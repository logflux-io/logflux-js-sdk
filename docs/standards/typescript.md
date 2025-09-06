# TypeScript Coding Standards

This document outlines the TypeScript coding standards and best practices for the LogFlux JavaScript/TypeScript SDK.

## Table of Contents

- [General Principles](#general-principles)
- [Code Style](#code-style)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)
- [Documentation](#documentation)
- [Testing](#testing)
- [Performance](#performance)
- [Security](#security)

## General Principles

### 1. TypeScript First
- Write all code in TypeScript with strict type checking enabled
- Avoid `any` type unless absolutely necessary
- Use explicit type annotations for public APIs
- Leverage TypeScript's type inference for internal code

### 2. Consistency
- Follow consistent naming conventions
- Use consistent code formatting (enforced by Prettier)
- Maintain consistent project structure
- Apply consistent error handling patterns

### 3. Readability
- Write self-documenting code with clear variable and function names
- Use meaningful comments for complex business logic
- Keep functions and classes focused on single responsibilities
- Prefer explicit over implicit where it improves clarity

### 4. Performance
- Optimize for runtime performance in critical paths
- Minimize memory allocations in hot paths
- Use appropriate data structures for the use case
- Profile and benchmark performance-critical code

## Code Style

### File Structure

```typescript
// 1. Node.js built-in imports
import { EventEmitter } from 'events';
import { Socket } from 'net';

// 2. Third-party imports
import * as winston from 'winston';

// 3. Internal imports (absolute paths preferred)
import { LogEntry, LogBatch } from '../types';
import { validateLogEntry } from '../utils/validation';
import { ConnectionError } from '../errors';

// 4. Type-only imports (separate from value imports)
import type { Config, BatchConfig } from '../config/types';
```

### Naming Conventions

#### Files and Directories
```typescript
// Use kebab-case for file names
client.ts
batch-client.ts
log-entry-validator.ts

// Use camelCase for directory names
src/integrations/winston/
src/utils/validation/
```

#### Variables and Functions
```typescript
// Use camelCase for variables and functions
const logLevel = LogLevel.Info;
const maxRetries = 3;

function createLogEntry(payload: string, source: string): LogEntry {
  // Implementation
}

async function sendLogBatch(batch: LogBatch): Promise<void> {
  // Implementation
}
```

#### Classes and Interfaces
```typescript
// Use PascalCase for classes and interfaces
class LogFluxClient {
  // Implementation
}

interface LogEntry {
  payload: string;
  source: string;
}

// Use descriptive names for generic types
interface ApiResponse<TData> {
  data: TData;
  success: boolean;
}
```

#### Constants and Enums
```typescript
// Use SCREAMING_SNAKE_CASE for module-level constants
const DEFAULT_SOCKET_PATH = '/tmp/logflux-agent.sock';
const MAX_RETRY_ATTEMPTS = 5;

// Use PascalCase for enum names and camelCase for values
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

enum NetworkType {
  Unix = 'unix',
  TCP = 'tcp'
}
```

### Code Formatting

#### Indentation and Spacing
```typescript
// Use 2 spaces for indentation
function processLogEntry(entry: LogEntry): ProcessedEntry {
  if (!entry.payload) {
    throw new ValidationError('Payload is required');
  }
  
  return {
    ...entry,
    processedAt: new Date().toISOString()
  };
}

// Use trailing commas in multi-line structures
const config: Config = {
  network: NetworkType.Unix,
  address: '/tmp/logflux-agent.sock',
  timeout: 5000,
  maxRetries: 3, // <- trailing comma
};
```

#### Line Length
- Keep lines under 100 characters
- Break long lines at logical points
- Align parameters and arguments when wrapping

```typescript
// Good: logical line breaks
function createBatchClient(
  client: LogFluxClient,
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): BatchClient {
  return new BatchClient(client, config);
}

// Good: parameter alignment
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.Console()
  ]
});
```

## Type Definitions

### Interface Design

#### Clear and Specific Interfaces
```typescript
// Good: specific, well-defined interface
interface LogEntry {
  readonly version?: string;
  readonly payload: string;
  readonly source: string;
  readonly timestamp?: string;
  readonly payloadType?: string;
  readonly metadata?: Record<string, string>;
  readonly entryType: EntryType;
  readonly logLevel: LogLevel;
}

// Good: optional vs required properties are clear
interface BatchConfig {
  readonly maxBatchSize?: number;
  readonly flushInterval?: number;
  readonly maxMemoryUsage?: number;
  readonly flushOnExit?: boolean;
}
```

#### Utility Types
```typescript
// Use utility types for common patterns
type LogEntryUpdate = Partial<Pick<LogEntry, 'logLevel' | 'metadata'>>;
type ConfigKeys = keyof Config;
type RequiredBatchConfig = Required<BatchConfig>;

// Create specific utility types for the domain
type LogEntryWithoutTimestamp = Omit<LogEntry, 'timestamp'>;
type MinimalLogEntry = Pick<LogEntry, 'payload' | 'source'>;
```

#### Generic Types
```typescript
// Use meaningful generic type names
interface ApiResponse<TData, TError = Error> {
  data?: TData;
  error?: TError;
  success: boolean;
}

interface Repository<TEntity, TId = string> {
  findById(id: TId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<TEntity>;
  delete(id: TId): Promise<void>;
}
```

### Type Guards and Validation

```typescript
// Implement type guards for runtime type checking
function isLogEntry(obj: any): obj is LogEntry {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.payload === 'string' &&
    typeof obj.source === 'string' &&
    typeof obj.entryType === 'number' &&
    typeof obj.logLevel === 'number'
  );
}

function isConfig(obj: any): obj is Config {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.network === 'string' &&
    typeof obj.address === 'string' &&
    (obj.network === 'unix' || obj.network === 'tcp')
  );
}

// Use assertion functions for validation
function assertIsLogEntry(obj: any): asserts obj is LogEntry {
  if (!isLogEntry(obj)) {
    throw new ValidationError('Invalid log entry format');
  }
}
```

### Union Types and Discriminated Unions

```typescript
// Use discriminated unions for type safety
interface UnixConfig {
  network: 'unix';
  address: string;
  timeout?: number;
}

interface TcpConfig {
  network: 'tcp';
  address: string;
  sharedSecret: string;
  timeout?: number;
}

type Config = UnixConfig | TcpConfig;

// Type narrowing with discriminated unions
function createConnection(config: Config): Connection {
  switch (config.network) {
    case 'unix':
      return new UnixConnection(config.address);
    case 'tcp':
      return new TcpConnection(config.address, config.sharedSecret);
    default:
      // TypeScript ensures exhaustive checking
      const _exhaustive: never = config;
      throw new Error(`Unknown network type: ${_exhaustive}`);
  }
}
```

## Error Handling

### Error Class Hierarchy

```typescript
// Base error class
abstract class LogFluxError extends Error {
  abstract readonly code: string;
  
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Specific error types
class ConnectionError extends LogFluxError {
  readonly code = 'CONNECTION_ERROR';
}

class AuthenticationError extends LogFluxError {
  readonly code = 'AUTHENTICATION_ERROR';
}

class ValidationError extends LogFluxError {
  readonly code = 'VALIDATION_ERROR';
  
  constructor(message: string, public readonly errors: string[]) {
    super(message);
  }
}
```

### Error Handling Patterns

```typescript
// Result type pattern for better error handling
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

async function safeOperation<T>(
  operation: () => Promise<T>
): Promise<Result<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

// Usage
const result = await safeOperation(() => client.sendLogEntry(entry));
if (result.success) {
  console.log('Entry sent successfully');
} else {
  console.error('Failed to send entry:', result.error.message);
}
```

### Async Error Handling

```typescript
// Proper async error handling in classes
class LogFluxClient {
  private async connectWithRetry(): Promise<void> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.connect();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === this.maxRetries) {
          throw new ConnectionError(
            `Failed to connect after ${this.maxRetries} attempts`,
            lastError
          );
        }
        
        await this.delay(this.calculateRetryDelay(attempt));
      }
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.retryDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * baseDelay;
    return Math.min(baseDelay + jitter, 30000); // Max 30 seconds
  }
}
```

## Documentation

### JSDoc Standards

```typescript
/**
 * Creates a new LogFlux client for communicating with the LogFlux agent.
 * 
 * @param config - Client configuration including network type and address
 * @returns A new LogFlux client instance
 * 
 * @example
 * ```typescript
 * const client = createClient({
 *   network: NetworkType.Unix,
 *   address: '/tmp/logflux-agent.sock'
 * });
 * ```
 * 
 * @throws {ValidationError} When configuration is invalid
 * @throws {ConnectionError} When connection cannot be established
 */
function createClient(config: Config): LogFluxClient {
  validateConfig(config);
  return new LogFluxClient(config);
}

/**
 * Represents a log entry that can be sent to the LogFlux agent.
 * 
 * @public
 */
interface LogEntry {
  /**
   * The API version for this log entry format.
   * @defaultValue "1.0"
   */
  readonly version?: string;
  
  /**
   * The actual log message content.
   * @remarks This can be plain text or JSON depending on payloadType.
   */
  readonly payload: string;
  
  /**
   * Identifier for the source of this log entry (e.g., application name).
   * @example "my-web-app"
   */
  readonly source: string;
}
```

### README Documentation

```typescript
// Include comprehensive examples in README
/**
 * @fileoverview
 * LogFlux JavaScript/TypeScript SDK
 * 
 * This SDK provides a lightweight client for communicating with LogFlux agents
 * via Unix socket or TCP connections. It supports automatic batching, type safety,
 * and integrations with popular logging libraries.
 * 
 * @example Basic usage:
 * ```typescript
 * import { createUnixClient, createLogEntry } from '@logflux-io/logflux-js-sdk';
 * 
 * const client = createUnixClient();
 * await client.connect();
 * 
 * const entry = createLogEntry('Hello LogFlux!', 'my-app');
 * await client.sendLogEntry(entry);
 * 
 * await client.close();
 * ```
 * 
 * @example With batching:
 * ```typescript
 * import { createUnixClient, createBatchClient } from '@logflux-io/logflux-js-sdk';
 * 
 * const client = createUnixClient();
 * const batchClient = createBatchClient(client);
 * 
 * // Entries are automatically batched
 * await batchClient.addLogEntry(createLogEntry('Log 1', 'app'));
 * await batchClient.addLogEntry(createLogEntry('Log 2', 'app'));
 * 
 * await batchClient.stop(); // Graceful shutdown
 * ```
 */
```

## Testing

### Test Structure Standards

```typescript
// Test file naming: *.test.ts
// Test structure: describe/test hierarchy

describe('LogFluxClient', () => {
  let client: LogFluxClient;
  let mockConfig: Config;
  
  beforeEach(() => {
    mockConfig = {
      network: NetworkType.Unix,
      address: '/tmp/test.sock',
      timeout: 5000
    };
    client = new LogFluxClient(mockConfig);
  });
  
  afterEach(async () => {
    if (client && client.isConnected()) {
      await client.close();
    }
  });

  describe('constructor', () => {
    test('should create client with valid config', () => {
      expect(client).toBeInstanceOf(LogFluxClient);
      expect(client.getConfig()).toEqual(mockConfig);
    });
    
    test('should throw ValidationError with invalid config', () => {
      const invalidConfig = { network: 'invalid' as any };
      expect(() => new LogFluxClient(invalidConfig)).toThrow(ValidationError);
    });
  });
  
  describe('connect', () => {
    test('should connect successfully', async () => {
      // Mock implementation
      jest.spyOn(client as any, 'establishConnection').mockResolvedValue(undefined);
      
      await expect(client.connect()).resolves.not.toThrow();
      expect(client.isConnected()).toBe(true);
    });
    
    test('should throw ConnectionError on failure', async () => {
      jest.spyOn(client as any, 'establishConnection').mockRejectedValue(new Error('Connection failed'));
      
      await expect(client.connect()).rejects.toThrow(ConnectionError);
    });
  });
});
```

### Mock Standards

```typescript
// Create typed mocks for better test safety
interface MockLogFluxClient extends LogFluxClient {
  __mockData: {
    connected: boolean;
    sentEntries: LogEntry[];
    sentBatches: LogBatch[];
  };
}

function createMockClient(): MockLogFluxClient {
  const mockData = {
    connected: false,
    sentEntries: [],
    sentBatches: []
  };
  
  return {
    __mockData: mockData,
    
    async connect(): Promise<void> {
      mockData.connected = true;
    },
    
    async close(): Promise<void> {
      mockData.connected = false;
    },
    
    async sendLogEntry(entry: LogEntry): Promise<void> {
      if (!mockData.connected) {
        throw new ConnectionError('Not connected');
      }
      mockData.sentEntries.push(entry);
    },
    
    // ... other methods
  } as MockLogFluxClient;
}
```

## Performance

### Memory Management

```typescript
// Use object pools for frequently created objects
class LogEntryPool {
  private pool: LogEntry[] = [];
  
  acquire(): LogEntry {
    return this.pool.pop() || this.createNew();
  }
  
  release(entry: LogEntry): void {
    // Reset object state
    Object.keys(entry).forEach(key => delete (entry as any)[key]);
    this.pool.push(entry);
  }
  
  private createNew(): LogEntry {
    return {} as LogEntry;
  }
}

// Avoid memory leaks in event handlers
class BatchClient {
  private flushTimer?: NodeJS.Timeout;
  
  start(): void {
    this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
  }
  
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }
}
```

### Efficient Data Structures

```typescript
// Use appropriate data structures for performance
class PendingEntryQueue {
  private entries: LogEntry[] = [];
  private totalSize = 0;
  
  add(entry: LogEntry): void {
    this.entries.push(entry);
    this.totalSize += this.estimateSize(entry);
  }
  
  drainAll(): LogEntry[] {
    const result = this.entries.slice();
    this.entries.length = 0;
    this.totalSize = 0;
    return result;
  }
  
  private estimateSize(entry: LogEntry): number {
    // Rough estimate for memory usage
    return entry.payload.length * 2 + 100; // UTF-16 + overhead
  }
}
```

## Security

### Input Validation

```typescript
// Always validate external input
function validateLogEntry(entry: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!entry || typeof entry !== 'object') {
    errors.push('Entry must be an object');
    return { valid: false, errors };
  }
  
  const e = entry as any;
  
  if (typeof e.payload !== 'string') {
    errors.push('Payload must be a string');
  } else if (e.payload.length > MAX_PAYLOAD_SIZE) {
    errors.push(`Payload too large: ${e.payload.length} > ${MAX_PAYLOAD_SIZE}`);
  }
  
  if (typeof e.source !== 'string') {
    errors.push('Source must be a string');
  } else if (!/^[a-zA-Z0-9_-]+$/.test(e.source)) {
    errors.push('Source contains invalid characters');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

### Safe String Handling

```typescript
// Prevent injection attacks in log messages
function sanitizeLogMessage(message: string): string {
  // Remove control characters except newlines and tabs
  return message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

// Safe JSON serialization
function safeJSONStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, (key, value) => {
      // Prevent circular references
      if (typeof value === 'object' && value !== null) {
        if (this.__refs?.has(value)) {
          return '[Circular]';
        }
        (this.__refs = this.__refs || new Set()).add(value);
      }
      return value;
    });
  } catch (error) {
    return '[Unable to serialize]';
  }
}
```

### Secure Configuration

```typescript
// Don't log sensitive configuration
class LogFluxClient {
  private config: Config;
  
  constructor(config: Config) {
    this.config = { ...config };
  }
  
  getConfig(): Readonly<Omit<Config, 'sharedSecret'>> {
    const { sharedSecret, ...safeConfig } = this.config;
    return safeConfig;
  }
  
  toString(): string {
    const safeConfig = this.getConfig();
    return `LogFluxClient(${JSON.stringify(safeConfig)})`;
  }
}
```