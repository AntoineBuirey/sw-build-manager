import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import fs from "fs";
import crypto from "crypto";

import {
    Creation, CreationCode, CreationLite, CreationId,
    CreationType, Usage, Status,
    Manufacturer, ManufacturerId,
    Microcontroller, MicrocontrollerId,
    Operator, OperatorId
} from "../models";
import { logger } from "../utility/logger";



type SqliteDatabase = Database<sqlite3.Database, sqlite3.Statement>;


export class SqliteStore {
    private dbPath: string;
    private db?: SqliteDatabase;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    async connect(): Promise<void> {
        if (this.db) {
            return;
        }

        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database,
        });

        await this.db.exec("PRAGMA foreign_keys = ON;");
        await this.initializeSchema();
    }

    async close(): Promise<void> {
        if (!this.db) {
            return;
        }

        await this.db.close();
        this.db = undefined;
    }

    private requireDb(): SqliteDatabase {
        if (!this.db) {
            throw new Error("SQLite connection not initialized. Call connect() first.");
        }

        return this.db;
    }

    private computeHash(content: string): string {
        return crypto.createHash("sha256").update(content).digest("hex");
    }

    private async initializeSchema(): Promise<void> {
        const db = this.requireDb();

        // load from init.sql file
        const initSqlPath = __dirname;
        logger.debug(`Loading SQL schema from ${initSqlPath}/init.sql`);
        const initSql = fs.readFileSync(`${initSqlPath}/init.sql`, "utf-8");

        // create a table to track the hash of the init.sql file
        await db.exec(`
            CREATE TABLE IF NOT EXISTS schema_version (
                id INTEGER PRIMARY KEY,
                hash TEXT NOT NULL
            );
        `);

        // check if the hash of the init.sql file has changed
        const currentHash = this.computeHash(initSql);
        const row = await db.get("SELECT hash FROM schema_version WHERE id = 1");
        if (!row) {
            // first time, insert the hash
            logger.debug("Initializing database schema for the first time");
            await db.run("INSERT INTO schema_version (id, hash) VALUES (1, ?)", [currentHash]);
            await db.exec(initSql);
        } else if (row.hash !== currentHash) {
            // hash has changed, reinitialize the schema
            logger.warn("Schema version has changed. You may need to migrate your database. Renaming the existing database and creating a new one.");
            const backupPath = `${this.dbPath}.backup.${Date.now()}`;
            await this.close();
            fs.renameSync(this.dbPath, backupPath);
            logger.info(`Existing database renamed to ${backupPath}`);

            await this.connect();
            const db = this.requireDb();
            await db.exec(initSql);
            await db.run("UPDATE schema_version SET hash = ? WHERE id = 1", [currentHash]);
        } else {
            logger.debug("Schema version is up to date");
        }
    }

    private static statusToInt(status: Status): number {
        switch (status) {
            case Status.DEVELOPMENT:
                return 0;
            case Status.PUBLISHED:
                return 1;
            case Status.DEPRECATED:
                return 2;
            case Status.ARCHIVED:
                return 3;
            default:
                return 0;
        }
    }

    private static intToStatus(value: number): Status {
        switch (value) {
            case 0:
                return Status.DEVELOPMENT;
            case 1:
                return Status.PUBLISHED;
            case 2:
                return Status.DEPRECATED;
            case 3:
                return Status.ARCHIVED;
            default:
                return Status.DEVELOPMENT;
        }
    }



    /**
     * Creates a new creation in the database. Fail if a creation with the same code already exists. Return the id of the newly created creation.
     * @param creation The creation to create.
     * @returns The code of the newly created creation.
     * @throws Error if a creation with the same code already exists.
     */
    public async createCreation(creation: Creation): Promise<CreationId> {
        const db = this.requireDb();

        const query = `
            INSERT INTO creations (name, code, description, workshop_link, manufacturer_id, operator_id, type, usage, creation_date, status, last_update)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.run(query, [
            creation.name,
            creation.code,
            creation.description,
            creation.workshop_link,
            creation.manufacturer,
            creation.operator,
            creation.type,
            creation.usage,
            creation.creation_date.getTime(),
            SqliteStore.statusToInt(creation.status),
            creation.last_update.getTime(),
        ]);

        const row = await db.get("SELECT last_insert_rowid() as id");
        return row.id as CreationId;
    }

    /**
     * Retrieves a creation from the database by its code. Returns null if no creation with the given code exists.
     * @param code The code of the creation to retrieve.
     * @returns The creation with the given code, or null if no such creation exists.
     */
    public async getCreation(code_or_id: CreationCode | CreationId): Promise<Creation | null> {
        const db = this.requireDb();

        const query = `
            SELECT * FROM creations WHERE code = ? OR id = ?
        `;

        const row = await db.get(query, [code_or_id, code_or_id]);

        if (!row) {
            return null;
        }

        return new Creation(
            row.id,
            row.code,
            row.name,
            row.description,
            row.workshop_link,
            row.manufacturer_id,
            row.operator_id,
            row.type,
            row.usage,
            new Date(row.creation_date),
            SqliteStore.intToStatus(row.status),
            new Date(row.last_update)
        );
    }

    /**
     * Retrieves all creations from the database. Returns an array of CreationLite objects, which contain only the code, name, type, usage, last_update, and status of each creation.
     * @returns An array of CreationLite objects representing all creations in the database.
     * @throws Error if there is an issue retrieving the creations from the database.
     */
    public async getAllCreations(): Promise<CreationLite[]> {
        const db = this.requireDb();

        const query = `
            SELECT id, code, name, type, usage, last_update, status FROM creations
        `;

        const rows = await db.all(query);

        return rows.map((row) => new CreationLite(
            row.id,
            row.code,
            row.name,
            row.type,
            row.usage,
            new Date(row.last_update),
            SqliteStore.intToStatus(row.status)
        ));
    }

    /**
     * Updates an existing creation in the database. The creation is identified by its code. If no creation with the given code exists, an error is thrown.
     * @param creation The creation to update.
     * @throws Error if no creation with the given code exists.
     * @throws Error if there is an issue updating the creation in the database.
     */
    public async updateCreation(creation: Creation): Promise<void> {
        const db = this.requireDb();

        const query = `
            UPDATE creations
            SET name = ?, description = ?, workshop_link = ?, manufacturer_id = ?, operator_id = ?, type = ?, usage = ?, creation_date = ?, status = ?, last_update = ?
            WHERE code = ?
        `;

        await db.run(query, [
            creation.name,
            creation.description,
            creation.workshop_link,
            creation.manufacturer,
            creation.operator,
            creation.type,
            creation.usage,
            creation.creation_date.getTime(),
            SqliteStore.statusToInt(creation.status),
            creation.last_update.getTime(),
            creation.code
        ]);
    }

    /**
     * Deletes a creation from the database by its code. If no creation with the given code exists, an error is thrown.
     * @param code The code of the creation to delete.
     * @throws Error if no creation with the given code exists.
     * @throws Error if there is an issue deleting the creation from the database.
     */
    public async deleteCreation(code: CreationCode): Promise<void> {
        const db = this.requireDb();

        const query = `
            DELETE FROM creations WHERE code = ?
        `;

        await db.run(query, [code]);
    }

    /**
     * Creates a new manufacturer in the database. Returns the ID of the newly created manufacturer.
     * @param manufacturer The manufacturer to create.
     * @returns The ID of the newly created manufacturer.
     * @throws Error if there is an issue creating the manufacturer in the database.
     */
    public async createManufacturer(manufacturer: Manufacturer): Promise<ManufacturerId> {
        const db = this.requireDb();

        const query = `
            INSERT INTO manufacturers (name, description, logo)
            VALUES (?, ?, ?)
        `;

        const result = await db.run(query, [
            manufacturer.name,
            manufacturer.description,
            manufacturer.logo
        ]);

        return result.lastID as ManufacturerId;
    }

    /**
     * Retrieves a manufacturer from the database by its ID. Returns null if no manufacturer with the given ID exists.
     * @param id The ID of the manufacturer to retrieve.
     * @returns The manufacturer with the given ID, or null if no such manufacturer exists.
     */
    public async getManufacturer(id: ManufacturerId): Promise<Manufacturer | null> {
        const db = this.requireDb();

        const query = `
            SELECT * FROM manufacturers WHERE id = ?
        `;

        const row = await db.get(query, [id]);

        if (!row) {
            return null;
        }

        return new Manufacturer(
            row.id,
            row.name,
            row.description,
            row.logo
        );
    }

    /**
     * Retrieves all manufacturers from the database. Returns an array of Manufacturer objects.
     * @returns An array of Manufacturer objects representing all manufacturers in the database.
     * @throws Error if there is an issue retrieving the manufacturers from the database.
     */
    public async getAllManufacturers(): Promise<Manufacturer[]> {
        const db = this.requireDb();

        const query = `
            SELECT * FROM manufacturers
        `;

        const rows = await db.all(query);

        return rows.map((row) => new Manufacturer(
            row.id,
            row.name,
            row.description,
            row.logo
        ));
    }

    /**
     * Updates an existing manufacturer in the database. The manufacturer is identified by its ID. If no manufacturer with the given ID exists, an error is thrown.
     * @param manufacturer The manufacturer to update.
     * @throws Error if no manufacturer with the given ID exists.
     * @throws Error if there is an issue updating the manufacturer in the database.
     */
    public async updateManufacturer(manufacturer: Manufacturer): Promise<void> {
        const db = this.requireDb();

        const query = `
            UPDATE manufacturers
            SET name = ?, description = ?, logo = ?
            WHERE id = ?
        `;

        await db.run(query, [
            manufacturer.name,
            manufacturer.description,
            manufacturer.logo,
            manufacturer.id
        ]);
    }

    /**
     * Deletes a manufacturer from the database by its ID. If no manufacturer with the given ID exists, an error is thrown.
     * @param id The ID of the manufacturer to delete.
     * @throws Error if no manufacturer with the given ID exists.
     * @throws Error if there is an issue deleting the manufacturer from the database.
     */
    public async deleteManufacturer(id: ManufacturerId): Promise<void> {
        const db = this.requireDb();

        const query = `
            DELETE FROM manufacturers WHERE id = ?
        `;

        await db.run(query, [id]);
    }


    /**
     * Creates a new microcontroller in the database. Returns the ID of the newly created microcontroller.
     * @param microcontroller The microcontroller to create.
     * @returns The ID of the newly created microcontroller.
     * @throws Error if there is an issue creating the microcontroller in the database.
     */
    public async createMicrocontroller(microcontroller: Microcontroller): Promise<MicrocontrollerId> {
        const db = this.requireDb();

        const query = `
            INSERT INTO microcontrollers (name, description, workshop_link, creation_date, status, last_update)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const result = await db.run(query, [
            microcontroller.name,
            microcontroller.description,
            microcontroller.workshop_link,
            microcontroller.creation_date.getTime(),
            SqliteStore.statusToInt(microcontroller.status),
            microcontroller.last_update.getTime()
        ]);

        return result.lastID as MicrocontrollerId;
    }

    /**
     * Retrieves a microcontroller from the database by its ID. Returns null if no microcontroller with the given ID exists.
     * @param id The ID of the microcontroller to retrieve.
     * @returns The microcontroller with the given ID, or null if no such microcontroller exists.
     */
    public async getMicrocontroller(id: MicrocontrollerId): Promise<Microcontroller | null> {
        const db = this.requireDb();

        const query = `
            SELECT * FROM microcontrollers WHERE id = ?
        `;

        const row = await db.get(query, [id]);

        if (!row) {
            return null;
        }

        return new Microcontroller(
            row.id,
            row.name,
            row.description,
            row.workshop_link,
            new Date(row.creation_date),
            SqliteStore.intToStatus(row.status),
            new Date(row.last_update)
        );
    }

    /**
     * Retrieves all microcontrollers from the database. Returns an array of Microcontroller objects.
     * @returns An array of Microcontroller objects representing all microcontrollers in the database.
     * @throws Error if there is an issue retrieving the microcontrollers from the database.
     */
    public async getAllMicrocontrollers(): Promise<Microcontroller[]> {
        const db = this.requireDb();

        const query = `
            SELECT * FROM microcontrollers
        `;

        const rows = await db.all(query);

        return rows.map((row) => new Microcontroller(
            row.id,
            row.name,
            row.description,
            row.workshop_link,
            new Date(row.creation_date),
            SqliteStore.intToStatus(row.status),
            new Date(row.last_update)
        ));
    }

    /**
     * Updates an existing microcontroller in the database. The microcontroller is identified by its ID. If no microcontroller with the given ID exists, an error is thrown.
     * @param microcontroller The microcontroller to update.
     * @throws Error if no microcontroller with the given ID exists.
     * @throws Error if there is an issue updating the microcontroller in the database.
     */
    public async updateMicrocontroller(microcontroller: Microcontroller): Promise<void> {
        const db = this.requireDb();

        const query = `
            UPDATE microcontrollers
            SET name = ?, description = ?, workshop_link = ?, creation_date = ?, status = ?, last_update = ?
            WHERE id = ?
        `;

        await db.run(query, [
            microcontroller.name,
            microcontroller.description,
            microcontroller.workshop_link,
            microcontroller.creation_date.getTime(),
            SqliteStore.statusToInt(microcontroller.status),
            microcontroller.last_update.getTime(),
            microcontroller.id
        ]);
    }

    /**
     * Deletes a microcontroller from the database by its ID. If no microcontroller with the given ID exists, an error is thrown.
     * @param id The ID of the microcontroller to delete.
     * @throws Error if no microcontroller with the given ID exists.
     * @throws Error if there is an issue deleting the microcontroller from the database.
     */
    public async deleteMicrocontroller(id: MicrocontrollerId): Promise<void> {
        const db = this.requireDb();

        const query = `
            DELETE FROM microcontrollers WHERE id = ?
        `;

        await db.run(query, [id]);
    }


    /**
     * Creates a new operator in the database. Returns the ID of the newly created operator.
     * @param operator The operator to create.
     * @returns The ID of the newly created operator.
     * @throws Error if there is an issue creating the operator in the database.
     */
    public async createOperator(operator: Operator): Promise<OperatorId> {
        const db = this.requireDb();

        const query = `
            INSERT INTO operators (name, description, logo)
            VALUES (?, ?, ?)
        `;

        const result = await db.run(query, [
            operator.name,
            operator.description,
            operator.logo
        ]);

        return result.lastID as OperatorId;
    }

    /**
     * Retrieves an operator from the database by its ID. Returns null if no operator with the given ID exists.
     * @param id The ID of the operator to retrieve.
     * @returns The operator with the given ID, or null if no such operator exists.
     */
    public async getOperator(id: OperatorId): Promise<Operator | null> {
        const db = this.requireDb();

        const query = `
            SELECT * FROM operators WHERE id = ?
        `;

        const row = await db.get(query, [id]);

        if (!row) {
            return null;
        }

        return new Operator(
            row.id,
            row.name,
            row.description,
            row.logo
        );
    }

    /**
     * Retrieves all operators from the database. Returns an array of Operator objects.
     * @returns An array of Operator objects representing all operators in the database.
     * @throws Error if there is an issue retrieving the operators from the database.
     */
    public async getAllOperators(): Promise<Operator[]> {
        const db = this.requireDb();

        const query = `
            SELECT * FROM operators
        `;

        const rows = await db.all(query);

        return rows.map((row) => new Operator(
            row.id,
            row.name,
            row.description,
            row.logo
        ));
    }

    /**
     * Updates an existing operator in the database. The operator is identified by its ID. If no operator with the given ID exists, an error is thrown.
     * @param operator The operator to update.
     * @throws Error if no operator with the given ID exists.
     * @throws Error if there is an issue updating the operator in the database.
     */
    public async updateOperator(operator: Operator): Promise<void> {
        const db = this.requireDb();

        const query = `
            UPDATE operators
            SET name = ?, description = ?, logo = ?
            WHERE id = ?
        `;

        await db.run(query, [
            operator.name,
            operator.description,
            operator.logo,
            operator.id
        ]);
    }

    /**
     * Deletes an operator from the database by its ID. If no operator with the given ID exists, an error is thrown.
     * @param id The ID of the operator to delete.
     * @throws Error if no operator with the given ID exists.
     * @throws Error if there is an issue deleting the operator from the database.
     */
    public async deleteOperator(id: OperatorId): Promise<void> {
        const db = this.requireDb();

        const query = `
            DELETE FROM operators WHERE id = ?
        `;

        await db.run(query, [id]);
    }
}
