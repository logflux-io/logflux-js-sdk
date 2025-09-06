import { LogFluxClient } from '../client';
import { createLogEntry, LogLevel, EntryType } from '../types';

/**
 * LogFlux integration for Log4js
 *
 * Log4js is a popular Java-inspired logging library for Node.js that provides
 * flexible logging with categories, levels, and multiple appenders.
 * This integration provides a LogFlux appender for Log4js.
 *
 * @example
 * ```typescript
 * import log4js from 'log4js';
 * import { createUnixClient } from '@logflux-io/logflux-js-sdk';
 * import { LogFluxAppender } from '@logflux-io/logflux-js-sdk/integrations/log4js';
 *
 * const client = createUnixClient();
 * await client.connect();
 *
 * // Configure log4js with LogFlux appender
 * log4js.configure({
 *   appenders: {
 *     logflux: LogFluxAppender.configure(client, 'my-app'),
 *     console: { type: 'console' }
 *   },
 *   categories: {
 *     default: { appenders: ['logflux', 'console'], level: 'info' }
 *   }
 * });
 *
 * const logger = log4js.getLogger('database');
 * logger.info('Database connection established');
 * ```
 */

// Log4js types
interface LoggingEvent {
  categoryName: string;
  level: {
    level: number;
    levelStr: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  startTime: Date;
  pid: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: Record<string, any>;
  cluster?: {
    worker?: number;
    workerId?: string;
  };
  callStack?: string;
}

interface Log4jsAppender {
  (loggingEvent: LoggingEvent): void;
}

interface AppenderConfiguration {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Maps Log4js levels to LogFlux levels
 */
const levelMapping: Record<string, LogLevel> = {
  'ALL': LogLevel.Debug,
  'TRACE': LogLevel.Debug,
  'DEBUG': LogLevel.Debug,
  'INFO': LogLevel.Info,
  'WARN': LogLevel.Warning,
  'ERROR': LogLevel.Error,
  'FATAL': LogLevel.Critical,
  'MARK': LogLevel.Notice,
  'OFF': LogLevel.Debug
};

/**
 * LogFlux appender configuration options
 */
export interface LogFluxAppenderOptions {
  /** LogFlux client instance */
  client: LogFluxClient;
  /** Source identifier for log entries */
  source: string;
  /** Whether to include log4js metadata (default: true) */
  includeMetadata?: boolean;
  /** Additional metadata to attach to all log entries */
  metadata?: Record<string, string>;
  /** Custom level mapping function */
  levelMapper?: (log4jsLevel: string) => LogLevel;
  /** Custom message formatter */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messageFormatter?: (data: any[]) => string;
}

/**
 * LogFlux appender for Log4js
 */
export class LogFluxAppender {
  private client: LogFluxClient;
  private source: string;
  private includeMetadata: boolean;
  private metadata: Record<string, string>;
  private levelMapper: (log4jsLevel: string) => LogLevel;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private messageFormatter: (data: any[]) => string;

  constructor(options: LogFluxAppenderOptions) {
    this.client = options.client;
    this.source = options.source;
    this.includeMetadata = options.includeMetadata ?? true;
    this.metadata = options.metadata ?? {};
    this.levelMapper = options.levelMapper ?? this.defaultLevelMapper;
    this.messageFormatter = options.messageFormatter ?? this.defaultMessageFormatter;
  }

  private defaultLevelMapper(log4jsLevel: string): LogLevel {
    return levelMapping[log4jsLevel.toUpperCase()] ?? LogLevel.Info;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private defaultMessageFormatter(data: any[]): string {
    return data.map(item => {
      if (typeof item === 'string') {
        return item;
      }
      if (item instanceof Error) {
        return `${item.message}\n${item.stack}`;
      }
      if (typeof item === 'object') {
        return JSON.stringify(item, null, 2);
      }
      return String(item);
    }).join(' ');
  }

  /**
   * The appender function that Log4js calls
   */
  public appender = (loggingEvent: LoggingEvent): void => {
    try {
      // Format the message
      const message = this.messageFormatter(loggingEvent.data);

      // Create LogFlux entry
      const entry = createLogEntry(message, this.source);
      entry.logLevel = this.levelMapper(loggingEvent.level.levelStr);
      entry.entryType = EntryType.Log;
      entry.timestamp = loggingEvent.startTime.toISOString();

      // Add metadata
      if (this.includeMetadata) {
        entry.metadata = {
          ...this.metadata,
          log4jsCategory: loggingEvent.categoryName,
          log4jsLevel: loggingEvent.level.levelStr,
          pid: String(loggingEvent.pid),
          ...(loggingEvent.cluster?.worker && {
            workerId: String(loggingEvent.cluster.worker)
          }),
          ...(loggingEvent.context && Object.keys(loggingEvent.context).length > 0 && {
            context: JSON.stringify(loggingEvent.context)
          })
        };
      } else {
        entry.metadata = this.metadata;
      }

      // Send to LogFlux (async, don't block logging)
      this.client.sendLogEntry(entry).catch(error => {
        console.error('LogFlux Log4js integration error:', error);
      });
    } catch (error) {
      console.error('LogFlux Log4js appender error:', error);
    }
  };

  /**
   * Creates a Log4js appender configuration
   */
  static configure(
    client: LogFluxClient,
    source: string,
    options: Omit<LogFluxAppenderOptions, 'client' | 'source'> = {}
  ): AppenderConfiguration {
    const appender = new LogFluxAppender({ client, source, ...options });

    return {
      type: 'logflux',
      appender: appender.appender
    };
  }

  /**
   * Creates the appender function directly (for manual configuration)
   */
  static createAppender(options: LogFluxAppenderOptions): Log4jsAppender {
    const appender = new LogFluxAppender(options);
    return appender.appender;
  }
}

/**
 * Register LogFlux appender with Log4js
 * Call this before configuring log4js to make 'logflux' appender type available
 */
export function registerLogFluxAppender(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let log4js: any;
  try {
    // eslint-disable-next-line no-undef
    log4js = require('log4js');
  } catch {
    throw new Error('Log4js module not found. Please install log4js: npm install log4js');
  }

  // Register the LogFlux appender type
  log4js.addLayout('logflux', () => {
    return (loggingEvent: LoggingEvent) => {
      // This layout is not actually used since we handle formatting ourselves
      return JSON.stringify(loggingEvent);
    };
  });
}

/**
 * Convenience function to create a complete Log4js configuration with LogFlux
 */
export function createLog4jsConfig(
  client: LogFluxClient,
  source: string,
  options: {
    /** Additional appenders to include (default: console) */
    additionalAppenders?: Record<string, AppenderConfiguration>;
    /** Log level for the default category (default: 'info') */
    level?: string;
    /** LogFlux appender options */
    logfluxOptions?: Omit<LogFluxAppenderOptions, 'client' | 'source'>;
    /** Additional categories */
    categories?: Record<string, { appenders: string[]; level: string }>;
  } = {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const {
    additionalAppenders = { console: { type: 'console' } },
    level = 'info',
    logfluxOptions = {},
    categories = {}
  } = options;

  return {
    appenders: {
      logflux: LogFluxAppender.configure(client, source, logfluxOptions),
      ...additionalAppenders
    },
    categories: {
      default: {
        appenders: ['logflux', ...Object.keys(additionalAppenders)],
        level
      },
      ...categories
    }
  };
}