import { randomBytes } from 'node:crypto';

/**
 * Trace context header name.
 * Format: <trace_id>-<span_id>-<sampled>
 */
export const TRACE_HEADER = 'X-LogFlux-Trace';

/**
 * Parsed trace context from propagation header.
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  sampled: boolean;
}

/**
 * Represents an in-flight trace span. Call end() to finish and return the payload.
 */
export class Span {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId: string;
  readonly operation: string;
  readonly description: string;
  readonly startTime: Date;

  private _status = 'ok';
  private _ended = false;
  private _endTime: Date | null = null;
  private _attributes: Record<string, string> = {};

  constructor(
    traceId: string,
    spanId: string,
    parentSpanId: string,
    operation: string,
    description: string,
  ) {
    this.traceId = traceId;
    this.spanId = spanId;
    this.parentSpanId = parentSpanId;
    this.operation = operation;
    this.description = description;
    this.startTime = new Date();
  }

  /**
   * Creates a child span under this span (same trace ID).
   */
  startChild(operation: string, description: string): Span {
    return new Span(
      this.traceId,
      generateSpanId(),
      this.spanId,
      operation,
      description,
    );
  }

  /**
   * Sets a span attribute.
   */
  setAttribute(key: string, value: string): void {
    this._attributes[key] = value;
  }

  /**
   * Sets multiple span attributes.
   */
  setAttributes(attrs: Record<string, string>): void {
    for (const [k, v] of Object.entries(attrs)) {
      this._attributes[k] = v;
    }
  }

  /**
   * Sets the span status ("ok" or "error").
   */
  setStatus(status: string): void {
    this._status = status;
  }

  /**
   * Marks the span as errored and records the error message.
   */
  setError(err: Error): void {
    this._status = 'error';
    this._attributes['error.message'] = err.message;
  }

  /**
   * Returns the trace header value for propagation.
   */
  toTraceHeader(): string {
    return `${this.traceId}-${this.spanId}-1`;
  }

  /**
   * Ends the span and returns the span data for sending.
   * Returns null if already ended.
   */
  end(): SpanData | null {
    if (this._ended) return null;
    this._ended = true;
    this._endTime = new Date();

    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      operation: this.operation,
      description: this.description,
      status: this._status,
      startTime: this.startTime,
      endTime: this._endTime,
      durationMs: this._endTime.getTime() - this.startTime.getTime(),
      attributes: { ...this._attributes },
    };
  }

  get status(): string {
    return this._status;
  }

  get ended(): boolean {
    return this._ended;
  }

  get attributes(): Record<string, string> {
    return { ...this._attributes };
  }
}

export interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  operation: string;
  description: string;
  status: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  attributes: Record<string, string>;
}

/**
 * Generates a random 32-character hex trace ID.
 */
export function generateTraceId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Generates a random 16-character hex span ID.
 */
export function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Parses a trace header value.
 * Returns null if the header is missing or malformed.
 */
export function parseTraceHeader(header: string): TraceContext | null {
  if (!header) return null;
  const parts = header.split('-', 3);
  if (parts.length < 2) return null;

  const traceId = parts[0];
  const spanId = parts[1];

  if (traceId.length !== 32 || spanId.length !== 16) return null;
  if (!/^[0-9a-f]+$/.test(traceId) || !/^[0-9a-f]+$/.test(spanId)) return null;

  const sampled = parts.length === 3 ? parts[2] !== '0' : true;

  return { traceId, spanId, sampled };
}

/**
 * Creates a new root span with a fresh trace ID.
 */
export function startSpan(operation: string, description: string): Span {
  return new Span(generateTraceId(), generateSpanId(), '', operation, description);
}

/**
 * Creates a child span that continues a trace from incoming headers.
 * If no valid trace header is present, starts a new root span.
 */
export function continueFromHeaders(
  headers: Record<string, string>,
  operation: string,
  description: string,
): Span {
  const headerValue = headers[TRACE_HEADER] ?? headers[TRACE_HEADER.toLowerCase()] ?? '';
  const tc = parseTraceHeader(headerValue);
  if (!tc) {
    return startSpan(operation, description);
  }
  return new Span(tc.traceId, generateSpanId(), tc.spanId, operation, description);
}
