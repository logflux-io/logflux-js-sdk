# Testing Guide

Comprehensive testing guide for the LogFlux JavaScript/TypeScript SDK, including unit tests, integration tests, and performance testing.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [Performance Testing](#performance-testing)
- [Test Configuration](#test-configuration)
- [Continuous Integration](#continuous-integration)
- [Writing Tests](#writing-tests)
- [Troubleshooting](#troubleshooting)

## Overview

The LogFlux SDK uses a comprehensive testing strategy with multiple test types:

- **Unit Tests**: Test individual components and functions in isolation
- **Integration Tests**: Test against a real LogFlux agent
- **Performance Tests**: Measure throughput and latency
- **Type Tests**: Validate TypeScript type definitions

### Test Framework

- **Jest**: Primary testing framework
- **TypeScript**: Full TypeScript support in tests
- **Coverage**: Statement, branch, and function coverage tracking
- **ESLint**: Linting for test files

## Test Structure

```
src/__tests__/
├── unit/                          # Unit tests
│   ├── client/
│   │   ├── client.test.ts        # Core client tests
│   │   └── batch-client.test.ts  # Batch client tests
│   ├── config/
│   │   └── config.test.ts        # Configuration tests
│   ├── types/
│   │   └── types.test.ts         # Type validation tests
│   └── utils/
│       └── validation.test.ts    # Utility function tests
├── integration/                   # Integration tests
│   ├── README.md                 # Integration test documentation
│   ├── unix-socket.test.ts       # Unix socket integration
│   ├── tcp-socket.test.ts        # TCP socket integration
│   ├── batch-processing.test.ts  # Batch processing integration
│   └── performance.test.ts       # Performance benchmarks
└── fixtures/                     # Test data and mocks
    ├── mock-agent.ts             # Mock agent for unit tests
    └── test-data.ts              # Sample log entries and batches
```

## Unit Testing

Unit tests run without requiring a LogFlux agent and test components in isolation.

### Running Unit Tests

```bash
# Run all unit tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test client.test.ts

# Run in watch mode
npm run test:watch

# Run with verbose output
npm run test -- --verbose
```

### Unit Test Examples

#### Testing Log Entry Creation

```typescript
import { createLogEntry, LogLevel, EntryType } from '../../../src/types';
import { validateLogEntry } from '../../../src/utils/validation';

describe('LogEntry Creation', () => {
  test('should create valid log entry with defaults', () => {
    const entry = createLogEntry('Test message', 'test-app');
    
    expect(entry.payload).toBe('Test message');
    expect(entry.source).toBe('test-app');
    expect(entry.logLevel).toBe(LogLevel.Info);
    expect(entry.entryType).toBe(EntryType.Log);
    expect(entry.version).toBe('1.0');
    expect(typeof entry.timestamp).toBe('string');
  });

  test('should create entry with custom log level', () => {
    const entry = createLogEntry('Error message', 'test-app', LogLevel.Error);
    
    expect(entry.logLevel).toBe(LogLevel.Error);
  });

  test('should validate created entry', () => {
    const entry = createLogEntry('Valid message', 'test-source');
    const result = validateLogEntry(entry);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

#### Testing Client Configuration

```typescript
import { validateConfig, NetworkType } from '../../../src/config';

describe('Config Validation', () => {
  test('should validate valid Unix config', () => {
    const config = {
      network: NetworkType.Unix,
      address: '/tmp/test.sock',
      timeout: 5000
    };
    
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
  });

  test('should reject TCP config without shared secret', () => {
    const config = {
      network: NetworkType.TCP,
      address: 'localhost:8080'
      // Missing sharedSecret
    };
    
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Shared secret required for TCP connections');
  });
});
```

#### Testing Batch Client Logic

```typescript
import { BatchClient } from '../../../src/client/batch-client';
import { MockLogFluxClient } from '../../fixtures/mock-agent';
import { createLogEntry } from '../../../src/types';

describe('BatchClient', () => {
  let mockClient: MockLogFluxClient;
  let batchClient: BatchClient;

  beforeEach(() => {
    mockClient = new MockLogFluxClient();
    batchClient = new BatchClient(mockClient, {
      maxBatchSize: 3,
      flushInterval: 1000
    });
  });

  afterEach(async () => {
    await batchClient.stop();
  });

  test('should batch entries up to max batch size', async () => {
    const entries = [
      createLogEntry('Message 1', 'test'),
      createLogEntry('Message 2', 'test'),
      createLogEntry('Message 3', 'test')
    ];

    // Add entries - should trigger flush at batch size
    for (const entry of entries) {
      await batchClient.addLogEntry(entry);
    }

    // Wait for batch to be sent
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockClient.sentBatches).toHaveLength(1);
    expect(mockClient.sentBatches[0].entries).toHaveLength(3);
  });

  test('should flush on timer', async () => {
    const entry = createLogEntry('Timer test', 'test');
    await batchClient.addLogEntry(entry);

    // Entry should be pending
    expect(batchClient.getPendingCount()).toBe(1);

    // Wait for timer flush
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Entry should be flushed
    expect(batchClient.getPendingCount()).toBe(0);
    expect(mockClient.sentBatches).toHaveLength(1);
  });
});
```

### Mocking Dependencies

Create mock implementations for testing:

```typescript
// src/__tests__/fixtures/mock-agent.ts
import { LogFluxClient, LogEntry, LogBatch, Config } from '../../src/types';

export class MockLogFluxClient implements LogFluxClient {
  public sentEntries: LogEntry[] = [];
  public sentBatches: LogBatch[] = [];
  public connected = false;
  public authenticated = false;
  
  constructor(private config: Config) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async close(): Promise<void> {
    this.connected = false;
  }

  async sendLogEntry(entry: LogEntry): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    this.sentEntries.push(entry);
  }

  async sendLogBatch(batch: LogBatch): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    this.sentBatches.push(batch);
  }

  async ping(): Promise<boolean> {
    return this.connected;
  }

  async authenticate(): Promise<boolean> {
    this.authenticated = true;
    return true;
  }
}
```

## Integration Testing

Integration tests require a running LogFlux agent and test the complete SDK functionality.

### Prerequisites

1. **LogFlux Agent**: Running agent with both Unix and TCP sockets enabled
2. **Configuration**: Agent configured with test settings
3. **Permissions**: Appropriate socket permissions

### Running Integration Tests

```bash
# Run integration tests
npm run test:integration

# Run with custom agent configuration
LOGFLUX_SOCKET_PATH=/custom/path.sock npm run test:integration

# Skip integration tests if agent unavailable
SKIP_INTEGRATION_TESTS=true npm run test:integration
```

### Agent Detection

Integration tests automatically detect available agents:

```typescript
describe('Agent Detection', () => {
  test('should detect available agents', async () => {
    const detection = await detectAgents();
    
    console.log('LogFlux agent detected:');
    console.log(`  Unix socket: ${detection.unixPath} - ${detection.unixAvailable ? 'Yes' : 'No'}`);
    console.log(`  TCP socket: ${detection.tcpHost}:${detection.tcpPort} - ${detection.tcpAvailable ? 'Yes' : 'No'}`);
    
    if (!detection.unixAvailable && !detection.tcpAvailable) {
      console.log('  Skipping integration tests. Start the agent to run these tests.');
      return;
    }
  });
});
```

### Integration Test Examples

#### Unix Socket Integration

```typescript
describe('Unix Socket Integration', () => {
  let client: LogFluxClient;

  beforeEach(async () => {
    const detection = await detectAgents();
    if (!detection.unixAvailable) {
      pending('LogFlux agent with Unix socket not available');
    }
    
    client = createUnixClient(detection.unixPath);
    await client.connect();
  });

  afterEach(async () => {
    if (client) {
      await client.close();
    }
  });

  test('should send log entry successfully', async () => {
    const entry = createLogEntry('Integration test message', 'integration-test');
    
    await expect(client.sendLogEntry(entry)).resolves.not.toThrow();
  });

  test('should handle batch sending', async () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      createLogEntry(`Batch message ${i}`, 'batch-test')
    );
    
    const batch = createLogBatch(entries);
    await expect(client.sendLogBatch(batch)).resolves.not.toThrow();
  });
});
```

#### TCP Integration with Authentication

```typescript
describe('TCP Integration', () => {
  let client: LogFluxClient;

  beforeEach(async () => {
    const detection = await detectAgents();
    if (!detection.tcpAvailable) {
      pending('LogFlux agent with TCP socket not available');
    }
    
    client = createTCPClient(detection.tcpHost, detection.tcpPort, detection.sharedSecret);
    await client.connect();
    
    const authenticated = await client.authenticate();
    if (!authenticated) {
      throw new Error('Failed to authenticate with agent');
    }
  });

  afterEach(async () => {
    if (client) {
      await client.close();
    }
  });

  test('should authenticate successfully', async () => {
    // Authentication done in beforeEach
    expect(client.isConnected()).toBe(true);
  });

  test('should send authenticated log entry', async () => {
    const entry = createLogEntry('TCP test message', 'tcp-test');
    
    await expect(client.sendLogEntry(entry)).resolves.not.toThrow();
  });
});
```

## Performance Testing

Performance tests measure SDK throughput and latency.

### Running Performance Tests

```bash
# Run performance tests
npm run test:performance

