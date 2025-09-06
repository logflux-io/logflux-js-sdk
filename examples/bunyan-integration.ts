import bunyan from 'bunyan';
import {
  createUnixClient,
  createBatchClient,
  LogFluxStream,
  createLogFluxStream
} from '../src';

async function bunyanBasicExample() {
  console.log('=== Bunyan Basic Example ===');
  
  const client = createUnixClient();
  const batchClient = createBatchClient(client);
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create Bunyan logger with LogFlux stream
    const logger = bunyan.createLogger({
      name: 'user-service',
      level: 'info',
      streams: [
        // LogFlux stream
        createLogFluxStream({
          client: batchClient,
          source: 'bunyan-basic-example',
          metadata: {
            service: 'user-service',
            version: '1.5.0',
            environment: 'production'
          }
        }),
        // Console stream for demonstration
        {
          level: 'info',
          stream: process.stdout
        }
      ]
    });

    // Basic logging
    logger.info('Service initialization started');
    logger.warn('Configuration deprecation warning');
    logger.error('Database connection timeout');

    // Structured logging with fields
    logger.info({
      userId: '12345',
      action: 'login',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      duration: 156
    }, 'User login completed');

    // Error logging with error object
    try {
      throw new Error('Database connection pool exhausted');
    } catch (err) {
      logger.error({
        err,
        component: 'database',
        pool: 'primary',
        activeConnections: 20,
        maxConnections: 20
      }, 'Database error occurred');
    }

    // Performance logging
    logger.info({
      operation: 'user_lookup',
      query: 'SELECT * FROM users WHERE id = ?',
      duration: 23,
      cacheHit: false,
      resultCount: 1
    }, 'Database operation completed');

    console.log('Bunyan basic example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await batchClient.stop();
  }
}

async function bunyanMultiStreamExample() {
  console.log('\n=== Bunyan Multi-Stream Example ===');
  
  const client = createUnixClient();
  const batchClient = createBatchClient(client);
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create different streams for different purposes
    const infoStream = new LogFluxStream({
      client: batchClient,
      source: 'bunyan-info',
      metadata: {
        type: 'application-logs',
        severity: 'info'
      }
    });

    const errorStream = new LogFluxStream({
      client: batchClient,
      source: 'bunyan-errors',
      metadata: {
        type: 'error-logs',
        severity: 'error',
        alerting: 'enabled'
      }
    });

    const auditStream = new LogFluxStream({
      client: batchClient,
      source: 'bunyan-audit',
      metadata: {
        type: 'audit-logs',
        retention: 'long-term'
      }
    });

    // Create logger with multiple streams
    const logger = bunyan.createLogger({
      name: 'payment-service',
      level: 'debug',
      streams: [
        // Info and above to info stream
        { level: 'info', type: 'raw', stream: infoStream },
        // Errors to error stream
        { level: 'error', type: 'raw', stream: errorStream },
        // All levels to console
        { level: 'debug', stream: process.stdout }
      ]
    });

    // Create audit logger (separate logger for audit events)
    const auditLogger = bunyan.createLogger({
      name: 'audit',
      level: 'info',
      streams: [
        { level: 'info', type: 'raw', stream: auditStream },
        { level: 'info', stream: process.stdout }
      ]
    });

    // Application logging
    logger.info({
      operation: 'payment_processing',
      orderId: 'order_123',
      amount: 99.99,
      currency: 'USD'
    }, 'Processing payment request');

    logger.debug({
      step: 'validation',
      rules: ['amount_check', 'card_check', 'fraud_check'],
      results: [true, true, true]
    }, 'Payment validation completed');

    logger.info({
      operation: 'payment_processing',
      orderId: 'order_123',
      status: 'completed',
      transactionId: 'txn_456'
    }, 'Payment processed successfully');

    // Error logging
    try {
      throw new Error('Payment gateway API error');
    } catch (err) {
      logger.error({
        err,
        orderId: 'order_124',
        gateway: 'stripe',
        apiEndpoint: '/v1/charges',
        httpStatus: 503,
        retryCount: 3
      }, 'Payment processing failed');
    }

    // Audit logging
    auditLogger.info({
      event: 'user_action',
      userId: 'user_789',
      action: 'view_sensitive_data',
      resource: '/api/users/123/payment-methods',
      ip: '10.0.0.1',
      userAgent: 'PostmanRuntime/7.32.3'
    }, 'Sensitive data access');

    auditLogger.warn({
      event: 'security_event',
      type: 'multiple_failed_logins',
      userId: 'user_456',
      attempts: 5,
      timeWindow: '5m',
      ip: '192.168.1.100'
    }, 'Multiple failed login attempts detected');

    console.log('Bunyan multi-stream example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 200));
    await infoStream.close();
    await errorStream.close();
    await auditStream.close();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await batchClient.stop();
  }
}

