import { StatsTracker } from '../stats';
import { DropReason } from '../types';

describe('StatsTracker', () => {
  test('tracks sent entries', () => {
    const tracker = new StatsTracker();
    tracker.recordSent(5);
    tracker.recordSent(3);

    const snap = tracker.snapshot(0, 100);
    expect(snap.entriesSent).toBe(8);
    expect(snap.lastSendTime).not.toBeNull();
  });

  test('tracks dropped entries with reasons', () => {
    const tracker = new StatsTracker();
    tracker.recordDrop(DropReason.QueueOverflow, 2);
    tracker.recordDrop(DropReason.NetworkError, 1);
    tracker.recordDrop(DropReason.QueueOverflow, 3);

    const snap = tracker.snapshot(0, 100);
    expect(snap.entriesDropped).toBe(6);
    expect(snap.dropReasons[DropReason.QueueOverflow]).toBe(5);
    expect(snap.dropReasons[DropReason.NetworkError]).toBe(1);
  });

  test('tracks all 7 drop reasons', () => {
    const tracker = new StatsTracker();

    tracker.recordDrop(DropReason.QueueOverflow, 1);
    tracker.recordDrop(DropReason.NetworkError, 1);
    tracker.recordDrop(DropReason.SendError, 1);
    tracker.recordDrop(DropReason.RateLimited, 1);
    tracker.recordDrop(DropReason.QuotaExceeded, 1);
    tracker.recordDrop(DropReason.BeforeSend, 1);
    tracker.recordDrop(DropReason.ValidationError, 1);

    const snap = tracker.snapshot(0, 100);
    expect(snap.entriesDropped).toBe(7);
    expect(Object.keys(snap.dropReasons).length).toBe(7);
  });

  test('tracks queued entries', () => {
    const tracker = new StatsTracker();
    tracker.recordQueued(10);

    const snap = tracker.snapshot(5, 100);
    expect(snap.entriesQueued).toBe(10);
    expect(snap.queueSize).toBe(5);
    expect(snap.queueCapacity).toBe(100);
  });

  test('records last error', () => {
    const tracker = new StatsTracker();
    tracker.recordError('connection refused');

    const snap = tracker.snapshot(0, 100);
    expect(snap.lastSendError).toBe('connection refused');
  });

  test('tracks handshake status', () => {
    const tracker = new StatsTracker();
    expect(tracker.snapshot(0, 0).handshakeOK).toBe(false);

    tracker.handshakeOK = true;
    expect(tracker.snapshot(0, 0).handshakeOK).toBe(true);
  });

  test('snapshot returns copy of drop reasons', () => {
    const tracker = new StatsTracker();
    tracker.recordDrop(DropReason.QueueOverflow, 1);

    const snap1 = tracker.snapshot(0, 0);
    tracker.recordDrop(DropReason.QueueOverflow, 1);
    const snap2 = tracker.snapshot(0, 0);

    expect(snap1.dropReasons[DropReason.QueueOverflow]).toBe(1);
    expect(snap2.dropReasons[DropReason.QueueOverflow]).toBe(2);
  });
});
