# LogFlux JavaScript/TypeScript SDK (BETA)

[![CI](https://github.com/logflux-io/logflux-js-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/logflux-io/logflux-js-sdk/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@logflux-io/logflux-js-sdk.svg)](https://www.npmjs.com/package/@logflux-io/logflux-js-sdk)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE-APACHE-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Node Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

> **BETA SOFTWARE**: This SDK is feature-complete for basic logging use cases but is marked as BETA while we gather community feedback and add additional features. The API is stable but may evolve based on user needs.

A lightweight JavaScript/TypeScript SDK for communicating with the LogFlux agent. Built for Node.js servers with support for popular logging libraries.

## Features

- **High Performance** - Automatic batching and connection pooling
- **Multiple Transports** - Unix socket and TCP support for local and remote agent communication
- **TypeScript First** - Full type safety with comprehensive TypeScript definitions  
- **Popular Integrations** - Winston, Bunyan, Pino, Debug, Log4js, Consola, Loglevel integrations included
- **Server Focused** - Optimized for Node.js server applications
- **Async/Await** - Modern Promise-based API
- **Batching** - Automatic log entry batching for optimal performance
- **Type Safe** - Complete TypeScript support with strict typing

## Installation

```bash
npm install @logflux-io/logflux-js-sdk

# Or with yarn
yarn add @logflux-io/logflux-js-sdk
```

## Quick Start

### Basic Usage

```typescript
import { createUnixClient, createLogEntry, LogLevel } from '@logflux-io/logflux-js-sdk';

const client = createUnixClient();

async function example() {
  try {
    await client.connect();
    
    // Send a simple log
    const entry = createLogEntry('Hello LogFlux!', 'my-app');
    await client.sendLogEntry(entry);
    
    // Send with custom level and metadata
    const customEntry = createLogEntry('User action', 'my-app');
    customEntry.logLevel = LogLevel.Warning;
    customEntry.metadata = { userId: '123', action: 'login' };
    
    await client.sendLogEntry(customEntry);
  } finally {
    await client.close();
  }
}
```

### Batch Client (Recommended for High Throughput)

```typescript
import { createUnixClient, createBatchClient, createLogEntry } from '@logflux-io/logflux-js-sdk';

const client = createUnixClient();
const batchClient = createBatchClient(client);

// Logs are automatically batched and sent efficiently
await batchClient.addLogEntry(createLogEntry('Log 1', 'my-app'));
await batchClient.addLogEntry(createLogEntry('Log 2', 'my-app'));

// Batch client handles flushing automatically
await batchClient.stop(); // Graceful shutdown
```

### Winston Integration

```typescript
import winston from 'winston';
import { LogFluxTransport, createBatchClient, createUnixClient } from '@logflux-io/logflux-js-sdk';

const client = createUnixClient();
const batchClient = createBatchClient(client);

const logger = winston.createLogger({
  transports: [
    new LogFluxTransport({
      client: batchClient,
      source: 'my-app',
      metadata: { service: 'user-service' }
    })
  ]
});

logger.info('Hello from Winston!', { userId: '123' });
```

## Transport Types

### Unix Socket (Default)

```typescript
import { createUnixClient } from '@logflux-io/logflux-js-sdk';

const client = createUnixClient('/path/to/logflux-agent.sock');
```

### TCP

```typescript
import { createTCPClient } from '@logflux-io/logflux-js-sdk';

const client = createTCPClient('localhost', 8080, 'shared-secret');
await client.authenticate(); // Required for TCP
```


## API Reference

### Core Types

```typescript
interface LogEntry {
  version?: string;
  payload: string;
  source: string;
  timestamp?: string;
  payloadType?: string;
  metadata?: Record<string, string>;
  entryType: number;
  logLevel: number;
}

enum LogLevel {
  Emergency = 1,
  Alert = 2,
  Critical = 3,
  Error = 4,
  Warning = 5,
  Notice = 6,
  Info = 7,
  Debug = 8
}
```

### Client Methods

```typescript
class LogFluxClient {
  async connect(): Promise<void>
  async close(): Promise<void>
  async sendLogEntry(entry: LogEntry): Promise<void>
  async sendLogBatch(batch: LogBatch): Promise<void>
  async ping(): Promise<boolean>
  async authenticate(): Promise<boolean> // TCP only
}
```

### Batch Client Methods

```typescript
class BatchClient {
  async addLogEntry(entry: LogEntry): Promise<void>
  async flush(): Promise<void>
  async stop(): Promise<void>
  getStats(): BatchStats
  getPendingCount(): number
}
```

## Integrations

### Winston

```typescript
import { LogFluxTransport } from '@logflux-io/logflux-js-sdk/integrations/winston';

new winston.transports.LogFluxTransport({
  client: batchClient,
  source: 'my-app',
  metadata: { environment: 'production' }
})
```

### Bunyan

```typescript
import { createLogFluxStream } from '@logflux-io/logflux-js-sdk/integrations/bunyan';

const logger = bunyan.createLogger({
  name: 'my-app',
  streams: [createLogFluxStream({ client: batchClient })]
});
```

### Pino

```typescript
import { createLogFluxDestination } from '@logflux-io/logflux-js-sdk/integrations/pino';

const logger = pino({}, createLogFluxDestination({ client: batchClient }));
```

## Configuration

### Basic Config

```typescript
import { Config, NetworkType } from '@logflux-io/logflux-js-sdk';

const config: Config = {
  network: NetworkType.Unix,
  address: '/tmp/logflux-agent.sock',
  timeout: 5000,
  batchSize: 50,
  flushInterval: 1000,
  maxRetries: 3,
  retryDelay: 1000
};
```

### Batch Config

```typescript
import { BatchConfig } from '@logflux-io/logflux-js-sdk';

const batchConfig: BatchConfig = {
  maxBatchSize: 100,
  flushInterval: 2000,
  maxMemoryUsage: 1024 * 1024, // 1MB
  flushOnExit: true
};
```

## Examples

See the `examples/` directory for complete examples:

- [`examples/basic.ts`](examples/basic.ts) - Basic client usage
- [`examples/batch.ts`](examples/batch.ts) - Batch client and high throughput
- [`examples/winston-integration.ts`](examples/winston-integration.ts) - Winston integration
- [`examples/bunyan-integration.ts`](examples/bunyan-integration.ts) - Bunyan integration
- [`examples/pino-integration.ts`](examples/pino-integration.ts) - Pino integration
- [`examples/log4js-integration.ts`](examples/log4js-integration.ts) - Log4js integration
- [`examples/consola-integration.ts`](examples/consola-integration.ts) - Consola integration
- [`examples/loglevel-integration.ts`](examples/loglevel-integration.ts) - Loglevel integration
- [`examples/debug-integration.ts`](examples/debug-integration.ts) - Debug integration

## Server Requirements

This SDK is designed for **Node.js server applications only**:

- **Node.js 16+** required
- **Unix socket** transport for local agent communication (fastest)
- **TCP** transport for remote agent communication  
- Integrates with popular Node.js logging libraries
- **Not suitable for browser environments** (use agent HTTP API directly from browsers)

## Performance

- **Batching**: Automatic batching reduces network overhead
- **Connection Pooling**: Reuses connections for multiple requests
- **TypeScript**: Zero-runtime overhead with compile-time type checking
- **Memory Efficient**: Configurable memory limits and automatic flushing

## Error Handling

```typescript
try {
  await client.sendLogEntry(entry);
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    console.error('LogFlux agent is not running');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[SDK Guide](docs/README.md)** - Complete SDK documentation and examples
- **[API Reference](docs/api-reference.md)** - Detailed API documentation
- **[Integrations](docs/integrations.md)** - Logging library integrations (Winston, Bunyan, Pino, etc.)
- **[Configuration](docs/configuration.md)** - Configuration options and best practices
- **[Testing](docs/testing.md)** - Testing guide and best practices
- **[Standards](docs/standards/)** - Coding standards and project conventions

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint

# Type check
npm run typecheck
```

## License

Apache License 2.0. See [LICENSE-APACHE-2.0](LICENSE-APACHE-2.0) for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- [Documentation](https://docs.logflux.io)
- [GitHub Issues](https://github.com/logflux-io/logflux-js-sdk/issues)
- [Community Forum](https://community.logflux.io)