import log4js from 'log4js';
import { 
  createUnixClient,
  LogFluxAppender,
  createLog4jsConfig,
  registerLogFluxAppender
} from '../src';

async function log4jsBasicExample() {
  console.log('=== Log4js Basic Example ===');
  
  const client = createUnixClient();
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Configure log4js with LogFlux appender
    log4js.configure({
      appenders: {
        logflux: LogFluxAppender.configure(client, 'log4js-basic-example', {
          includeMetadata: true,
          metadata: { 
            environment: 'development',
            service: 'user-service'
          }
        }),
        console: { type: 'console' }
      },
      categories: {
        default: { appenders: ['logflux', 'console'], level: 'info' },
        database: { appenders: ['logflux', 'console'], level: 'debug' }
      }
    });

    // Get loggers for different categories
    const defaultLogger = log4js.getLogger();
    const dbLogger = log4js.getLogger('database');

    // Log various levels
    defaultLogger.info('Application starting up');
    defaultLogger.warn('This is a warning message');
    defaultLogger.error('An error occurred');

    // Database-specific logging
    dbLogger.debug('Database query: SELECT * FROM users');
    dbLogger.info('Database connection established');
    dbLogger.error('Database query failed', new Error('Connection timeout'));

    // Structured logging
    defaultLogger.info('User login', {
      userId: '12345',
      username: 'alice',
      timestamp: new Date().toISOString()
    });

    console.log('Log4js basic example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    log4js.shutdown();
  }
}

async function log4jsAdvancedExample() {
  console.log('\n=== Log4js Advanced Example ===');
  
  const client = createUnixClient();
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Use the convenience function for configuration
    const config = createLog4jsConfig(client, 'log4js-advanced-example', {
      level: 'debug',
      logfluxOptions: {
        includeMetadata: true,
        metadata: {
          service: 'api-gateway',
          version: '1.2.0'
        }
      },
      categories: {
        http: { appenders: ['logflux', 'console'], level: 'info' },
        auth: { appenders: ['logflux'], level: 'warn' }, // LogFlux only
        performance: { appenders: ['logflux', 'console'], level: 'debug' }
      }
    });

    log4js.configure(config);

    // Get specialized loggers
    const httpLogger = log4js.getLogger('http');
    const authLogger = log4js.getLogger('auth');
    const perfLogger = log4js.getLogger('performance');

    // HTTP request logging
    httpLogger.info('GET /api/users - 200', {
      method: 'GET',
      path: '/api/users',
      statusCode: 200,
      responseTime: 45
    });

    // Authentication logging (LogFlux only, no console)
    authLogger.warn('Invalid login attempt', {
      username: 'hacker',
      ip: '192.168.1.100',
      userAgent: 'curl/7.68.0'
    });

    // Performance monitoring
    perfLogger.debug('Database query performance', {
      query: 'getUserById',
      duration: 12.5,
      rows: 1
    });

    perfLogger.info('Cache hit rate', {
      hits: 95,
      misses: 5,
      ratio: 0.95
    });

    console.log('Log4js advanced example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    log4js.shutdown();
  }
}

async function log4jsErrorHandlingExample() {
  console.log('\n=== Log4js Error Handling Example ===');
  
  const client = createUnixClient();
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Configure with custom message formatter
    const appender = LogFluxAppender.configure(client, 'log4js-errors', {
      messageFormatter: (data: any[]) => {
        return data.map(item => {
          if (item instanceof Error) {
            return `ERROR: ${item.name}: ${item.message}\nStack: ${item.stack}`;
          }
          return typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item);
        }).join(' | ');
      },
      metadata: {
        handler: 'error-service'
      }
    });

    log4js.configure({
      appenders: {
        logflux: appender,
        console: { type: 'console' }
      },
      categories: {
        default: { appenders: ['logflux', 'console'], level: 'info' }
      }
    });

    const logger = log4js.getLogger();

    // Log different types of errors
    try {
      throw new Error('Database connection failed');
    } catch (err) {
      logger.error('Database error occurred:', err);
    }

    // Log with complex objects
    logger.info('User session data', {
      sessionId: 'sess_123456',
      user: {
        id: 42,
        username: 'alice',
        roles: ['user', 'moderator']
      },
      metadata: {
        loginTime: new Date().toISOString(),
        lastActivity: Date.now() - 30000
      }
    });

    // Log fatal error
    logger.fatal('Critical system failure', {
      component: 'payment-processor',
      error: 'Unable to connect to payment gateway',
      affectedUsers: 1500
    });

    console.log('Log4js error handling example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    log4js.shutdown();
  }
}

// Run examples
async function main() {
  await log4jsBasicExample();
  await log4jsAdvancedExample();  
  await log4jsErrorHandlingExample();
}

if (require.main === module) {
  main().catch(console.error);
}