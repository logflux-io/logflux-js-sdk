import type { LogLevel } from './types';

/**
 * BeforeSend callback. Return the entry to send it, or null to drop it.
 */
export type BeforeSendFn<T> = (entry: T) => T | null;

/**
 * Options for configuring the LogFlux SDK.
 */
export interface Options {
  apiKey: string;
  node?: string;
  source?: string;
  environment?: string;
  release?: string;
  logGroup?: string;
  customEndpointUrl?: string;

  /** Maximum number of entries in the in-memory queue (default: 1000). */
  queueSize?: number;
  /** Flush interval in milliseconds (default: 5000). */
  flushIntervalMs?: number;
  /** Maximum entries per batch (default: 100). */
  batchSize?: number;
  /** Number of concurrent send workers (default: 2). */
  workerCount?: number;

  /** Maximum retries for failed sends (default: 3). */
  maxRetries?: number;
  /** Initial retry delay in milliseconds (default: 1000). */
  initialDelayMs?: number;
  /** Maximum retry delay in milliseconds (default: 30000). */
  maxDelayMs?: number;
  /** Exponential backoff factor (default: 2.0). */
  backoffFactor?: number;

  /** HTTP request timeout in milliseconds (default: 30000). */
  httpTimeoutMs?: number;
  /** In failsafe mode, errors are silently swallowed (default: true). */
  failsafe?: boolean;
  /** Enable gzip compression before encryption (default: true). */
  enableCompression?: boolean;
  /** Enable debug logging to console (default: false). */
  debug?: boolean;

  /** Ring buffer size for breadcrumbs (default: 100). */
  maxBreadcrumbs?: number;
  /** Sampling rate 0.0-1.0 (default: 1.0 = send all). */
  sampleRate?: number;

  /** Global beforeSend hook. Return null to drop. */
  beforeSend?: BeforeSendFn<Record<string, unknown>>;
}

/**
 * Loads SDK configuration from environment variables.
 * Supports the same env vars as the Go SDK.
 */
export function loadOptionsFromEnv(node?: string): Options {
  const env = typeof process !== 'undefined' ? process.env : {};

  const apiKey = env.LOGFLUX_API_KEY ?? '';
  if (!apiKey) {
    throw new Error('LOGFLUX_API_KEY environment variable is required');
  }

  const opts: Options = {
    apiKey,
    node: node ?? env.LOGFLUX_NODE ?? undefined,
    environment: env.LOGFLUX_ENVIRONMENT ?? undefined,
    logGroup: env.LOGFLUX_LOG_GROUP ?? undefined,
    failsafe: true,
    enableCompression: true,
  };

  const intEnv = (key: string): number | undefined => {
    const v = env[key];
    if (v === undefined || v === '') return undefined;
    const n = parseInt(v, 10);
    return isNaN(n) ? undefined : n;
  };

  const floatEnv = (key: string): number | undefined => {
    const v = env[key];
    if (v === undefined || v === '') return undefined;
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  };

  const boolEnv = (key: string): boolean | undefined => {
    const v = env[key];
    if (v === undefined || v === '') return undefined;
    return v === 'true' || v === '1';
  };

  opts.queueSize = intEnv('LOGFLUX_QUEUE_SIZE');
  opts.batchSize = intEnv('LOGFLUX_BATCH_SIZE');
  opts.maxRetries = intEnv('LOGFLUX_MAX_RETRIES');
  opts.workerCount = intEnv('LOGFLUX_WORKER_COUNT');

  const flushSec = intEnv('LOGFLUX_FLUSH_INTERVAL');
  if (flushSec !== undefined) opts.flushIntervalMs = flushSec * 1000;

  const initialDelayMs = intEnv('LOGFLUX_INITIAL_DELAY');
  if (initialDelayMs !== undefined) opts.initialDelayMs = initialDelayMs;

  const maxDelaySec = intEnv('LOGFLUX_MAX_DELAY');
  if (maxDelaySec !== undefined) opts.maxDelayMs = maxDelaySec * 1000;

  opts.backoffFactor = floatEnv('LOGFLUX_BACKOFF_FACTOR');

  const httpSec = intEnv('LOGFLUX_HTTP_TIMEOUT');
  if (httpSec !== undefined) opts.httpTimeoutMs = httpSec * 1000;

  const failsafe = boolEnv('LOGFLUX_FAILSAFE_MODE');
  if (failsafe !== undefined) opts.failsafe = failsafe;

  const compression = boolEnv('LOGFLUX_ENABLE_COMPRESSION');
  if (compression !== undefined) opts.enableCompression = compression;

  const debug = boolEnv('LOGFLUX_DEBUG');
  if (debug !== undefined) opts.debug = debug;

  return opts;
}

/**
 * Validates API key format: <region>-lf_<key>
 */
export function validateApiKey(key: string): void {
  const dashIdx = key.indexOf('-');
  if (dashIdx === -1) {
    throw new Error('Invalid API key format: must be <region>-lf_<key>');
  }
  const region = key.substring(0, dashIdx);
  const validRegions = new Set(['eu', 'us', 'ca', 'au', 'ap']);
  if (!validRegions.has(region)) {
    throw new Error(`Invalid API key region: "${region}" (expected eu, us, ca, au, or ap)`);
  }
  const rest = key.substring(dashIdx + 1);
  if (!rest.startsWith('lf_')) {
    throw new Error('Invalid API key format: key must start with lf_');
  }
  if (rest.length <= 3) {
    throw new Error('Invalid API key format: key body is empty');
  }
}
