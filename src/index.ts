import { Client } from './client';
import { Scope } from './scope';
import {
  Span,
  startSpan as _startSpan,
  continueFromHeaders as _continueFromHeaders,
  TRACE_HEADER,
  type SpanData,
  type TraceContext,
  parseTraceHeader,
  generateTraceId,
  generateSpanId,
} from './span';
import { BreadcrumbRing, type Breadcrumb } from './breadcrumb';
import type { Options, BeforeSendFn } from './options';
import { loadOptionsFromEnv, validateApiKey } from './options';
import { configureContext } from './payload/context';
import { createLogPayload } from './payload/log';
import { createMetricPayload } from './payload/metric';
import { createTracePayload } from './payload/trace';
import { createEventPayload } from './payload/event';
import { createAuditPayload } from './payload/audit';
import { createErrorPayload, createErrorPayloadWithMessage } from './payload/error';
import { createTelemetryPayload, type Reading } from './payload/telemetry';
import {
  LogLevel,
  EntryType,
  PayloadType,
  DropReason,
  type ClientStats,
} from './types';
import { VERSION } from './version';

let globalClient: Client | null = null;

/**
 * LogFlux SDK - static API for zero-knowledge encrypted logging.
 *
 * Usage:
 *   LogFlux.init({ apiKey: 'eu-lf_xxx', node: 'my-app' });
 *   LogFlux.info('Server started', { port: '3000' });
 *   LogFlux.close();
 */
export class LogFlux {
  private constructor() {} // Prevent instantiation

  /**
   * Initializes the SDK. Must be awaited before sending entries.
   */
  static async init(options: Options): Promise<void> {
    if (globalClient) {
      await globalClient.close();
    }
    globalClient = new Client(options);
    await globalClient.initialize();
  }

  /**
   * Initializes the SDK from environment variables.
   */
  static async initFromEnv(node?: string): Promise<void> {
    const options = loadOptionsFromEnv(node);
    return LogFlux.init(options);
  }

  /**
   * Closes the SDK, flushing pending entries and zeroing key material.
   */
  static async close(): Promise<void> {
    if (globalClient) {
      await globalClient.close();
      globalClient = null;
    }
  }

  /**
   * Flushes the queue, waiting up to timeoutMs (default: 10000).
   */
  static async flush(timeoutMs?: number): Promise<void> {
    if (!globalClient) return;
    return globalClient.flush(timeoutMs);
  }

  // --- Log (Type 1) ---

  static debug(message: string, attributes?: Record<string, string>): void {
    LogFlux.log(LogLevel.Debug, message, attributes);
  }

  static info(message: string, attributes?: Record<string, string>): void {
    LogFlux.log(LogLevel.Info, message, attributes);
  }

  static notice(message: string, attributes?: Record<string, string>): void {
    LogFlux.log(LogLevel.Notice, message, attributes);
  }

  static warn(message: string, attributes?: Record<string, string>): void {
    LogFlux.log(LogLevel.Warning, message, attributes);
  }

  static error(message: string, attributes?: Record<string, string>): void {
    LogFlux.log(LogLevel.Error, message, attributes);
  }

  static critical(message: string, attributes?: Record<string, string>): void {
    LogFlux.log(LogLevel.Critical, message, attributes);
  }

  static alert(message: string, attributes?: Record<string, string>): void {
    LogFlux.log(LogLevel.Alert, message, attributes);
  }

  static emergency(message: string, attributes?: Record<string, string>): void {
    LogFlux.log(LogLevel.Emergency, message, attributes);
  }

  static fatal(message: string, attributes?: Record<string, string>): void {
    LogFlux.log(LogLevel.Critical, message, attributes);
  }

  static log(level: LogLevel, message: string, attributes?: Record<string, string>): void {
    if (!globalClient) return;
    const payload = createLogPayload(message, level, attributes);
    globalClient.enqueue(JSON.stringify(payload), level, EntryType.Log);

    // Auto-breadcrumb for log entries at info level or above
    if (level <= LogLevel.Info) {
      globalClient.breadcrumbs.add({
        timestamp: new Date().toISOString(),
        category: 'log',
        message,
        level: levelString(level),
      });
    }
  }

  // --- Metric (Type 2) ---

  static counter(name: string, value: number, attributes?: Record<string, string>): void {
    LogFlux.metric(name, value, 'counter', attributes);
  }

  static gauge(name: string, value: number, attributes?: Record<string, string>): void {
    LogFlux.metric(name, value, 'gauge', attributes);
  }

