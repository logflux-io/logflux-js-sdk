# API Reference

Complete API documentation for the LogFlux JavaScript/TypeScript SDK.

## Table of Contents

- [Core Types](#core-types)
- [Client Classes](#client-classes)
- [Factory Functions](#factory-functions)
- [Utility Functions](#utility-functions)
- [Error Classes](#error-classes)
- [Constants](#constants)

## Core Types

### LogEntry

The primary data structure for log entries.

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
```

**Properties:**
- `version` (optional): API version, defaults to "1.0"
- `payload` (required): The log message content
- `source` (required): Source identifier (application name, service name, etc.)
- `timestamp` (optional): ISO 8601 timestamp, auto-generated if not provided
- `payloadType` (optional): Payload type hint, auto-detected if not provided
- `metadata` (optional): Key-value pairs for additional context
- `entryType` (required): Entry type identifier (currently only log entries supported)
- `logLevel` (required): Syslog-compatible log level

### LogBatch

Container for multiple log entries.

```typescript
interface LogBatch {
  version?: string;
  entries: LogEntry[];
}
```

**Properties:**
- `version` (optional): API version, defaults to "1.0"
- `entries` (required): Array of LogEntry objects

### Config

Configuration interface for client connections.

```typescript
interface Config {
  network: NetworkType;
  address: string;
  sharedSecret?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}
```

**Properties:**
- `network` (required): Network transport type (Unix or TCP)
- `address` (required): Socket path or host:port combination
- `sharedSecret` (optional): Required for TCP authentication
- `timeout` (optional): Connection timeout in milliseconds (default: 5000)
- `maxRetries` (optional): Maximum retry attempts (default: 3)
- `retryDelay` (optional): Delay between retries in milliseconds (default: 1000)

### BatchConfig

Configuration for batch client behavior.

```typescript
interface BatchConfig {
  maxBatchSize?: number;
  flushInterval?: number;
  maxMemoryUsage?: number;
  flushOnExit?: boolean;
}
```

**Properties:**
- `maxBatchSize` (optional): Maximum entries per batch (default: 50)
- `flushInterval` (optional): Automatic flush interval in milliseconds (default: 1000)
- `maxMemoryUsage` (optional): Maximum memory usage before forced flush (default: 1MB)
- `flushOnExit` (optional): Automatically flush on process exit (default: true)

### PingRequest

Request structure for ping operations.

```typescript
interface PingRequest {
  version?: string;
  message?: string;
}
```

### AuthRequest

Request structure for TCP authentication.

```typescript
interface AuthRequest {
  version?: string;
  sharedSecret: string;
}
```

## Client Classes

### LogFluxClient

The base client class for communicating with the LogFlux agent.

```typescript
class LogFluxClient {
  constructor(config: Config)
  
  async connect(): Promise<void>
  async close(): Promise<void>
  async sendLogEntry(entry: LogEntry): Promise<void>
  async sendLogBatch(batch: LogBatch): Promise<void>
  async ping(message?: string): Promise<boolean>
  async authenticate(): Promise<boolean>
  
  isConnected(): boolean
  getConfig(): Config
}
```

**Methods:**

#### `constructor(config: Config)`
Creates a new LogFlux client with the specified configuration.

#### `async connect(): Promise<void>`
Establishes connection to the LogFlux agent.
- Throws `ConnectionError` if connection fails
- Throws `TimeoutError` if connection times out

#### `async close(): Promise<void>`
Closes the connection to the LogFlux agent.
- Always succeeds, safe to call multiple times

#### `async sendLogEntry(entry: LogEntry): Promise<void>`
Sends a single log entry to the agent.
- Validates entry structure before sending
- Throws `ValidationError` for invalid entries
- Throws `ConnectionError` if not connected

#### `async sendLogBatch(batch: LogBatch): Promise<void>`
Sends a batch of log entries to the agent.
- More efficient than multiple single sends
- Validates batch structure before sending
- Throws `ValidationError` for invalid batches
- Throws `ConnectionError` if not connected

#### `async ping(message?: string): Promise<boolean>`
Pings the LogFlux agent to verify connectivity.
- Returns `true` if agent responds
- Returns `false` if agent doesn't respond
- Throws `ConnectionError` if not connected

#### `async authenticate(): Promise<boolean>`
Authenticates with the LogFlux agent (TCP only).
- Required for TCP connections before sending logs
- Returns `true` if authentication succeeds
- Returns `false` if authentication fails
- Throws `AuthenticationError` for invalid credentials
- Throws `Error` if called on Unix socket connections

#### `isConnected(): boolean`
Returns the current connection status.

#### `getConfig(): Config`
Returns the current client configuration.

### BatchClient

High-level client that automatically batches log entries for optimal performance.

```typescript
class BatchClient {
  constructor(client: LogFluxClient, config?: BatchConfig)
  
  async addLogEntry(entry: LogEntry): Promise<void>
  async flush(): Promise<void>
  async stop(): Promise<void>
  
  getStats(): BatchStats
  getPendingCount(): number
  isRunning(): boolean
}
```

**Methods:**

#### `constructor(client: LogFluxClient, config?: BatchConfig)`
Creates a batch client that wraps an existing LogFlux client.

#### `async addLogEntry(entry: LogEntry): Promise<void>`
Adds a log entry to the current batch.
- Entries are queued and sent in batches
- Automatically flushes when batch size limit is reached
- Non-blocking operation
- Throws `ValidationError` for invalid entries

#### `async flush(): Promise<void>`
Immediately sends all pending log entries.
- Useful for ensuring logs are sent before application shutdown
- Safe to call multiple times

#### `async stop(): Promise<void>`
Gracefully shuts down the batch client.
- Flushes all pending entries
- Stops automatic flushing timer
- Closes underlying client connection

#### `getStats(): BatchStats`
Returns statistics about batch client performance.

```typescript
interface BatchStats {
  totalEntriesProcessed: number;
  totalBatchesSent: number;
  averageBatchSize: number;
  pendingEntries: number;
  lastFlushTime: Date;
}
```

#### `getPendingCount(): number`
Returns the number of entries waiting to be sent.

#### `isRunning(): boolean`
Returns whether the batch client is actively processing entries.

## Factory Functions

### Client Factory Functions

#### `createUnixClient(socketPath?: string): LogFluxClient`
Creates a Unix socket client.
- `socketPath` (optional): Path to agent socket (default: "/tmp/logflux-agent.sock")

#### `createTCPClient(host: string, port: number, sharedSecret: string): LogFluxClient`
Creates a TCP client with authentication.
- `host` (required): Agent hostname or IP address
- `port` (required): Agent port number
- `sharedSecret` (required): Shared secret for authentication

#### `createBatchClient(client: LogFluxClient, config?: BatchConfig): BatchClient`
Creates a batch client that wraps an existing client.
- `client` (required): Base LogFlux client
- `config` (optional): Batch configuration options

### Entry Factory Functions

#### `createLogEntry(payload: string, source: string, logLevel?: LogLevel): LogEntry`
Creates a new log entry with automatic defaults.
- `payload` (required): Log message content
- `source` (required): Source identifier
- `logLevel` (optional): Log level (default: LogLevel.Info)

#### `createLogBatch(entries: LogEntry[]): LogBatch`
Creates a log batch from an array of entries.
- `entries` (required): Array of log entries

## Utility Functions

### Validation Functions

#### `validateLogEntry(entry: LogEntry): ValidationResult`
Validates a log entry structure.

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

#### `validateLogBatch(batch: LogBatch): ValidationResult`
Validates a log batch structure.

#### `validateConfig(config: Config): ValidationResult`
Validates a client configuration.

### Type Detection Functions

#### `isValidJSON(payload: string): boolean`
Checks if a string contains valid JSON.

#### `autoDetectPayloadType(payload: string): string`
Automatically detects the appropriate payload type for content.

### Configuration Functions

#### `createDefaultConfig(): Config`
Returns default configuration for Unix socket connection.

#### `createDefaultBatchConfig(): BatchConfig`
Returns default batch configuration.

## Error Classes

### LogFluxError

Base error class for all SDK errors.

```typescript
class LogFluxError extends Error {
  constructor(message: string, code?: string)
  
  readonly code?: string;
}
```

### ConnectionError

Error thrown when connection operations fail.

```typescript
class ConnectionError extends LogFluxError {
  constructor(message: string, originalError?: Error)
  
  readonly originalError?: Error;
}
```

### AuthenticationError

Error thrown when authentication fails.

```typescript
class AuthenticationError extends LogFluxError {
  constructor(message: string)
}
```

### ValidationError

Error thrown when data validation fails.

```typescript
class ValidationError extends LogFluxError {
  constructor(message: string, validationErrors: string[])
  
  readonly validationErrors: string[];
}
```

### TimeoutError

Error thrown when operations time out.

```typescript
class TimeoutError extends LogFluxError {
  constructor(message: string, timeout: number)
  
  readonly timeout: number;
}
```

## Constants

### NetworkType

```typescript
enum NetworkType {
  Unix = 'unix',
  TCP = 'tcp'
}
```

### LogLevel

```typescript
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

### EntryType

```typescript
enum EntryType {
  Log = 1
  // Additional types planned for future releases
}
```

### PayloadType

```typescript
enum PayloadType {
  Generic = 'generic',
  GenericJSON = 'generic_json'
  // Additional types planned for future releases
}
```

## Type Guards

### `isLogEntry(obj: any): obj is LogEntry`
Type guard to check if an object is a valid LogEntry.

### `isLogBatch(obj: any): obj is LogBatch`
Type guard to check if an object is a valid LogBatch.

### `isConfig(obj: any): obj is Config`
Type guard to check if an object is a valid Config.

## Usage Examples

### Basic Client Usage

```typescript
import { createUnixClient, createLogEntry, LogLevel } from '@logflux-io/logflux-js-sdk';

const client = createUnixClient();

try {
  await client.connect();
  
  const entry = createLogEntry('Application started', 'my-app', LogLevel.Info);
  await client.sendLogEntry(entry);
  
} finally {
  await client.close();
}
```

### Batch Client Usage

```typescript
import { createUnixClient, createBatchClient, createLogEntry } from '@logflux-io/logflux-js-sdk';

const client = createUnixClient();
const batchClient = createBatchClient(client, {
  maxBatchSize: 100,
  flushInterval: 5000
});

// Add multiple entries
for (let i = 0; i < 1000; i++) {
  await batchClient.addLogEntry(
    createLogEntry(`Processing item ${i}`, 'batch-processor')
  );
}

// Graceful shutdown
await batchClient.stop();
```

### Error Handling

```typescript
import { 
  createTCPClient, 
  ConnectionError, 
  AuthenticationError,
  ValidationError 
} from '@logflux-io/logflux-js-sdk';

const client = createTCPClient('localhost', 8080, 'secret');

try {
  await client.connect();
  await client.authenticate();
  
  // Use client...
  
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('Failed to connect to LogFlux agent');
  } else if (error instanceof AuthenticationError) {
    console.error('Invalid shared secret');
  } else if (error instanceof ValidationError) {
    console.error('Invalid data:', error.validationErrors);
  } else {
    console.error('Unexpected error:', error);
  }
}
```