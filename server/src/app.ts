import { Request, Response } from 'express';
import { randomUUID } from "crypto";
import { logger } from './utility/logger';
import { environConfig } from './environ';
import { CreationType, Usage, Creation, CreationCode, Manufacturer, Operator, Microcontroller, Status, Token, User } from "./models";
import { hashPassword, checkPassword } from "./utility/password";

import { EmptyApp } from "./empty_app";


/**
 * This class extends the EmptyApp class and provides concrete implementations for the abstract methods defined in EmptyApp.
 * It handles specific API endpoints for managing creations, manufacturers, operators, and user authentication.
 * It is designed to be the main application class that initializes and runs the server with the defined routes and middlewares.
 */
export class App extends EmptyApp {

    protected async onPostLogin(req: Request, res: Response): Promise<void> {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }
        const user = await this.store.getUser(username);
        if (!user) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }
        if (!checkPassword(password, user.hashed_password)) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }

        // Generate a new auth token for the user
        const token = randomUUID();

        const authToken = new Token(
            0,
            user.name,
            token,
            new Date(Date.now() + environConfig.sessionMaxAge)  // Token valid for 1 hour
        )

        await this.store.createAuthToken(authToken);

        res.json({ message: 'Login successful', token: token, expires_at: authToken.expiration_date.toISOString() });
    }

    protected async onPostRegister(req: Request, res: Response): Promise<void> {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        const existingUser = await this.store.getUser(username);
        if (existingUser) {
            res.status(400).json({ error: 'Username already exists' });
            return;
        }

        const hashedPassword = hashPassword(password);

        const newUser = new User(
            username,
            hashedPassword
        );

        await this.store.createUser(newUser);

        res.status(201).json({ message: 'User registered successfully' });
    }

    protected async onPostLogout(req: Request, res: Response): Promise<void> {
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            res.status(400).json({ error: 'Authorization header is required' });
            return;
        }

        const token = authHeader.split(' ')[1]; // Assuming Bearer token format
        if (!token) {
            res.status(400).json({ error: 'Token is required in Authorization header' });
            return;
        }

        const isValid = await this.store.isAuthTokenValid(token);
        if (!isValid) {
            res.status(400).json({ error: 'Invalid token' });
            return;
        }

        await this.store.deleteAuthToken(token);

        res.json({ message: 'Logout successful' });
    }


    protected onGetCreationTypes(_: Request, res: Response): void {
        const creationTypes: { [key: string]: number } = {};
        for (const [key, value] of Object.entries(CreationType)) {
            if (typeof value === 'number') {
                creationTypes[key] = value
            }
        }
        res.json(creationTypes);
    }

    protected onGetCreationUsages(_: Request, res: Response): void {
        const creationUsages: { [key: string]: number } = {};
        for (const [key, value] of Object.entries(Usage)) {
            if (typeof value === 'number') {
                creationUsages[key] = value;
            }
        }
        res.json(creationUsages);
    }

    protected onGetStatuses(_: Request, res: Response): void {
        const statuses: { [key: string]: number } = {};
        for (const [key, value] of Object.entries(Status)) {
            if (typeof value === 'number') {
                statuses[key] = value
            }
        }
        res.json(statuses);
    }


    protected onGetCreations(_: Request, res: Response): void {
        this.store.getAllCreations()
            .then(creations => {
                res.json(creations);
            })
            .catch(err => {
                logger.error(`Error fetching creations: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    protected onGetCreation(req: Request, res: Response): void {
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

    protected onPostCreation(req: Request, res: Response): void {
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

    protected onPutCreation(req: Request, res: Response): void {
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

    protected onDeleteCreation(req: Request, res: Response): void {
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


    protected onGetManufacturers(_: Request, res: Response): void {
        this.store.getAllManufacturers()
            .then(manufacturers => {
                res.json(manufacturers);
            })
            .catch(err => {
                logger.error(`Error fetching manufacturers: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    protected onGetManufacturer(req: Request, res: Response): void {
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

    protected onPostManufacturer(req: Request, res: Response): void {
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

    protected onPutManufacturer(req: Request, res: Response): void {
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

    protected onDeleteManufacturer(req: Request, res: Response): void {
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


    protected onGetOperators(_: Request, res: Response): void {
        this.store.getAllOperators()
            .then(operators => {
                res.json(operators);
            })
            .catch(err => {
                logger.error(`Error fetching operators: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    protected onGetOperator(req: Request, res: Response): void {
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

    protected onPostOperator(req: Request, res: Response): void {
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

    protected onPutOperator(req: Request, res: Response): void {
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

    protected onDeleteOperator(req: Request, res: Response): void {
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


    protected onGetMicrocontrollers(_: Request, res: Response): void {
        this.store.getAllMicrocontrollers()
            .then(microcontrollers => {
                res.json(microcontrollers);
            })
            .catch(err => {
                logger.error(`Error fetching microcontrollers: ${err}`);
                res.status(500).json({ error: 'Internal server error' });
            });
    }

    protected onGetMicrocontroller(req: Request, res: Response): void {
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

    protected onPostMicrocontroller(req: Request, res: Response): void {
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

    protected onPutMicrocontroller(req: Request, res: Response): void {
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

    protected onDeleteMicrocontroller(req: Request, res: Response): void {
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