  static metric(
    name: string,
    value: number,
    metricType: string,
    attributes?: Record<string, string>,
  ): void {
    if (!globalClient) return;
    const payload = createMetricPayload(name, value, metricType, attributes);
    globalClient.enqueue(JSON.stringify(payload), LogLevel.Info, EntryType.Metric);
  }

  // --- Event (Type 4) ---

  static event(name: string, attributes?: Record<string, string>): void {
    if (!globalClient) return;
    const payload = createEventPayload(name, attributes);
    globalClient.enqueue(JSON.stringify(payload), LogLevel.Info, EntryType.Event);

    // Auto-breadcrumb for events
    globalClient.breadcrumbs.add({
      timestamp: new Date().toISOString(),
      category: 'event',
      message: name,
      data: attributes,
    });
  }

  // --- Audit (Type 5) ---

  static audit(
    action: string,
    actor: string,
    resource: string,
    resourceId: string,
    attributes?: Record<string, string>,
  ): void {
    if (!globalClient) return;
    const payload = createAuditPayload(action, actor, resource, resourceId, attributes);
    // Audit entries are never sampled - compliance requirement
    globalClient.enqueue(JSON.stringify(payload), LogLevel.Notice, EntryType.Audit);
  }

  // --- Error capture ---

  static captureError(error: Error, attributes?: Record<string, string>): void {
    if (!globalClient) return;
    const crumbs = globalClient.breadcrumbs.snapshot();
    const payload = createErrorPayload(error, attributes, crumbs);
    globalClient.enqueue(JSON.stringify(payload), LogLevel.Error, EntryType.Log);
  }

  static captureErrorWithMessage(
    error: Error,
    message: string,
    attributes?: Record<string, string>,
  ): void {
    if (!globalClient) return;
    const crumbs = globalClient.breadcrumbs.snapshot();
    const payload = createErrorPayloadWithMessage(error, message, attributes, crumbs);
    globalClient.enqueue(JSON.stringify(payload), LogLevel.Error, EntryType.Log);
  }

  // --- Breadcrumbs ---

  static addBreadcrumb(
    category: string,
    message: string,
    data?: Record<string, string>,
  ): void {
    if (!globalClient) return;
    globalClient.breadcrumbs.add({
      timestamp: new Date().toISOString(),
      category,
      message,
      data,
    });
  }

  static clearBreadcrumbs(): void {
    if (!globalClient) return;
    globalClient.breadcrumbs.clear();
  }

  // --- Scopes ---

  static withScope(callback: (scope: Scope) => void): void {
    const scope = new Scope();
    callback(scope);
  }

  // --- Tracing ---

  static startSpan(operation: string, description: string): Span {
    return _startSpan(operation, description);
  }

  static continueFromHeaders(
    headers: Record<string, string>,
    operation: string,
    description: string,
  ): Span {
    return _continueFromHeaders(headers, operation, description);
  }

  /**
   * Ends a span and sends it as a trace entry (type 3).
   */
  static sendSpan(span: Span): void {
    if (!globalClient) return;
    const data = span.end();
    if (!data) return;

    const payload = createTracePayload(
      data.traceId,
      data.spanId,
      data.parentSpanId,
      data.operation,
      data.description,
      data.status,
      data.startTime,
      data.endTime,
      data.durationMs,
      data.attributes,
    );
    globalClient.enqueue(JSON.stringify(payload), LogLevel.Info, EntryType.Trace);
  }

  // --- Stats ---

  static stats(): ClientStats {
    if (!globalClient) {
      return {
        entriesSent: 0,
        entriesDropped: 0,
        entriesQueued: 0,
        queueSize: 0,
        queueCapacity: 0,
        dropReasons: {},
        lastSendError: '',
        lastSendTime: null,
        handshakeOK: false,
      };
    }
    return globalClient.getStats();
  }

  static get isActive(): boolean {
    return globalClient !== null && globalClient.isActive;
  }
}

function levelString(level: number): string {
  if (level <= LogLevel.Critical) return 'error';
  if (level === LogLevel.Error) return 'error';
  if (level === LogLevel.Warning) return 'warning';
  return 'info';
}

// Re-export types and utilities
export {
  LogLevel,
  EntryType,
  PayloadType,
  DropReason,
  VERSION,
  TRACE_HEADER,
  type Options,
  type ClientStats,
  type BeforeSendFn,
  type Breadcrumb,
  type SpanData,
  type TraceContext,
  type Reading,
  Scope,
  Span,
  BreadcrumbRing,
  parseTraceHeader,
  generateTraceId,
  generateSpanId,
  validateApiKey,
  loadOptionsFromEnv,
};