# Run with detailed timing
npm run test:performance -- --verbose

# Run specific performance test
npm run test:performance -- --testNamePattern="Batch processing"
```

### Performance Test Examples

#### Throughput Testing

```typescript
describe('Performance Tests', () => {
  test('should handle high-volume single entries', async () => {
    const client = createUnixClient();
    await client.connect();
    
    const entryCount = 1000;
    const startTime = Date.now();
    
    for (let i = 0; i < entryCount; i++) {
      const entry = createLogEntry(`Performance test ${i}`, 'perf-test');
      await client.sendLogEntry(entry);
    }
    
    const duration = Date.now() - startTime;
    const entriesPerSecond = (entryCount / duration) * 1000;
    
    console.log(`Sent ${entryCount} entries in ${duration}ms (${entriesPerSecond.toFixed(1)} entries/sec)`);
    
    // Performance expectation
    expect(entriesPerSecond).toBeGreaterThan(100);
    
    await client.close();
  });

  test('should handle high-volume batch processing', async () => {
    const client = createUnixClient();
    const batchClient = createBatchClient(client, {
      maxBatchSize: 100,
      flushInterval: 5000
    });
    
    const entryCount = 10000;
    const startTime = Date.now();
    
    // Add entries as fast as possible
    const promises = [];
    for (let i = 0; i < entryCount; i++) {
      const entry = createLogEntry(`Batch perf test ${i}`, 'batch-perf');
      promises.push(batchClient.addLogEntry(entry));
    }
    
    await Promise.all(promises);
    await batchClient.flush();
    
    const duration = Date.now() - startTime;
    const entriesPerSecond = (entryCount / duration) * 1000;
    
    console.log(`Processed ${entryCount} entries via batching in ${duration}ms (${entriesPerSecond.toFixed(1)} entries/sec)`);
    
    const stats = batchClient.getStats();
    console.log(`Batches sent: ${stats.totalBatchesSent}, Average batch size: ${stats.averageBatchSize}`);
    
    // Batching should be significantly faster
    expect(entriesPerSecond).toBeGreaterThan(1000);
    
    await batchClient.stop();
  });
});
```

#### Memory Usage Testing

```typescript
describe('Memory Performance', () => {
  test('should not leak memory during batch processing', async () => {
    const client = createUnixClient();
    const batchClient = createBatchClient(client, {
      maxBatchSize: 50,
      flushInterval: 1000
    });
    
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Process many entries
    for (let batch = 0; batch < 100; batch++) {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const entry = createLogEntry(`Memory test batch ${batch} entry ${i}`, 'memory-test');
        promises.push(batchClient.addLogEntry(entry));
      }
      await Promise.all(promises);
      await batchClient.flush();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;
    const memoryGrowthMB = memoryGrowth / 1024 / 1024;
    
    console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)} MB`);
    
    // Should not grow significantly
    expect(memoryGrowthMB).toBeLessThan(50);
    
    await batchClient.stop();
  });
});
```

## Test Configuration

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts']
};
```

### Test Environment Variables

```bash
# Test configuration
NODE_ENV=test

# Integration test settings
LOGFLUX_SOCKET_PATH=/tmp/logflux-test.sock
LOGFLUX_TCP_HOST=localhost
LOGFLUX_TCP_PORT=8080
LOGFLUX_SHARED_SECRET=test-secret
SKIP_INTEGRATION_TESTS=false

# Performance test settings
PERFORMANCE_TEST_ITERATIONS=1000
PERFORMANCE_TEST_BATCH_SIZE=100
```

## Continuous Integration

### GitHub Actions Configuration

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      logflux-agent:
        image: logflux/agent:latest
        ports:
          - 8080:8080
        volumes:
          - /tmp:/tmp
        options: >-
          --health-cmd "curl -f http://localhost:8080/health"
          --health-interval 30s
          --health-timeout 10s
          --health-retries 3

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run typecheck
    
    - name: Run unit tests
      run: npm run test:coverage
    
    - name: Wait for LogFlux agent
      run: |
        timeout 60 bash -c 'until nc -z localhost 8080; do sleep 1; done'
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

## Writing Tests

### Best Practices

1. **Descriptive Test Names**: Use clear, descriptive test names
2. **Arrange-Act-Assert**: Follow the AAA pattern
3. **Test Edge Cases**: Include boundary conditions and error cases
4. **Mock External Dependencies**: Use mocks for unit tests
5. **Clean Up Resources**: Properly close connections and clean up

### Test Structure Template

```typescript
describe('Component Name', () => {
  // Setup and teardown
  beforeEach(() => {
    // Initialize test data
  });

  afterEach(() => {
    // Clean up resources
  });

  describe('method or functionality', () => {
    test('should handle normal case', () => {
      // Arrange
      const input = createTestData();
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
    });

    test('should handle error case', () => {
      // Test error conditions
      expect(() => functionUnderTest(invalidInput)).toThrow();
    });

    test('should handle edge case', () => {
      // Test boundary conditions
    });
  });
});
```

### Testing Async Operations

```typescript
describe('Async Operations', () => {
  test('should handle promise resolution', async () => {
    const result = await asyncFunction();
    expect(result).toBeDefined();
  });

  test('should handle promise rejection', async () => {
    await expect(failingAsyncFunction()).rejects.toThrow('Expected error');
  });

  test('should timeout appropriately', async () => {
    const promise = longRunningFunction();
    await expect(promise).resolves.toBeDefined();
  }, 10000); // 10 second timeout
});
```

## Troubleshooting

### Common Test Issues

#### Agent Connection Issues

```bash
# Check agent status
nc -zv localhost 8080

# Check Unix socket
ls -la /tmp/logflux*.sock

# Run with debug logging
DEBUG=logflux:* npm run test:integration
```

#### Test Timeouts

```typescript
// Increase timeout for slow operations
describe('Slow operations', () => {
  test('should handle large batch', async () => {
    // Test implementation
  }, 30000); // 30 second timeout
});
```

#### Memory Issues

```bash
# Run tests with more memory
node --max-old-space-size=4096 node_modules/.bin/jest

# Enable garbage collection logging
node --trace-gc node_modules/.bin/jest
```

### Coverage Issues

```bash
# View detailed coverage report
npm run test:coverage
open coverage/lcov-report/index.html

# Check specific file coverage
npx jest --coverage --collectCoverageOnlyFrom=src/client/client.ts
```