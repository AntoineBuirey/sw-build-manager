import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";

import { BaseApp } from "./base_app";
import { logRequest, requireAuth } from "./middlewares";

import { get_uptime, Environment, hashPassword, DateTime, parseDateTimeSafe, rootDirectory } from "./utility/utils";
import { logger } from './utility/logger';
import { version } from "./utility/package";
import { ValueError } from "./utility/exceptions";
import { SqliteStore } from "./database/sqlite_store";

declare module 'express-session' {
    interface SessionData {
        user: { email: string, id: number };
    }
}

/**
 * This class implements the main application logic, including route handling and middleware setup.
 */
export class App extends BaseApp {
    private public_dir: string;
    private store: SqliteStore;

    constructor(sslOptions: any, port: number, environment: Environment, public_dir: string) {
        super(sslOptions, port, environment);
        this.public_dir = public_dir;
        const dataDir = path.join(rootDirectory, "data");
        fs.mkdirSync(dataDir, { recursive: true });
        this.store = new SqliteStore(path.join(dataDir, "sw-build-manager.sqlite"));

        this.configure();
    }

    public async openStore(): Promise<void> {
        await this.store.connect();
        logger.info("SQLite store connected");
    }

    public async closeStore(): Promise<void> {
        await this.store.close();
        logger.info("SQLite store closed");
    }

    public getStore(): SqliteStore {
        return this.store;
    }

    public setupMiddlewares(): void {
        logger.debug('Setting up middlewares');

        this.app.use(logRequest);                               // Custom middleware to log incoming requests
        this.app.use(express.static(this.public_dir));          // Serve static files from the specified public directory
        this.app.use(express.json());                           // Middleware to parse JSON request bodies
        this.app.use(express.urlencoded({ extended: true }));   // Middleware to parse URL-encoded request bodies
    }

    public setupRoutes(): void {
        logger.debug('Setting up routes');
        this.app.get('/api/v1/info', this.onGetInfo.bind(this));
    }


    /**
     * Handle GET requests to /api/v1/info endpoint
     */
    private onGetInfo(req: Request, res: Response): void {
        let response: any = {
            request: {
                method: req.method,
                url: req.url,
                headers: req.headers
            },
            message: 'sw-build-manager-server HTTPS Server is running',
            server_info: {
                uptime: get_uptime(),
                timestamp: new Date().toISOString(),
                port: this.port,
                environment: this.environment,
                node_version: process.version,
                version: version
            }
        };

        if (req.session && req.session.user) {
            response['user'] = req.session.user;
        }

        res.json(response);
    }

}
