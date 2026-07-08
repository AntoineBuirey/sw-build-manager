import express, { Express } from 'express';
import https from 'https';

import { SSLOptions } from './ssl';

import { Environment } from './utility/utils';
import { logger } from './utility/logger';


// Error handling
interface ServerError extends Error {
	code?: string;
}

/**
 * This class Provide all confiigurations and basic setup for the application
 * It must be extended by a class implementing the abstract methods setupMiddlewares and setupRoutes
 * The methods configure must be called at the end of the constructor of the child class
 */
export abstract class BaseApp{
    protected app: Express;
    protected server: https.Server;
    public port: number;
    public environment: Environment;

    constructor(sslOptions: SSLOptions, port : number, environment : Environment){
        logger.info(`Initializing application with port: ${port} and environment: ${environment}`);
        this.app = express();
        this.server = https.createServer(sslOptions, this.app);
        this.port = port;
        this.environment = environment;
        this.setupErrorHandlers();
        logger.debug('Application initialized');
    }

    /**
     * Configure the application by setting up middlewares and routes, must be called at the end of the constructor of the child class
     */
    protected configure(): void {
        logger.info('Configuring application');
        this.setupMiddlewares();
        this.setupRoutes();
        logger.debug('Application configured successfully');
    }

    /**
     * Get the Express application instance, allowing access to the app for testing or further configuration
     */
    public getApp(): Express{
        return this.app;
    }

    /**
     * Start the server and listen on the specified port, logging the server URL and environment information
     */
    public startServer(): void{
        this.server.listen(this.port, () => {
            logger.info(`Server started successfully on port: ${this.port}`);
            logger.info(`HTTPS URL: https://localhost:${this.port}/`);
            logger.info(`Environment: ${this.environment}`);
        });
    }

    /**
     * Stop the server gracefully, ensuring all connections are closed before exiting the process
     */
    public stopServer(): void{
        this.server.close(() => {
            logger.info('HTTPS server stopped');
            process.exit(0);
        });
    }

    /**
     * Abstract method to setup middlewares, must be implemented by child class
     */
    public abstract setupMiddlewares(): void;

    /**
     * Abstract method to setup routes, must be implemented by child class
     */
    public abstract setupRoutes(): void;

    /**
     * Setup error handlers for the server, including handling EADDRINUSE and EACCES errors (port already in use and permission denied errors)
     */
    private setupErrorHandlers(): void{
        this.server.on('error', (error: ServerError) => {
            switch (error.code) {
                case 'EADDRINUSE':
                    logger.fatal(`Error: Port ${this.port} is already in use`);
                    break;
                case 'EACCES':
                    logger.fatal(`Error: Permission denied to bind to port ${this.port}`);
                    break;
                default:
                    logger.fatal(`Server error: ${error.message}`);
                    logger.debug(`${error.stack}`);
            }
            logger.debug('Exiting with code 1');
            process.exit(1);
        });
    }
}
