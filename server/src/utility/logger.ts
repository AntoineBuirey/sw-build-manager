import bunyan from 'bunyan';
import path from 'path';
import fs from 'fs';

import { Environment } from './utils';

import { environConfig } from '../environ';

/**
 * Initialize and configure the logger using bunyan,
 * set the log level based on the environment
 * write to both the console and a file in the specified log directory
 */
function getLogger(): bunyan {
    const level = environConfig.nodeEnv === Environment.Production ? 'info' : 'debug';

    // Ensure log directory exists
    if (!fs.existsSync(environConfig.logDir)) {
        fs.mkdirSync(environConfig.logDir, { recursive: true });
    }

    // based on the current date (YYYY-MM-DD) to create a new log file each day
    const logfile = path.join(environConfig.logDir, `sw-build-manager-server-${new Date().toISOString().split('T')[0]}.log`);

    return bunyan.createLogger({
        name: 'sw-build-manager-server',
        level: level,
        streams: [
            {
                level: level,
                stream: process.stdout
            },
            {
                level: level,
                path: logfile,
                type: 'rotating-file',
                period: '1d', // rotate daily
                count: 7 // keep 7 days of logs
            }
        ]
    });
}

export const logger = getLogger();