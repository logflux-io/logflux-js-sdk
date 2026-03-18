import { Scope } from '../scope';

describe('Scope', () => {
  test('setAttribute and getAttributes', () => {
    const scope = new Scope();
    scope.setAttribute('key1', 'val1');
    scope.setAttribute('key2', 'val2');

    const attrs = scope.getAttributes();
    expect(attrs).toEqual({ key1: 'val1', key2: 'val2' });
  });

  test('setAttributes merges', () => {
    const scope = new Scope();
    scope.setAttribute('existing', 'value');
    scope.setAttributes({ new1: 'a', new2: 'b' });

    expect(scope.getAttributes()).toEqual({
      existing: 'value',
      new1: 'a',
      new2: 'b',
    });
  });

  test('setUser sets user.id', () => {
    const scope = new Scope();
    scope.setUser('usr_123');

    expect(scope.getAttributes()['user.id']).toBe('usr_123');
  });

  test('setRequest sets http context', () => {
    const scope = new Scope();
    scope.setRequest('GET', '/api/users', 'req-456');

    const attrs = scope.getAttributes();
    expect(attrs['http.method']).toBe('GET');
    expect(attrs['http.path']).toBe('/api/users');
    expect(attrs['request_id']).toBe('req-456');
  });

  test('applyTo merges scope attrs as defaults', () => {
    const scope = new Scope();
    scope.setAttribute('scope_key', 'scope_val');
    scope.setAttribute('shared_key', 'scope_version');

    const existing = { shared_key: 'explicit', other: 'value' };
    const merged = scope.applyTo(existing);

    expect(merged.scope_key).toBe('scope_val');
    expect(merged.shared_key).toBe('explicit'); // explicit wins
    expect(merged.other).toBe('value');
  });

  test('applyTo with undefined existing', () => {
    const scope = new Scope();
    scope.setAttribute('key', 'val');

    const merged = scope.applyTo(undefined);
    expect(merged).toEqual({ key: 'val' });
  });

  test('addBreadcrumb adds to scope breadcrumbs', () => {
    const scope = new Scope();
    scope.addBreadcrumb('http', 'GET /api', { status: '200' });

    const crumbs = scope.breadcrumbs.snapshot();
    expect(crumbs.length).toBe(1);
    expect(crumbs[0].category).toBe('http');
    expect(crumbs[0].message).toBe('GET /api');
    expect(crumbs[0].data?.status).toBe('200');
  });
});
