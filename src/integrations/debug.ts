import { LogFluxClient } from '../client';
import { createLogEntry, LogLevel, EntryType } from '../types';

/**
 * LogFlux integration for the Debug library
 *
 * Debug is a tiny JavaScript debugging utility that can be used in both browser and Node.js environments.
 * This integration allows Debug output to be sent to LogFlux for centralized debugging log collection.
 *
 * @example
 * ```typescript
 * import debug from 'debug';
 * import { createUnixClient } from '@logflux-io/logflux-js-sdk';
 * import { attachDebugToLogFlux } from '@logflux-io/logflux-js-sdk/integrations/debug';
 *
 * const client = createUnixClient();
 * await client.connect();
 *
 * // Attach debug to LogFlux (intercepts all debug output)
 * attachDebugToLogFlux(client, 'my-app');
 *
 * // Use debug normally - output will be sent to LogFlux
 * const log = debug('app:database');
 * log('Connecting to database...');
 * ```
 */

interface DebugInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (...args: any[]): void;
  namespace: string;
  enabled: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log?: (...args: any[]) => void;
}

interface DebugFactory {
  (namespace: string): DebugInstance;
  enabled: (namespaces: string) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log?: (...args: any[]) => void;
}

/**
 * Attaches Debug library to LogFlux client
 * Intercepts all debug output and sends it to LogFlux
 */
export function attachDebugToLogFlux(
  client: LogFluxClient,
  source: string,
  options: {
    /** Log level for debug messages (default: Debug) */
    logLevel?: LogLevel;
    /** Whether to also log to console (default: true) */
    keepConsoleOutput?: boolean;
    /** Additional metadata to attach to all debug entries */
    metadata?: Record<string, string>;
  } = {}
): void {
  const {
    logLevel = LogLevel.Debug,
    keepConsoleOutput = true,
    metadata = {}
  } = options;

  // Try to get debug module
  let debug: DebugFactory;
  try {
    // eslint-disable-next-line no-undef
    debug = require('debug');
  } catch {
    throw new Error('Debug module not found. Please install debug: npm install debug');
  }

  // Store original log function
  const originalLog = debug.log;

  // Override debug.log to intercept all debug output
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug.log = (...args: any[]) => {
    // Format the debug message
    const message = args.join(' ');

    // Extract namespace from the message (debug prefixes with namespace)
    const match = message.match(/^(\S+)\s+(.*)/);
    const namespace = match ? match[1] : 'debug';
    const content = match ? match[2] : message;

    // Send to LogFlux
    const entry = createLogEntry(content, source);
    entry.logLevel = logLevel;
    entry.entryType = EntryType.Log;
    entry.metadata = {
      ...metadata,
      debugNamespace: namespace,
      debugLevel: 'debug'
    };

    // Send to LogFlux (async, don't block debug output)
    client.sendLogEntry(entry).catch(error => {
      // Fallback to console if LogFlux fails
      console.error('LogFlux Debug integration error:', error);
    });

    // Call original log function if keeping console output
    if (keepConsoleOutput && originalLog) {
      originalLog.apply(debug, args);
    }
  };
}

/**
 * Creates a Debug instance that sends output to LogFlux
 * More targeted approach - only specific debug instances send to LogFlux
 */
export function createLogFluxDebug(
  client: LogFluxClient,
  namespace: string,
  source: string,
  options: {
    /** Log level for debug messages (default: Debug) */
    logLevel?: LogLevel;
    /** Whether to also log to console (default: true) */
    keepConsoleOutput?: boolean;
    /** Additional metadata to attach to all debug entries */
    metadata?: Record<string, string>;
  } = {}
): DebugInstance {
  const {
    logLevel = LogLevel.Debug,
    keepConsoleOutput = true,
    metadata = {}
  } = options;

  // Get debug module
  let debug: DebugFactory;
  try {
    // eslint-disable-next-line no-undef
    debug = require('debug');
  } catch {
    throw new Error('Debug module not found. Please install debug: npm install debug');
  }

  // Create debug instance
  const debugInstance = debug(namespace);

  // Store original log function for this instance
  const originalLog = debugInstance.log;

  // Create LogFlux-enabled debug function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logFluxDebug = function(...args: any[]) {
    const message = args.join(' ');

    // Send to LogFlux
    const entry = createLogEntry(message, source);
    entry.logLevel = logLevel;
    entry.entryType = EntryType.Log;
    entry.metadata = {
      ...metadata,
      debugNamespace: namespace,
      debugLevel: 'debug'
    };

    // Send to LogFlux (async, don't block debug output)
    client.sendLogEntry(entry).catch(error => {
      console.error('LogFlux Debug integration error:', error);
    });

    // Call original debug function if keeping console output
    if (keepConsoleOutput && debugInstance.enabled) {
      if (originalLog) {
        originalLog.apply(debugInstance, args);
      } else {
        // Fallback to console
        console.log(`${namespace} ${message}`);
      }
    }
  } as DebugInstance;

  // Copy properties from original debug instance
  logFluxDebug.namespace = debugInstance.namespace;
  logFluxDebug.enabled = debugInstance.enabled;

  return logFluxDebug;
}

/**
 * Detaches Debug from LogFlux (restores original behavior)
 */
export function detachDebugFromLogFlux(): void {
  let debug: DebugFactory;
  try {
    // eslint-disable-next-line no-undef
    debug = require('debug');
  } catch {
    return; // Debug not available, nothing to detach
  }

  // Reset to original log function (if it was overridden)
  delete debug.log;
}