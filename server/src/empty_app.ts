import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";

import { BaseApp } from "./base_app";
import { logRequest, createAuthMiddleware } from "./middlewares";
import { environConfig } from './environ';

import { get_uptime, Environment, rootDirectory, Pascal2SnakeCase } from "./utility/utils";
import { logger } from './utility/logger';
import { version } from "./utility/package";
import { SqliteStore } from "./database/sqlite_store";


const API_PREFIX = '/api/v1';

declare module 'express-session' {
    interface SessionData {
        user: { email: string, id: number };
    }
}

type HandlerFunction = (req: Request, res: Response, next: express.NextFunction) => void;
type ExpressRegisterMethod = (path: string, ...handlers: HandlerFunction[]) => void;
type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * This class extends the BaseApp class and provides a basic implementation of an Express application with predefined routes and middlewares.
 * It is designed to be extended by a child class that implements the abstract methods for handling specific API endpoints.
 */
export abstract class EmptyApp extends BaseApp {
    protected public_dir: string;
    protected store: SqliteStore;
    protected routes: { method: HTTPMethod, path: string, need_auth: boolean}[] = [];
    protected authMiddleware: HandlerFunction;

    constructor(sslOptions: any, port: number, environment: Environment, public_dir: string) {
        super(sslOptions, port, environment);
        this.public_dir = public_dir;
        const dataDir = path.join(rootDirectory, "data");
        fs.mkdirSync(dataDir, { recursive: true });
        this.store = new SqliteStore(path.join(dataDir, "sw-build-manager.sqlite"), this.environment === Environment.Development);

        this.authMiddleware = createAuthMiddleware(this.store);

        this.configure();
    }

    protected async onStart(): Promise<void> {
        await this.store.connect();
        logger.info("SQLite store connected");
    }

    protected async onStop(): Promise<void> {
        await this.store.close();
        logger.info("SQLite store closed");
    }

    protected setupMiddlewares(): void {
        logger.debug('Setting up middlewares');

        this.app.use(logRequest);                               // Custom middleware to log incoming requests
        this.app.use(express.json());                           // Middleware to parse JSON request bodies
        this.app.use(express.urlencoded({ extended: true }));   // Middleware to parse URL-encoded request bodies
    }


    private registerRoute(
        handler: (req: Request, res: Response) => void,
        { path, method, args, need_auth }: { path?: string, method?: HTTPMethod, args?: string[], need_auth?: boolean } = {}
    ): void {
        const handlerName = handler.name;
        const match = handlerName.match(/^on(Get|Post|Put|Delete)([A-Z][a-zA-Z0-9]*)$/);
        if (!match) {
            throw new Error(`Handler function name "${handlerName}" does not follow the expected pattern "on[Method][Path]"`);
        }

        if (!method) {
            method = match[1].toUpperCase() as HTTPMethod;
        }

        if (!path) {
            path = '/' + Pascal2SnakeCase(match[2]).replace(/_/g, '/');
        }

        // Prepend the API prefix to the path if it doesn't already start with it
        if (!path.startsWith(API_PREFIX)) {
            path = API_PREFIX + path;
        }

        if (args && args.length > 0) {
            const argsPattern = args.map(arg => `:${arg}`).join('/');
            path = `${path}/${argsPattern}`;
        }

        if (need_auth === undefined) {
            // Default to true
            need_auth = true;
        }


        logger.debug(`Registering route: ${method} ${path}`);
        let expressMethod : ExpressRegisterMethod = (this.app as any)[method.toLowerCase()];
        expressMethod = expressMethod.bind(this.app);

        if (need_auth) {
            expressMethod(path, this.authMiddleware.bind(this), handler.bind(this));
        }
        else{
            expressMethod(path, handler.bind(this));
        }
        this.routes.push({ method, path, need_auth });
    }

