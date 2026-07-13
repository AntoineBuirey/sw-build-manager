import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";

import { BaseApp } from "./base_app";
import { logRequest } from "./middlewares";

import { get_uptime, Environment, hashPassword, rootDirectory } from "./utility/utils";
import { logger } from './utility/logger';
import { version } from "./utility/package";
import { ValueError } from "./utility/exceptions";
import { SqliteStore } from "./database/sqlite_store";
import { CreationType, Usage, Creation, Manufacturer, Operator, Microcontroller, Status } from "./models";

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
        this.app.use(express.json());                           // Middleware to parse JSON request bodies
        this.app.use(express.urlencoded({ extended: true }));   // Middleware to parse URL-encoded request bodies
    }

    public setupRoutes(): void {
        logger.debug('Setting up routes');
        this.app.get('/api/v1/info', this.onGetInfo.bind(this));

        this.app.get('/api/v1/creation_types', this.onGetCreationTypes.bind(this));
        this.app.get('/api/v1/creation_usages', this.onGetCreationUsages.bind(this));
        this.app.get('/api/v1/statuses', this.onGetStatuses.bind(this));

        this.app.get('/api/v1/creations', this.onGetCreations.bind(this));
        this.app.get('/api/v1/creation/:id', this.onGetCreation.bind(this));
        this.app.post('/api/v1/creation', this.onPostCreation.bind(this));

        this.app.get('/api/v1/manufacturers', this.onGetManufacturers.bind(this));
        this.app.get('/api/v1/manufacturer/:id', this.onGetManufacturer.bind(this));
        this.app.post('/api/v1/manufacturer', this.onPostManufacturer.bind(this));

        this.app.get('/api/v1/operators', this.onGetOperators.bind(this));
        this.app.get('/api/v1/operator/:id', this.onGetOperator.bind(this));
        this.app.post('/api/v1/operator', this.onPostOperator.bind(this));

        this.app.get('/api/v1/microcontrollers', this.onGetMicrocontrollers.bind(this));
        this.app.get('/api/v1/microcontroller/:id', this.onGetMicrocontroller.bind(this));
        this.app.post('/api/v1/microcontroller', this.onPostMicrocontroller.bind(this));
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


    private onGetCreationTypes(_: Request, res: Response): void {
        const creationTypes: { [key: string]: number } = {};
        for (const [key, value] of Object.entries(CreationType)) {
            if (typeof value === 'number') {
                creationTypes[key] = value
            }
        }
        res.json(creationTypes);
    }

    private onGetCreationUsages(_: Request, res: Response): void {
        const creationUsages: { [key: string]: number } = {};
        for (const [key, value] of Object.entries(Usage)) {
            if (typeof value === 'number') {
                creationUsages[key] = value;
            }
        }
        res.json(creationUsages);
    }

    private onGetStatuses(_: Request, res: Response): void {
        const statuses: { [key: string]: number } = {};
        for (const [key, value] of Object.entries(Status)) {
            if (typeof value === 'number') {
                statuses[key] = value
            }
        }
        res.json(statuses);
    }


    private onGetCreations(_: Request, res: Response): void {
        this.store.getCreations()
            .then(creations => {
                res.json(creations);
            })
            .catch(err => {
                logger.error(`Error fetching creations: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onGetCreation(req: Request, res: Response): void {
        const creationId = parseInt(req.params.id, 10);
        if (isNaN(creationId)) {
            res.status(400).json({ error: 'Invalid creation ID' });
            return;
        }

        this.store.getCreations()
            .then(creations => {
                const creation = creations.find(c => c.id === creationId);
                if (!creation) {
                    res.status(404).json({ error: 'Creation not found' });
                    return;
                }
                res.json(creation);
            })
            .catch(err => {
                logger.error(`Error fetching creation with ID ${creationId}: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onPostCreation(req: Request, res: Response): void {
        const { name, code, description, workshop_link, manufacturer_id, operator_id, type, usage, creation_date, status } = req.body;

        // only name is required, other will have default values if not provided
        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            logger.warn('Received POST /api/v1/creation request with missing name');
            return;
        }

        // if provided, manufacturer and operator must be existing in the database, otherwise return 400
        // get the manufacturer and operator from the store
        Promise.all([
            manufacturer_id ? this.store.getManufacturers().then(manufacturers => manufacturers.find(m => m.id === manufacturer_id)) : Promise.resolve(null),
            operator_id ? this.store.getOperators().then(operators => operators.find(o => o.id === operator_id)) : Promise.resolve(null)
        ])
        .then(([manufacturer, operator]) => {
            if (manufacturer_id && !manufacturer) {
                res.status(400).json({ error: 'Manufacturer not found' });
                logger.warn(`Received POST /api/v1/creation request with invalid manufacturer_id: ${manufacturer_id}`);
                return;
            }
            if (operator_id && !operator) {
                res.status(400).json({ error: 'Operator not found' });
                logger.warn(`Received POST /api/v1/creation request with invalid operator_id: ${operator_id}`);
                return;
            }

            const creation = new Creation(
                0, // id will be set by the database
                name,
                code || '',
                description || '',
                workshop_link || '',
                manufacturer || null,
                operator || null,
                type || CreationType.UNKNOWN,
                usage || Usage.UNKNOWN,
                creation_date ? new Date(creation_date) : new Date(),
                status || Status.DEVELOPMENT,
                new Date()
            );

            this.store.saveCreation(creation)
                .then(() => {
                    res.status(201).json({ message: 'Creation saved successfully' });
                    logger.info(`Creation named "${name}" saved successfully`);
                })
                .catch(err => {
                    logger.error(`Error saving creation: ${err}`);
                    res.status(500).json({ error: 'Internal server error' });
                });
        })
        .catch(err => {
            logger.error(`Error fetching manufacturer or operator: ${err}`);
            res.status(500).json({ error: 'Internal server error' });
        });
    }


    private onGetManufacturers(_: Request, res: Response): void {
        this.store.getManufacturers()
            .then(manufacturers => {
                res.json(manufacturers);
            })
            .catch(err => {
                logger.error(`Error fetching manufacturers: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onGetManufacturer(req: Request, res: Response): void {
        const manufacturerId = parseInt(req.params.id, 10);
        if (isNaN(manufacturerId)) {
            res.status(400).json({ error: 'Invalid manufacturer ID' });
            return;
        }

        this.store.getManufacturers()
            .then(manufacturers => {
                const manufacturer = manufacturers.find(m => m.id === manufacturerId);
                if (!manufacturer) {
                    res.status(404).json({ error: 'Manufacturer not found' });
                    return;
                }
                res.json(manufacturer);
            })
            .catch(err => {
                logger.error(`Error fetching manufacturer with ID ${manufacturerId}: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onPostManufacturer(req: Request, res: Response): void {
        const { name, description, logo } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            logger.warn('Received POST /api/v1/manufacturer request with missing name');
            return;
        }

        const manufacturer = new Manufacturer(
            0, // id will be set by the database
            name,
            description || '',
            logo || ''
        );

        this.store.saveManufacturer(manufacturer)
            .then((id) => {
                res.status(201).json({ message: 'Manufacturer saved successfully', id });
                logger.info(`Manufacturer saved successfully: ${JSON.stringify(manufacturer)}`);
            })
            .catch(err => {
                logger.error(`Error saving manufacturer: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }


    private onGetOperators(_: Request, res: Response): void {
        this.store.getOperators()
            .then(operators => {
                res.json(operators);
            })
            .catch(err => {
                logger.error(`Error fetching operators: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onGetOperator(req: Request, res: Response): void {
        const operatorId = parseInt(req.params.id, 10);
        if (isNaN(operatorId)) {
            res.status(400).json({ error: 'Invalid operator ID' });
            return;
        }

        this.store.getOperators()
            .then(operators => {
                const operator = operators.find(o => o.id === operatorId);
                if (!operator) {
                    res.status(404).json({ error: 'Operator not found' });
                    return;
                }
                res.json(operator);
            })
            .catch(err => {
                logger.error(`Error fetching operator with ID ${operatorId}: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onPostOperator(req: Request, res: Response): void {
        const { name, description, logo } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            logger.warn('Received POST /api/v1/operator request with missing name');
            return;
        }

        const operator = new Operator(
            0, // id will be set by the database
            name,
            description || '',
            logo || ''
        );

        this.store.saveOperator(operator)
            .then((id) => {
                res.status(201).json({ message: 'Operator saved successfully', id });
                logger.info(`Operator saved successfully: ${JSON.stringify(operator)}`);
            })
            .catch(err => {
                logger.error(`Error saving operator: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }


    private onGetMicrocontrollers(_: Request, res: Response): void {
        this.store.getMicrocontrollers()
            .then(microcontrollers => {
                res.json(microcontrollers);
            })
            .catch(err => {
                logger.error(`Error fetching microcontrollers: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onGetMicrocontroller(req: Request, res: Response): void {
        const microcontrollerId = parseInt(req.params.id, 10);
        if (isNaN(microcontrollerId)) {
            res.status(400).json({ error: 'Invalid microcontroller ID' });
            return;
        }

        this.store.getMicrocontrollers()
            .then(microcontrollers => {
                const microcontroller = microcontrollers.find(m => m.id === microcontrollerId);
                if (!microcontroller) {
                    res.status(404).json({ error: 'Microcontroller not found' });
                    return;
                }
                res.json(microcontroller);
            })
            .catch(err => {
                logger.error(`Error fetching microcontroller with ID ${microcontrollerId}: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onPostMicrocontroller(req: Request, res: Response): void {
        const { name, description, workshop_link, creation_date, status, last_update } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            logger.warn('Received POST /api/v1/microcontroller request with missing name');
            return;
        }

        const microcontroller = new Microcontroller(
            0, // id will be set by the database
            name,
            description || '',
            workshop_link || '',
            creation_date ? new Date(creation_date) : new Date(),
            status || Status.DEVELOPMENT,
            last_update ? new Date(last_update) : new Date()
        );

        this.store.saveMicrocontroller(microcontroller)
            .then(() => {
                res.status(201).json({ message: 'Microcontroller saved successfully' });
                logger.info(`Microcontroller saved successfully: ${JSON.stringify(microcontroller)}`);
            })
            .catch(err => {
                logger.error(`Error saving microcontroller: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

}
