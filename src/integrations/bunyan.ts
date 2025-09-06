import * as bunyan from 'bunyan';
import { LogLevel, createLogEntry } from '../types';
import { BatchClient } from '../client/batch';

/**
 * Maps Bunyan log levels to LogFlux log levels
 */
const BUNYAN_TO_LOGFLUX_LEVEL: Record<number, LogLevel> = {
  [bunyan.TRACE]: LogLevel.Debug,
  [bunyan.DEBUG]: LogLevel.Debug,
  [bunyan.INFO]: LogLevel.Info,
  [bunyan.WARN]: LogLevel.Warning,
  [bunyan.ERROR]: LogLevel.Error,
  [bunyan.FATAL]: LogLevel.Critical,
};

/**
 * Configuration for Bunyan LogFlux stream
 */
export interface BunyanLogFluxStreamOptions {
  /** BatchClient instance to use for sending logs */
  client: BatchClient;
  /** Source identifier for logs */
  source?: string;
  /** Additional metadata to include with all logs */
  metadata?: Record<string, string>;
}

/**
 * Bunyan stream for LogFlux
 *
 * @example
 * ```typescript
 * import bunyan from 'bunyan';
 * import { LogFluxStream } from '@logflux-io/logflux-js-sdk/integrations/bunyan';
 * import { createBatchClient, createUnixClient } from '@logflux-io/logflux-js-sdk';
 *
 * const client = createUnixClient();
 * const batchClient = createBatchClient(client);
 *
 * const logger = bunyan.createLogger({
 *   name: 'my-app',
 *   streams: [{
 *     type: 'raw',
 *     stream: new LogFluxStream({
 *       client: batchClient,
 *       source: 'my-app'
 *     })
 *   }]
 * });
 *
 * logger.info({ userId: '123' }, 'Hello LogFlux!');
 * ```
 */
export class LogFluxStream {
  private client: BatchClient;
  private source: string;
  private globalMetadata: Record<string, string>;

  constructor(options: BunyanLogFluxStreamOptions) {
    if (!options.client) {
      throw new Error('client is required for LogFluxStream');
    }

    this.client = options.client;
    this.source = options.source ?? 'bunyan';
    this.globalMetadata = options.metadata ?? {};
  }

  /**
   * Writes a log record to LogFlux (required by Bunyan)
   */
  write(record: unknown): void {
    if (!this.isValidRecord(record)) {
      return;
    }

    const bunyanRecord = record as Record<string, unknown>;
    const entry = this.createLogEntry(bunyanRecord);

    this.sendToLogFlux(entry);
  }

  private isValidRecord(record: unknown): boolean {
    return Boolean(record && typeof record === 'object');
  }

  private createLogEntry(record: Record<string, unknown>): ReturnType<typeof createLogEntry> {
    const { level, msg, time, name, hostname, pid, v: _v, ...fields } = record;

    const logLevel = BUNYAN_TO_LOGFLUX_LEVEL[level as number] ?? LogLevel.Info;
    const payload = this.createPayload(msg, fields);

    const entry = createLogEntry(payload, this.source);
    entry.logLevel = logLevel;

    this.setTimestamp(entry, time);
    this.setMetadata(entry, { level, name, hostname, pid });

    return entry;
  }

  private createPayload(msg: unknown, fields: Record<string, unknown>): string {
    if (Object.keys(fields).length > 0) {
      return JSON.stringify({
        message: String(msg ?? ''),
        ...fields,
      });
    }
    return String(msg ?? '');
  }

  private setTimestamp(entry: ReturnType<typeof createLogEntry>, time: unknown): void {
    if (time && typeof time === 'number') {
      entry.timestamp = new Date(time).toISOString();
    }
  }

  private setMetadata(entry: ReturnType<typeof createLogEntry>, bunyanFields: Record<string, unknown>): void {
    const { level, name, hostname, pid } = bunyanFields;

    entry.metadata = {
      ...this.globalMetadata,
      ...entry.metadata,
      bunyan_level: bunyan.nameFromLevel[level as number] ?? String(level ?? ''),
      bunyan_name: String(name ?? ''),
      bunyan_hostname: String(hostname ?? ''),
      bunyan_pid: String(pid ?? ''),
    };
  }

  private sendToLogFlux(entry: ReturnType<typeof createLogEntry>): void {
    this.client.addLogEntry(entry).catch((error) => {
      console.error('LogFlux stream error:', error);
    });
  }

  /**
   * Closes the stream and flushes remaining logs
   */
  async close(): Promise<void> {
    await this.client.flush();
  }
}

/**
 * Creates a Bunyan stream configuration for LogFlux
 */
export function createLogFluxStream(options: BunyanLogFluxStreamOptions): bunyan.Stream {
  return {
    type: 'raw',
    stream: new LogFluxStream(options),
  };
}