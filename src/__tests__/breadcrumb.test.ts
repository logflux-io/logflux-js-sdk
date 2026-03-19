import { BreadcrumbRing } from '../breadcrumb';

describe('BreadcrumbRing', () => {
  test('add and snapshot in order', () => {
    const ring = new BreadcrumbRing(10);
    ring.add({ timestamp: '2026-01-01T00:00:01Z', category: 'a', message: 'first' });
    ring.add({ timestamp: '2026-01-01T00:00:02Z', category: 'b', message: 'second' });

    const snap = ring.snapshot();
    expect(snap.length).toBe(2);
    expect(snap[0].message).toBe('first');
    expect(snap[1].message).toBe('second');
  });

  test('overflow wraps around and maintains order', () => {
    const ring = new BreadcrumbRing(3);
    ring.add({ timestamp: '1', message: 'a', category: 'x' });
    ring.add({ timestamp: '2', message: 'b', category: 'x' });
    ring.add({ timestamp: '3', message: 'c', category: 'x' });
    ring.add({ timestamp: '4', message: 'd', category: 'x' }); // overwrites 'a'
    ring.add({ timestamp: '5', message: 'e', category: 'x' }); // overwrites 'b'

    const snap = ring.snapshot();
    expect(snap.length).toBe(3);
    expect(snap[0].message).toBe('c');
    expect(snap[1].message).toBe('d');
    expect(snap[2].message).toBe('e');
  });

  test('clear resets the ring buffer', () => {
    const ring = new BreadcrumbRing(10);
    ring.add({ timestamp: '1', message: 'a', category: 'x' });
    ring.add({ timestamp: '2', message: 'b', category: 'x' });
    ring.clear();

    expect(ring.size).toBe(0);
    expect(ring.snapshot()).toEqual([]);
  });

  test('size tracks entries correctly', () => {
    const ring = new BreadcrumbRing(5);
    expect(ring.size).toBe(0);

    ring.add({ timestamp: '1', message: 'a', category: 'x' });
    expect(ring.size).toBe(1);

    ring.add({ timestamp: '2', message: 'b', category: 'x' });
    expect(ring.size).toBe(2);
  });

  test('auto-sets timestamp if empty', () => {
    const ring = new BreadcrumbRing(10);
    ring.add({ timestamp: '', message: 'auto ts', category: 'x' });

    const snap = ring.snapshot();
    expect(snap[0].timestamp).toBeTruthy();
    expect(snap[0].timestamp.length).toBeGreaterThan(0);
  });

  test('empty snapshot returns empty array', () => {
    const ring = new BreadcrumbRing(10);
    expect(ring.snapshot()).toEqual([]);
  });
});
