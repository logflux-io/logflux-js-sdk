import { applyContext } from './context';

/**
 * Creates a v2 trace payload (type 3).
 */
export function createTracePayload(
  traceId: string,
  spanId: string,
  parentSpanId: string,
  operation: string,
  description: string,
  status: string,
  startTime: Date,
  endTime: Date,
  durationMs: number,
  attributes?: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    v: '2.0',
    type: 'trace',
    source: '',
    level: 7,
    ts: new Date().toISOString(),
    trace_id: traceId,
    span_id: spanId,
    operation,
    description,
    status,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    duration_ms: durationMs,
  };
  if (parentSpanId) {
    payload.parent_span_id = parentSpanId;
  }
  if (attributes && Object.keys(attributes).length > 0) {
    payload.attributes = attributes;
  }
  applyContext(payload);
  return payload;
}
