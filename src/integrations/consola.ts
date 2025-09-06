import { LogFluxClient } from '../client';
import { createLogEntry, LogLevel, EntryType } from '../types';

/**
 * LogFlux integration for Consola
 *
 * Consola is a Universal logging framework for Node.js and the browser.
 * It's especially popular in the Nuxt.js and Vue.js ecosystems.
 * This integration provides a LogFlux reporter for Consola.
 *
 * @example
 * ```typescript
 * import { consola } from 'consola';
 * import { createUnixClient } from '@logflux-io/logflux-js-sdk';
 * import { LogFluxReporter } from '@logflux-io/logflux-js-sdk/integrations/consola';
 *
 * const client = createUnixClient();
 * await client.connect();
 *
 * // Add LogFlux reporter to consola
 * consola.addReporter(new LogFluxReporter(client, 'my-app'));
 *
 * // Use consola normally - output will be sent to LogFlux
 * consola.info('Application starting...');
 * consola.error('Database connection failed');
 * ```
 */

// Consola types
interface ConsolaLogObject {
  level: number;
  type: string;
  tag?: string;
  args: unknown[];
  date: Date;
  [key: string]: unknown;
}

interface ConsolaReporter {
  log(logObj: ConsolaLogObject, ctx: unknown): void;
}

/**
 * Maps Consola levels to LogFlux levels
 * Consola uses numeric levels: 0=silent, 1=fatal, 2=error, 3=warn, 4=info, 5=debug, 6=trace
 */
const levelMapping: Record<number, LogLevel> = {
  0: LogLevel.Emergency, // Silent (shouldn't occur in practice)
  1: LogLevel.Critical,  // Fatal
  2: LogLevel.Error,     // Error
  3: LogLevel.Warning,   // Warn
  4: LogLevel.Info,      // Info
  5: LogLevel.Debug,     // Debug
  6: LogLevel.Debug      // Trace
};

/**
 * Maps Consola type strings to LogFlux levels (fallback mapping)
 */
const typeMapping: Record<string, LogLevel> = {
  'silent': LogLevel.Emergency,
  'fatal': LogLevel.Critical,
  'error': LogLevel.Error,
  'warn': LogLevel.Warning,
  'warning': LogLevel.Warning,
  'info': LogLevel.Info,
  'log': LogLevel.Info,
  'debug': LogLevel.Debug,
  'trace': LogLevel.Debug,
  'verbose': LogLevel.Debug,
  'start': LogLevel.Info,
  'success': LogLevel.Info,
  'fail': LogLevel.Error,
  'ready': LogLevel.Info,
  'box': LogLevel.Info
};

/**
 * LogFlux reporter options
 */
export interface LogFluxReporterOptions {
  /** LogFlux client instance */
  client: LogFluxClient;
  /** Source identifier for log entries */
  source: string;
  /** Whether to include consola metadata (default: true) */
  includeMetadata?: boolean;
  /** Additional metadata to attach to all log entries */
  metadata?: Record<string, string>;
  /** Custom level mapping function */
  levelMapper?: (consolaLevel: number, consolaType: string) => LogLevel;
  /** Custom message formatter */
  messageFormatter?: (args: unknown[]) => string;
  /** Minimum level to send to LogFlux (default: 0, send all) */
  minLevel?: number;
}

/**
 * LogFlux reporter for Consola
 */
export class LogFluxReporter implements ConsolaReporter {
  private client: LogFluxClient;
  private source: string;
  private includeMetadata: boolean;
  private metadata: Record<string, string>;
  private levelMapper: (consolaLevel: number, consolaType: string) => LogLevel;
  private messageFormatter: (args: unknown[]) => string;
  private minLevel: number;

  constructor(options: LogFluxReporterOptions) {
    this.client = options.client;
    this.source = options.source;
    this.includeMetadata = options.includeMetadata ?? true;
    this.metadata = options.metadata ?? {};
    this.levelMapper = options.levelMapper ?? this.defaultLevelMapper;
    this.messageFormatter = options.messageFormatter ?? this.defaultMessageFormatter;
    this.minLevel = options.minLevel ?? 0;
  }

