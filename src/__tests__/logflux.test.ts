import { LogFlux, LogLevel, EntryType, VERSION, Scope, Span, BreadcrumbRing } from '../index';

describe('LogFlux static API', () => {
  test('isActive is false before init', () => {
    expect(LogFlux.isActive).toBe(false);
  });

  test('stats returns empty stats before init', () => {
    const s = LogFlux.stats();
    expect(s.entriesSent).toBe(0);
    expect(s.entriesDropped).toBe(0);
    expect(s.handshakeOK).toBe(false);
  });

  test('log methods do not throw before init', () => {
    expect(() => LogFlux.debug('test')).not.toThrow();
    expect(() => LogFlux.info('test')).not.toThrow();
    expect(() => LogFlux.notice('test')).not.toThrow();
    expect(() => LogFlux.warn('test')).not.toThrow();
    expect(() => LogFlux.error('test')).not.toThrow();
    expect(() => LogFlux.critical('test')).not.toThrow();
    expect(() => LogFlux.alert('test')).not.toThrow();
    expect(() => LogFlux.emergency('test')).not.toThrow();
    expect(() => LogFlux.fatal('test')).not.toThrow();
  });

  test('metric methods do not throw before init', () => {
    expect(() => LogFlux.counter('hits', 1)).not.toThrow();
    expect(() => LogFlux.gauge('temp', 22.5)).not.toThrow();
    expect(() => LogFlux.metric('custom', 1, 'counter')).not.toThrow();
  });

  test('event does not throw before init', () => {
    expect(() => LogFlux.event('user.signup')).not.toThrow();
  });

  test('audit does not throw before init', () => {
    expect(() => LogFlux.audit('delete', 'admin', 'doc', 'doc-1')).not.toThrow();
  });

  test('captureError does not throw before init', () => {
    expect(() => LogFlux.captureError(new Error('test'))).not.toThrow();
    expect(() => LogFlux.captureErrorWithMessage(new Error('e'), 'msg')).not.toThrow();
  });

  test('breadcrumbs do not throw before init', () => {
    expect(() => LogFlux.addBreadcrumb('cat', 'msg')).not.toThrow();
    expect(() => LogFlux.clearBreadcrumbs()).not.toThrow();
  });

  test('close does not throw before init', async () => {
    await expect(LogFlux.close()).resolves.not.toThrow();
  });

  test('flush does not throw before init', async () => {
    await expect(LogFlux.flush()).resolves.not.toThrow();
  });
});

describe('LogLevel constants', () => {
  test('syslog severity 1-8', () => {
    expect(LogLevel.Emergency).toBe(1);
    expect(LogLevel.Alert).toBe(2);
    expect(LogLevel.Critical).toBe(3);
    expect(LogLevel.Error).toBe(4);
    expect(LogLevel.Warning).toBe(5);
    expect(LogLevel.Notice).toBe(6);
    expect(LogLevel.Info).toBe(7);
    expect(LogLevel.Debug).toBe(8);
  });
});

describe('EntryType constants', () => {
  test('entry types 1-7', () => {
    expect(EntryType.Log).toBe(1);
    expect(EntryType.Metric).toBe(2);
    expect(EntryType.Trace).toBe(3);
    expect(EntryType.Event).toBe(4);
    expect(EntryType.Audit).toBe(5);
    expect(EntryType.Telemetry).toBe(6);
    expect(EntryType.TelemetryManaged).toBe(7);
  });
});

describe('Exports', () => {
  test('VERSION is defined', () => {
    expect(VERSION).toBe('3.0.0');
  });

  test('Scope is exported', () => {
    expect(Scope).toBeDefined();
  });

  test('Span is exported', () => {
    expect(Span).toBeDefined();
  });

  test('BreadcrumbRing is exported', () => {
    expect(BreadcrumbRing).toBeDefined();
  });

  test('withScope works', () => {
    let called = false;
    LogFlux.withScope((scope) => {
      expect(scope).toBeInstanceOf(Scope);
      called = true;
    });
    expect(called).toBe(true);
  });

  test('startSpan returns a Span', () => {
    const span = LogFlux.startSpan('test', 'operation');
    expect(span).toBeInstanceOf(Span);
    expect(span.operation).toBe('test');
    expect(span.description).toBe('operation');
  });

  test('continueFromHeaders returns a Span', () => {
    const span = LogFlux.continueFromHeaders({}, 'test', 'op');
    expect(span).toBeInstanceOf(Span);
  });
});
