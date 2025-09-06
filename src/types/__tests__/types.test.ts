import {
  createLogEntry,
  createPingRequest,
  createAuthRequest,
  isValidJSON,
  autoDetectPayloadType,
  LogLevel,
  EntryType,
  PayloadType,
  LogEntryBuilder,
  DEFAULT_PROTOCOL_VERSION
} from '../index';

describe('Types', () => {
  describe('createLogEntry', () => {
    it('should create a log entry with default values', () => {
      const entry = createLogEntry('test message', 'test-source');
      
      expect(entry.payload).toBe('test message');
      expect(entry.source).toBe('test-source');
      expect(entry.version).toBe(DEFAULT_PROTOCOL_VERSION);
      expect(entry.entryType).toBe(EntryType.Log);
      expect(entry.logLevel).toBe(LogLevel.Info);
      expect(entry.payloadType).toBe(PayloadType.Generic);
      expect(entry.metadata).toEqual({});
      expect(entry.timestamp).toBeDefined();
    });

    it('should auto-detect JSON payload type', () => {
      const entry = createLogEntry('{"key": "value"}', 'test-source');
      expect(entry.payloadType).toBe(PayloadType.GenericJSON);
    });

    it('should use "unknown" as default source', () => {
      const entry = createLogEntry('test message', '');
      expect(entry.source).toBe('unknown');
    });
  });

  describe('createPingRequest', () => {
    it('should create a ping request', () => {
      const ping = createPingRequest();
      
      expect(ping.version).toBe(DEFAULT_PROTOCOL_VERSION);
      expect(ping.action).toBe('ping');
    });
  });

  describe('createAuthRequest', () => {
    it('should create an auth request', () => {
      const auth = createAuthRequest('secret123');
      
      expect(auth.version).toBe(DEFAULT_PROTOCOL_VERSION);
      expect(auth.action).toBe('authenticate');
      expect(auth.shared_secret).toBe('secret123');
    });

    it('should throw error for empty secret', () => {
      expect(() => createAuthRequest('')).toThrow('sharedSecret cannot be empty');
    });
  });

  describe('isValidJSON', () => {
    it('should return true for valid JSON', () => {
      expect(isValidJSON('{"key": "value"}')).toBe(true);
      expect(isValidJSON('[]')).toBe(true);
      expect(isValidJSON('"string"')).toBe(true);
      expect(isValidJSON('123')).toBe(true);
      expect(isValidJSON('true')).toBe(true);
    });

    it('should return false for invalid JSON', () => {
      expect(isValidJSON('not json')).toBe(false);
      expect(isValidJSON('{"incomplete"')).toBe(false);
      expect(isValidJSON('')).toBe(false);
    });
  });

  describe('autoDetectPayloadType', () => {
    it('should detect JSON payload type', () => {
      expect(autoDetectPayloadType('{"key": "value"}')).toBe(PayloadType.GenericJSON);
    });

    it('should detect generic payload type', () => {
      expect(autoDetectPayloadType('plain text')).toBe(PayloadType.Generic);
    });
  });

  describe('LogEntryBuilder', () => {
    it('should build log entry with fluent API', () => {
      const entry = new LogEntryBuilder('test payload', 'test-source')
        .withLogLevel(LogLevel.Error)
        .withMetadata('key1', 'value1')
        .withMetadata('key2', 'value2')
        .withPayloadType(PayloadType.GenericJSON)
        .build();

      expect(entry.payload).toBe('test payload');
      expect(entry.source).toBe('test-source');
      expect(entry.logLevel).toBe(LogLevel.Error);
      expect(entry.metadata).toEqual({ key1: 'value1', key2: 'value2' });
      expect(entry.payloadType).toBe(PayloadType.GenericJSON);
    });

    it('should handle invalid log level', () => {
      const entry = new LogEntryBuilder('test', 'source')
        .withLogLevel(999 as LogLevel)
        .build();

      expect(entry.logLevel).toBe(LogLevel.Info);
    });

    it('should handle empty source', () => {
      const entry = new LogEntryBuilder('test', 'source')
        .withSource('')
        .build();

      expect(entry.source).toBe('unknown');
    });

    it('should skip empty metadata keys', () => {
      const entry = new LogEntryBuilder('test', 'source')
        .withMetadata('', 'value')
        .withMetadata('key', 'value')
        .build();

      expect(entry.metadata).toEqual({ key: 'value' });
    });

    it('should set custom timestamp', () => {
      const testDate = new Date('2023-01-01T12:00:00.000Z');
      const entry = new LogEntryBuilder('test', 'source')
        .withTimestamp(testDate)
        .build();

      expect(entry.timestamp).toBe('2023-01-01T12:00:00.000Z');
    });

    it('should merge all metadata', () => {
      const entry = new LogEntryBuilder('test', 'source')
        .withMetadata('key1', 'value1')
        .withAllMetadata({ key2: 'value2', key3: 'value3' })
        .build();

      expect(entry.metadata).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      });
    });
  });
});