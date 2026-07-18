import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";

import { BaseApp } from "./base_app";
import { logRequest } from "./middlewares";

import { get_uptime, Environment, hashPassword, rootDirectory, Pascal2SnakeCase } from "./utility/utils";
import { logger } from './utility/logger';
import { version } from "./utility/package";
import { ValueError } from "./utility/exceptions";
import { SqliteStore } from "./database/sqlite_store";
import { CreationType, Usage, Creation, CreationCode, Manufacturer, Operator, Microcontroller, Status } from "./models";


const API_PREFIX = '/api/v1';

declare module 'express-session' {
    interface SessionData {
        user: { email: string, id: number };
    }
}

type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
const GET: HTTPMethod = 'GET';
const POST: HTTPMethod = 'POST';
const PUT: HTTPMethod = 'PUT';
const DELETE: HTTPMethod = 'DELETE';

/**
 * This class implements the main application logic, including route handling and middleware setup.
 */
export class App extends BaseApp {
    private public_dir: string;
    private store: SqliteStore;
    private routes: { method: HTTPMethod, path: string}[] = [];

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

    // private registerRoute(method: HTTPMethod, path: string, handler: (req: Request, res: Response) => void): void {
    //     logger.debug(`Registering route: ${method} ${path}`);
    //     const expressMethod = method.toLowerCase() as 'get' | 'post' | 'put' | 'delete';
    //     (this.app as any)[expressMethod](path, handler.bind(this));

    //     this.routes.push({ method, path });
    // }

    private registerRoute(handler: (req: Request, res: Response) => void, { path, method, args }: { path?: string, method?: HTTPMethod, args?: string[] } = {}): void {
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

        logger.debug(`Registering route: ${method} ${path}`);
        const expressMethod = method.toLowerCase();
        (this.app as any)[expressMethod](path, handler.bind(this));
        this.routes.push({ method, path });
    }

