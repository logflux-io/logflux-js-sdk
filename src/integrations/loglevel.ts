import { LogFluxClient } from '../client';
import { createLogEntry, LogLevel, EntryType } from '../types';

/**
 * LogFlux integration for Loglevel
 *
 * Loglevel is a minimal, lightweight logging library for JavaScript that works
 * in browsers and Node.js. It's designed to be simple and fast with minimal overhead.
 * This integration provides a LogFlux plugin for Loglevel.
 *
 * @example
 * ```typescript
 * import log from 'loglevel';
 * import { createUnixClient } from '@logflux-io/logflux-js-sdk';
 * import { attachLoglevelToLogFlux } from '@logflux-io/logflux-js-sdk/integrations/loglevel';
 *
 * const client = createUnixClient();
 * await client.connect();
 *
 * // Attach loglevel to LogFlux (intercepts all loglevel output)
 * attachLoglevelToLogFlux(log, client, 'my-app');
 *
 * // Use loglevel normally - output will be sent to LogFlux
 * log.info('Application starting...');
 * log.error('Database connection failed');
 * ```
 */

// Loglevel types
interface LoglevelLogger {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trace(...args: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(...args: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info(...args: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(...args: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(...args: any[]): void;
  setLevel(level: string | number): void;
  getLevel(): number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  methodFactory: (methodName: string, level: number, loggerName?: string) => (...args: any[]) => void;
}

/**
 * Maps Loglevel numeric levels to LogFlux levels
 * Loglevel uses: 0=TRACE, 1=DEBUG, 2=INFO, 3=WARN, 4=ERROR, 5=SILENT
 */
const _levelMapping: Record<number, LogLevel> = {
  0: LogLevel.Debug,    // TRACE
  1: LogLevel.Debug,    // DEBUG
  2: LogLevel.Info,     // INFO
  3: LogLevel.Warning,  // WARN
  4: LogLevel.Error,    // ERROR
  5: LogLevel.Emergency // SILENT (shouldn't occur in practice)
};

/**
 * Maps Loglevel method names to LogFlux levels
 */
const methodLevelMapping: Record<string, LogLevel> = {
  'trace': LogLevel.Debug,
  'debug': LogLevel.Debug,
  'info': LogLevel.Info,
  'warn': LogLevel.Warning,
  'error': LogLevel.Error
};

/**
 * Attaches Loglevel logger to LogFlux client
 * Intercepts all loglevel output and sends it to LogFlux
 */
export function attachLoglevelToLogFlux(
  logger: LoglevelLogger,
  client: LogFluxClient,
  source: string,
  options: {
    /** Whether to also log to console (default: true) */
    keepConsoleOutput?: boolean;
    /** Additional metadata to attach to all log entries */
    metadata?: Record<string, string>;
    /** Logger name for metadata (default: 'loglevel') */
    loggerName?: string;
  } = {}
): void {
  const {
    keepConsoleOutput = true,
    metadata = {},
    loggerName: _loggerName = 'loglevel'
  } = options;

  // Store original methodFactory
  const originalMethodFactory = logger.methodFactory;

  // Override methodFactory to intercept all log methods
  logger.methodFactory = (methodName: string, level: number, loggerName?: string) => {
    // Get the original method
    const originalMethod = originalMethodFactory(methodName, level, loggerName);

    // Return wrapped method that sends to LogFlux
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (...args: any[]) => {
      const message = args.map(arg => {
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

      // Send to LogFlux
      const entry = createLogEntry(message, source);
      entry.logLevel = methodLevelMapping[methodName] || LogLevel.Info;
      entry.entryType = EntryType.Log;
      entry.metadata = {
        ...metadata,
        loglevelMethod: methodName,
        loglevelLevel: String(level),
        loggerName: loggerName ?? 'loglevel'
      };

      // Send to LogFlux (async, don't block logging)
      client.sendLogEntry(entry).catch(error => {
        console.error('LogFlux Loglevel integration error:', error);
      });

      // Call original method if keeping console output
      if (keepConsoleOutput) {
        originalMethod(...args);
      }
    };
  };

  // Re-apply the current log level to activate the new methodFactory
  const currentLevel = logger.getLevel();
  logger.setLevel(currentLevel);
}

/**
 * Creates a Loglevel logger that sends output to LogFlux
 * More targeted approach - creates a new logger instance
 */
export function createLogFluxLoglevel(
  client: LogFluxClient,
  source: string,
  options: {
    /** Initial log level (default: 'info') */
    level?: string | number;
    /** Whether to also log to console (default: true) */
    keepConsoleOutput?: boolean;
    /** Additional metadata to attach to all log entries */
    metadata?: Record<string, string>;
    /** Logger name for metadata */
    loggerName?: string;
  } = {}
): LoglevelLogger {
  const {
    level = 'info',
    keepConsoleOutput = true,
    metadata = {},
    loggerName = 'logflux-logger'
  } = options;

  // Get loglevel module
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let loglevel: any;
  try {
    // eslint-disable-next-line no-undef
    loglevel = require('loglevel');
  } catch {
    throw new Error('Loglevel module not found. Please install loglevel: npm install loglevel');
  }

  // Create a new logger instance
  const logger = loglevel.getLogger(loggerName);

  // Attach LogFlux to this specific logger
  attachLoglevelToLogFlux(logger, client, source, {
    keepConsoleOutput,
    metadata,
    loggerName
  });

  // Set initial level
  logger.setLevel(level);

  return logger;
}

/**
 * Detaches Loglevel from LogFlux (restores original behavior)
 */
export function detachLoglevelFromLogFlux(logger: LoglevelLogger): void {
  // Get loglevel module to access original methodFactory
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let loglevel: any;
  try {
    // eslint-disable-next-line no-undef
    loglevel = require('loglevel');
  } catch {
    return; // Loglevel not available, nothing to detach
  }

  // Reset to original methodFactory
  const originalLogger = loglevel.getLogger('temp');
  logger.methodFactory = originalLogger.methodFactory;

  // Re-apply current level to restore original methods
  const currentLevel = logger.getLevel();
  logger.setLevel(currentLevel);
}

/**
 * Convenience function to setup Loglevel with LogFlux for common use cases
 */
export function setupLoglevelWithLogFlux(
  client: LogFluxClient,
  source: string,
  options: {
    /** Whether to attach to default logger (default: true) */
    useDefaultLogger?: boolean;
    /** Initial log level (default: 'info') */
    level?: string | number;
    /** Whether to also log to console (default: true) */
    keepConsoleOutput?: boolean;
    /** Additional metadata to attach to all log entries */
    metadata?: Record<string, string>;
    /** Custom logger name if not using default */
    loggerName?: string;
  } = {}
): LoglevelLogger {
  const {
    useDefaultLogger = true,
    level = 'info',
    keepConsoleOutput = true,
    metadata = {},
    loggerName = 'app'
  } = options;

  let logger: LoglevelLogger;

  if (useDefaultLogger) {
    // Use the default loglevel logger
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let loglevel: any;
    try {
      // eslint-disable-next-line no-undef
      loglevel = require('loglevel');
    } catch {
      throw new Error('Loglevel module not found. Please install loglevel: npm install loglevel');
    }

    logger = loglevel;
    attachLoglevelToLogFlux(logger, client, source, {
      keepConsoleOutput,
      metadata,
      loggerName: 'default'
    });
  } else {
    // Create a new logger instance
    logger = createLogFluxLoglevel(client, source, {
      level,
      keepConsoleOutput,
      metadata,
      loggerName
    });
  }

  // Set the level
  logger.setLevel(level);

  return logger;
}

/**
 * Level constants for convenience (matching Loglevel levels)
 */
export const LoglevelLevels = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 5
} as const;