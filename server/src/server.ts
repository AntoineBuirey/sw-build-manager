import { App } from './app';
import { getSSLOptions } from './ssl';
import { environConfig } from './environ';

import { logger } from './utility/logger';

let app: App;
try{
	const sslOptions = getSSLOptions(environConfig.certPath);
	app = new App(
		sslOptions,
		environConfig.port,
		environConfig.nodeEnv,
		environConfig.clientDir
	);
}
catch (error) {
	// do not use ssl certificates, and fallback to HTTP server
	const message = error instanceof Error ? error.message : String(error);
	logger.warn(`Failed to load SSL certificates: ${message}`);
	logger.warn('Falling back to HTTP server');
	app = new App(
		null,
		environConfig.port,
		environConfig.nodeEnv,
		environConfig.clientDir
	);
}


async function bootstrap(): Promise<void> {
	try {
		await app.openStore();
		app.startServer();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.fatal(`Failed to initialize server: ${message}`);
		process.exit(1);
	}
}

void bootstrap();


// Graceful shutdown when receiving termination signals, from ^C or kill command
process.on('SIGTERM', () => {
	logger.info('SIGTERM signal received: closing HTTPS server');
	void app.closeStore().finally(() => app.stopServer());
});

process.on('SIGINT', () => {
	logger.info('\nSIGINT signal received: closing HTTPS server');
	void app.closeStore().finally(() => app.stopServer());
});

// Export for testing purposes
export { app };
