import { applyContext } from './context';

/**
 * Creates a v2 metric payload (type 2).
 */
export function createMetricPayload(
  name: string,
  value: number,
  metricType: string,
  attributes?: Record<string, string>,
  unit?: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    v: '2.0',
    type: 'metric',
    source: '',
    level: 7,
    ts: new Date().toISOString(),
    name,
    value,
    metric_type: metricType,
  };
  if (unit) {
    payload.unit = unit;
  }
  if (attributes && Object.keys(attributes).length > 0) {
    payload.attributes = attributes;
  }
  applyContext(payload);
  return payload;
}
