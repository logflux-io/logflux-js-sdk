/**
 * LogEntry represents a log entry to be sent to the agent
 * Matches the API specification for logflux-agent-api-v1.yaml
 */
export interface LogEntry {
  /** Optional: Protocol version for compatibility */
  version?: string;
  /** Required: Log payload content */
  payload: string;
  /** Required: Source identifier */
  source: string;
  /** Optional: RFC3339 timestamp in UTC */
  timestamp?: string;
  /** Optional: Content type identifier */
  payloadType?: string;
  /** Optional: Additional key-value metadata */
  metadata?: Record<string, string>;
  /** Required: 1=log, 2=metric, 3=trace, 4=event, 5=audit */
  entryType: number;
  /** Required: 1-8 (Emergency to Debug) */
  logLevel: number;
}

/**
 * LogBatch represents a batch of log entries
 * Matches the API specification for logflux-agent-api-v1.yaml
 */
export interface LogBatch {
  /** Optional: Protocol version for compatibility */
  version?: string;
  /** Required: Array of log entries (1-100 items) */
  entries: LogEntry[];
}

/** LogLevel constants for convenience */
export enum LogLevel {
  Emergency = 1, // System is unusable
  Alert = 2,     // Action must be taken immediately
  Critical = 3,  // Critical conditions
  Error = 4,     // Error conditions
  Warning = 5,   // Warning conditions
  Notice = 6,    // Normal but significant condition
  Info = 7,      // Informational messages
  Debug = 8,     // Debug-level messages
}

/** EntryType constants for convenience */
export enum EntryType {
  Log = 1,    // Standard log entry (default for all entries)
  Metric = 2, // Metric entry (future use)
  Trace = 3,  // Trace entry (future use)
  Event = 4,  // Event entry (future use)
  Audit = 5,  // Audit entry (future use)
}

/** PayloadType identifies the structure and format of the log payload */
export enum PayloadType {
  Generic = 'generic',           // Generic text logs
  GenericJSON = 'generic_json',  // Generic JSON data
}

/** PingRequest represents a ping health check request */
export interface PingRequest {
  /** Optional: Protocol version for compatibility */
  version?: string;
  /** Must be "ping" */
  action: string;
}

/** PongResponse represents a pong health check response */
export interface PongResponse {
  /** Must be "pong" */
  status: string;
}

/** AuthRequest represents an authentication request for TCP connections */
export interface AuthRequest {
  /** Optional: Protocol version for compatibility */
  version?: string;
  /** Must be "authenticate" */
  action: string;
  /** Shared secret for authentication */
  shared_secret: string;
}

/** AuthResponse represents an authentication response */
export interface AuthResponse {
  /** "success" or "error" */
  status: string;
  /** Success or error message */
  message: string;
}

/** Default protocol version used by the SDK */
export const DEFAULT_PROTOCOL_VERSION = '1.0';

/**
 * Creates a new log entry with default values and auto-detection
 * Automatically detects JSON payload type. All entries default to TypeLog.
 */
export function createLogEntry(payload: string, source: string): LogEntry {
  if (!source) {
    source = 'unknown';
  }

  // Auto-detect payload type (JSON vs generic text)
  const payloadType = autoDetectPayloadType(payload);

  return {
    version: DEFAULT_PROTOCOL_VERSION,
    payload,
    source,
    entryType: EntryType.Log,
    logLevel: LogLevel.Info,
    timestamp: new Date().toISOString(),
    payloadType,
    metadata: {},
  };
}

/**
 * Creates a new ping request
 */
export function createPingRequest(): PingRequest {
  return {
    version: DEFAULT_PROTOCOL_VERSION,
    action: 'ping',
  };
}

/**
 * Creates a new authentication request
 */
export function createAuthRequest(sharedSecret: string): AuthRequest {
  if (!sharedSecret) {
    throw new Error('sharedSecret cannot be empty for authentication');
  }

  return {
    version: DEFAULT_PROTOCOL_VERSION,
    action: 'authenticate',
    shared_secret: sharedSecret,
  };
}

/**
 * Checks if a string contains valid JSON.
 * Returns true if the string can be parsed as JSON, false otherwise.
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempts to automatically detect the payload type based on content.
 * If the message is valid JSON, returns PayloadTypeGenericJSON, otherwise PayloadTypeGeneric.
 */
export function autoDetectPayloadType(message: string): string {
  return isValidJSON(message) ? PayloadType.GenericJSON : PayloadType.Generic;
}

/**
 * Helper class for building LogEntry instances with fluent API
 */
export class LogEntryBuilder {
  private entry: LogEntry;

  constructor(payload: string, source: string) {
    this.entry = createLogEntry(payload, source);
  }

  withLogLevel(logLevel: LogLevel): LogEntryBuilder {
    if (logLevel < LogLevel.Emergency || logLevel > LogLevel.Debug) {
      logLevel = LogLevel.Info; // Default to Info if invalid
    }
    this.entry.logLevel = logLevel;
    return this;
  }

  withEntryType(_entryType: EntryType): LogEntryBuilder {
    // In minimal SDK, only TypeLog is supported
    this.entry.entryType = EntryType.Log;
    return this;
  }

  withSource(source: string): LogEntryBuilder {
    if (!source) {
      source = 'unknown';
    }
    this.entry.source = source;
    return this;
  }

  withMetadata(key: string, value: string): LogEntryBuilder {
    if (!key) {
      return this; // Skip empty keys
    }
    this.entry.metadata ??= {};
    this.entry.metadata[key] = value;
    return this;
  }

  withAllMetadata(metadata: Record<string, string>): LogEntryBuilder {
    this.entry.metadata ??= {};
    Object.assign(this.entry.metadata, metadata);
    return this;
  }

  withTimestamp(timestamp: Date): LogEntryBuilder {
    this.entry.timestamp = timestamp.toISOString();
    return this;
  }

  withTimestampString(timestamp: string): LogEntryBuilder {
    this.entry.timestamp = timestamp;
    return this;
  }

  withPayloadType(payloadType: PayloadType): LogEntryBuilder {
    this.entry.payloadType = payloadType;
    return this;
  }

  withVersion(version: string): LogEntryBuilder {
    this.entry.version = version;
    return this;
  }

  build(): LogEntry {
    return { ...this.entry };
  }
}