    protected setupRoutes(): void {
        logger.debug('Setting up routes');

        this.registerRoute(this.onGetRoot, {path: API_PREFIX, need_auth: false});
        this.registerRoute(this.onGetInfo, {need_auth: false});

        this.registerRoute(this.onGetCreationTypes);
        this.registerRoute(this.onGetCreationUsages);
        this.registerRoute(this.onGetStatuses);

        this.registerRoute(this.onGetCreations);
        this.registerRoute(this.onGetCreation, {args: ['code']});
        this.registerRoute(this.onPostCreation);
        this.registerRoute(this.onPutCreation, {args: ['code']});
        this.registerRoute(this.onDeleteCreation, {args: ['code']});

        this.registerRoute(this.onGetManufacturers);
        this.registerRoute(this.onGetManufacturer, {args: ['id']});
        this.registerRoute(this.onPostManufacturer);
        this.registerRoute(this.onPutManufacturer, {args: ['id']});
        this.registerRoute(this.onDeleteManufacturer, {args: ['id']});

        this.registerRoute(this.onGetOperators);
        this.registerRoute(this.onGetOperator, {args: ['id']});
        this.registerRoute(this.onPostOperator);
        this.registerRoute(this.onPutOperator, {args: ['id']});
        this.registerRoute(this.onDeleteOperator, {args: ['id']});

        this.registerRoute(this.onGetMicrocontrollers);
        this.registerRoute(this.onGetMicrocontroller, {args: ['id']});
        this.registerRoute(this.onPostMicrocontroller);
        this.registerRoute(this.onPutMicrocontroller, {args: ['id']});
        this.registerRoute(this.onDeleteMicrocontroller, {args: ['id']});

        this.registerRoute(this.onPostLogin, {need_auth: false});
        this.registerRoute(this.onPostLogout);
        if (environConfig.allowRegistration) {
            this.registerRoute(this.onPostRegister, {need_auth: false});
        }
        else{
            logger.info('User registration is disabled. The /api/v1/register endpoint will not be available.');
        }
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
        res.json(response);
    }

    private onGetRoot(_: Request, res: Response): void {
        res.json(this.routes );
    }

    protected abstract onGetCreationTypes(req: Request, res: Response): void;
    protected abstract onGetCreationUsages(req: Request, res: Response): void;
    protected abstract onGetStatuses(req: Request, res: Response): void;

    protected abstract onGetCreations(req: Request, res: Response): void;
    protected abstract onGetCreation(req: Request, res: Response): void;
    protected abstract onPostCreation(req: Request, res: Response): void;
    protected abstract onPutCreation(req: Request, res: Response): void;
    protected abstract onDeleteCreation(req: Request, res: Response): void;

    protected abstract onGetManufacturers(req: Request, res: Response): void;
    protected abstract onGetManufacturer(req: Request, res: Response): void;
    protected abstract onPostManufacturer(req: Request, res: Response): void;
    protected abstract onPutManufacturer(req: Request, res: Response): void;
    protected abstract onDeleteManufacturer(req: Request, res: Response): void;

    protected abstract onGetOperators(req: Request, res: Response): void;
    protected abstract onGetOperator(req: Request, res: Response): void;
    protected abstract onPostOperator(req: Request, res: Response): void;
    protected abstract onPutOperator(req: Request, res: Response): void;
    protected abstract onDeleteOperator(req: Request, res: Response): void;

    protected abstract onGetMicrocontrollers(req: Request, res: Response): void;
    protected abstract onGetMicrocontroller(req: Request, res: Response): void;
    protected abstract onPostMicrocontroller(req: Request, res: Response): void;
    protected abstract onPutMicrocontroller(req: Request, res: Response): void;
    protected abstract onDeleteMicrocontroller(req: Request, res: Response): void;

    protected abstract onPostLogin(req: Request, res: Response): void;
    protected abstract onPostLogout(req: Request, res: Response): void;
    protected abstract onPostRegister(req: Request, res: Response): void;

}
