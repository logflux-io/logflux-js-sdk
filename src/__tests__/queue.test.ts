import { Queue, type QueueEntry } from '../queue';

function makeEntry(msg: string): QueueEntry {
  return {
    id: 'test',
    message: msg,
    timestamp: new Date(),
    level: 7,
    entryType: 1,
    payloadType: 0,
    node: 'test',
    createdAt: new Date(),
  };
}

describe('Queue', () => {
  test('enqueue and dequeue FIFO order', () => {
    const q = new Queue(10);
    q.enqueue(makeEntry('first'));
    q.enqueue(makeEntry('second'));
    q.enqueue(makeEntry('third'));

    expect(q.dequeue()!.message).toBe('first');
    expect(q.dequeue()!.message).toBe('second');
    expect(q.dequeue()!.message).toBe('third');
    expect(q.dequeue()).toBeNull();
  });

  test('overflow returns false when full', () => {
    const q = new Queue(2);
    expect(q.enqueue(makeEntry('a'))).toBe(true);
    expect(q.enqueue(makeEntry('b'))).toBe(true);
    expect(q.enqueue(makeEntry('c'))).toBe(false);
    expect(q.size).toBe(2);
  });

  test('dequeueBatch returns up to n entries', () => {
    const q = new Queue(10);
    q.enqueue(makeEntry('1'));
    q.enqueue(makeEntry('2'));
    q.enqueue(makeEntry('3'));

    const batch = q.dequeueBatch(2);
    expect(batch.length).toBe(2);
    expect(batch[0].message).toBe('1');
    expect(batch[1].message).toBe('2');
    expect(q.size).toBe(1);
  });

  test('dequeueBatch returns all if less than n', () => {
    const q = new Queue(10);
    q.enqueue(makeEntry('1'));
    const batch = q.dequeueBatch(5);
    expect(batch.length).toBe(1);
  });

  test('isEmpty and isFull properties', () => {
    const q = new Queue(2);
    expect(q.isEmpty).toBe(true);
    expect(q.isFull).toBe(false);

    q.enqueue(makeEntry('a'));
    expect(q.isEmpty).toBe(false);
    expect(q.isFull).toBe(false);

    q.enqueue(makeEntry('b'));
    expect(q.isFull).toBe(true);
  });

  test('close prevents further enqueue', () => {
    const q = new Queue(10);
    q.close();
    expect(q.enqueue(makeEntry('a'))).toBe(false);
    expect(q.closed).toBe(true);
  });

  test('dequeueAsync resolves when entry arrives', async () => {
    const q = new Queue(10);

    // Enqueue after a short delay
    setTimeout(() => {
      q.enqueue(makeEntry('delayed'));
    }, 10);

    const entry = await q.dequeueAsync();
    expect(entry).not.toBeNull();
    expect(entry!.message).toBe('delayed');
  });

  test('dequeueAsync resolves null when closed', async () => {
    const q = new Queue(10);

    setTimeout(() => {
      q.close();
    }, 10);

    const entry = await q.dequeueAsync();
    expect(entry).toBeNull();
  });

  test('clear empties the queue', () => {
    const q = new Queue(10);
    q.enqueue(makeEntry('a'));
    q.enqueue(makeEntry('b'));
    q.clear();
    expect(q.size).toBe(0);
    expect(q.isEmpty).toBe(true);
  });

  test('capacity returns maxSize', () => {
    const q = new Queue(42);
    expect(q.capacity).toBe(42);
  });
});
