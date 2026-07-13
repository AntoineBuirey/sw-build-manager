import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";

// import { Creation } from "../models/creation";
// import { CreationType } from "../models/creation_type";
// import { Usage } from "../models/creation_usage";
// import { Manufacturer } from "../models/manufacturer";
// import { Microcontroller } from "../models/microcontroller";
// import { Operator } from "../models/operator";
// import { Status } from "../models/status";
import { Creation, CreationType, Usage, Manufacturer, Microcontroller, Operator, Status } from "../models";
import { TYPE_MAP, USAGE_MAP } from "../utility/code_mapping";

type SqliteDatabase = Database<sqlite3.Database, sqlite3.Statement>;

interface ManufacturerRow {
    id: number;
    name: string;
    description: string;
    logo: string;
}

interface OperatorRow {
    id: number;
    name: string;
    description: string;
    logo: string;
}

interface CreationRow {
    id: number;
    name: string;
    code: string;
    description: string;
    workshop_link: string;
    type: number;
    usage: number;
    creation_date: number;
    status: number;
    last_update: number;
    manufacturer_id: number | null;
    manufacturer_name: string | null;
    manufacturer_description: string | null;
    manufacturer_logo: string | null;
    operator_id: number | null;
    operator_name: string | null;
    operator_description: string | null;
    operator_logo: string | null;
}

