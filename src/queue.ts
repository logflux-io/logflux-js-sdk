export interface QueueEntry {
  id: string;
  message: string;
  timestamp: Date;
  level: number;
  entryType: number;
  payloadType: number;
  node: string;
  labels?: Record<string, string>;
  searchTokens?: string[];
  createdAt: Date;
}

/**
 * In-memory FIFO queue with max size eviction.
 * Returns false from enqueue() when full or closed (caller counts as overflow).
 */
export class Queue {
  private items: QueueEntry[] = [];
  private maxSize: number;
  private _closed = false;

  // Resolve callbacks for blocked dequeue operations
  private waiters: Array<(entry: QueueEntry | null) => void> = [];

  constructor(maxSize: number = 1000) {
    this.maxSize = Math.max(1, maxSize);
  }

  /**
   * Adds an entry to the queue. Returns false if full or closed.
   */
  enqueue(entry: QueueEntry): boolean {
    if (this._closed || this.items.length >= this.maxSize) {
      return false;
    }
    this.items.push(entry);

    // Wake up a waiting dequeue if any
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;
      waiter(this.items.shift()!);
    }

    return true;
  }

  /**
   * Removes and returns the oldest entry, or null if empty.
   */
  dequeue(): QueueEntry | null {
    if (this.items.length === 0) {
      return null;
    }
    return this.items.shift()!;
  }

  /**
   * Removes up to n entries at once.
   */
  dequeueBatch(n: number): QueueEntry[] {
    const count = Math.min(n, this.items.length);
    if (count === 0) return [];
    return this.items.splice(0, count);
  }

  /**
   * Returns a promise that resolves with the next available entry,
   * or null if the queue is closed and empty.
   */
  dequeueAsync(): Promise<QueueEntry | null> {
    const entry = this.dequeue();
    if (entry) return Promise.resolve(entry);
    if (this._closed) return Promise.resolve(null);

    return new Promise<QueueEntry | null>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  get size(): number {
    return this.items.length;
  }

  get capacity(): number {
    return this.maxSize;
  }

  get isFull(): boolean {
    return this.items.length >= this.maxSize;
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  get closed(): boolean {
    return this._closed;
  }

  clear(): void {
    this.items.length = 0;
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    // Resolve all waiting dequeuers with null
    for (const waiter of this.waiters) {
      waiter(null);
    }
    this.waiters.length = 0;
  }
}
