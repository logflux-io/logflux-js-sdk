# Logging Library Integrations

The LogFlux JavaScript SDK provides seamless integrations with popular Node.js logging libraries. These integrations allow you to add LogFlux as a transport/destination without changing your existing logging code.

## Table of Contents

- [Winston Integration](#winston-integration)
- [Bunyan Integration](#bunyan-integration)
- [Pino Integration](#pino-integration)
- [Debug Integration](#debug-integration)
- [Log4js Integration](#log4js-integration)
- [Consola Integration](#consola-integration)
- [Loglevel Integration](#loglevel-integration)
- [Custom Integration Guide](#custom-integration-guide)
- [Performance Considerations](#performance-considerations)

## Winston Integration

Winston is one of the most popular logging libraries for Node.js. The LogFlux Winston transport makes integration seamless.

### Installation

The Winston integration is included with the main SDK package.

```bash
npm install winston @logflux-io/logflux-js-sdk
```

### Basic Usage

```typescript
import winston from 'winston';
import { LogFluxTransport, createBatchClient, createUnixClient } from '@logflux-io/logflux-js-sdk';

// Create LogFlux client
const client = createUnixClient();
const batchClient = createBatchClient(client);

// Create Winston logger with LogFlux transport
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new LogFluxTransport({
      client: batchClient,
      source: 'my-app',
      metadata: { 
        service: 'user-service',
        version: '1.0.0'
      }
    })
  ]
});

// Use Winston normally - logs will be sent to both console and LogFlux
logger.info('Application started');
logger.error('Database connection failed', { error: 'Connection timeout' });
```

### Winston Transport Options

```typescript
interface LogFluxTransportOptions {
  client: LogFluxClient | BatchClient;
  source: string;
  metadata?: Record<string, string>;
  level?: string;
  format?: winston.Logform.Format;
  handleExceptions?: boolean;
  handleRejections?: boolean;
}
```

**Options:**
- `client` (required): LogFlux client or batch client instance
- `source` (required): Source identifier for logs
- `metadata` (optional): Static metadata added to all log entries
- `level` (optional): Minimum log level (default: 'info')
- `format` (optional): Winston format for log transformation
- `handleExceptions` (optional): Handle uncaught exceptions (default: false)
- `handleRejections` (optional): Handle unhandled promise rejections (default: false)

### Advanced Winston Configuration

```typescript
import winston from 'winston';
import { LogFluxTransport, createBatchClient, createUnixClient } from '@logflux-io/logflux-js-sdk';

const client = createUnixClient();
const batchClient = createBatchClient(client, {
  maxBatchSize: 100,
  flushInterval: 2000
});

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new LogFluxTransport({
      client: batchClient,
      source: 'production-app',
      level: 'info',
      metadata: {
        environment: 'production',
        datacenter: 'us-west-2'
      },
      handleExceptions: true,
      handleRejections: true
    })
  ]
});

// Structured logging with Winston
logger.info('User logged in', {
  userId: '123',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});
```

## Bunyan Integration

Bunyan is a structured logging library for Node.js. The LogFlux integration provides a Bunyan stream.

### Installation

```bash
npm install bunyan @logflux-io/logflux-js-sdk
```

### Basic Usage

```typescript
import bunyan from 'bunyan';
import { createLogFluxStream, createBatchClient, createUnixClient } from '@logflux-io/logflux-js-sdk';

// Create LogFlux client
const client = createUnixClient();
const batchClient = createBatchClient(client);

// Create Bunyan logger with LogFlux stream
const logger = bunyan.createLogger({
  name: 'my-app',
  streams: [
    {
      name: 'stdout',
      stream: process.stdout,
      level: 'info'
    },
    createLogFluxStream({
      client: batchClient,
      source: 'my-app',
      level: 'info'
    })
  ]
});

// Use Bunyan normally
logger.info('Application started');
logger.error({ err: new Error('Database failed') }, 'Connection error');
```

### Bunyan Stream Options

```typescript
interface LogFluxStreamOptions {
  client: LogFluxClient | BatchClient;
  source?: string;
  level?: bunyan.LogLevel;
  metadata?: Record<string, string>;
}
```

### Advanced Bunyan Configuration

```typescript
import bunyan from 'bunyan';
import { createLogFluxStream, createBatchClient, createUnixClient } from '@logflux-io/logflux-js-sdk';

const client = createUnixClient();
const batchClient = createBatchClient(client);

const logger = bunyan.createLogger({
  name: 'production-service',
  streams: [
    // Console stream for development
    {
      name: 'stdout',
      stream: process.stdout,
      level: 'debug'
    },
    // LogFlux stream for production logging
    createLogFluxStream({
      client: batchClient,
      source: 'production-service',
      level: 'info',
      metadata: {
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    })
  ]
});

// Structured logging with Bunyan
logger.info({
  userId: '123',
  action: 'purchase',
  amount: 99.99,
  currency: 'USD'
}, 'User made purchase');
```

## Pino Integration

Pino is a very low overhead Node.js logger. The LogFlux integration provides a Pino destination.

### Installation

```bash
npm install pino @logflux-io/logflux-js-sdk
```

### Basic Usage

```typescript
import pino from 'pino';
import { createLogFluxDestination, createBatchClient, createUnixClient } from '@logflux-io/logflux-js-sdk';

// Create LogFlux client
const client = createUnixClient();
const batchClient = createBatchClient(client);

// Create Pino logger with LogFlux destination
const logger = pino({
  level: 'info'
}, pino.multistream([
  { stream: process.stdout },
  createLogFluxDestination({
    client: batchClient,
    source: 'my-app'
  })
]));

// Use Pino normally
logger.info('Application started');
logger.error({ err: new Error('Failed') }, 'Operation failed');
```

### Pino Destination Options

```typescript
interface LogFluxDestinationOptions {
  client: LogFluxClient | BatchClient;
  source?: string;
  metadata?: Record<string, string>;
}
```

### High-Performance Pino Setup

```typescript
import pino from 'pino';
import { createLogFluxDestination, createBatchClient, createUnixClient } from '@logflux-io/logflux-js-sdk';

const client = createUnixClient();
const batchClient = createBatchClient(client, {
  maxBatchSize: 200,  // Higher batch size for performance
  flushInterval: 5000 // Less frequent flushes
});

// Pino with optimized settings
const logger = pino({
  level: 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label })
  }
}, createLogFluxDestination({
  client: batchClient,
  source: 'high-perf-service',
  metadata: {
    service: 'api-server',
    instance: process.env.INSTANCE_ID || 'unknown'
  }
}));
```

## Debug Integration

The Debug library is widely used for debugging Node.js applications. The LogFlux integration captures debug messages.

### Installation

```bash
npm install debug @logflux-io/logflux-js-sdk
```

### Basic Usage

```typescript
import { setupDebugIntegration, createBatchClient, createUnixClient } from '@logflux-io/logflux-js-sdk';

// Create LogFlux client
const client = createUnixClient();
const batchClient = createBatchClient(client);

// Setup Debug integration
setupDebugIntegration({
  client: batchClient,
  source: 'my-app',
  namespaceFilter: 'my-app:*' // Only capture debug messages from 'my-app' namespace
});

// Use Debug normally
import createDebug from 'debug';
const debug = createDebug('my-app:database');

debug('Connecting to database...');
debug('Query executed: %s', 'SELECT * FROM users');
```

### Debug Integration Options

```typescript
interface DebugIntegrationOptions {
  client: LogFluxClient | BatchClient;
  source: string;
  namespaceFilter?: string;
  metadata?: Record<string, string>;
  logLevel?: LogLevel;
}
```

## Log4js Integration

Log4js is a logging library inspired by the Java log4j library.

### Installation

```bash
npm install log4js @logflux-io/logflux-js-sdk
```

### Basic Usage

```typescript
import log4js from 'log4js';
import { createLogFluxAppender, createBatchClient, createUnixClient } from '@logflux-io/logflux-js-sdk';

// Create LogFlux client
const client = createUnixClient();
const batchClient = createBatchClient(client);

// Configure log4js with LogFlux appender
log4js.configure({
  appenders: {
    console: { type: 'console' },
    logflux: createLogFluxAppender({
      client: batchClient,
      source: 'my-app'
    })
  },
  categories: {
    default: { appenders: ['console', 'logflux'], level: 'info' }
  }
});

const logger = log4js.getLogger();

logger.info('Application started');
logger.error('Database connection failed');
```

## Consola Integration

Consola is an elegant console logger for Node.js and browsers.

### Installation

```bash
npm install consola @logflux-io/logflux-js-sdk
```

### Basic Usage

```typescript
import { consola } from 'consola';
import { createConsolaReporter, createBatchClient, createUnixClient } from '@logflux-io/logflux-js-sdk';

// Create LogFlux client
const client = createUnixClient();
const batchClient = createBatchClient(client);

// Add LogFlux reporter to Consola
consola.addReporter(createConsolaReporter({
  client: batchClient,
  source: 'my-app'
}));

// Use Consola normally
consola.info('Application started');
consola.error('Something went wrong');
```

## Loglevel Integration

Loglevel is a minimal lightweight logging library for JavaScript.

### Installation

```bash
npm install loglevel @logflux-io/logflux-js-sdk
```

### Basic Usage

```typescript
import log from 'loglevel';
import { setupLoglevelIntegration, createBatchClient, createUnixClient } from '@logflux-io/logflux-js-sdk';

// Create LogFlux client
const client = createUnixClient();
const batchClient = createBatchClient(client);

// Setup Loglevel integration
setupLoglevelIntegration({
  client: batchClient,
  source: 'my-app'
});

// Use Loglevel normally
log.setLevel('info');
log.info('Application started');
log.error('Error occurred');
```

## Custom Integration Guide

You can create custom integrations for any logging library by following these patterns:

### Basic Integration Pattern

```typescript
import { LogFluxClient, BatchClient, createLogEntry, LogLevel } from '@logflux-io/logflux-js-sdk';

class CustomLogFluxIntegration {
  constructor(
    private client: LogFluxClient | BatchClient,
    private source: string,
    private metadata?: Record<string, string>
  ) {}

  async log(level: string, message: string, extra?: any) {
    // Convert library-specific level to LogFlux LogLevel
    const logLevel = this.convertLogLevel(level);
    
    // Format message with extra data
    const payload = extra 
      ? JSON.stringify({ message, ...extra })
      : message;
    
    // Create log entry
    const entry = createLogEntry(payload, this.source, logLevel);
    
    // Add static metadata
    if (this.metadata) {
      entry.metadata = { ...entry.metadata, ...this.metadata };
    }
    
    // Send to LogFlux
    if (this.client instanceof BatchClient) {
      await this.client.addLogEntry(entry);
    } else {
      await this.client.sendLogEntry(entry);
    }
  }

  private convertLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error': return LogLevel.Error;
      case 'warn': return LogLevel.Warning;
      case 'info': return LogLevel.Info;
      case 'debug': return LogLevel.Debug;
      default: return LogLevel.Info;
    }
  }
}

// Usage
const client = createUnixClient();
const batchClient = createBatchClient(client);
const integration = new CustomLogFluxIntegration(batchClient, 'custom-app');

await integration.log('info', 'Custom log message', { userId: '123' });
```

### Stream-based Integration

For libraries that support stream-based logging:

```typescript
import { Writable } from 'stream';
import { LogFluxClient, BatchClient, createLogEntry, LogLevel } from '@logflux-io/logflux-js-sdk';

class LogFluxStream extends Writable {
  constructor(
    private client: LogFluxClient | BatchClient,
    private source: string,
    private metadata?: Record<string, string>
  ) {
    super({ objectMode: true });
  }

  _write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
    try {
      // Parse log data
      const logData = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
      
      // Create log entry
      const entry = createLogEntry(
        JSON.stringify(logData), 
        this.source, 
        this.convertLogLevel(logData.level)
      );
      
      // Add metadata
      if (this.metadata) {
        entry.metadata = { ...entry.metadata, ...this.metadata };
      }
      
      // Send to LogFlux
      if (this.client instanceof BatchClient) {
        this.client.addLogEntry(entry).then(() => callback()).catch(callback);
      } else {
        this.client.sendLogEntry(entry).then(() => callback()).catch(callback);
      }
    } catch (error) {
      callback(error);
    }
  }

  private convertLogLevel(level: string): LogLevel {
    // Implementation similar to above
    return LogLevel.Info;
  }
}
```

## Performance Considerations

### Use Batch Clients

Always use batch clients for integrations to maximize performance:

```typescript
// Good - uses batching
const batchClient = createBatchClient(client, {
  maxBatchSize: 100,
  flushInterval: 2000
});

// Avoid - sends individual entries
const client = createUnixClient();
```

### Configure Appropriate Batch Sizes

Adjust batch configuration based on your logging volume:

```typescript
// High-volume applications
const batchClient = createBatchClient(client, {
  maxBatchSize: 200,
  flushInterval: 5000,
  maxMemoryUsage: 2 * 1024 * 1024 // 2MB
});

// Low-volume applications
const batchClient = createBatchClient(client, {
  maxBatchSize: 20,
  flushInterval: 1000
});
```

### Handle Integration Errors

Always handle errors gracefully in integrations:

```typescript
class SafeLogFluxIntegration {
  async log(message: string) {
    try {
      const entry = createLogEntry(message, this.source);
      await this.client.addLogEntry(entry);
    } catch (error) {
      // Log integration errors to console, don't throw
      console.error('LogFlux integration error:', error);
    }
  }
}
```

### Monitor Integration Performance

Track integration performance in production:

```typescript
const batchClient = createBatchClient(client);

// Monitor batch statistics
setInterval(() => {
  const stats = batchClient.getStats();
  console.log('LogFlux stats:', {
    totalProcessed: stats.totalEntriesProcessed,
    averageBatchSize: stats.averageBatchSize,
    pending: stats.pendingEntries
  });
}, 30000); // Every 30 seconds
```

## Best Practices

1. **Always use batch clients** for better performance
2. **Handle errors gracefully** - don't let logging errors crash your application
3. **Configure appropriate batch sizes** based on your logging volume
4. **Add consistent metadata** to help with log organization
5. **Use structured logging** when possible (JSON format)
6. **Monitor integration performance** in production environments
7. **Test integrations** thoroughly before deploying
8. **Consider log levels** to avoid excessive noise in production