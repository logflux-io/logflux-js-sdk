import { LogFluxClient } from './index';
import { LogEntry, LogBatch } from '../types';
import { BatchConfig, createDefaultBatchConfig, validateBatchConfig } from '../config';

/**
 * Statistics for batch client operations
 */
export interface BatchStats {
  entriesProcessed: number;
  batchesSent: number;
  errors: number;
  averageBatchSize: number;
  lastFlushTime: Date | null;
}

/**
 * BatchClient wraps the basic client with automatic batching functionality.
 * It collects log entries and sends them in batches to improve performance.
 * Supports automatic flushing based on batch size, time intervals, or memory usage.
 */
export class BatchClient {
  private client: LogFluxClient;
  private config: BatchConfig;
  private batch: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private stopped = false;
  private exitHandlers?: {
    exitHandler: () => Promise<void>;
    syncExitHandler: () => void;
  };
  private stats: BatchStats = {
    entriesProcessed: 0,
    batchesSent: 0,
    errors: 0,
    averageBatchSize: 0,
    lastFlushTime: null,
  };

  // Exponential backoff state
  private consecutiveFailures = 0;
  private nextRetryDelay: number;

  // Circuit breaker state
  private circuitOpen = false;
  private circuitOpenTime?: number;

  /**
   * Creates a new batch client with the given client and configuration.
   * If batchConfig is null, uses default batch configuration.
   */
  constructor(client: LogFluxClient, batchConfig?: BatchConfig) {
    if (!client) {
      throw new Error('client cannot be null');
    }

    this.client = client;
    this.config = batchConfig ?? createDefaultBatchConfig();
    validateBatchConfig(this.config);

    // Initialize backoff delay
    this.nextRetryDelay = this.config.initialRetryDelay ?? 1000;

    this.startFlushTimer();

    // Flush on process exit if configured
    if (this.config.flushOnExit) {
      this.setupExitHandlers();
    }
  }

  /**
   * Adds a log entry to the batch. Automatically flushes if batch size limit is reached.
   */
  async addLogEntry(entry: LogEntry): Promise<void> {
    if (this.stopped) {
      throw new Error('batch client has been stopped');
    }

    this.batch.push(entry);
    this.stats.entriesProcessed++;

    // Check if we should flush based on batch size
    if (this.batch.length >= this.config.maxBatchSize) {
      await this.flush();
    }
    // Check if we should flush based on memory usage
    else if (this.getEstimatedMemoryUsage() >= this.config.maxMemoryUsage) {
      await this.flush();
    }
  }

  /**
   * Manually flushes all pending log entries
   */
  async flush(): Promise<void> {
    if (this.batch.length === 0) {
      return;
    }

    // Check circuit breaker
    if (this.isCircuitOpen()) {
      // Circuit is open - drop logs to protect application
      const droppedCount = this.batch.length;
      this.batch = [];
      console.warn(`LogFlux: Circuit breaker open, dropped ${droppedCount} log entries`);
      return;
    }

    const batchToSend = [...this.batch];
    this.batch = [];

    try {
      const logBatch: LogBatch = {
        entries: batchToSend,
      };

      await this.client.sendLogBatch(logBatch);

      // Success - reset backoff
      this.consecutiveFailures = 0;
      this.nextRetryDelay = this.config.initialRetryDelay ?? 1000;

      this.stats.batchesSent++;
      this.stats.lastFlushTime = new Date();
      this.updateAverageBatchSize(batchToSend.length);
    } catch (error) {
      this.stats.errors++;

      // Increment failure count and calculate next delay
      this.consecutiveFailures++;
      this.calculateNextRetryDelay();

      // Check if circuit breaker should open
      this.openCircuit();

      // Re-add entries to the front of the batch for retry
      this.batch.unshift(...batchToSend);
      throw error;
    }
  }

  /**
   * Stops the batch client and flushes remaining entries
   */
  async stop(): Promise<void> {
    this.stopped = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Remove exit handlers if they were registered
    this.removeExitHandlers();

    // Flush remaining entries
    if (this.batch.length > 0) {
      try {
        await this.flush();
      } catch (error) {
        // Log errors during shutdown
        console.error('LogFlux: Error during batch stop:', error);
      }
    }

    await this.client.close();
  }

  /**
   * Gets current batch statistics
   */
  getStats(): BatchStats {
    return { ...this.stats };
  }

  /**
   * Gets the current batch size
   */
  getPendingCount(): number {
    return this.batch.length;
  }

  /**
   * Gets the current configuration
   */
  getConfig(): BatchConfig {
    return { ...this.config };
  }

