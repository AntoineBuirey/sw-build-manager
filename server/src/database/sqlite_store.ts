import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";

import { Creation } from "../models/creation";
import { CreationType } from "../models/creation_type";
import { Usage } from "../models/creation_usage";
import { Manufacturer } from "../models/manufacturer";
import { Microcontroller } from "../models/microcontroller";
import { Operator } from "../models/operator";
import { Status } from "../models/status";

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
    name: string;
    code: string;
    description: string;
    workshop_link: string;
    type: number;
    usage: number;
    creation_date: number;
    status: number;
    last_update: number;
    manufacturer_name: string;
    manufacturer_description: string;
    manufacturer_logo: string;
    operator_name: string;
    operator_description: string;
    operator_logo: string;
}

interface MicrocontrollerRow {
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

        const manufacturerId = await this.saveManufacturer(creation.manufacturer);
        const operatorId = await this.saveOperator(creation.operator);

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
            manufacturerId,
            operatorId,
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

        return rows.map((row) => new Manufacturer(row.name, row.description, row.logo));
    }

    async getOperators(): Promise<Operator[]> {
        const db = this.requireDb();
        const rows = await db.all<OperatorRow[]>(
            "SELECT id, name, description, logo FROM operators ORDER BY name",
        );

        return rows.map((row) => new Operator(row.name, row.description, row.logo));
    }

    async getCreations(): Promise<Creation[]> {
        const db = this.requireDb();
        const rows = await db.all<CreationRow[]>(
            `
            SELECT
                c.name,
                c.code,
                c.description,
                c.workshop_link,
                c.type,
                c.usage,
                c.creation_date,
                c.status,
                c.last_update,
                m.name AS manufacturer_name,
                m.description AS manufacturer_description,
                m.logo AS manufacturer_logo,
                o.name AS operator_name,
                o.description AS operator_description,
                o.logo AS operator_logo
            FROM creations c
            INNER JOIN manufacturers m ON c.manufacturer_id = m.id
            INNER JOIN operators o ON c.operator_id = o.id
            ORDER BY c.name
            `,
        );

        return rows.map((row) => {
            const manufacturer = new Manufacturer(
                row.manufacturer_name,
                row.manufacturer_description,
                row.manufacturer_logo,
            );
            const operator = new Operator(
                row.operator_name,
                row.operator_description,
                row.operator_logo,
            );

            return new Creation(
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
                manufacturer_id INTEGER NOT NULL,
                operator_id INTEGER NOT NULL,
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
