import { createHash } from 'crypto';
import { logger } from './logger';

export function hashPassword(password: string): string {
    return createHash('sha1').update(password).digest('hex');
}

export function checkPassword(password: string, storedHashedPassword: string): boolean {
    const hashedInputPassword = hashPassword(password);
    logger.debug(`Checking password: input hash = ${hashedInputPassword}, stored hash = ${storedHashedPassword}`);
    return hashedInputPassword === storedHashedPassword;
}