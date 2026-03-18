import { applyContext } from './context';

/**
 * Creates a v2 log payload (type 1).
 */
export function createLogPayload(
  message: string,
  level: number,
  attributes?: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    v: '2.0',
    type: 'log',
    source: '',
    level,
    ts: new Date().toISOString(),
    message,
  };
  if (attributes && Object.keys(attributes).length > 0) {
    payload.attributes = attributes;
  }
  applyContext(payload);
  return payload;
}
