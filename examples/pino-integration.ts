import pino from 'pino';
import {
  createUnixClient,
  createBatchClient,
  createLogFluxDestination,
  LogFluxDestination
} from '../src';

async function pinoBasicExample() {
  console.log('=== Pino Basic Example ===');
  
  const client = createUnixClient();
  const batchClient = createBatchClient(client);
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create LogFlux destination
    const logFluxDestination = createLogFluxDestination({
      client: batchClient,
      source: 'pino-basic-example',
      metadata: {
        service: 'user-service',
        version: '2.1.0'
      }
    });

    // Create Pino logger with multiple destinations
    const logger = pino({
      level: 'info',
      name: 'user-service'
    }, pino.multistream([
      // Send to LogFlux
      { level: 'info', stream: logFluxDestination },
      // Also log to console for demonstration
      { level: 'info', stream: process.stdout }
    ]));

    // Basic logging
    logger.info('Service starting up');
    logger.warn('Configuration warning detected');
    logger.error('Database connection error');

    // Structured logging with objects
    logger.info({
      userId: '12345',
      action: 'login',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }, 'User login successful');

    // Error logging with error object
    try {
      throw new Error('Database query failed');
    } catch (err) {
      logger.error({
        err,
        query: 'SELECT * FROM users WHERE id = ?',
        params: ['12345'],
        component: 'database'
      }, 'Database error occurred');
    }

    // Performance logging
    logger.info({
      operation: 'user_lookup',
      duration: 45,
      cacheHit: true,
      resultCount: 1
    }, 'Database operation completed');

    console.log('Pino basic example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 200));
    await logFluxDestination.close();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await batchClient.stop();
  }
}

async function pinoAdvancedExample() {
  console.log('\n=== Pino Advanced Example ===');
  
  const client = createUnixClient();
  const batchClient = createBatchClient(client);
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create different destinations for different log levels
    const infoDestination = createLogFluxDestination({
      client: batchClient,
      source: 'pino-info',
      metadata: {
        level: 'info',
        environment: 'production'
      }
    });

    const errorDestination = createLogFluxDestination({
      client: batchClient,
      source: 'pino-errors',
      metadata: {
        level: 'error',
        environment: 'production',
        alerting: 'enabled'
      }
    });

    // Create logger with custom serializers and multiple streams
    const logger = pino({
      level: 'debug',
      name: 'payment-service',
      serializers: {
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
        err: pino.stdSerializers.err
      }
    }, pino.multistream([
      { level: 'info', stream: infoDestination },
      { level: 'error', stream: errorDestination },
      { level: 'debug', stream: process.stdout }
    ]));

    // HTTP request logging (simulated Express middleware style)
    const req = {
      method: 'POST',
      url: '/api/payments',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer xxx...xxx'
      }
    };

    const res = {
      statusCode: 201,
      headers: {
        'content-type': 'application/json'
      }
    };

    logger.info({
      req,
      requestId: 'req_abc123'
    }, 'Incoming payment request');

    // Business logic logging
    logger.info({
      orderId: 'order_456',
      amount: 99.99,
      currency: 'USD',
      paymentMethod: 'stripe'
    }, 'Processing payment');

    // Performance metrics
    logger.debug({
      operation: 'payment_validation',
      duration: 23,
      rules_checked: 5,
      result: 'pass'
    }, 'Payment validation completed');

    logger.info({
      res,
      requestId: 'req_abc123',
      responseTime: 156
    }, 'Payment request completed');

    // Error scenarios
    try {
      throw new Error('Payment gateway timeout');
    } catch (err) {
      logger.error({
        err,
        orderId: 'order_789',
        paymentGateway: 'stripe',
        retryCount: 3,
        component: 'payment-processor'
      }, 'Payment processing failed');
    }

    console.log('Pino advanced example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 200));
    await infoDestination.close();
    await errorDestination.close();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await batchClient.stop();
  }
}

