import { applyContext } from './context';

/**
 * A single sensor reading.
 */
export interface Reading {
  name: string;
  value: number;
  unit?: string;
}

/**
 * Creates a v2 telemetry payload (type 6 or 7).
 */
export function createTelemetryPayload(
  deviceId: string,
  readings: Reading[],
  attributes?: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    v: '2.0',
    type: 'telemetry',
    source: '',
    level: 7,
    ts: new Date().toISOString(),
    device_id: deviceId,
    readings,
  };
  if (attributes && Object.keys(attributes).length > 0) {
    payload.attributes = attributes;
  }
  applyContext(payload);
  return payload;
}
