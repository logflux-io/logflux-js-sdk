import { BreadcrumbRing, type Breadcrumb } from './breadcrumb';

/**
 * Scope provides per-request context isolation.
 * Attributes and breadcrumbs set on a scope are merged into every entry sent through it,
 * without affecting other scopes or the global state.
 */
export class Scope {
  private attributes: Record<string, string> = {};
  readonly breadcrumbs: BreadcrumbRing;

  constructor(maxBreadcrumbs: number = 100) {
    this.breadcrumbs = new BreadcrumbRing(maxBreadcrumbs);
  }

  /**
   * Sets a key-value pair that will be merged into every entry.
   */
  setAttribute(key: string, value: string): void {
    this.attributes[key] = value;
  }

  /**
   * Sets multiple attributes at once.
   */
  setAttributes(attrs: Record<string, string>): void {
    for (const [k, v] of Object.entries(attrs)) {
      this.attributes[k] = v;
    }
  }

  /**
   * Convenience method for setting user context.
   */
  setUser(userId: string): void {
    this.attributes['user.id'] = userId;
  }

  /**
   * Convenience method for setting request context.
   */
  setRequest(method: string, path: string, requestId?: string): void {
    this.attributes['http.method'] = method;
    this.attributes['http.path'] = path;
    if (requestId) {
      this.attributes['request_id'] = requestId;
    }
  }

  /**
   * Adds a breadcrumb to this scope's trail.
   */
  addBreadcrumb(category: string, message: string, data?: Record<string, string>): void {
    this.breadcrumbs.add({
      timestamp: new Date().toISOString(),
      category,
      message,
      data,
    });
  }

  /**
   * Merges scope attributes into a payload's attributes.
   * Scope attributes are defaults - they don't overwrite explicit ones.
   */
  applyTo(existing: Record<string, string> | undefined): Record<string, string> {
    const result = { ...this.attributes };
    if (existing) {
      // Explicit attributes take priority over scope attributes
      for (const [k, v] of Object.entries(existing)) {
        result[k] = v;
      }
    }
    return result;
  }

  /**
   * Returns a copy of current attributes.
   */
  getAttributes(): Record<string, string> {
    return { ...this.attributes };
  }
}