async function bunyanChildLoggerExample() {
  console.log('\n=== Bunyan Child Logger Example ===');
  
  const client = createUnixClient();
  const batchClient = createBatchClient(client);
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create parent logger
    const parentLogger = bunyan.createLogger({
      name: 'api-gateway',
      level: 'info',
      streams: [
        createLogFluxStream({
          client: batchClient,
          source: 'bunyan-parent',
          metadata: {
            application: 'api-gateway',
            version: '2.0.0'
          }
        }),
        { level: 'info', stream: process.stdout }
      ]
    });

    // Create child loggers with additional context
    const requestLogger = parentLogger.child({
      requestId: 'req_abc123',
      userId: 'user_789',
      sessionId: 'sess_xyz789',
      traceId: 'trace_123456'
    });

    const dbLogger = parentLogger.child({
      component: 'database',
      database: 'main_db',
      pool: 'primary'
    });

    const cacheLogger = parentLogger.child({
      component: 'cache',
      provider: 'redis',
      cluster: 'main'
    });

    // Request processing
    requestLogger.info({
      method: 'POST',
      path: '/api/orders',
      contentLength: 256,
      ip: '203.0.113.1'
    }, 'Processing order creation request');

    // Database operations
    dbLogger.debug({
      operation: 'INSERT',
      table: 'orders',
      query: 'INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)',
      params: ['user_789', 149.99, 'pending']
    }, 'Executing order insert');

    dbLogger.info({
      operation: 'INSERT',
      table: 'orders',
      duration: 15,
      rowsAffected: 1,
      orderId: 'order_456'
    }, 'Order created in database');

    // Cache operations
    cacheLogger.debug({
      operation: 'SET',
      key: 'user:user_789:cart',
      ttl: 1800,
      size: 512
    }, 'Updated user cart cache');

    cacheLogger.info({
      operation: 'DEL',
      key: 'user:user_789:cart',
      result: 'success'
    }, 'Cleared user cart cache');

    // Request completion
    requestLogger.info({
      statusCode: 201,
      responseTime: 89,
      orderId: 'order_456',
      cacheOperations: 2,
      dbOperations: 1
    }, 'Order creation completed');

    // Deeply nested child logger for transaction handling
    const transactionLogger = dbLogger.child({
      transactionId: 'txn_789',
      isolationLevel: 'READ_COMMITTED'
    });

    transactionLogger.debug('Database transaction started');
    
    transactionLogger.debug({
      operation: 'UPDATE',
      table: 'inventory',
      condition: 'product_id = ?',
      params: ['prod_123']
    }, 'Updating inventory count');

    transactionLogger.info({
      operations: 3,
      duration: 45,
      committed: true
    }, 'Transaction completed successfully');

    console.log('Bunyan child logger example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await batchClient.stop();
  }
}

async function bunyanSerializerExample() {
  console.log('\n=== Bunyan Serializer Example ===');
  
  const client = createUnixClient();
  const batchClient = createBatchClient(client);
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Custom serializers for specific object types
    const customSerializers = {
      // HTTP request serializer
      req: (req: any) => ({
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.headers?.['user-agent'],
          'content-type': req.headers?.['content-type'],
          'authorization': req.headers?.['authorization'] ? '[REDACTED]' : undefined
        },
        remoteAddress: req.connection?.remoteAddress,
        remotePort: req.connection?.remotePort
      }),

      // HTTP response serializer
      res: (res: any) => ({
        statusCode: res.statusCode,
        headers: {
          'content-type': res.headers?.['content-type'],
          'content-length': res.headers?.['content-length']
        },
        responseTime: res.responseTime
      }),

      // Error serializer with additional context
      err: (err: any) => ({
        name: err.name,
        message: err.message,
        code: err.code,
        signal: err.signal,
        stack: err.stack,
        cause: err.cause
      }),

      // User object serializer (with PII redaction)
      user: (user: any) => ({
        id: user.id,
        username: user.username,
        email: user.email ? user.email.replace(/(.{2}).*@/, '$1***@') : undefined,
        roles: user.roles,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      })
    };

    // Create logger with custom serializers
    const logger = bunyan.createLogger({
      name: 'serializer-example',
      level: 'info',
      serializers: customSerializers,
      streams: [
        createLogFluxStream({
          client: batchClient,
          source: 'bunyan-serializers',
          metadata: {
            type: 'serialized-logs',
            version: '1.0.0'
          }
        }),
        { level: 'info', stream: process.stdout }
      ]
    });

    // Mock request/response objects
    const mockReq = {
      method: 'POST',
      url: '/api/login',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'content-type': 'application/json',
        'authorization': 'Bearer eyJhbGciOiJIUzI1NiIs...'
      },
      connection: {
        remoteAddress: '192.168.1.100',
        remotePort: 54321
      }
    };

    const mockRes = {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'content-length': '156'
      },
      responseTime: 89
    };

    const mockUser = {
      id: 'user_123',
      username: 'alice',
      email: 'alice.smith@example.com',
      roles: ['user', 'editor'],
      createdAt: '2023-01-15T10:30:00Z',
      lastLoginAt: '2023-12-01T14:22:33Z',
      password: 'secret123' // This won't be serialized
    };

    // Log with serialized objects
    logger.info({
      req: mockReq,
      user: mockUser
    }, 'User login request received');

    logger.info({
      req: mockReq,
      res: mockRes,
      user: mockUser
    }, 'User login completed');

    // Error logging with serialized error
    try {
      const err = new Error('Database connection timeout');
      err.code = 'ETIMEDOUT';
      err.cause = 'Network unreachable';
      throw err;
    } catch (err) {
      logger.error({
        err,
        req: mockReq,
        operation: 'user_login',
        retryCount: 2
      }, 'Login failed due to database error');
    }

    // Performance logging with custom data
    logger.info({
      performance: {
        dbQueries: 3,
        cacheHits: 2,
        cacheMisses: 1,
        totalTime: 145,
        breakdown: {
          auth: 23,
          validation: 12,
          database: 89,
          response: 21
        }
      },
      req: mockReq
    }, 'Performance metrics for request');

    console.log('Bunyan serializer example completed');

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
  await bunyanBasicExample();
  await bunyanMultiStreamExample();
  await bunyanChildLoggerExample();
  await bunyanSerializerExample();
}

if (require.main === module) {
  main().catch(console.error);
}