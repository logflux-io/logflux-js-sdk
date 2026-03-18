# LogFlux JavaScript SDK

Zero-knowledge encrypted logging SDK for [LogFlux.io](https://logflux.io). All data is encrypted client-side with AES-256-GCM before transmission -- the server never sees plaintext.

## Features

- **End-to-end encryption** -- AES-256-GCM with RSA key exchange
- **Zero dependencies** -- uses Node.js built-in `crypto`, `zlib`, and `fetch`
- **All 7 entry types** -- Log, Metric, Trace, Event, Audit, Telemetry, TelemetryManaged
- **Async queue** -- non-blocking with configurable batch size and flush interval
- **Automatic retry** -- exponential backoff with jitter, rate-limit awareness
- **Breadcrumbs** -- ring buffer trail attached to error captures
- **Scopes** -- per-request context isolation
- **Distributed tracing** -- spans with parent/child relationships and header propagation
- **Sampling** -- probabilistic sampling with audit exemption

## Requirements

- Node.js 18+
- TypeScript 5+ (optional, for type support)

## Installation

```bash
npm install @logflux-io/logflux-js-sdk
```

## Quick Start

```typescript
import { LogFlux } from '@logflux-io/logflux-js-sdk';

// Initialize (performs endpoint discovery + RSA handshake)
await LogFlux.init({
  apiKey: 'eu-lf_your_api_key_here',
  node: 'my-app-server',
  environment: 'production',
  release: 'v1.2.3',
});

// Log messages at different severity levels
LogFlux.info('Server started', { port: '3000' });
LogFlux.warn('High memory usage', { usage: '85%' });
LogFlux.error('Request failed', { path: '/api/users', status: '500' });

// Metrics
LogFlux.counter('http_requests_total', 1, { method: 'GET' });
LogFlux.gauge('memory_usage_bytes', 1024 * 1024 * 512);

// Events
LogFlux.event('user.signup', { plan: 'pro', source: 'organic' });

// Audit trail (never sampled -- compliance requirement)
LogFlux.audit('delete', 'admin@example.com', 'document', 'doc-123');

// Error capture with stack trace + breadcrumbs
try {
  await riskyOperation();
} catch (err) {
  LogFlux.captureError(err as Error, { operation: 'riskyOperation' });
}

// Flush and close on shutdown
await LogFlux.flush();
await LogFlux.close();
```

## Initialize from Environment Variables

```typescript
await LogFlux.initFromEnv('my-node');
```

Reads from:
- `LOGFLUX_API_KEY` (required)
- `LOGFLUX_ENVIRONMENT`
- `LOGFLUX_LOG_GROUP`
- `LOGFLUX_NODE`
- `LOGFLUX_QUEUE_SIZE`
- `LOGFLUX_BATCH_SIZE`
- `LOGFLUX_FLUSH_INTERVAL` (seconds)
- `LOGFLUX_HTTP_TIMEOUT` (seconds)
- `LOGFLUX_MAX_RETRIES`
- `LOGFLUX_BACKOFF_FACTOR`
- `LOGFLUX_FAILSAFE_MODE`
- `LOGFLUX_ENABLE_COMPRESSION`
- `LOGFLUX_DEBUG`

## Log Levels

Syslog severity levels (1-8):

| Level | Name | Constant |
|-------|------|----------|
| 1 | Emergency | `LogLevel.Emergency` |
| 2 | Alert | `LogLevel.Alert` |
| 3 | Critical | `LogLevel.Critical` |
| 4 | Error | `LogLevel.Error` |
| 5 | Warning | `LogLevel.Warning` |
| 6 | Notice | `LogLevel.Notice` |
| 7 | Info | `LogLevel.Info` |
| 8 | Debug | `LogLevel.Debug` |

## Entry Types

| Type | Name | Constant | Encryption |
|------|------|----------|------------|
| 1 | Log | `EntryType.Log` | AES-256-GCM |
| 2 | Metric | `EntryType.Metric` | AES-256-GCM |
| 3 | Trace | `EntryType.Trace` | AES-256-GCM |
| 4 | Event | `EntryType.Event` | AES-256-GCM |
| 5 | Audit | `EntryType.Audit` | AES-256-GCM |
| 6 | Telemetry | `EntryType.Telemetry` | AES-256-GCM |
| 7 | TelemetryManaged | `EntryType.TelemetryManaged` | gzip only |

## Breadcrumbs

Breadcrumbs create a trail of events leading up to an error:

```typescript
LogFlux.addBreadcrumb('http', 'GET /api/users', { status: '200' });
LogFlux.addBreadcrumb('db', 'SELECT * FROM users', { rows: '42' });

// Breadcrumbs are automatically included with captureError
LogFlux.captureError(new Error('processing failed'));

// Clear when no longer needed
LogFlux.clearBreadcrumbs();
```

Log entries at info level or above, and all events, automatically add breadcrumbs.

## Scopes

Scopes provide per-request isolation:

```typescript
LogFlux.withScope((scope) => {
  scope.setAttribute('request_id', 'abc-123');
  scope.setUser('usr_456');
  scope.setRequest('GET', '/api/users', 'req-789');
  scope.addBreadcrumb('auth', 'validated token');
  // Use scope attributes in your logging logic
});
```

## Distributed Tracing

```typescript
// Create a root span
const span = LogFlux.startSpan('http.server', 'GET /api/users');
span.setAttribute('http.method', 'GET');

// Create a child span
const dbSpan = span.startChild('db.query', 'SELECT users');
// ... do database work ...
dbSpan.end();
LogFlux.sendSpan(dbSpan);

// Mark errors
if (response.status >= 500) {
  span.setStatus('error');
}
span.end();
LogFlux.sendSpan(span);

// Propagate trace context
const headers = { 'X-LogFlux-Trace': span.toTraceHeader() };

// Continue from incoming headers
const childSpan = LogFlux.continueFromHeaders(
  req.headers,
  'http.server',
  'GET /api/data',
);
```

## Express Middleware Example

```typescript
import express from 'express';
import { LogFlux } from '@logflux-io/logflux-js-sdk';

const app = express();

// Initialize LogFlux
await LogFlux.init({
  apiKey: process.env.LOGFLUX_API_KEY!,
  node: 'api-server',
  environment: 'production',
});

// Request logging middleware
app.use((req, res, next) => {
  const span = LogFlux.continueFromHeaders(
    req.headers as Record<string, string>,
    'http.server',
    `${req.method} ${req.path}`,
  );
  span.setAttribute('http.method', req.method);
  span.setAttribute('http.url', req.originalUrl);

  res.on('finish', () => {
    span.setAttribute('http.status_code', String(res.statusCode));
    if (res.statusCode >= 500) {
      span.setStatus('error');
    }
    span.end();
    LogFlux.sendSpan(span);
  });

  next();
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  LogFlux.captureError(err, {
    method: req.method,
    path: req.path,
  });
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await LogFlux.flush();
  await LogFlux.close();
  process.exit(0);
});

app.listen(3000);
```

## Configuration Options

```typescript
interface Options {
  apiKey: string;                // Required: API key (format: <region>-lf_<key>)
  node?: string;                 // Node/service name (default: hostname)
  source?: string;               // Source identifier for all payloads
  environment?: string;          // Environment (e.g., 'production')
  release?: string;              // Release version (e.g., 'v1.2.3')
  logGroup?: string;             // Log group identifier
  customEndpointUrl?: string;    // Override endpoint discovery

  queueSize?: number;            // Max queue entries (default: 1000)
  flushIntervalMs?: number;      // Flush interval ms (default: 5000)
  batchSize?: number;            // Max entries per batch (default: 100)
  workerCount?: number;          // Concurrent send workers (default: 2)

  maxRetries?: number;           // Max retry attempts (default: 3)
  initialDelayMs?: number;       // Initial retry delay ms (default: 1000)
  maxDelayMs?: number;           // Max retry delay ms (default: 30000)
  backoffFactor?: number;        // Exponential backoff factor (default: 2.0)

  httpTimeoutMs?: number;        // HTTP timeout ms (default: 30000)
  failsafe?: boolean;            // Swallow errors silently (default: true)
  enableCompression?: boolean;   // gzip before encrypt (default: true)
  debug?: boolean;               // Console debug output (default: false)

  maxBreadcrumbs?: number;       // Ring buffer size (default: 100)
  sampleRate?: number;           // 0.0-1.0, send probability (default: 1.0)

  beforeSend?: (entry: Record<string, unknown>) => Record<string, unknown> | null;
}
```

## Statistics

```typescript
const stats = LogFlux.stats();
console.log(`Sent: ${stats.entriesSent}`);
console.log(`Dropped: ${stats.entriesDropped}`);
console.log(`Queue: ${stats.queueSize}/${stats.queueCapacity}`);
console.log(`Handshake: ${stats.handshakeOK}`);
console.log(`Drop reasons:`, stats.dropReasons);
```

## Development

```bash
# Build (in Docker)
make build

# Test (in Docker)
make test

# Shell into dev container
make shell
```

## License

Elastic License 2.0 (ELv2) -- see [LICENSE](./LICENSE).

Copyright 2026 LogFlux.io