interface MicrocontrollerRow {
    id: number;
    name: string;
    description: string;
    workshop_link: string;
    creation_date: number;
    status: number;
    last_update: number;
}

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
        await this.migrateNullableCreationRelations();
    }

    async close(): Promise<void> {
        if (!this.db) {
            return;
        }

        await this.db.close();
        this.db = undefined;
    }

    async saveManufacturer(manufacturer: Manufacturer): Promise<number> {
        const db = this.requireDb();

        await db.run(
            `
            INSERT INTO manufacturers (name, description, logo)
            VALUES (?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                description = excluded.description,
                logo = excluded.logo
            `,
            manufacturer.name,
            manufacturer.description,
            manufacturer.logo,
        );

        const row = await db.get<{ id: number }>(
            "SELECT id FROM manufacturers WHERE name = ?",
            manufacturer.name,
        );

        if (!row) {
            throw new Error("Failed to persist manufacturer.");
        }

        return row.id;
    }

    async saveOperator(operator: Operator): Promise<number> {
        const db = this.requireDb();

        await db.run(
            `
            INSERT INTO operators (name, description, logo)
            VALUES (?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                description = excluded.description,
                logo = excluded.logo
            `,
            operator.name,
            operator.description,
            operator.logo,
        );

        const row = await db.get<{ id: number }>(
            "SELECT id FROM operators WHERE name = ?",
            operator.name,
        );

        if (!row) {
            throw new Error("Failed to persist operator.");
        }

        return row.id;
    }

    async saveCreation(creation: Creation): Promise<void> {
        const db = this.requireDb();

        if (!creation.code) {
            // create it as follow: letter for type + letter for usage + 4 digits incrementing at each creation of the same type and usage
            let codePrefix = TYPE_MAP[creation.type] + USAGE_MAP[creation.usage];

            // get the last code with the same prefix
            const lastCodeRow = await db.get<{ last_code: string | null }>(
                "SELECT code AS last_code FROM creations WHERE code LIKE ? ORDER BY code DESC LIMIT 1",
                codePrefix + "%",
            );

            let nextNumber = 1;
            if (lastCodeRow && lastCodeRow.last_code) {
                const lastNumber = parseInt(lastCodeRow.last_code.slice(-4), 10);
                nextNumber = lastNumber + 1;
            }

            creation.code = codePrefix + nextNumber.toString().padStart(4, "0");
        }

        await db.run(
            `
            INSERT INTO creations (
                name,
                code,
                description,
                workshop_link,
                manufacturer_id,
                operator_id,
                type,
                usage,
                creation_date,
                status,
                last_update
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(code) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                workshop_link = excluded.workshop_link,
                manufacturer_id = excluded.manufacturer_id,
                operator_id = excluded.operator_id,
                type = excluded.type,
                usage = excluded.usage,
                creation_date = excluded.creation_date,
                status = excluded.status,
                last_update = excluded.last_update
            `,
            creation.name,
            creation.code,
            creation.description,
            creation.workshop_link,
            creation.manufacturer ? creation.manufacturer.id : null,
            creation.operator ? creation.operator.id : null,
            creation.type,
            creation.usage,
            creation.creation_date.getTime(),
            SqliteStore.statusToInt(creation.status),
            creation.last_update.getTime(),
        );
    }

    async saveMicrocontroller(microcontroller: Microcontroller): Promise<void> {
        const db = this.requireDb();

        await db.run(
            `
            INSERT INTO microcontrollers (
                name,
                description,
                workshop_link,
                creation_date,
                status,
                last_update
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(workshop_link) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                creation_date = excluded.creation_date,
                status = excluded.status,
                last_update = excluded.last_update
            `,
            microcontroller.name,
            microcontroller.description,
            microcontroller.workshop_link,
            microcontroller.creation_date.getTime(),
            SqliteStore.statusToInt(microcontroller.status),
            microcontroller.last_update.getTime(),
        );
    }

    async getManufacturers(): Promise<Manufacturer[]> {
        const db = this.requireDb();
        const rows = await db.all<ManufacturerRow[]>(
            "SELECT id, name, description, logo FROM manufacturers ORDER BY name",
        );

        return rows.map((row) => new Manufacturer(row.id, row.name, row.description, row.logo));
    }

    async getOperators(): Promise<Operator[]> {
        const db = this.requireDb();
        const rows = await db.all<OperatorRow[]>(
            "SELECT id, name, description, logo FROM operators ORDER BY name",
        );

        return rows.map((row) => new Operator(row.id, row.name, row.description, row.logo));
    }

    async getCreations(): Promise<Creation[]> {
        const db = this.requireDb();
        const rows = await db.all<CreationRow[]>(
            `
            SELECT
                c.id,
                c.name,
                c.code,
                c.description,
                c.workshop_link,
                c.type,
                c.usage,
                c.creation_date,
                c.status,
                c.last_update,
                m.id AS manufacturer_id,
                m.name AS manufacturer_name,
                m.description AS manufacturer_description,
                m.logo AS manufacturer_logo,
                o.id AS operator_id,
                o.name AS operator_name,
                o.description AS operator_description,
                o.logo AS operator_logo
            FROM creations c
            LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
            LEFT JOIN operators o ON c.operator_id = o.id
            ORDER BY c.name
            `,
        );

        return rows.map((row) => {
            const manufacturer =
                row.manufacturer_id === null || row.manufacturer_name === null || row.manufacturer_description === null || row.manufacturer_logo === null
                    ? null
                    : new Manufacturer(
                          row.manufacturer_id,
                          row.manufacturer_name,
                          row.manufacturer_description,
                          row.manufacturer_logo,
                      );
            const operator =
                row.operator_id === null || row.operator_name === null || row.operator_description === null || row.operator_logo === null
                    ? null
                    : new Operator(
                          row.operator_id,
                          row.operator_name,
                          row.operator_description,
                          row.operator_logo,
                      );

            return new Creation(
                row.id,
                row.name,
                row.code,
                row.description,
                row.workshop_link,
                manufacturer,
                operator,
                row.type as CreationType,
                row.usage as Usage,
                new Date(row.creation_date),
                SqliteStore.intToStatus(row.status),
                new Date(row.last_update),
            );
        });
    }

    async getMicrocontrollers(): Promise<Microcontroller[]> {
        const db = this.requireDb();
        const rows = await db.all<MicrocontrollerRow[]>(
            `
            SELECT
                name,
                description,
                workshop_link,
                creation_date,
                status,
                last_update
            FROM microcontrollers
            ORDER BY name
            `,
        );

        return rows.map(
            (row) =>
                new Microcontroller(
                    row.id,
                    row.name,
                    row.description,
                    row.workshop_link,
                    new Date(row.creation_date),
                    SqliteStore.intToStatus(row.status),
                    new Date(row.last_update),
                ),
        );
    }

    private requireDb(): SqliteDatabase {
        if (!this.db) {
            throw new Error("SQLite connection not initialized. Call connect() first.");
        }

        return this.db;
    }

    private async initializeSchema(): Promise<void> {
        const db = this.requireDb();

        await db.exec(`
            CREATE TABLE IF NOT EXISTS manufacturers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL,
                logo TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS operators (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL,
                logo TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS creations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL,
                workshop_link TEXT NOT NULL,
                manufacturer_id INTEGER,
                operator_id INTEGER,
                type INTEGER NOT NULL,
                usage INTEGER NOT NULL,
                creation_date INTEGER NOT NULL,
                status INTEGER NOT NULL,
                last_update INTEGER NOT NULL,
                FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id) ON DELETE RESTRICT,
                FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE RESTRICT
            );

            CREATE TABLE IF NOT EXISTS microcontrollers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                workshop_link TEXT NOT NULL UNIQUE,
                creation_date INTEGER NOT NULL,
                status INTEGER NOT NULL,
                last_update INTEGER NOT NULL
            );
        `);
    }

    private async migrateNullableCreationRelations(): Promise<void> {
        const db = this.requireDb();
        const columns = await db.all<{ name: string; notnull: number }[]>("PRAGMA table_info(creations);");

        const manufacturerColumn = columns.find((column) => column.name === "manufacturer_id");
        const operatorColumn = columns.find((column) => column.name === "operator_id");

        if (!manufacturerColumn || !operatorColumn || (manufacturerColumn.notnull === 0 && operatorColumn.notnull === 0)) {
            return;
        }

        await db.exec("PRAGMA foreign_keys = OFF;");
        await db.exec(`
            BEGIN TRANSACTION;
            ALTER TABLE creations RENAME TO creations_old;

            CREATE TABLE creations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL,
                workshop_link TEXT NOT NULL,
                manufacturer_id INTEGER,
                operator_id INTEGER,
                type INTEGER NOT NULL,
                usage INTEGER NOT NULL,
                creation_date INTEGER NOT NULL,
                status INTEGER NOT NULL,
                last_update INTEGER NOT NULL,
                FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id) ON DELETE RESTRICT,
                FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE RESTRICT
            );

            INSERT INTO creations (
                id,
                name,
                code,
                description,
                workshop_link,
                manufacturer_id,
                operator_id,
                type,
                usage,
                creation_date,
                status,
                last_update
            )
            SELECT
                id,
                name,
                code,
                description,
                workshop_link,
                manufacturer_id,
                operator_id,
                type,
                usage,
                creation_date,
                status,
                last_update
            FROM creations_old;

            DROP TABLE creations_old;
            COMMIT;
        `);
        await db.exec("PRAGMA foreign_keys = ON;");
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
}
