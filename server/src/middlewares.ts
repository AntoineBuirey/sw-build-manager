import session from "express-session";
import { Request, Response, NextFunction } from 'express';

import { SqliteStore } from "./database/sqlite_store";

import { logger } from './utility/logger';

/**
 * Middleware function to log incoming HTTP requests;
 * include:
 * - method
 * - URL
 * - timestamp
 * - client IP address
 */
export function logRequest(req: Request, _: Response, next: NextFunction) {
    const { method, url } = req;
    const timestamp = new Date().toISOString();

    logger.info(`Received ${method} request on ${url} :\nTimestamp: ${timestamp}\nclient IP: ${req.ip}`);
    next();
};

/**
 * Middleware function to ensure authentication for protected routes.
 * It checks if the user is authenticated by verifying the presence of a valid token in the request headers.
 * If the token is valid, the request proceeds; otherwise, a 401 Unauthorized response is sent.
 * 
 */
export function createAuthMiddleware(store: SqliteStore) {
    return async function authMiddleware(req: Request, res: Response, next: NextFunction) {
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            logger.warn('Unauthorized access attempt: Missing Authorization header');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1]; // Assuming Bearer token format
        if (!token) {
            logger.warn('Unauthorized access attempt: Missing token in Authorization header');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const isValid = await store.isAuthTokenValid(token);
            if (!isValid) {
                logger.warn(`Unauthorized access attempt with invalid token: ${token}`);
                return res.status(401).json({ error: 'Unauthorized' });
            }
            return next();
        } catch (error) {
            logger.error(`Error validating auth token: ${error}`);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}