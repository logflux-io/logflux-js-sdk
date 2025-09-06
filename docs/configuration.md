# Configuration Guide

This guide covers all configuration options available in the LogFlux JavaScript/TypeScript SDK.

## Table of Contents

- [Client Configuration](#client-configuration)
- [Batch Configuration](#batch-configuration)
- [Transport Configuration](#transport-configuration)
- [Environment Variables](#environment-variables)
- [Configuration Examples](#configuration-examples)
- [Best Practices](#best-practices)

## Client Configuration

The SDK provides flexible configuration options for connecting to the LogFlux agent.

### Basic Configuration Interface

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

### Configuration Options

#### `network` (required)
Specifies the transport protocol to use.

```typescript
enum NetworkType {
  Unix = 'unix',
  TCP = 'tcp'
}
```

**Values:**
- `NetworkType.Unix`: Use Unix domain sockets (recommended for local agent)
- `NetworkType.TCP`: Use TCP connections (required for remote agent)

#### `address` (required)
The connection address, format depends on network type.

**For Unix sockets:**
```typescript
const config: Config = {
  network: NetworkType.Unix,
  address: '/tmp/logflux-agent.sock'  // Path to socket file
};
```

**For TCP connections:**
```typescript
const config: Config = {
  network: NetworkType.TCP,
  address: 'localhost:8080'  // host:port format
};
```

#### `sharedSecret` (optional)
Required for TCP authentication, ignored for Unix sockets.

```typescript
const config: Config = {
  network: NetworkType.TCP,
  address: 'localhost:8080',
  sharedSecret: 'your-secret-key'
};
```

#### `timeout` (optional)
Connection timeout in milliseconds.

- **Default:** `5000` (5 seconds)
- **Range:** `1000` to `30000` milliseconds

```typescript
const config: Config = {
  network: NetworkType.Unix,
  address: '/tmp/logflux-agent.sock',
  timeout: 10000  // 10 seconds
};
```

#### `maxRetries` (optional)
Maximum number of retry attempts for failed operations.

- **Default:** `3`
- **Range:** `0` to `10`

```typescript
const config: Config = {
  network: NetworkType.Unix,
  address: '/tmp/logflux-agent.sock',
  maxRetries: 5
};
```

#### `retryDelay` (optional)
Base delay between retry attempts in milliseconds.

- **Default:** `1000` (1 second)
- **Range:** `100` to `10000` milliseconds
- **Note:** Actual delay uses exponential backoff with jitter

```typescript
const config: Config = {
  network: NetworkType.Unix,
  address: '/tmp/logflux-agent.sock',
  retryDelay: 2000  // Start with 2 seconds, then 4, 8, etc.
};
```

## Batch Configuration

Batch clients provide additional configuration options for optimizing performance.

### Batch Configuration Interface

```typescript
interface BatchConfig {
  maxBatchSize?: number;
  flushInterval?: number;
  maxMemoryUsage?: number;
  flushOnExit?: boolean;
}
```

### Batch Configuration Options

#### `maxBatchSize` (optional)
Maximum number of log entries per batch.

- **Default:** `50`
- **Range:** `1` to `1000`
- **Recommendation:** 50-200 for most applications

```typescript
const batchConfig: BatchConfig = {
  maxBatchSize: 100  // Send batches of up to 100 entries
};
```

#### `flushInterval` (optional)
Maximum time to wait before sending a partial batch.

- **Default:** `1000` milliseconds (1 second)
- **Range:** `100` to `30000` milliseconds

```typescript
const batchConfig: BatchConfig = {
  flushInterval: 5000  // Flush every 5 seconds maximum
};
```

#### `maxMemoryUsage` (optional)
Maximum memory usage for pending log entries in bytes.

- **Default:** `1048576` (1 MB)
- **Range:** `65536` (64 KB) to `10485760` (10 MB)

```typescript
const batchConfig: BatchConfig = {
  maxMemoryUsage: 2 * 1024 * 1024  // 2 MB maximum
};
```

#### `flushOnExit` (optional)
Whether to automatically flush pending entries on process exit.

- **Default:** `true`
- **Recommendation:** Keep enabled for data integrity

```typescript
const batchConfig: BatchConfig = {
  flushOnExit: true  // Ensure no log entries are lost on shutdown
};
```

## Transport Configuration

### Unix Socket Configuration

Unix sockets are the recommended transport for local LogFlux agent communication.

```typescript
import { createUnixClient, NetworkType } from '@logflux-io/logflux-js-sdk';

// Simple factory function
const client = createUnixClient('/tmp/logflux-agent.sock');

// Or explicit configuration
const config: Config = {
  network: NetworkType.Unix,
  address: '/tmp/logflux-agent.sock',
  timeout: 5000,
  maxRetries: 3,
  retryDelay: 1000
};
```

**Advantages:**
- Fastest communication (no network overhead)
- Most secure (filesystem permissions)
- No authentication required
- Lower resource usage

**Requirements:**
- LogFlux agent must be running on the same machine
- Appropriate filesystem permissions

### TCP Configuration

TCP connections are used for remote LogFlux agent communication.

```typescript
import { createTCPClient, NetworkType } from '@logflux-io/logflux-js-sdk';

// Simple factory function
const client = createTCPClient('remote-host', 8080, 'shared-secret');

// Or explicit configuration
const config: Config = {
  network: NetworkType.TCP,
  address: 'remote-host:8080',
  sharedSecret: 'your-shared-secret',
  timeout: 10000,  // Higher timeout for network communication
  maxRetries: 5,   // More retries for network issues
  retryDelay: 2000
};
```

**Advantages:**
- Remote agent communication
- Flexible deployment options
- Network load balancing support

**Requirements:**
- Network connectivity to agent
- Shared secret authentication
- Firewall configuration

## Environment Variables

The SDK can read configuration from environment variables for easier deployment.

### Supported Environment Variables

```bash
# Connection settings
LOGFLUX_NETWORK=unix                           # 'unix' or 'tcp'
LOGFLUX_ADDRESS=/tmp/logflux-agent.sock       # Socket path or host:port
LOGFLUX_SHARED_SECRET=your-secret-key         # Required for TCP

# Connection behavior
LOGFLUX_TIMEOUT=5000                          # Connection timeout (ms)
LOGFLUX_MAX_RETRIES=3                         # Maximum retry attempts
LOGFLUX_RETRY_DELAY=1000                      # Base retry delay (ms)

# Batch settings
LOGFLUX_MAX_BATCH_SIZE=50                     # Maximum entries per batch
LOGFLUX_FLUSH_INTERVAL=1000                   # Maximum flush delay (ms)
LOGFLUX_MAX_MEMORY_USAGE=1048576              # Maximum memory usage (bytes)
LOGFLUX_FLUSH_ON_EXIT=true                    # Flush on process exit

# Application settings
LOGFLUX_DEFAULT_SOURCE=my-app                 # Default source identifier
LOGFLUX_DEFAULT_LOG_LEVEL=info                # Default log level
```

### Using Environment Configuration

```typescript
import { createConfigFromEnv, createClientFromEnv, createBatchClientFromEnv } from '@logflux-io/logflux-js-sdk';

// Create configuration from environment variables
const config = createConfigFromEnv();

// Or create clients directly from environment
const client = createClientFromEnv();
const batchClient = createBatchClientFromEnv();
```

### Environment Configuration Examples

**Development environment (.env):**
```bash
LOGFLUX_NETWORK=unix
LOGFLUX_ADDRESS=/tmp/logflux-agent.sock
LOGFLUX_MAX_BATCH_SIZE=20
LOGFLUX_FLUSH_INTERVAL=1000
LOGFLUX_DEFAULT_SOURCE=dev-app
```

**Production environment:**
```bash
LOGFLUX_NETWORK=tcp
LOGFLUX_ADDRESS=logflux-agent:8080
LOGFLUX_SHARED_SECRET=production-secret-key
LOGFLUX_TIMEOUT=10000
LOGFLUX_MAX_RETRIES=5
LOGFLUX_MAX_BATCH_SIZE=200
LOGFLUX_FLUSH_INTERVAL=5000
LOGFLUX_DEFAULT_SOURCE=prod-app
```

## Configuration Examples

### Development Configuration

Optimized for development with fast feedback and debugging.

```typescript
import { Config, BatchConfig, NetworkType } from '@logflux-io/logflux-js-sdk';

const devConfig: Config = {
  network: NetworkType.Unix,
  address: '/tmp/logflux-agent.sock',
  timeout: 2000,      // Shorter timeout for quick feedback
  maxRetries: 1,      // Fewer retries in development
  retryDelay: 500
};

const devBatchConfig: BatchConfig = {
  maxBatchSize: 10,   // Smaller batches for immediate visibility
  flushInterval: 500, // Frequent flushing for debugging
  maxMemoryUsage: 512 * 1024, // 512 KB
  flushOnExit: true
};
```

### Production Configuration

Optimized for high performance and reliability.

```typescript
const prodConfig: Config = {
  network: NetworkType.TCP,
  address: 'logflux-cluster:8080',
  sharedSecret: process.env.LOGFLUX_SECRET,
  timeout: 10000,     // Longer timeout for network latency
  maxRetries: 5,      // More retries for network resilience
  retryDelay: 2000
};

const prodBatchConfig: BatchConfig = {
  maxBatchSize: 200,  // Larger batches for efficiency
  flushInterval: 5000, // Less frequent flushing
  maxMemoryUsage: 4 * 1024 * 1024, // 4 MB
  flushOnExit: true
};
```

### High-Volume Configuration

Optimized for applications with very high log volume.

```typescript
const highVolumeConfig: Config = {
  network: NetworkType.Unix, // Unix socket for maximum performance
  address: '/tmp/logflux-agent.sock',
  timeout: 5000,
  maxRetries: 3,
  retryDelay: 1000
};

const highVolumeBatchConfig: BatchConfig = {
  maxBatchSize: 500,  // Very large batches
  flushInterval: 10000, // Infrequent flushing
  maxMemoryUsage: 8 * 1024 * 1024, // 8 MB
  flushOnExit: true
};
```

### Multi-Environment Configuration

Dynamic configuration based on environment.

```typescript
function createEnvironmentConfig(): { config: Config, batchConfig: BatchConfig } {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isProduction) {
    return {
      config: {
        network: NetworkType.TCP,
        address: process.env.LOGFLUX_ADDRESS || 'logflux:8080',
        sharedSecret: process.env.LOGFLUX_SECRET,
        timeout: 15000,
        maxRetries: 5,
        retryDelay: 3000
      },
      batchConfig: {
        maxBatchSize: 200,
        flushInterval: 5000,
        maxMemoryUsage: 4 * 1024 * 1024,
        flushOnExit: true
      }
    };
  }
  
  if (isDevelopment) {
    return {
      config: {
        network: NetworkType.Unix,
        address: '/tmp/logflux-agent.sock',
        timeout: 2000,
        maxRetries: 1,
        retryDelay: 500
      },
      batchConfig: {
        maxBatchSize: 10,
        flushInterval: 500,
        maxMemoryUsage: 512 * 1024,
        flushOnExit: true
      }
    };
  }
  
  // Default/test configuration
  return {
    config: {
      network: NetworkType.Unix,
      address: '/tmp/logflux-agent.sock',
      timeout: 5000,
      maxRetries: 3,
      retryDelay: 1000
    },
    batchConfig: {
      maxBatchSize: 50,
      flushInterval: 1000,
      maxMemoryUsage: 1024 * 1024,
      flushOnExit: true
    }
  };
}

// Usage
const { config, batchConfig } = createEnvironmentConfig();
const client = createClient(config);
const batchClient = createBatchClient(client, batchConfig);
```

## Best Practices

### Connection Configuration

1. **Use Unix sockets for local agents** - faster and more secure
2. **Use appropriate timeouts** - balance responsiveness with reliability
3. **Configure retry behavior** - more retries for production, fewer for development
4. **Secure shared secrets** - use environment variables, never hardcode

### Batch Configuration

1. **Optimize for your log volume:**
   - Low volume: Small batches (10-50), frequent flushing (1-2s)
   - High volume: Large batches (100-500), less frequent flushing (5-10s)

2. **Monitor memory usage** - set appropriate limits to prevent memory leaks

3. **Always enable flush on exit** - prevents data loss during shutdown

4. **Test configuration under load** - verify performance meets requirements

### Environment-Specific Configuration

1. **Use environment variables** - easier deployment and configuration management

2. **Validate configuration** - check required values at startup

3. **Provide sensible defaults** - application should work with minimal configuration

4. **Document configuration options** - help operations teams deploy correctly

### Configuration Validation

```typescript
import { validateConfig, validateBatchConfig } from '@logflux-io/logflux-js-sdk';

function validateApplicationConfig(config: Config, batchConfig: BatchConfig) {
  // Validate client config
  const configResult = validateConfig(config);
  if (!configResult.valid) {
    throw new Error(`Invalid client config: ${configResult.errors.join(', ')}`);
  }
  
  // Validate batch config
  const batchResult = validateBatchConfig(batchConfig);
  if (!batchResult.valid) {
    throw new Error(`Invalid batch config: ${batchResult.errors.join(', ')}`);
  }
  
  // Custom validation
  if (config.network === NetworkType.TCP && !config.sharedSecret) {
    throw new Error('Shared secret required for TCP connections');
  }
  
  if (batchConfig.maxBatchSize! > 1000) {
    console.warn('Very large batch size may impact performance');
  }
}
```

### Performance Tuning

1. **Monitor batch statistics** - track performance metrics in production

2. **Adjust based on load patterns** - optimize for your specific use case

3. **Load test configuration** - verify performance under expected load

4. **Consider resource constraints** - balance performance with memory/CPU usage

```typescript
// Example performance monitoring
const batchClient = createBatchClient(client, batchConfig);

setInterval(() => {
  const stats = batchClient.getStats();
  console.log('LogFlux Performance:', {
    entriesPerSecond: stats.totalEntriesProcessed / (Date.now() - startTime) * 1000,
    averageBatchSize: stats.averageBatchSize,
    pendingEntries: stats.pendingEntries,
    memoryUsage: process.memoryUsage().heapUsed
  });
}, 30000); // Every 30 seconds
```