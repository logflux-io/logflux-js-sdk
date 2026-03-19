import { createLogPayload } from '../payload/log';
import { createMetricPayload } from '../payload/metric';
import { createTracePayload } from '../payload/trace';
import { createEventPayload } from '../payload/event';
import { createAuditPayload } from '../payload/audit';
import { createErrorPayload, createErrorPayloadWithMessage } from '../payload/error';
import { createTelemetryPayload } from '../payload/telemetry';
import { configureContext } from '../payload/context';
import { LogLevel } from '../types';

describe('Payload serialization', () => {
  beforeEach(() => {
    configureContext('test-node', 'production', 'v1.0.0');
  });

  afterEach(() => {
    configureContext('', '', '');
  });

  test('Log payload has correct fields', () => {
    const p = createLogPayload('hello world', LogLevel.Info, { key: 'val' });
    expect(p.v).toBe('2.0');
    expect(p.type).toBe('log');
    expect(p.source).toBe('test-node');
    expect(p.level).toBe(7);
    expect(p.message).toBe('hello world');
    expect(p.ts).toBeDefined();
    expect((p.attributes as Record<string, string>).key).toBe('val');
    expect((p.meta as Record<string, string>).environment).toBe('production');
    expect((p.meta as Record<string, string>).release).toBe('v1.0.0');
  });

  test('Metric payload has correct fields', () => {
    const p = createMetricPayload('cpu_usage', 0.85, 'gauge', { host: 'node1' }, 'percent');
    expect(p.v).toBe('2.0');
    expect(p.type).toBe('metric');
    expect(p.name).toBe('cpu_usage');
    expect(p.value).toBe(0.85);
    expect(p.metric_type).toBe('gauge');
    expect(p.unit).toBe('percent');
    expect((p.attributes as Record<string, string>).host).toBe('node1');
  });

  test('Trace payload has correct fields', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-01T00:00:01Z');
    const p = createTracePayload(
      'trace123',
      'span456',
      'parent789',
      'http.server',
      'GET /api',
      'ok',
      start,
      end,
      1000,
      { route: '/api' },
    );
    expect(p.v).toBe('2.0');
    expect(p.type).toBe('trace');
    expect(p.trace_id).toBe('trace123');
    expect(p.span_id).toBe('span456');
    expect(p.parent_span_id).toBe('parent789');
    expect(p.operation).toBe('http.server');
    expect(p.description).toBe('GET /api');
    expect(p.status).toBe('ok');
    expect(p.duration_ms).toBe(1000);
  });

  test('Event payload has correct fields', () => {
    const p = createEventPayload('user.signup', { plan: 'pro' });
    expect(p.v).toBe('2.0');
    expect(p.type).toBe('event');
    expect(p.event).toBe('user.signup');
    expect((p.attributes as Record<string, string>).plan).toBe('pro');
  });

  test('Audit payload has correct fields', () => {
    const p = createAuditPayload('delete', 'user@test.com', 'document', 'doc-123', {
      reason: 'requested',
    });
    expect(p.v).toBe('2.0');
    expect(p.type).toBe('audit');
    expect(p.action).toBe('delete');
    expect(p.actor).toBe('user@test.com');
    expect(p.resource).toBe('document');
    expect(p.resource_id).toBe('doc-123');
    expect(p.outcome).toBe('success');
    expect(p.level).toBe(6); // notice
  });

  test('Error payload has stack trace', () => {
    const err = new Error('test error');
    const p = createErrorPayload(err, { context: 'unit test' });
    expect(p.v).toBe('2.0');
    expect(p.type).toBe('log');
    expect(p.level).toBe(4); // error
    expect(p.message).toBe('test error');
    expect(p.error_type).toBe('Error');
    expect(p.error_message).toBe('test error');
    expect(Array.isArray(p.stack_trace)).toBe(true);
    expect((p.stack_trace as unknown[]).length).toBeGreaterThan(0);
  });

  test('Error payload with custom message', () => {
    const err = new Error('original');
    const p = createErrorPayloadWithMessage(err, 'custom message', { key: 'val' });
    expect(p.message).toBe('custom message');
    expect((p.attributes as Record<string, string>).error).toBe('original');
    expect((p.attributes as Record<string, string>).key).toBe('val');
  });

  test('Telemetry payload has correct fields', () => {
    const p = createTelemetryPayload('device-001', [
      { name: 'temperature', value: 22.5, unit: 'celsius' },
      { name: 'humidity', value: 65 },
    ]);
    expect(p.v).toBe('2.0');
    expect(p.type).toBe('telemetry');
    expect(p.device_id).toBe('device-001');
    expect(Array.isArray(p.readings)).toBe(true);
    expect((p.readings as unknown[]).length).toBe(2);
  });

  test('Payload without attributes omits empty attributes', () => {
    const p = createLogPayload('no attrs', LogLevel.Info);
    expect(p.attributes).toBeUndefined();
  });

  test('Context is applied automatically', () => {
    const p = createEventPayload('test');
    expect(p.source).toBe('test-node');
    expect((p.meta as Record<string, string>).environment).toBe('production');
  });
});