  private defaultLevelMapper(consolaLevel: number, consolaType: string): LogLevel {
    // First try numeric level mapping
    if (consolaLevel in levelMapping) {
      return levelMapping[consolaLevel];
    }

    // Fallback to type string mapping
    if (consolaType in typeMapping) {
      return typeMapping[consolaType];
    }

    // Ultimate fallback
    return LogLevel.Info;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private defaultMessageFormatter(args: any[]): string {
    return args.map(arg => {
      if (typeof arg === 'string') {
        return arg;
      }
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack}`;
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return '[Circular Object]';
        }
      }
      return String(arg);
    }).join(' ');
  }

  /**
   * The reporter function that Consola calls
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public log(logObj: ConsolaLogObject, _ctx: any): void {
    try {
      // Check minimum level
      if (logObj.level < this.minLevel) {
        return;
      }

      // Format the message
      const message = this.messageFormatter(logObj.args);

      // Create LogFlux entry
      const entry = createLogEntry(message, this.source);
      entry.logLevel = this.levelMapper(logObj.level, logObj.type);
      entry.entryType = EntryType.Log;
      entry.timestamp = logObj.date.toISOString();

      // Add metadata
      if (this.includeMetadata) {
        entry.metadata = {
          ...this.metadata,
          consolaLevel: String(logObj.level),
          consolaType: logObj.type,
          ...(logObj.tag && { consolaTag: logObj.tag }),
          // Add any additional properties from the log object
          ...Object.keys(logObj)
            .filter(key => !['level', 'type', 'args', 'date', 'tag'].includes(key))
            .reduce((acc, key) => {
              const value = logObj[key];
              if (value !== undefined && value !== null) {
                acc[`consola_${key}`] = String(value);
              }
              return acc;
            }, {} as Record<string, string>)
        };
      } else {
        entry.metadata = this.metadata;
      }

      // Send to LogFlux (async, don't block logging)
      this.client.sendLogEntry(entry).catch(error => {
        console.error('LogFlux Consola integration error:', error);
      });
    } catch (error) {
      console.error('LogFlux Consola reporter error:', error);
    }
  }
}

/**
 * Creates and configures a LogFlux reporter for Consola
 */
export function createLogFluxReporter(
  client: LogFluxClient,
  source: string,
  options: Omit<LogFluxReporterOptions, 'client' | 'source'> = {}
): LogFluxReporter {
  return new LogFluxReporter({ client, source, ...options });
}

/**
 * Convenience function to add LogFlux reporter to an existing Consola instance
 */
export function addLogFluxReporter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  consolaInstance: any,
  client: LogFluxClient,
  source: string,
  options: Omit<LogFluxReporterOptions, 'client' | 'source'> = {}
): LogFluxReporter {
  const reporter = new LogFluxReporter({ client, source, ...options });
  consolaInstance.addReporter(reporter);
  return reporter;
}

/**
 * Creates a new Consola instance with LogFlux reporter pre-configured
 */
export function createLogFluxConsola(
  client: LogFluxClient,
  source: string,
  options: Omit<LogFluxReporterOptions, 'client' | 'source'> & {
    /** Additional Consola configuration */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    consolaConfig?: any;
    /** Whether to include default console reporter (default: true) */
    includeConsoleReporter?: boolean;
  } = {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consola: any;
  try {
    // eslint-disable-next-line no-undef
    consola = require('consola');
  } catch {
    throw new Error('Consola module not found. Please install consola: npm install consola');
  }

  const {
    consolaConfig = {},
    includeConsoleReporter = true,
    ...reporterOptions
  } = options;

  // Create new consola instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logger: any = consola.create(consolaConfig);

  // Clear reporters if not including console reporter
  if (!includeConsoleReporter) {
    logger.removeReporter();
  }

  // Add LogFlux reporter
  const reporter = new LogFluxReporter({ client, source, ...reporterOptions });
  logger.addReporter(reporter);

  return logger;
}

/**
 * Level constants for convenience (matching Consola levels)
 */
export const ConsolaLevels = {
  silent: 0,
  fatal: 1,
  error: 2,
  warn: 3,
  info: 4,
  debug: 5,
  trace: 6
} as const;