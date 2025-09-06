/**
 * Network transport types
 */
export enum NetworkType {
  Unix = 'unix',
  TCP = 'tcp',
}

/**
 * Configuration for the SDK client
 */
export interface Config {
  /** Connection network type */
  network: NetworkType;
  /** Socket path for unix, host:port for tcp/http */
  address: string;
  /** Connection timeout in milliseconds */
  timeout: number;
  /** Optional shared secret for authentication */
  sharedSecret?: string;
  /** Number of messages to batch before sending */
  batchSize: number;
  /** Time to wait before sending partial batch (ms) */
  flushInterval: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Delay between retries (ms) */
  retryDelay: number;
}

/**
 * Configuration for batch processing
 */
export interface BatchConfig {
  /** Maximum entries per batch */
  maxBatchSize: number;
  /** Time interval for automatic flushing (ms) */
  flushInterval: number;
  /** Maximum memory usage before forcing flush (bytes) */
  maxMemoryUsage: number;
  /** Whether to flush on process exit */
  flushOnExit: boolean;
  /** Initial retry delay in milliseconds */
  initialRetryDelay?: number;
  /** Maximum retry delay in milliseconds */
  maxRetryDelay?: number;
  /** Exponential backoff multiplier */
  retryBackoffMultiplier?: number;
  /** Circuit breaker: failures before opening circuit */
  circuitBreakerFailureThreshold?: number;
  /** Circuit breaker: time to wait before retry in open state (ms) */
  circuitBreakerOpenTimeout?: number;
}

// Batch size limits (from API spec)
export const MIN_BATCH_SIZE = 1;
export const MAX_BATCH_SIZE = 100;

// Default timeouts (optimized for local/LAN agent communication)
export const DEFAULT_TIMEOUT = 2000; // 2 seconds - local agent should respond quickly
export const DEFAULT_FLUSH_INTERVAL = 1000; // 1 second
export const DEFAULT_RETRY_DELAY = 1000; // 1 second

// Exponential backoff defaults
export const DEFAULT_INITIAL_RETRY_DELAY = 500; // 500ms - faster initial retry for local agent
export const DEFAULT_MAX_RETRY_DELAY = 30000; // 30 seconds - shorter max for local agent
export const DEFAULT_RETRY_BACKOFF_MULTIPLIER = 2; // Double each time

// Circuit breaker defaults
export const DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5; // Open circuit after 5 consecutive failures
export const DEFAULT_CIRCUIT_BREAKER_OPEN_TIMEOUT = 10000; // 10 seconds before retry

/**
 * Creates default configuration with Unix socket transport
 */
export function createDefaultConfig(): Config {
  return {
    network: NetworkType.Unix,
    address: '/tmp/logflux-agent.sock',
    timeout: DEFAULT_TIMEOUT,
    batchSize: 10,
    flushInterval: DEFAULT_FLUSH_INTERVAL,
    maxRetries: 3,
    retryDelay: DEFAULT_RETRY_DELAY,
  };
}

/**
 * Creates default batch configuration
 */
export function createDefaultBatchConfig(): BatchConfig {
  return {
    maxBatchSize: MAX_BATCH_SIZE,
    flushInterval: DEFAULT_FLUSH_INTERVAL,
    maxMemoryUsage: 512 * 1024, // 512KB - more aggressive for application protection
    flushOnExit: true,
    initialRetryDelay: DEFAULT_INITIAL_RETRY_DELAY,
    maxRetryDelay: DEFAULT_MAX_RETRY_DELAY,
    retryBackoffMultiplier: DEFAULT_RETRY_BACKOFF_MULTIPLIER,
    circuitBreakerFailureThreshold: DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    circuitBreakerOpenTimeout: DEFAULT_CIRCUIT_BREAKER_OPEN_TIMEOUT,
  };
}

/**
 * Creates TCP configuration for the given host and port
 */
export function createTCPConfig(host: string, port: number, sharedSecret?: string): Config {
  return {
    network: NetworkType.TCP,
    address: `${host}:${port}`,
    timeout: DEFAULT_TIMEOUT,
    sharedSecret,
    batchSize: 10,
    flushInterval: DEFAULT_FLUSH_INTERVAL,
    maxRetries: 3,
    retryDelay: DEFAULT_RETRY_DELAY,
  };
}


/**
 * Validates configuration and throws error if invalid
 */
export function validateConfig(config: Config): void {
  if (!config.address) {
    throw new Error('address is required');
  }

  if (config.timeout <= 0) {
    throw new Error('timeout must be positive');
  }

  if (config.batchSize < MIN_BATCH_SIZE || config.batchSize > MAX_BATCH_SIZE) {
    throw new Error(`batchSize must be between ${MIN_BATCH_SIZE} and ${MAX_BATCH_SIZE}`);
  }

  if (config.flushInterval <= 0) {
    throw new Error('flushInterval must be positive');
  }

  if (config.maxRetries < 0) {
    throw new Error('maxRetries must be non-negative');
  }

  if (config.retryDelay < 0) {
    throw new Error('retryDelay must be non-negative');
  }

  // TCP connections require shared secret in most cases
  if (config.network === NetworkType.TCP && !config.sharedSecret) {
    console.warn('TCP connection without shared secret may fail authentication');
  }
}

/**
 * Validates basic batch configuration options
 */
function validateBatchBasicConfig(config: BatchConfig): void {
  if (config.maxBatchSize < MIN_BATCH_SIZE || config.maxBatchSize > MAX_BATCH_SIZE) {
    throw new Error(`maxBatchSize must be between ${MIN_BATCH_SIZE} and ${MAX_BATCH_SIZE}`);
  }

  if (config.flushInterval <= 0) {
    throw new Error('flushInterval must be positive');
  }

  if (config.maxMemoryUsage <= 0) {
    throw new Error('maxMemoryUsage must be positive');
  }
}

/**
 * Validates retry configuration options
 */
function validateBatchRetryConfig(config: BatchConfig): void {
  if (config.initialRetryDelay !== undefined && config.initialRetryDelay <= 0) {
    throw new Error('initialRetryDelay must be positive');
  }

  if (config.maxRetryDelay !== undefined && config.maxRetryDelay <= 0) {
    throw new Error('maxRetryDelay must be positive');
  }

  if (config.retryBackoffMultiplier !== undefined && config.retryBackoffMultiplier <= 1) {
    throw new Error('retryBackoffMultiplier must be greater than 1');
  }

  if (config.initialRetryDelay !== undefined && config.maxRetryDelay !== undefined &&
      config.initialRetryDelay > config.maxRetryDelay) {
    throw new Error('initialRetryDelay must be less than or equal to maxRetryDelay');
  }
}

/**
 * Validates circuit breaker configuration options
 */
function validateBatchCircuitBreakerConfig(config: BatchConfig): void {
  if (config.circuitBreakerFailureThreshold !== undefined && config.circuitBreakerFailureThreshold <= 0) {
    throw new Error('circuitBreakerFailureThreshold must be positive');
  }

  if (config.circuitBreakerOpenTimeout !== undefined && config.circuitBreakerOpenTimeout <= 0) {
    throw new Error('circuitBreakerOpenTimeout must be positive');
  }
}

/**
 * Validates batch configuration and throws error if invalid
 */
export function validateBatchConfig(config: BatchConfig): void {
  validateBatchBasicConfig(config);
  validateBatchRetryConfig(config);
  validateBatchCircuitBreakerConfig(config);
}