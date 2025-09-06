# LogFlux JavaScript/TypeScript SDK

A lightweight JavaScript/TypeScript SDK for communicating with the LogFlux agent. Built for Node.js servers with support for popular logging libraries.

For complete platform documentation, visit [docs.logflux.io](https://docs.logflux.io).

## Features

- **High Performance** - Automatic batching and connection pooling
- **Multiple Transports** - Unix socket and TCP support for local and remote agent communication
- **TypeScript First** - Full type safety with comprehensive TypeScript definitions  
- **Popular Integrations** - Winston, Bunyan, Pino, Debug, Log4js, Consola, Loglevel integrations included
- **Server Focused** - Optimized for Node.js server applications
- **Async/Await** - Modern Promise-based API
- **Batching** - Automatic log entry batching for optimal performance
- **Type Safe** - Complete TypeScript support with strict typing

## Quick Start

### Installation

```bash
npm install @logflux-io/logflux-js-sdk

# Or with yarn
yarn add @logflux-io/logflux-js-sdk
```

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

## Log Levels

The SDK supports standard syslog levels:

- `LogLevel.Emergency` (1) - Emergency
- `LogLevel.Alert` (2) - Alert  
- `LogLevel.Critical` (3) - Critical
- `LogLevel.Error` (4) - Error
- `LogLevel.Warning` (5) - Warning
- `LogLevel.Notice` (6) - Notice
- `LogLevel.Info` (7) - Info
- `LogLevel.Debug` (8) - Debug

## Entry Types

Currently, the minimal SDK only supports:
- `EntryType.Log` (1) - Standard log messages

Additional entry types (metrics, traces, events, audit) are planned for future releases.

## Payload Types

The minimal SDK currently supports basic payload type hints:

- `PayloadType.Generic` - Generic text logs (default)
- `PayloadType.GenericJSON` - Generic JSON data (auto-detected)

Additional payload types for systemd, syslog, metrics, applications, and containers are planned for future releases.

### Payload Type Examples

```typescript
// Automatic payload type detection
const entry = createLogEntry(`{"level": "info", "message": "JSON log"}`, "app"); // Auto-detects JSON

// Manual payload type assignment
const textEntry = createLogEntry("Custom log message", "app");
textEntry.payloadType = PayloadType.Generic;

const jsonEntry = createLogEntry(`{"key": "value"}`, "app");
jsonEntry.payloadType = PayloadType.GenericJSON;
```

### JSON Detection

The SDK automatically detects JSON content and sets the appropriate payload type:

```typescript
// Automatically detected as PayloadType.GenericJSON
const entry = createLogEntry(`{"user": "admin", "action": "login", "success": true}`, "auth");

// Check if content is JSON
import { isValidJSON, autoDetectPayloadType } from '@logflux-io/logflux-js-sdk';

if (isValidJSON(content)) {
    // Handle as JSON
}

// Auto-detect payload type
const payloadType = autoDetectPayloadType(message);
```

## Best Practices

1. **Use Unix sockets** for local communication (fastest and most secure)
2. **Use batch clients** for high-throughput scenarios
3. **Set appropriate log levels** to avoid noise
4. **Handle connection errors** gracefully with try/catch blocks
5. **Close clients** properly to avoid resource leaks
6. **Use TypeScript** for better development experience and type safety
7. **Configure appropriate timeouts** for your use case
8. **Monitor batch client stats** in production environments

## Error Handling

```typescript
import { LogFluxError, ConnectionError, AuthenticationError } from '@logflux-io/logflux-js-sdk';

try {
  await client.sendLogEntry(entry);
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('LogFlux agent is not running or unreachable');
  } else if (error instanceof AuthenticationError) {
    console.error('Authentication failed - check shared secret');
  } else if (error instanceof LogFluxError) {
    console.error('LogFlux SDK error:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

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

## Documentation

- **[API Reference](./api-reference.md)** - Complete API documentation
- **[Integrations](./integrations.md)** - Logging library integrations
- **[Configuration](./configuration.md)** - Configuration options and examples
- **[Testing](./testing.md)** - Testing guide and best practices
- **[Examples](../examples/)** - Complete code examples
- **[Standards](./standards/)** - Coding standards and project conventions

## Security

### Unix Socket Security
Unix sockets provide security through filesystem permissions. Only processes with appropriate file system access can connect to the agent socket.

### TCP Authentication  
TCP connections require explicit shared secret authentication:

```typescript
import { createTCPClient } from '@logflux-io/logflux-js-sdk';

const client = createTCPClient('localhost', 8080, 'your-shared-secret');

try {
  await client.connect();
  
  // Authenticate for TCP connections
  const authenticated = await client.authenticate();
  if (!authenticated) {
    throw new Error('Authentication failed');
  }
} catch (error) {
  console.error('Connection or authentication failed:', error);
}
```

## License

This project is licensed under the Apache License 2.0. See [../LICENSE-APACHE-2.0](../LICENSE-APACHE-2.0) for details.

## Additional Resources

- [LogFlux Documentation](https://docs.logflux.io) - Complete platform documentation
- [API Reference](https://docs.logflux.io/api) - REST API documentation
- [SDK Guide](https://docs.logflux.io/sdks/javascript) - Official JavaScript SDK guide
- [Agent Configuration](https://docs.logflux.io/agent) - Agent setup and configuration