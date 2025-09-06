import * as pino from 'pino';
import { LogLevel, createLogEntry } from '../types';
import { BatchClient } from '../client/batch';

/**
 * Maps Pino log levels to LogFlux log levels
 */
const PINO_TO_LOGFLUX_LEVEL: Record<number, LogLevel> = {
  10: LogLevel.Debug,    // trace
  20: LogLevel.Debug,    // debug
  30: LogLevel.Info,     // info
  40: LogLevel.Warning,  // warn
  50: LogLevel.Error,    // error
  60: LogLevel.Critical, // fatal
};

/**
 * Configuration for Pino LogFlux destination
 */
export interface PinoLogFluxDestinationOptions {
  /** BatchClient instance to use for sending logs */
  client: BatchClient;
  /** Source identifier for logs */
  source?: string;
  /** Additional metadata to include with all logs */
  metadata?: Record<string, string>;
}

/**
 * Pino destination for LogFlux
 *
 * @example
 * ```typescript
 * import pino from 'pino';
 * import { createLogFluxDestination } from '@logflux-io/logflux-js-sdk/integrations/pino';
 * import { createBatchClient, createUnixClient } from '@logflux-io/logflux-js-sdk';
 *
 * const client = createUnixClient();
 * const batchClient = createBatchClient(client);
 *
 * const logger = pino({
 *   level: 'info'
 * }, createLogFluxDestination({
 *   client: batchClient,
 *   source: 'my-app'
 * }));
 *
 * logger.info({ userId: '123' }, 'Hello LogFlux!');
 * ```
 */
export class LogFluxDestination {
  private client: BatchClient;
  private source: string;
  private globalMetadata: Record<string, string>;

  constructor(options: PinoLogFluxDestinationOptions) {
    if (!options.client) {
      throw new Error('client is required for LogFluxDestination');
    }

    this.client = options.client;
    this.source = options.source ?? 'pino';
    this.globalMetadata = options.metadata ?? {};
  }

  /**
   * Writes a log record to LogFlux (required by Pino)
   */
  write(chunk: string): void {
    try {
      const record = JSON.parse(chunk);
      this.processRecord(record);
    } catch (error) {
      console.error('Failed to parse Pino log record:', error);
    }
  }

  private processRecord(record: { level: number; msg: string; time: number; name: string; hostname: string; pid: number; [key: string]: unknown }): void {
    // Extract Pino log record fields
    const { level, msg, time, name, hostname, pid, ...fields } = record;

    // Convert Pino level to LogFlux level
    const logLevel = PINO_TO_LOGFLUX_LEVEL[level] ?? LogLevel.Info;

    // Create payload from message and fields
    let payload: string;
    if (Object.keys(fields).length > 0) {
      payload = JSON.stringify({
        message: msg ?? '',
        ...fields,
      });
    } else {
      payload = String(msg ?? '');
    }

    // Create log entry
    const entry = createLogEntry(payload, this.source);
    entry.logLevel = logLevel;

    // Set timestamp from Pino record
    if (time) {
      entry.timestamp = new Date(time).toISOString();
    }

    // Merge metadata
    entry.metadata = {
      ...this.globalMetadata,
      ...entry.metadata,
      pino_level: String(level),
      pino_name: name,
      pino_hostname: hostname,
      pino_pid: String(pid),
    };

    // Send to LogFlux
    this.client.addLogEntry(entry).catch((error) => {
      console.error('LogFlux destination error:', error);
    });
  }

  /**
   * Closes the destination and flushes remaining logs
   */
  async close(): Promise<void> {
    await this.client.flush();
  }
}

/**
 * Creates a Pino destination for LogFlux
 */
export function createLogFluxDestination(options: PinoLogFluxDestinationOptions): LogFluxDestination {
  return new LogFluxDestination(options);
}

/**
 * Creates a Pino transport configuration for LogFlux
 */
export function createLogFluxTransport(options: PinoLogFluxDestinationOptions): pino.TransportSingleOptions {
  return {
    target: 'pino/file',
    options: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      destination: new LogFluxDestination(options) as any,
    },
  };
}