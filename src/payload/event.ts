import { applyContext } from './context';

/**
 * Creates a v2 event payload (type 4).
 */
export function createEventPayload(
  eventName: string,
  attributes?: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    v: '2.0',
    type: 'event',
    source: '',
    level: 7,
    ts: new Date().toISOString(),
    event: eventName,
  };
  if (attributes && Object.keys(attributes).length > 0) {
    payload.attributes = attributes;
  }
  applyContext(payload);
  return payload;
}
