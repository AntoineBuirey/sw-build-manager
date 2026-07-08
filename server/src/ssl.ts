import path from 'path';
import fs from 'fs';

import { logger } from './utility/logger';

/**
 * Interface containing SSL certificates
 */
export interface SSLOptions {
	key: Buffer;
	cert: Buffer;
}

/**
 * Load SSL key and certificate files from the specified directory, ensuring that both files exist and are readable, and return an object containing the key and certificate as buffers
 * @param certPath - The directory path where the SSL key and certificate files are located
 * @returns An object containing the key and certificate as buffers
 * @throws An error if either the key or certificate file is not found at the specified path
 */
export function getSSLOptions(certPath: string): SSLOptions {
	const keyPath = path.join(certPath, 'server.key');
	const certFilePath = path.join(certPath, 'server.cert');
	
	if (!fs.existsSync(keyPath)) {
		throw new Error(`SSL key file not found at path: ${keyPath}`);
	}
	if (!fs.existsSync(certFilePath)) {
		throw new Error(`SSL certificate file not found at path: ${certFilePath}`);
	}
	logger.info(`Loaded SSL certificates from: ${certPath}`);
	return {
		key: fs.readFileSync(keyPath),
		cert: fs.readFileSync(certFilePath)
	};
}
