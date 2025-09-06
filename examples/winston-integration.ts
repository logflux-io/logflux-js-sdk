import winston from 'winston';
import {
  createUnixClient,
  createBatchClient,
  LogFluxTransport
} from '../src';

async function winstonBasicExample() {
  console.log('=== Winston Basic Example ===');
  
  const client = createUnixClient();
  const batchClient = createBatchClient(client);
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create Winston logger with LogFlux transport
    const logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new LogFluxTransport({
          client: batchClient,
          source: 'winston-basic-example',
          level: 'info',
          metadata: {
            service: 'web-api',
            version: '1.0.0'
          }
        }),
        // Also log to console for demonstration
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    // Basic logging
    logger.info('Application starting up');
    logger.warn('This is a warning message');
    logger.error('An error occurred', { errorCode: 'E001' });

    // Structured logging
    logger.info('User login successful', {
      userId: '12345',
      username: 'alice',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0...'
    });

    // Error logging with stack trace
    try {
      throw new Error('Database connection failed');
    } catch (err) {
      logger.error('Database error', {
        error: err.message,
        stack: err.stack,
        component: 'database'
      });
    }

    console.log('Winston basic example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await batchClient.stop();
  }
}

async function winstonAdvancedExample() {
  console.log('\n=== Winston Advanced Example ===');
  
  const client = createUnixClient();
  const batchClient = createBatchClient(client);
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create multiple loggers for different components
    const createComponentLogger = (component: string) => {
      return winston.createLogger({
        level: 'debug',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
        defaultMeta: { component },
        transports: [
          new LogFluxTransport({
            client: batchClient,
            source: `winston-${component}`,
            metadata: {
              component,
              environment: 'production',
              region: 'us-east-1'
            }
          }),
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          })
        ]
      });
    };

    const httpLogger = createComponentLogger('http');
    const dbLogger = createComponentLogger('database');
    const authLogger = createComponentLogger('auth');

    // HTTP request logging
    httpLogger.info('Incoming request', {
      method: 'POST',
      url: '/api/users',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'axios/1.0.0'
      },
      body: { username: 'bob', email: 'bob@example.com' }
    });

    httpLogger.info('Request completed', {
      method: 'POST',
      url: '/api/users',
      statusCode: 201,
      responseTime: 145
    });

    // Database logging
    dbLogger.debug('Executing query', {
      sql: 'INSERT INTO users (username, email) VALUES (?, ?)',
      params: ['bob', 'bob@example.com']
    });

    dbLogger.info('Query completed', {
      query: 'INSERT INTO users',
      duration: 23,
      rowsAffected: 1
    });

    // Authentication logging
    authLogger.info('User authentication', {
      userId: '67890',
      method: 'jwt',
      success: true,
      roles: ['user', 'editor']
    });

    authLogger.warn('Rate limit warning', {
      userId: '67890',
      endpoint: '/api/upload',
      requestCount: 95,
      limit: 100,
      windowMs: 60000
    });

    // Performance monitoring
    const performanceLogger = createComponentLogger('performance');
    performanceLogger.info('Performance metrics', {
      endpoint: '/api/users',
      avgResponseTime: 156,
      p95ResponseTime: 320,
      requestsPerSecond: 45.2,
      errorRate: 0.01
    });

    console.log('Winston advanced example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await batchClient.stop();
  }
}

async function winstonCustomFormatsExample() {
  console.log('\n=== Winston Custom Formats Example ===');
  
  const client = createUnixClient();
  const batchClient = createBatchClient(client);
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Custom format for business events
    const businessEventFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
          '@timestamp': timestamp,
          level,
          event: message,
          ...meta
        });
      })
    );

    const businessLogger = winston.createLogger({
      level: 'info',
      format: businessEventFormat,
      transports: [
        new LogFluxTransport({
          client: batchClient,
          source: 'business-events',
          metadata: {
            type: 'business-event',
            system: 'ecommerce'
          }
        }),
        new winston.transports.Console()
      ]
    });

    // Business event logging
    businessLogger.info('order_placed', {
      orderId: 'ORD-2023-001',
      userId: 'user_789',
      amount: 299.99,
      currency: 'USD',
      items: [
        { sku: 'LAPTOP-001', quantity: 1, price: 299.99 }
      ],
      paymentMethod: 'credit_card'
    });

    businessLogger.info('payment_processed', {
      orderId: 'ORD-2023-001',
      paymentId: 'pay_abc123',
      amount: 299.99,
      currency: 'USD',
      processingTime: 1.23
    });

    businessLogger.info('order_shipped', {
      orderId: 'ORD-2023-001',
      trackingNumber: 'TRK-456789',
      carrier: 'UPS',
      estimatedDelivery: '2023-12-15'
    });

    // Error tracking with custom format
    const errorFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        return JSON.stringify({
          '@timestamp': timestamp,
          level,
          error: message,
          stack,
          context: meta
        });
      })
    );

    const errorLogger = winston.createLogger({
      level: 'error',
      format: errorFormat,
      transports: [
        new LogFluxTransport({
          client: batchClient,
          source: 'error-tracking',
          metadata: {
            type: 'error',
            severity: 'high'
          }
        })
      ]
    });

    // Error logging
    try {
      throw new Error('Payment gateway connection failed');
    } catch (err) {
      errorLogger.error(err, {
        orderId: 'ORD-2023-002',
        userId: 'user_456',
        retryCount: 3,
        lastRetryAt: new Date().toISOString()
      });
    }

    console.log('Winston custom formats example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await batchClient.stop();
  }
}

async function winstonChildLoggerExample() {
  console.log('\n=== Winston Child Logger Example ===');
  
  const client = createUnixClient();
  const batchClient = createBatchClient(client);
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create parent logger
    const parentLogger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'api-gateway' },
      transports: [
        new LogFluxTransport({
          client: batchClient,
          source: 'winston-parent',
          metadata: {
            application: 'api-gateway',
            environment: 'production'
          }
        }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    // Create child loggers with additional context
    const requestLogger = parentLogger.child({
      requestId: 'req_12345',
      userId: 'user_789',
      sessionId: 'sess_abc'
    });

    const dbLogger = parentLogger.child({
      component: 'database',
      pool: 'primary'
    });

    // Use child loggers
    requestLogger.info('Processing user request', {
      endpoint: '/api/profile',
      method: 'GET'
    });

    dbLogger.debug('Executing user query', {
      table: 'users',
      operation: 'SELECT'
    });

    requestLogger.info('Request completed successfully', {
      statusCode: 200,
      responseTime: 89
    });

    // Create deeply nested child logger
    const dbTransactionLogger = dbLogger.child({
      transactionId: 'txn_456',
      isolation: 'READ_COMMITTED'
    });

    dbTransactionLogger.debug('Transaction started');
    dbTransactionLogger.debug('Updating user profile');
    dbTransactionLogger.info('Transaction committed', {
      duration: 45,
      operations: 2
    });

    console.log('Winston child logger example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await batchClient.stop();
  }
}

// Run examples
async function main() {
  await winstonBasicExample();
  await winstonAdvancedExample();
  await winstonCustomFormatsExample();
  await winstonChildLoggerExample();
}

if (require.main === module) {
  main().catch(console.error);
}