import session from "express-session";
import { Request, Response, NextFunction } from 'express';

import { environConfig } from "./environ";

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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.status(401).json({ success: false, message: 'Unauthorized' });
    }
}