async function pinoChildLoggerExample() {
  console.log('\n=== Pino Child Logger Example ===');
  
  const client = createUnixClient();
  const batchClient = createBatchClient(client);
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create base logger
    const destination = createLogFluxDestination({
      client: batchClient,
      source: 'pino-child-loggers',
      metadata: {
        application: 'microservice-api'
      }
    });

    const baseLogger = pino({
      level: 'info',
      name: 'api-service'
    }, pino.multistream([
      { level: 'info', stream: destination },
      { level: 'info', stream: process.stdout }
    ]));

    // Create child loggers with additional context
    const requestLogger = baseLogger.child({
      requestId: 'req_12345',
      userId: 'user_789',
      traceId: 'trace_abc123'
    });

    const dbLogger = baseLogger.child({
      component: 'database',
      database: 'users_db',
      pool: 'primary'
    });

    const cacheLogger = baseLogger.child({
      component: 'cache',
      provider: 'redis',
      cluster: 'primary'
    });

    // Use child loggers
    requestLogger.info({
      method: 'GET',
      path: '/api/users/profile',
      ip: '10.0.0.1'
    }, 'Processing user profile request');

    // Database operations
    dbLogger.debug({
      query: 'SELECT id, username, email FROM users WHERE id = $1',
      params: ['user_789'],
      executionPlan: 'Index Scan using users_pkey'
    }, 'Executing user lookup query');

    dbLogger.info({
      query: 'user_lookup',
      duration: 12,
      rowsReturned: 1,
      cacheableResult: true
    }, 'Database query completed');

    // Cache operations  
    cacheLogger.debug({
      operation: 'SET',
      key: 'user:user_789:profile',
      ttl: 300,
      size: 156
    }, 'Caching user profile');

    cacheLogger.info({
      operation: 'GET',
      key: 'user:user_789:permissions',
      hit: true,
      size: 89
    }, 'Cache hit for user permissions');

    // Request completion
    requestLogger.info({
      statusCode: 200,
      responseTime: 67,
      cacheHits: 1,
      dbQueries: 1
    }, 'Request completed successfully');

    // Deeply nested child logger
    const transactionLogger = dbLogger.child({
      transactionId: 'txn_456',
      isolationLevel: 'READ_COMMITTED'
    });

    transactionLogger.debug('Transaction started');
    transactionLogger.debug({
      operation: 'UPDATE',
      table: 'users',
      rowsAffected: 1
    }, 'Updated user profile');
    transactionLogger.info({
      duration: 34,
      operations: 2,
      committed: true
    }, 'Transaction completed');

    console.log('Pino child logger example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 200));
    await destination.close();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await batchClient.stop();
  }
}

async function pinoHighVolumeExample() {
  console.log('\n=== Pino High Volume Example ===');
  
  const client = createUnixClient();
  const batchClient = createBatchClient(client);
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create high-performance destination
    const destination = createLogFluxDestination({
      client: batchClient,
      source: 'pino-high-volume',
      metadata: {
        environment: 'production',
        service: 'high-throughput-api'
      }
    });

    // Create logger optimized for performance
    const logger = pino({
      level: 'info',
      name: 'high-volume-service',
      // Pino performance optimizations
      useLevelLabels: false,
      changeLevelName: 'severity',
      base: null // Remove default fields for performance
    }, destination);

    console.log('Generating high volume logs...');

    // Simulate high-volume logging
    const startTime = Date.now();
    const logCount = 100;

    for (let i = 0; i < logCount; i++) {
      // API request logs
      logger.info({
        reqId: `req_${i}`,
        method: 'GET',
        path: '/api/data',
        status: 200,
        duration: Math.floor(Math.random() * 100) + 10
      }, 'API request processed');

      // Business event logs
      if (i % 10 === 0) {
        logger.info({
          eventType: 'user_action',
          userId: `user_${Math.floor(Math.random() * 1000)}`,
          action: 'data_access',
          resourceId: `resource_${i}`
        }, 'User action recorded');
      }

      // Error logs (occasional)
      if (i % 25 === 0) {
        logger.error({
          errorCode: 'E001',
          message: 'Temporary service unavailable',
          retryAfter: 5000
        }, 'Service error occurred');
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`Generated ${logCount} logs in ${duration}ms (${Math.round(logCount / duration * 1000)} logs/sec)`);

    // Wait for batch processing
    await new Promise(resolve => setTimeout(resolve, 500));
    await destination.close();

    console.log('Pino high volume example completed');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await batchClient.stop();
  }
}

// Run examples
async function main() {
  await pinoBasicExample();
  await pinoAdvancedExample();
  await pinoChildLoggerExample();
  await pinoHighVolumeExample();
}

if (require.main === module) {
  main().catch(console.error);
}