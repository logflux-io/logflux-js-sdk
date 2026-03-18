import {
  Span,
  startSpan,
  continueFromHeaders,
  parseTraceHeader,
  generateTraceId,
  generateSpanId,
  TRACE_HEADER,
} from '../span';

describe('Span', () => {
  test('startSpan creates root span', () => {
    const span = startSpan('http.server', 'GET /api');
    expect(span.traceId.length).toBe(32);
    expect(span.spanId.length).toBe(16);
    expect(span.parentSpanId).toBe('');
    expect(span.operation).toBe('http.server');
    expect(span.description).toBe('GET /api');
    expect(span.status).toBe('ok');
    expect(span.ended).toBe(false);
  });

  test('startChild creates child with same traceId', () => {
    const parent = startSpan('http.server', 'GET /api');
    const child = parent.startChild('db.query', 'SELECT users');

    expect(child.traceId).toBe(parent.traceId);
    expect(child.parentSpanId).toBe(parent.spanId);
    expect(child.spanId).not.toBe(parent.spanId);
    expect(child.operation).toBe('db.query');
  });

  test('end returns span data and marks as ended', () => {
    const span = startSpan('test', 'test-op');
    span.setAttribute('key', 'val');

    const data = span.end();
    expect(data).not.toBeNull();
    expect(data!.traceId).toBe(span.traceId);
    expect(data!.operation).toBe('test');
    expect(data!.durationMs).toBeGreaterThanOrEqual(0);
    expect(data!.attributes.key).toBe('val');
    expect(span.ended).toBe(true);
  });

  test('double end returns null', () => {
    const span = startSpan('test', 'test-op');
    expect(span.end()).not.toBeNull();
    expect(span.end()).toBeNull();
  });

  test('setStatus changes status', () => {
    const span = startSpan('test', 'op');
    span.setStatus('error');
    expect(span.status).toBe('error');
  });

  test('setError marks error and records message', () => {
    const span = startSpan('test', 'op');
    span.setError(new Error('something failed'));
    expect(span.status).toBe('error');
    expect(span.attributes['error.message']).toBe('something failed');
  });

  test('toTraceHeader produces correct format', () => {
    const span = startSpan('test', 'op');
    const header = span.toTraceHeader();
    expect(header).toMatch(/^[0-9a-f]{32}-[0-9a-f]{16}-1$/);
  });
});

describe('parseTraceHeader', () => {
  test('valid header with sampled=1', () => {
    const traceId = 'a'.repeat(32);
    const spanId = 'b'.repeat(16);
    const tc = parseTraceHeader(`${traceId}-${spanId}-1`);
    expect(tc).not.toBeNull();
    expect(tc!.traceId).toBe(traceId);
    expect(tc!.spanId).toBe(spanId);
    expect(tc!.sampled).toBe(true);
  });

  test('valid header with sampled=0', () => {
    const traceId = 'a'.repeat(32);
    const spanId = 'b'.repeat(16);
    const tc = parseTraceHeader(`${traceId}-${spanId}-0`);
    expect(tc!.sampled).toBe(false);
  });

  test('returns null for empty', () => {
    expect(parseTraceHeader('')).toBeNull();
  });

  test('returns null for wrong lengths', () => {
    expect(parseTraceHeader('abc-def-1')).toBeNull();
  });

  test('returns null for non-hex', () => {
    expect(parseTraceHeader('g'.repeat(32) + '-' + 'b'.repeat(16) + '-1')).toBeNull();
  });
});

describe('continueFromHeaders', () => {
  test('continues from valid header', () => {
    const traceId = 'a'.repeat(32);
    const spanId = 'b'.repeat(16);
    const headers = { [TRACE_HEADER]: `${traceId}-${spanId}-1` };

    const span = continueFromHeaders(headers, 'http.server', 'GET /api');
    expect(span.traceId).toBe(traceId);
    expect(span.parentSpanId).toBe(spanId);
    expect(span.operation).toBe('http.server');
  });

  test('starts new root when no header', () => {
    const span = continueFromHeaders({}, 'http.server', 'GET /api');
    expect(span.traceId.length).toBe(32);
    expect(span.parentSpanId).toBe('');
  });
});

describe('ID generation', () => {
  test('generateTraceId is 32 hex chars', () => {
    const id = generateTraceId();
    expect(id.length).toBe(32);
    expect(/^[0-9a-f]+$/.test(id)).toBe(true);
  });

  test('generateSpanId is 16 hex chars', () => {
    const id = generateSpanId();
    expect(id.length).toBe(16);
    expect(/^[0-9a-f]+$/.test(id)).toBe(true);
  });
});
