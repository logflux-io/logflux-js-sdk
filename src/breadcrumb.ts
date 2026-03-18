/**
 * A single breadcrumb entry in the trail.
 */
export interface Breadcrumb {
  timestamp: string;
  category?: string;
  message: string;
  level?: string;
  data?: Record<string, string>;
}

/**
 * Thread-safe ring buffer for breadcrumbs.
 * When full, the oldest entries are overwritten.
 */
export class BreadcrumbRing {
  private items: (Breadcrumb | null)[];
  private maxSize: number;
  private position = 0;
  private full = false;

  constructor(maxSize: number = 100) {
    this.maxSize = Math.max(1, maxSize);
    this.items = new Array(this.maxSize).fill(null);
  }

  /**
   * Adds a breadcrumb to the ring buffer.
   */
  add(b: Breadcrumb): void {
    if (!b.timestamp) {
      b.timestamp = new Date().toISOString();
    }
    this.items[this.position] = b;
    this.position = (this.position + 1) % this.maxSize;
    if (this.position === 0) {
      this.full = true;
    }
  }

  /**
   * Returns a chronological copy of all breadcrumbs.
   */
  snapshot(): Breadcrumb[] {
    const count = this.full ? this.maxSize : this.position;
    if (count === 0) return [];

    const result: Breadcrumb[] = [];
    if (this.full) {
      // Oldest entries start at this.position (wrapped around)
      for (let i = this.position; i < this.maxSize; i++) {
        result.push(this.items[i]!);
      }
      for (let i = 0; i < this.position; i++) {
        result.push(this.items[i]!);
      }
    } else {
      for (let i = 0; i < this.position; i++) {
        result.push(this.items[i]!);
      }
    }
    return result;
  }

  /**
   * Removes all breadcrumbs.
   */
  clear(): void {
    this.position = 0;
    this.full = false;
  }

  /**
   * Returns current breadcrumb count.
   */
  get size(): number {
    return this.full ? this.maxSize : this.position;
  }
}
