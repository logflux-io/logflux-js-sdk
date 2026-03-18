/**
 * Syslog severity levels (1-8).
 */
export const LogLevel = {
  Emergency: 1,
  Alert: 2,
  Critical: 3,
  Error: 4,
  Warning: 5,
  Notice: 6,
  Info: 7,
  Debug: 8,
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

/**
 * Entry type constants matching the server protocol.
 */
export const EntryType = {
  Log: 1,
  Metric: 2,
  Trace: 3,
  Event: 4,
  Audit: 5,
  Telemetry: 6,
  TelemetryManaged: 7,
} as const;

export type EntryType = (typeof EntryType)[keyof typeof EntryType];

/**
 * Payload type constants for encryption/compression.
 */
export const PayloadType = {
  AES256GCMGzipJSON: 1,
  GzipJSON: 3,
} as const;

export type PayloadType = (typeof PayloadType)[keyof typeof PayloadType];

/**
 * Drop reason constants for statistics tracking.
 */
export const DropReason = {
  QueueOverflow: 'queue_overflow',
  NetworkError: 'network_error',
  SendError: 'send_error',
  RateLimited: 'ratelimit_backoff',
  QuotaExceeded: 'quota_exceeded',
  BeforeSend: 'before_send',
  ValidationError: 'validation_error',
} as const;

export type DropReason = (typeof DropReason)[keyof typeof DropReason];

/**
 * Runtime statistics for the SDK client.
 */
export interface ClientStats {
  entriesSent: number;
  entriesDropped: number;
  entriesQueued: number;
  queueSize: number;
  queueCapacity: number;
  dropReasons: Record<string, number>;
  lastSendError: string;
  lastSendTime: Date | null;
  handshakeOK: boolean;
}

/**
 * Returns the pricing category for an entry type.
 */
export function entryTypeCategory(entryType: number): string {
  switch (entryType) {
    case EntryType.Log:
    case EntryType.Metric:
    case EntryType.Event:
      return 'events';
    case EntryType.Trace:
    case EntryType.Telemetry:
    case EntryType.TelemetryManaged:
      return 'traces';
    case EntryType.Audit:
      return 'audit';
    default:
      return 'events';
  }
}

/**
 * Returns true if the entry type requires E2E encryption (types 1-6).
 */
export function entryTypeRequiresEncryption(entryType: number): boolean {
  return entryType >= 1 && entryType <= 6;
}

/**
 * Returns the default payload type for an entry type.
 */
export function defaultPayloadType(entryType: number): number {
  if (entryType === EntryType.TelemetryManaged) {
    return PayloadType.GzipJSON;
  }
  return PayloadType.AES256GCMGzipJSON;
}
