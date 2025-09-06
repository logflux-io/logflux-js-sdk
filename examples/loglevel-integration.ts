import log from 'loglevel';
import { 
  createUnixClient,
  attachLoglevelToLogFlux,
  createLogFluxLoglevel,
  setupLoglevelWithLogFlux,
  detachLoglevelFromLogFlux,
  LoglevelLevels
} from '../src';

async function loglevelBasicExample() {
  console.log('=== Loglevel Basic Example ===');
  
  const client = createUnixClient();
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Attach the default loglevel logger to LogFlux
    attachLoglevelToLogFlux(log, client, 'loglevel-basic-example', {
      keepConsoleOutput: true,
      metadata: { 
        service: 'web-server',
        version: '1.0.0'
      }
    });

    // Set log level
    log.setLevel('debug');

    // Use loglevel normally - output goes to both console and LogFlux
    log.trace('This is a trace message');
    log.debug('Debug information');
    log.info('Application started successfully');
    log.warn('This is a warning');
    log.error('An error occurred');

    // Log various data types
    log.info('User data:', { id: 123, name: 'Alice' });
    log.error('Exception caught:', new Error('Database connection failed'));

    console.log('Loglevel basic example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Detach from LogFlux
    detachLoglevelFromLogFlux(log);
    console.log('Detached loglevel from LogFlux');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

async function loglevelCustomLoggerExample() {
  console.log('\n=== Loglevel Custom Logger Example ===');
  
  const client = createUnixClient();
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create dedicated LogFlux logger
    const logger = createLogFluxLoglevel(client, 'loglevel-custom-example', {
      level: 'info',
      keepConsoleOutput: true,
      metadata: {
        component: 'api-gateway',
        environment: 'production'
      },
      loggerName: 'api-logger'
    });

    // API request logging
    logger.info('Incoming request', {
      method: 'GET',
      path: '/api/users',
      ip: '192.168.1.100'
    });

    logger.debug('Database query executed'); // Won't show (below info level)
    
    logger.warn('Rate limit approaching', {
      currentRequests: 95,
      limit: 100,
      timeWindow: '1m'
    });

    logger.error('API request failed', {
      statusCode: 500,
      error: 'Internal server error',
      duration: 2500
    });

    console.log('Loglevel custom logger example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

async function loglevelSetupExample() {
  console.log('\n=== Loglevel Setup Helper Example ===');
  
  const client = createUnixClient();
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Use convenience setup function
    const logger = setupLoglevelWithLogFlux(client, 'loglevel-setup-example', {
      useDefaultLogger: false, // Create new logger instance
      level: LoglevelLevels.WARN, // Only WARN and ERROR
      metadata: {
        module: 'user-service',
        instance: 'prod-01'
      },
      loggerName: 'user-service'
    });

    // Only warnings and errors will be sent to LogFlux
    logger.trace('Trace message'); // Ignored
    logger.debug('Debug message'); // Ignored  
    logger.info('Info message'); // Ignored
    logger.warn('Warning message'); // Sent to LogFlux
    logger.error('Error message'); // Sent to LogFlux

    // Log with structured data
    logger.warn('Database connection slow', {
      connectionTime: 5000,
      threshold: 1000,
      database: 'users_db'
    });

    logger.error('Authentication failed', {
      username: 'alice',
      reason: 'invalid_password',
      attempts: 3,
      lockout: true
    });

    console.log('Loglevel setup example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

async function loglevelMultiLoggerExample() {
  console.log('\n=== Loglevel Multi-Logger Example ===');
  
  const client = createUnixClient();
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create multiple specialized loggers
    const httpLogger = createLogFluxLoglevel(client, 'http-service', {
      level: 'info',
      metadata: { component: 'http' },
      loggerName: 'http'
    });

    const dbLogger = createLogFluxLoglevel(client, 'database-service', {
      level: 'debug',
      metadata: { component: 'database' },
      loggerName: 'database'
    });

    const authLogger = createLogFluxLoglevel(client, 'auth-service', {
      level: 'warn',
      metadata: { component: 'auth' },
      loggerName: 'auth'
    });

    // HTTP logging
    httpLogger.info('Starting HTTP server');
    httpLogger.info('GET /api/health - 200 OK');
    httpLogger.warn('Request timeout', { url: '/api/slow-endpoint' });

    // Database logging  
    dbLogger.debug('Executing query: SELECT * FROM users');
    dbLogger.info('Query completed in 45ms');
    dbLogger.error('Connection pool exhausted');

    // Auth logging (only warnings and errors due to level)
    authLogger.info('Login attempt'); // Won't be sent (below warn level)
    authLogger.warn('Failed login attempt', { username: 'hacker', ip: '192.168.1.100' });
    authLogger.error('Account locked due to multiple failed attempts');

    // Demonstrate different error handling
    try {
      throw new Error('Simulated database error');
    } catch (err) {
      dbLogger.error('Database operation failed:', err);
    }

    console.log('Loglevel multi-logger example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run examples
async function main() {
  await loglevelBasicExample();
  await loglevelCustomLoggerExample();
  await loglevelSetupExample();
  await loglevelMultiLoggerExample();
}

if (require.main === module) {
  main().catch(console.error);
}