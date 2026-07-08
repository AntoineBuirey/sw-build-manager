import { App } from './app';
import { getSSLOptions } from './ssl';
import { environConfig } from './environ';

import { logger } from './utility/logger';

const sslOptions = getSSLOptions(environConfig.certPath);
const app : App = new App(
	sslOptions,
	environConfig.port,
	environConfig.nodeEnv,
	environConfig.clientDir
);

// Start the server
app.startServer();


// Graceful shutdown when receiving termination signals, from ^C or kill command
process.on('SIGTERM', () => {
	logger.info('SIGTERM signal received: closing HTTPS server');
	app.stopServer();
});

process.on('SIGINT', () => {
	logger.info('\nSIGINT signal received: closing HTTPS server');
	app.stopServer();
});

// Export for testing purposes
export { app };
