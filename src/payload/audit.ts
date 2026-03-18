import { applyContext } from './context';

/**
 * Creates a v2 audit payload (type 5).
 */
export function createAuditPayload(
  action: string,
  actor: string,
  resource: string,
  resourceId: string,
  attributes?: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    v: '2.0',
    type: 'audit',
    source: '',
    level: 6,
    ts: new Date().toISOString(),
    action,
    actor,
    resource,
    resource_id: resourceId,
    outcome: 'success',
  };
  if (attributes && Object.keys(attributes).length > 0) {
    payload.attributes = attributes;
  }
  applyContext(payload);
  return payload;
}
