import type { ClientStats, DropReason } from './types';

/**
 * Tracks runtime statistics for the SDK.
 */
export class StatsTracker {
  private sent = 0;
  private dropped = 0;
  private queued = 0;
  private reasons: Record<string, number> = {};
  private lastError = '';
  private lastTime: Date | null = null;
  private _handshakeOK = false;

  recordSent(count: number): void {
    this.sent += count;
    this.lastTime = new Date();
  }

  recordDrop(reason: DropReason, count: number): void {
    this.dropped += count;
    this.reasons[reason] = (this.reasons[reason] ?? 0) + count;
  }

  recordQueued(count: number): void {
    this.queued += count;
  }

  recordError(err: string): void {
    this.lastError = err;
  }

  set handshakeOK(ok: boolean) {
    this._handshakeOK = ok;
  }

  get handshakeStatus(): boolean {
    return this._handshakeOK;
  }

  snapshot(queueSize: number, queueCapacity: number): ClientStats {
    return {
      entriesSent: this.sent,
      entriesDropped: this.dropped,
      entriesQueued: this.queued,
      queueSize,
      queueCapacity,
      dropReasons: { ...this.reasons },
      lastSendError: this.lastError,
      lastSendTime: this.lastTime,
      handshakeOK: this._handshakeOK,
    };
  }
}
