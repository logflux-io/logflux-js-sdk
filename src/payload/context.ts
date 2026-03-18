/**
 * Global payload context. Auto-applied to all payloads via applyContext().
 */
let globalSource = '';
let globalEnvironment = '';
let globalRelease = '';

export function configureContext(source: string, environment: string, release: string): void {
  globalSource = source;
  globalEnvironment = environment;
  globalRelease = release;
}

export function getSource(): string {
  return globalSource;
}

/**
 * Applies global context (source, environment, release) to a payload object.
 */
export function applyContext(payload: Record<string, unknown>): void {
  if (!payload.source && globalSource) {
    payload.source = globalSource;
  }
  // Build meta from environment + release if set
  if (globalEnvironment || globalRelease) {
    const meta = (payload.meta as Record<string, string>) ?? {};
    if (globalEnvironment && !meta.environment) {
      meta.environment = globalEnvironment;
    }
    if (globalRelease && !meta.release) {
      meta.release = globalRelease;
    }
    payload.meta = meta;
  }
}
