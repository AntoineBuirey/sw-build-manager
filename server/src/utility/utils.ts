import { createHash } from 'crypto';
import path from 'path';
import fs from 'fs';


/**
 * Get the server uptime in a human-readable format (HH:MM:SS), calculating the uptime from the process uptime and formatting it as a string with hours, minutes, and seconds
 * @returns The server uptime as a string in the format HH:MM:SS
 */
export function get_uptime() : string {
	const uptime = new Date(process.uptime() * 1000);
	let timestring = uptime.getUTCHours().toString().padStart(2, '0') + ':';
	timestring += uptime.getUTCMinutes().toString().padStart(2, '0') + ':';
	timestring += uptime.getUTCSeconds().toString().padStart(2, '0');
	return timestring;
}

/**
 * Enumeration representing the different environments the application can run in
 * - Development: Used for local development and testing, with verbose logging and debugging features enabled (developer machine)
 * - Production: Used for deployment in a live environment, with less verbose logging (production server)
 * - Testing: Used for automated testing, with specific configurations to facilitate testing and debugging (testing environment)
 */
export enum Environment {
	Development = 'development',
	Production = 'production',
	Testing = 'testing'
}


function getRootDirectory(): string {
	let currentDir = __dirname;
	while (!fs.existsSync(path.join(currentDir, '.env'))) {
		const parentDir = path.resolve(currentDir, '..');
		if (parentDir === currentDir) { // Reached the root of the filesystem
			throw new Error('Could not find parent directory containing .env file');
		}
		currentDir = parentDir;
	}
	return currentDir;
}

export const rootDirectory = getRootDirectory();


export function hashPassword(password: string): string {
	return createHash('sha1').update(password).digest('hex');
}


/**
 * Send a HEAD request to the specified URI and check if it is reachable (returns a 200 OK status code)
 * @param uri the URI to check
 */
export function checkUri(uri: string): Promise<boolean> {
	const http = uri.startsWith('https') ? require('https') : require('http');
	return new Promise((resolve) => {
		const request = http.request(uri, { method: 'HEAD' }, (response: any) => {
			resolve(response.statusCode === 200);
		});
		request.on('error', () => resolve(false));
		request.end();
	});
}