  /**
   * Checks if the batch client is stopped
   */
  isStopped(): boolean {
    return this.stopped;
  }

  private startFlushTimer(): void {
    const scheduleNextFlush = () => {
      // Calculate delay: use exponential backoff delay if there are failures, otherwise normal interval
      const delay = this.consecutiveFailures > 0
        ? this.nextRetryDelay
        : this.config.flushInterval;

      this.flushTimer = setTimeout(() => {
        if (!this.stopped && this.batch.length > 0) {
          // Use void to explicitly ignore the promise
          void this.flush().catch(error => {
            // Timer flush errors are logged but don't stop the timer
            console.error('Error during timer flush:', error);
            this.stats.errors++;
          });
        }

        // Schedule the next flush if not stopped
        if (!this.stopped) {
          scheduleNextFlush();
        }
      }, delay);

      // Don't let the timer keep the process alive
      this.flushTimer.unref();
    };

    // Start the first flush
    scheduleNextFlush();
  }

  private setupExitHandlers(): void {
    const exitHandler = async (): Promise<void> => {
      if (!this.stopped) {
        try {
          await this.stop();
        } catch (error) {
          console.error('LogFlux: Error during exit flush:', error);
        }
      }
    };

    const syncExitHandler = () => {
      // Synchronous only - can't use async here
      if (!this.stopped && this.batch.length > 0) {
        console.warn(`BatchClient: ${this.batch.length} entries lost on exit (use stop() for graceful shutdown)`);
      }
    };

    // Store handlers for cleanup
    this.exitHandlers = { exitHandler, syncExitHandler };

    // Handle various exit scenarios
    process.on('exit', syncExitHandler);
    process.on('SIGINT', () => void exitHandler());
    process.on('SIGTERM', () => void exitHandler());
  }

  private removeExitHandlers(): void {
    if (this.exitHandlers) {
      process.off('exit', this.exitHandlers.syncExitHandler);
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      process.off('SIGINT', this.exitHandlers.exitHandler);
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      process.off('SIGTERM', this.exitHandlers.exitHandler);
      this.exitHandlers = undefined;
    }
  }

  private getEstimatedMemoryUsage(): number {
    // Calculate memory usage based on actual entry content
    let totalSize = 0;
    for (const entry of this.batch) {
      // Base overhead per entry
      totalSize += 200;
      // Add payload size
      totalSize += Buffer.byteLength(entry.payload, 'utf8');
      // Add metadata size if present
      if (entry.metadata) {
        for (const [key, value] of Object.entries(entry.metadata)) {
          totalSize += Buffer.byteLength(key + value, 'utf8');
        }
      }
    }
    return totalSize;
  }

  /**
   * Calculates the next retry delay using exponential backoff
   */
  private calculateNextRetryDelay(): void {
    const multiplier = this.config.retryBackoffMultiplier ?? 2;
    const maxDelay = this.config.maxRetryDelay ?? 60000;

    this.nextRetryDelay = Math.min(
      this.nextRetryDelay * multiplier,
      maxDelay
    );
  }

  /**
   * Gets the current retry delay for monitoring
   */
  public getCurrentRetryDelay(): number {
    return this.nextRetryDelay;
  }

  /**
   * Gets the number of consecutive failures for monitoring
   */
  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  private updateAverageBatchSize(batchSize: number): void {
    const totalEntries = this.stats.averageBatchSize * (this.stats.batchesSent - 1) + batchSize;
    this.stats.averageBatchSize = totalEntries / this.stats.batchesSent;
  }

  /**
   * Checks if the circuit breaker is open
   */
  private isCircuitOpen(): boolean {
    // If circuit is not open, it's closed
    if (!this.circuitOpen) {
      return false;
    }

    // Check if enough time has passed to try again
    const openTimeout = this.config.circuitBreakerOpenTimeout ?? 10000;
    if (this.circuitOpenTime && Date.now() - this.circuitOpenTime >= openTimeout) {
      // Reset circuit breaker to half-open state
      this.circuitOpen = false;
      this.circuitOpenTime = undefined;
      return false;
    }

    return true;
  }

  /**
   * Opens the circuit breaker after too many failures
   */
  private openCircuit(): void {
    const threshold = this.config.circuitBreakerFailureThreshold ?? 5;
    if (this.consecutiveFailures >= threshold) {
      this.circuitOpen = true;
      this.circuitOpenTime = Date.now();
    }
  }
}

/**
 * Creates a new batch client with the given client
 */
export function createBatchClient(client: LogFluxClient, config?: BatchConfig): BatchClient {
  return new BatchClient(client, config);
}