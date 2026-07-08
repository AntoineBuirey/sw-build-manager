import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

import { Environment, rootDirectory } from './utility/utils';

const dotenvpath = path.resolve(rootDirectory, '.env');
if (!fs.existsSync(dotenvpath)) {
    console.warn(`Warning: .env file not found at path: ${dotenvpath}. Using default environment variables.`);
}
dotenv.config({ path: dotenvpath });

console.log('Using environment variables from:', dotenvpath);

/**
 * Get absolute path from a relative path based on the root directory of the project.
 * If the provided path is already absolute, it is returned as is.
 * @param relativePath - The relative or absolute path
 * @returns The absolute path
 */
export function getAbsolutePath(relativePath: string): string {
    if (path.isAbsolute(relativePath)) {
        return relativePath;
    }
    return path.join(rootDirectory, relativePath);
}

/**
 * Interface for environment configuration, defining the expected structure of the configuration object used to initialize the application
 */
export interface EnvironConfig {
    port: number;
    nodeEnv: Environment;
    certPath: string;
    logDir: string;
    clientDir: string;
    serverDir: string;
    sessionSecret: string;
}

// Create the environment configuration object by reading values from environment variables, providing default values if not set
export const environConfig: EnvironConfig = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: (process.env.NODE_ENV as Environment) || Environment.Development,
    certPath: getAbsolutePath(process.env.CERTPATH || 'certs'),
    logDir: getAbsolutePath(process.env.LOG_DIR || './logs'),
    clientDir: getAbsolutePath(process.env.CLIENT_DIR || './public'),
    serverDir: getAbsolutePath(process.env.SERVER_DIR || './app'),
    sessionSecret: process.env.SESSION_SECRET || 'default_session_secret',
};