    public setupRoutes(): void {
        logger.debug('Setting up routes');

        this.registerRoute(this.onGetRoot, {path: API_PREFIX});
        this.registerRoute(this.onGetInfo);

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
        this.store.getAllCreations()
            .then(creations => {
                res.json(creations);
            })
            .catch(err => {
                logger.error(`Error fetching creations: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onGetCreation(req: Request, res: Response): void {
        const creationCode = req.params.code as CreationCode;
        if (!creationCode) {
            res.status(400).json({ error: 'Invalid creation code' });
            return;
        }

        this.store.getCreation(creationCode)
            .then(creation => {
                if (!creation) {
                    res.status(404).json({ error: 'Creation not found' });
                    return;
                }
                res.json(creation);
            })
            .catch(err => {
                logger.error(`Error fetching creation with code ${creationCode}: ${err}`);
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
        const manufacturerId = manufacturer_id ? parseInt(manufacturer_id, 10) : null;
        const operatorId = operator_id ? parseInt(operator_id, 10) : null;

        if (manufacturerId !== null) {
            this.store.getManufacturer(manufacturerId)
                .then(manufacturer => {
                    if (!manufacturer) {
                        res.status(400).json({ error: 'Invalid manufacturer ID' });
                        return;
                    }
                })
                .catch(err => {
                    logger.error(`Error fetching manufacturer with ID ${manufacturerId}: ${err}`);
                    res.status(500).json({ error: 'Internal server error' });
                });
        }

        if (operatorId !== null) {
            this.store.getOperator(operatorId)
                .then(operator => {
                    if (!operator) {
                        res.status(400).json({ error: 'Invalid operator ID' });
                        return;
                    }
                })
                .catch(err => {
                    logger.error(`Error fetching operator with ID ${operatorId}: ${err}`);
                    res.status(500).json({ error: 'Internal server error' });
                });
        }

        const creation = new Creation(
            0, // id will be set by the database
            code || null,
            name,
            description || '',
            workshop_link || '',
            manufacturerId,
            operatorId,
            type || CreationType.UNKNOWN,
            usage || Usage.UNKNOWN,
            creation_date ? new Date(creation_date) : new Date(),
            status || Status.DEVELOPMENT,
            new Date()
        );

        this.store.createCreation(creation)
            .then((id) => {
                res.status(201).json({ message: 'Creation saved successfully', id });
                logger.info(`Creation saved successfully with id ${id}`);
            })
            .catch(err => {
                logger.error(`Error saving creation: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onPutCreation(req: Request, res: Response): void {
        const creationCode = req.params.code as CreationCode;
        if (!creationCode) {
            res.status(400).json({ error: 'Invalid creation code' });
            return;
        }

        const { name, description, workshop_link, manufacturer_id, operator_id, type, usage, creation_date, status } = req.body;

        this.store.getCreation(creationCode)
            .then(existingCreation => {
                if (!existingCreation) {
                    res.status(404).json({ error: 'Creation not found' });
                    return;
                }
                
                // Update the existing creation with new values
                existingCreation.name = name || existingCreation.name;
                existingCreation.description = description || existingCreation.description;
                existingCreation.workshop_link = workshop_link || existingCreation.workshop_link;
                existingCreation.manufacturer = manufacturer_id ? parseInt(manufacturer_id, 10) : existingCreation.manufacturer;
                existingCreation.operator = operator_id ? parseInt(operator_id, 10) : existingCreation.operator;
                existingCreation.type = type || existingCreation.type;
                existingCreation.usage = usage || existingCreation.usage;
                existingCreation.creation_date = creation_date ? new Date(creation_date) : existingCreation.creation_date;
                existingCreation.status = status || existingCreation.status;
                existingCreation.last_update = new Date();

                this.store.updateCreation(existingCreation)
                    .then(() => {
                        res.json({ message: 'Creation updated successfully' });
                        logger.info(`Creation with code ${creationCode} updated successfully`);
                    })
                    .catch(err => {
                        logger.error(`Error updating creation with code ${creationCode}: ${err}`);
                        res.status(500).json({ error: 'Internal server error' });
                    });
            })
            .catch(err => {
                logger.error(`Error fetching creation with code ${creationCode}: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onDeleteCreation(req: Request, res: Response): void {
        const creationCode = req.params.code as CreationCode;
        if (!creationCode) {
            res.status(400).json({ error: 'Invalid creation code' });
            return;
        }
        this.store.deleteCreation(creationCode)
            .then(() => {
                res.json({ message: 'Creation deleted successfully' });
                logger.info(`Creation with code ${creationCode} deleted successfully`);
            })
            .catch(err => {
                logger.error(`Error deleting creation with code ${creationCode}: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }


    private onGetManufacturers(_: Request, res: Response): void {
        this.store.getAllManufacturers()
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

        this.store.getManufacturer(manufacturerId)
            .then(manufacturer => {
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

        this.store.createManufacturer(manufacturer)
            .then((id) => {
                res.status(201).json({ message: 'Manufacturer saved successfully', id });
                logger.info(`Manufacturer saved successfully: ${JSON.stringify(manufacturer)}`);
            })
            .catch(err => {
                logger.error(`Error saving manufacturer: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onPutManufacturer(req: Request, res: Response): void {
        const manufacturerId = parseInt(req.params.id, 10);
        if (isNaN(manufacturerId)) {
            res.status(400).json({ error: 'Invalid manufacturer ID' });
            return;
        }

        const { name, description, logo } = req.body;

        this.store.getManufacturer(manufacturerId)
            .then(existingManufacturer => {
                if (!existingManufacturer) {
                    res.status(404).json({ error: 'Manufacturer not found' });
                    return;
                }

                // Update the existing manufacturer with new values
                existingManufacturer.name = name || existingManufacturer.name;
                existingManufacturer.description = description || existingManufacturer.description;
                existingManufacturer.logo = logo || existingManufacturer.logo;

                this.store.updateManufacturer(existingManufacturer)
                    .then(() => {
                        res.json({ message: 'Manufacturer updated successfully' });
                        logger.info(`Manufacturer with ID ${manufacturerId} updated successfully`);
                    })
                    .catch(err => {
                        logger.error(`Error updating manufacturer with ID ${manufacturerId}: ${err}`);
                        res.status(500).json({ error: 'Internal server error' });
                    });
            })
            .catch(err => {
                logger.error(`Error fetching manufacturer with ID ${manufacturerId}: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onDeleteManufacturer(req: Request, res: Response): void {
        const manufacturerId = parseInt(req.params.id, 10);
        if (isNaN(manufacturerId)) {
            res.status(400).json({ error: 'Invalid manufacturer ID' });
            return;
        }
        this.store.deleteManufacturer(manufacturerId)
            .then(() => {
                res.json({ message: 'Manufacturer deleted successfully' });
                logger.info(`Manufacturer with ID ${manufacturerId} deleted successfully`);
            })
            .catch(err => {
                logger.error(`Error deleting manufacturer with ID ${manufacturerId}: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }


    private onGetOperators(_: Request, res: Response): void {
        this.store.getAllOperators()
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

        this.store.getOperator(operatorId)
            .then(operator => {
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

        this.store.createOperator(operator)
            .then((id) => {
                res.status(201).json({ message: 'Operator saved successfully', id });
                logger.info(`Operator saved successfully with ID ${id}`);
            })
            .catch(err => {
                logger.error(`Error saving operator: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onPutOperator(req: Request, res: Response): void {
        const operatorId = parseInt(req.params.id, 10);
        if (isNaN(operatorId)) {
            res.status(400).json({ error: 'Invalid operator ID' });
            return;
        }

        const { name, description, logo } = req.body;

        this.store.getOperator(operatorId)
            .then(existingOperator => {
                if (!existingOperator) {
                    res.status(404).json({ error: 'Operator not found' });
                    return;
                }

                // Update the existing operator with new values
                existingOperator.name = name || existingOperator.name;
                existingOperator.description = description || existingOperator.description;
                existingOperator.logo = logo || existingOperator.logo;

                this.store.updateOperator(existingOperator)
                    .then(() => {
                        res.json({ message: 'Operator updated successfully' });
                        logger.info(`Operator with ID ${operatorId} updated successfully`);
                    })
                    .catch(err => {
                        logger.error(`Error updating operator with ID ${operatorId}: ${err}`);
                        res.status(500).json({ error: 'Internal server error' });
                    });
            })
            .catch(err => {
                logger.error(`Error fetching operator with ID ${operatorId}: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onDeleteOperator(req: Request, res: Response): void {
        const operatorId = parseInt(req.params.id, 10);
        if (isNaN(operatorId)) {
            res.status(400).json({ error: 'Invalid operator ID' });
            return;
        }
        this.store.deleteOperator(operatorId)
            .then(() => {
                res.json({ message: 'Operator deleted successfully' });
                logger.info(`Operator with ID ${operatorId} deleted successfully`);
            })
            .catch(err => {
                logger.error(`Error deleting operator with ID ${operatorId}: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }


    private onGetMicrocontrollers(_: Request, res: Response): void {
        this.store.getAllMicrocontrollers()
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

        this.store.getMicrocontroller(microcontrollerId)
            .then(microcontroller => {
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

        const normalizedWorkshopLink = typeof workshop_link === 'string' && workshop_link.trim() !== ''
            ? workshop_link.trim()
            : null;

        const microcontroller = new Microcontroller(
            0, // id will be set by the database
            name,
            description || '',
            normalizedWorkshopLink,
            creation_date ? new Date(creation_date) : new Date(),
            status || Status.DEVELOPMENT,
            last_update ? new Date(last_update) : new Date()
        );

        this.store.createMicrocontroller(microcontroller)
            .then((id) => {
                res.status(201).json({ message: 'Microcontroller saved successfully', id });
                logger.info(`Microcontroller saved successfully with ID ${id}`);
            })
            .catch(err => {
                logger.error(`Error saving microcontroller: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onPutMicrocontroller(req: Request, res: Response): void {
        const microcontrollerId = parseInt(req.params.id, 10);
        if (isNaN(microcontrollerId)) {
            res.status(400).json({ error: 'Invalid microcontroller ID' });
            return;
        }

        const { name, description, workshop_link, creation_date, status, last_update } = req.body;

        this.store.getMicrocontroller(microcontrollerId)
            .then(existingMicrocontroller => {
                if (!existingMicrocontroller) {
                    res.status(404).json({ error: 'Microcontroller not found' });
                    return;
                }

                // Update the existing microcontroller with new values
                existingMicrocontroller.name = name || existingMicrocontroller.name;
                existingMicrocontroller.description = description || existingMicrocontroller.description;
                existingMicrocontroller.workshop_link = workshop_link || existingMicrocontroller.workshop_link;
                existingMicrocontroller.creation_date = creation_date ? new Date(creation_date) : existingMicrocontroller.creation_date;
                existingMicrocontroller.status = status || existingMicrocontroller.status;
                existingMicrocontroller.last_update = last_update ? new Date(last_update) : existingMicrocontroller.last_update;

                this.store.updateMicrocontroller(existingMicrocontroller)
                    .then(() => {
                        res.json({ message: 'Microcontroller updated successfully' });
                        logger.info(`Microcontroller with ID ${microcontrollerId} updated successfully`);
                    })
                    .catch(err => {
                        logger.error(`Error updating microcontroller with ID ${microcontrollerId}: ${err}`);
                        res.status(500).json({ error: 'Internal server error' });
                    });
            })
            .catch(err => {
                logger.error(`Error fetching microcontroller with ID ${microcontrollerId}: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    private onDeleteMicrocontroller(req: Request, res: Response): void {
        const microcontrollerId = parseInt(req.params.id, 10);
        if (isNaN(microcontrollerId)) {
            res.status(400).json({ error: 'Invalid microcontroller ID' });
            return;
        }
        this.store.deleteMicrocontroller(microcontrollerId)
            .then(() => {
                res.json({ message: 'Microcontroller deleted successfully' });
                logger.info(`Microcontroller with ID ${microcontrollerId} deleted successfully`);
            })
            .catch(err => {
                logger.error(`Error deleting microcontroller with ID ${microcontrollerId}: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }
}
