import { LogLevel, createLogEntry } from '../types';
import { BatchClient } from '../client/batch';

/**
 * Configuration for Winston LogFlux transport
 */
export interface WinstonLogFluxOptions {
  /** BatchClient instance to use for sending logs */
  client: BatchClient;
  /** Source identifier for logs */
  source?: string;
  /** Additional metadata to include with all logs */
  metadata?: Record<string, string>;
  /** Log level threshold */
  level?: string;
}

/**
 * Maps Winston log levels to LogFlux log levels
 */
const WINSTON_TO_LOGFLUX_LEVEL: Record<string, LogLevel> = {
  error: LogLevel.Error,
  warn: LogLevel.Warning,
  info: LogLevel.Info,
  http: LogLevel.Info,
  verbose: LogLevel.Debug,
  debug: LogLevel.Debug,
  silly: LogLevel.Debug,
  emerg: LogLevel.Emergency,
  alert: LogLevel.Alert,
  crit: LogLevel.Critical,
  warning: LogLevel.Warning,
  notice: LogLevel.Notice,
};

/**
 * Winston transport for LogFlux
 *
 * @example
 * ```typescript
 * import winston from 'winston';
 * import { LogFluxTransport } from '@logflux-io/logflux-js-sdk/integrations/winston';
 * import { createBatchClient, createUnixClient } from '@logflux-io/logflux-js-sdk';
 *
 * const client = createUnixClient();
 * const batchClient = createBatchClient(client);
 *
 * const logger = winston.createLogger({
 *   transports: [
 *     new LogFluxTransport({
 *       client: batchClient,
 *       source: 'my-app',
 *       level: 'info'
 *     })
 *   ]
 * });
 *
 * logger.info('Hello LogFlux!', { userId: '123' });
 * ```
 */
export class LogFluxTransport {
  private client: BatchClient;
  private source: string;
  private globalMetadata: Record<string, string>;
  private level: string;

  constructor(options: WinstonLogFluxOptions) {
    this.level = options.level ?? 'info';

    if (!options.client) {
      throw new Error('client is required for LogFluxTransport');
    }

    this.client = options.client;
    this.source = options.source ?? 'winston';
    this.globalMetadata = options.metadata ?? {};
  }

  log(info: { level: string; message: string; timestamp?: string | Date; [key: string]: unknown }, callback: () => void): void {
    // Async processing without emit

    // Extract Winston log info
    const { level, message, timestamp, ...meta } = info;

    // Convert Winston level to LogFlux level
    const logLevel = WINSTON_TO_LOGFLUX_LEVEL[level] || LogLevel.Info;

    // Create payload from message and metadata
    let payload: string;
    if (typeof message === 'object') {
      payload = JSON.stringify(message);
    } else {
      payload = String(message);

      // If there's additional metadata, include it
      if (Object.keys(meta).length > 0) {
        payload = JSON.stringify({
          message: payload,
          ...meta,
        });
      }
    }

    // Create log entry
    const entry = createLogEntry(payload, this.source);
    entry.logLevel = logLevel;

    // Set timestamp if provided
    if (timestamp) {
      if (timestamp instanceof Date) {
        entry.timestamp = timestamp.toISOString();
      } else {
        entry.timestamp = String(timestamp);
      }
    }

    // Merge metadata
    entry.metadata = {
      ...this.globalMetadata,
      ...entry.metadata,
      winston_level: level,
    };

    // Send to LogFlux
    this.client.addLogEntry(entry).catch((error) => {
      console.error('LogFlux transport error:', error);
    });

    callback();
  }

  /**
   * Closes the transport and flushes remaining logs
   */
  async close(): Promise<void> {
    await this.client.flush();
  }
}