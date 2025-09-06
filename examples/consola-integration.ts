import { consola } from 'consola';
import { 
  createUnixClient,
  LogFluxReporter,
  createLogFluxReporter,
  addLogFluxReporter,
  createLogFluxConsola
} from '../src';

async function consolaBasicExample() {
  console.log('=== Consola Basic Example ===');
  
  const client = createUnixClient();
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Add LogFlux reporter to the global consola instance
    const reporter = addLogFluxReporter(consola, client, 'consola-basic-example', {
      includeMetadata: true,
      metadata: { 
        service: 'web-app',
        version: '2.1.0'
      }
    });

    // Use consola normally - output goes to both console and LogFlux
    consola.info('Application starting...');
    consola.success('Database connection established');
    consola.warn('Deprecated API usage detected');
    consola.error('Failed to load configuration file');
    consola.debug('User session created', { sessionId: 'sess_abc123' });

    // Consola's special log types
    consola.start('Server initialization');
    consola.ready('Server ready on port 3000');
    consola.fail('Health check failed');

    // With tags
    consola.withTag('auth').info('User logged in successfully');
    consola.withTag('database').debug('Query executed in 45ms');

    console.log('Consola basic example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

async function consolaCustomReporterExample() {
  console.log('\n=== Consola Custom Reporter Example ===');
  
  const client = createUnixClient();
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create custom reporter with filtering
    const reporter = createLogFluxReporter(client, 'consola-custom-example', {
      minLevel: 2, // Only send ERROR and above to LogFlux
      messageFormatter: (args: any[]) => {
        // Custom formatting for LogFlux
        const timestamp = new Date().toISOString();
        const message = args.join(' ');
        return `[${timestamp}] ${message}`;
      },
      metadata: {
        environment: 'production',
        region: 'us-east-1'
      }
    });

    // Create new consola instance with custom configuration
    const logger = consola.create({
      level: 4, // INFO level
      reporters: [
        reporter,
        consola._reporters[0] // Keep console reporter
      ]
    });

    // These will go to both console and LogFlux
    logger.error('Critical error occurred');
    logger.fatal('System is shutting down');
    
    // These will only go to console (below minLevel)
    logger.info('This is just an info message');
    logger.debug('Debug information');
    logger.warn('Warning message');

    console.log('Consola custom reporter example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

async function consolaAdvancedExample() {
  console.log('\n=== Consola Advanced Example ===');
  
  const client = createUnixClient();
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create dedicated LogFlux consola instance
    const logfluxLogger = createLogFluxConsola(client, 'consola-advanced-example', {
      includeConsoleReporter: true, // Also log to console
      metadata: {
        component: 'payment-service',
        instanceId: 'web-01'
      },
      consolaConfig: {
        level: 3, // WARN and above
        throttle: 1000, // Throttle repeated messages
        formatOptions: {
          colors: true,
          compact: false
        }
      }
    });

    // Business logic logging
    logfluxLogger.info('Processing payment', {
      orderId: 'order_123',
      amount: 99.99,
      currency: 'USD'
    });

    logfluxLogger.success('Payment processed successfully', {
      transactionId: 'txn_456',
      processingTime: '1.2s'
    });

    // Error scenarios
    try {
      throw new Error('Payment gateway timeout');
    } catch (err) {
      logfluxLogger.error('Payment processing failed', {
        error: err.message,
        orderId: 'order_124',
        retryCount: 3
      });
    }

    // Performance monitoring
    logfluxLogger.withTag('performance').info('API response time', {
      endpoint: '/api/payments',
      method: 'POST',
      responseTime: 245,
      statusCode: 200
    });

    // Security events
    logfluxLogger.withTag('security').warn('Suspicious activity detected', {
      ip: '192.168.1.100',
      userAgent: 'curl/7.68.0',
      endpoint: '/admin/users',
      attempts: 5
    });

    console.log('Consola advanced example completed');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

async function consolaVueNuxtExample() {
  console.log('\n=== Consola Vue/Nuxt Style Example ===');
  
  const client = createUnixClient();
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Simulate Vue/Nuxt application logging
    const logger = createLogFluxConsola(client, 'vue-nuxt-app', {
      metadata: {
        framework: 'nuxt',
        mode: 'universal',
        version: '3.0.0'
      }
    });

    // Application lifecycle
    logger.start('Starting Nuxt application...');
    logger.info('Loading middleware');
    logger.info('Loading plugins');
    logger.success('Client compiled successfully');
    logger.success('Server compiled successfully');
    logger.ready('Server ready at http://localhost:3000');

    // Route navigation
    logger.withTag('router').info('Navigating to /dashboard');
    logger.withTag('ssr').debug('Server-side rendering page');
    logger.withTag('hydration').debug('Client hydration complete');

    // API calls
    logger.withTag('api').info('Fetching user data');
    logger.withTag('api').success('User data loaded');

    // Error handling
    logger.withTag('error').error('404 - Page not found: /unknown-route');
    logger.withTag('error').warn('Slow API response detected', {
      endpoint: '/api/posts',
      duration: 5000
    });

    // Build/development
    logger.withTag('build').info('Hot reload triggered');
    logger.withTag('build').success('Rebuilt in 234ms');

    console.log('Consola Vue/Nuxt example completed');

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
  await consolaBasicExample();
  await consolaCustomReporterExample();
  await consolaAdvancedExample();
  await consolaVueNuxtExample();
}

if (require.main === module) {
  main().catch(console.error);
}