import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import fs from "fs";
import crypto from "crypto";

import {
    Creation, CreationCode, CreationLite, CreationId,
    CreationType, Usage, Status,
    Manufacturer, ManufacturerId,
    Microcontroller, MicrocontrollerId,
    Operator, OperatorId,
    UserName, User,
    Token, TokenId
} from "../models";
import { logger } from "../utility/logger";

import { DbStore } from "./db_store";

type SqliteDatabase = Database<sqlite3.Database, sqlite3.Statement>;


export class SqliteStore implements DbStore {
    private dbPath: string;
    private db?: SqliteDatabase;
    private debug_mode: boolean;
    private tokenCleanupInterval: NodeJS.Timeout | null = null;

    constructor(dbPath: string, debug_mode: boolean = false) {
        this.dbPath = dbPath;
        this.debug_mode = debug_mode;
    }

    public async connect(): Promise<void> {
        if (this.db) {
            return;
        }

        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database,
        });

        await this.db.exec("PRAGMA foreign_keys = ON;");
        await this.initializeSchema();

        // auto-delete expired auth tokens every minute
        const cleanupInterval = 60 * 1000; // 1 minute in milliseconds

        const deleteExpiredTokens = async () => {
            try {
                await this.deleteExpiredAuthTokens();
                logger.debug("Expired auth tokens deleted successfully. Next run at: " + new Date(Date.now() + cleanupInterval).toISOString());
            } catch (error) {
                logger.error(`Error deleting expired auth tokens: ${error}. Next run at: ` + new Date(Date.now() + cleanupInterval).toISOString());
            }
        };

        this.tokenCleanupInterval = setInterval(deleteExpiredTokens, cleanupInterval);
        deleteExpiredTokens(); // Run immediately on startup
    }

    public async close(): Promise<void> {
        if (!this.db) {
            return;
        }

        if (this.tokenCleanupInterval) {
            clearInterval(this.tokenCleanupInterval);
            this.tokenCleanupInterval = null;
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
        let initSql = fs.readFileSync(`${initSqlPath}/init.sql`, "utf-8");
        let initDebugSql = "";

        if (this.debug_mode) {
            if (fs.existsSync(`${initSqlPath}/init_debug.sql`)) {
                logger.debug(`Loading SQL debug schema from ${initSqlPath}/init_debug.sql`);
                initDebugSql = fs.readFileSync(`${initSqlPath}/init_debug.sql`, "utf-8");
            } else {
                logger.warn(`Debug mode is enabled, but ${initSqlPath}/init_debug.sql does not exist.`);
            }
        }

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
            logger.debug("Database schema initialized");
            if (this.debug_mode && initDebugSql) {
                logger.debug("Applying debug SQL schema");
                await db.exec(initDebugSql);
                logger.debug("Debug SQL schema applied");
            }
        } else if (row.hash !== currentHash) {
            // hash has changed, reinitialize the schema
            logger.warn("Schema version has changed. You may need to migrate your database. Renaming the existing database and creating a new one.");
            const backupPath = `${this.dbPath}.backup.${Date.now()}`;
            await this.close();
            fs.renameSync(this.dbPath, backupPath);
            logger.info(`Existing database renamed to ${backupPath}`);

            this.db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database,
            });

            await this.db.exec("PRAGMA foreign_keys = ON;");
            const db = this.requireDb();

            await db.exec(initSql);
            await db.run("UPDATE schema_version SET hash = ? WHERE id = 1", [currentHash]);
            logger.info("Database schema reinitialized with new version");

            if (this.debug_mode && initDebugSql) {
                logger.debug("Applying debug SQL schema");
                await db.exec(initDebugSql);
                logger.debug("Debug SQL schema applied");
            }
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

    public async deleteCreation(code: CreationCode): Promise<void> {
        const db = this.requireDb();

        const query = `
            DELETE FROM creations WHERE code = ?
        `;

        await db.run(query, [code]);
    }



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

    public async deleteManufacturer(id: ManufacturerId): Promise<void> {
        const db = this.requireDb();

        const query = `
            DELETE FROM manufacturers WHERE id = ?
        `;

        await db.run(query, [id]);
    }



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

    public async deleteMicrocontroller(id: MicrocontrollerId): Promise<void> {
        const db = this.requireDb();

        const query = `
            DELETE FROM microcontrollers WHERE id = ?
        `;

        await db.run(query, [id]);
    }



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

    public async deleteOperator(id: OperatorId): Promise<void> {
        const db = this.requireDb();

        const query = `
            DELETE FROM operators WHERE id = ?
        `;

        await db.run(query, [id]);
    }



    public async createUser(user: User): Promise<void> {
        const db = this.requireDb();

        const query = `
            INSERT INTO users (username, password)
            VALUES (?, ?)
        `;

        await db.run(query, [
            user.name,
            user.hashed_password
        ]);
    }

    public async getUser(username: UserName): Promise<User | null> {
        const db = this.requireDb();

        const query = `
            SELECT * FROM users WHERE username = ?
        `;

        const row = await db.get(query, [username]);

        if (!row) {
            return null;
        }

        return new User(
            row.username,
            row.password
        );
    }

    public async getAllUsers(): Promise<User[]> {
        const db = this.requireDb();

        const query = `
            SELECT * FROM users
        `;

        const rows = await db.all(query);

        return rows.map((row) => new User(
            row.username,
            row.password
        ));
    }

    public async deleteUser(username: UserName): Promise<void> {
        const db = this.requireDb();

        const query = `
            DELETE FROM users WHERE username = ?
        `;

        await db.run(query, [username]);
    }

    public async updateUserPassword(username: UserName, newPassword: string): Promise<void> {
        const db = this.requireDb();

        const query = `
            UPDATE users
            SET password = ?
            WHERE username = ?
        `;

        await db.run(query, [newPassword, username]);
    }

    public async userExists(username: UserName): Promise<boolean> {
        const db = this.requireDb();

        const query = `
            SELECT 1 FROM users WHERE username = ?
        `;

        const row = await db.get(query, [username]);

        return !!row;
    }


    public async getUserByAuthToken(authToken: string): Promise<User | null> {
        const db = this.requireDb();

        const query = `
            SELECT u.username, u.password
            FROM users u
            JOIN auth_tokens t ON u.username = t.username
            WHERE t.token = ? AND t.expiration_date > ?
        `;

        const row = await db.get(query, [authToken, Date.now()]);

        if (!row) {
            return null;
        }

        return new User(
            row.username,
            row.password
        );
    }

    public async createAuthToken(token: Token): Promise<void> {
        const db = this.requireDb();

        const query = `
            INSERT INTO auth_tokens (username, token, expiration_date)
            VALUES (?, ?, ?)
        `;

        await db.run(query, [
            token.username,
            token.token,
            token.expiration_date.getTime()
        ]);
    }

    public async deleteAuthToken(authToken: string): Promise<void> {
        const db = this.requireDb();

        const query = `
            DELETE FROM auth_tokens WHERE token = ?
        `;

        await db.run(query, [authToken]);
    }

    public async deleteExpiredAuthTokens(): Promise<void> {
        const db = this.requireDb();

        const query = `
            DELETE FROM auth_tokens WHERE expiration_date <= ?
        `;

        await db.run(query, [Date.now()]);
    }

    public async isAuthTokenValid(authToken: string): Promise<boolean> {
        const db = this.requireDb();

        const query = `
            SELECT 1 FROM auth_tokens WHERE token = ? AND expiration_date > ?
        `;

        const row = await db.get(query, [authToken, Date.now()]);

        return !!row;
    }
}
