// Mock bunyan import - must be at the very top
jest.mock('bunyan', () => ({
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  FATAL: 60,
  nameFromLevel: {
    10: 'TRACE',
    20: 'DEBUG',
    30: 'INFO',
    40: 'WARN',
    50: 'ERROR',
    60: 'FATAL'
  }
}));

import { LogFluxStream, createLogFluxStream } from '../bunyan';
import { BatchClient } from '../../client/batch';
import { LogLevel, EntryType } from '../../types';

// Get the mocked bunyan module
const bunyan = require('bunyan') as {
  TRACE: number;
  DEBUG: number;
  INFO: number;
  WARN: number;
  ERROR: number;
  FATAL: number;
  nameFromLevel: Record<number, string>;
};

// Mock BatchClient
const mockBatchClient = {
  addLogEntry: jest.fn(),
  flush: jest.fn(),
  stop: jest.fn(),
  getStats: jest.fn(),
  getPendingCount: jest.fn(),
  getConfig: jest.fn(),
  isStopped: jest.fn()
} as unknown as BatchClient;

describe('Bunyan LogFlux Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockBatchClient.addLogEntry as jest.Mock).mockResolvedValue(undefined);
    (mockBatchClient.flush as jest.Mock).mockResolvedValue(undefined);
  });

  describe('LogFluxStream', () => {
    test('should create stream with required options', () => {
      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      expect(stream).toBeInstanceOf(LogFluxStream);
    });

    test('should throw error if client is not provided', () => {
      expect(() => {
        new LogFluxStream({
          client: null as any,
          source: 'test-app'
        });
      }).toThrow('client is required for LogFluxStream');
    });

    test('should use default source if not provided', () => {
      const stream = new LogFluxStream({
        client: mockBatchClient
      });

      const bunyanRecord = {
        level: bunyan.INFO,
        msg: 'test message',
        time: Date.now(),
        name: 'test-logger',
        hostname: 'localhost',
        pid: process.pid,
        v: 0
      };

      stream.write(bunyanRecord);

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'bunyan'
        })
      );
    });

    test('should handle valid Bunyan log record', () => {
      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      const timestamp = Date.now();
      const bunyanRecord = {
        level: bunyan.INFO,
        msg: 'test message',
        time: timestamp,
        name: 'test-logger',
        hostname: 'test-host',
        pid: 12345,
        v: 0
      };

      stream.write(bunyanRecord);

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'test-app',
          payload: 'test message',
          logLevel: LogLevel.Info,
          entryType: EntryType.Log,
          timestamp: new Date(timestamp).toISOString(),
          metadata: expect.objectContaining({
            bunyan_level: 'INFO',
            bunyan_name: 'test-logger',
            bunyan_hostname: 'test-host',
            bunyan_pid: '12345'
          })
        })
      );
    });

    test('should map Bunyan levels to LogFlux levels correctly', () => {
      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      const levelMappings = [
        [bunyan.TRACE, LogLevel.Debug],
        [bunyan.DEBUG, LogLevel.Debug],
        [bunyan.INFO, LogLevel.Info],
        [bunyan.WARN, LogLevel.Warning],
        [bunyan.ERROR, LogLevel.Error],
        [bunyan.FATAL, LogLevel.Critical]
      ];

      levelMappings.forEach(([bunyanLevel, expectedLevel]) => {
        const record = {
          level: bunyanLevel,
          msg: 'test',
          time: Date.now(),
          name: 'test',
          hostname: 'localhost',
          pid: process.pid,
          v: 0
        };

        stream.write(record);
        expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
          expect.objectContaining({
            logLevel: expectedLevel
          })
        );
        jest.clearAllMocks();
      });
    });

    test('should handle unknown level with Info fallback', () => {
      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: 999, // unknown level
        msg: 'test',
        time: Date.now(),
        name: 'test',
        hostname: 'localhost',
        pid: process.pid,
        v: 0
      };

      stream.write(record);

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          logLevel: LogLevel.Info,
          metadata: expect.objectContaining({
            bunyan_level: '999' // fallback to string representation
          })
        })
      );
    });

    test('should handle structured logging with additional fields', () => {
      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: bunyan.INFO,
        msg: 'user login',
        time: Date.now(),
        name: 'auth-service',
        hostname: 'localhost',
        pid: process.pid,
        v: 0,
        userId: '123',
        action: 'login',
        ip: '192.168.1.100'
      };

      stream.write(record);

      const expectedPayload = JSON.stringify({
        message: 'user login',
        userId: '123',
        action: 'login',
        ip: '192.168.1.100'
      });

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expectedPayload
        })
      );
    });

    test('should handle record with no additional fields', () => {
      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: bunyan.INFO,
        msg: 'simple message',
        time: Date.now(),
        name: 'logger',
        hostname: 'localhost',
        pid: process.pid,
        v: 0
      };

      stream.write(record);

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: 'simple message'
        })
      );
    });

    test('should handle empty message', () => {
      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: bunyan.INFO,
        msg: '',
        time: Date.now(),
        name: 'logger',
        hostname: 'localhost',
        pid: process.pid,
        v: 0,
        userId: '123'
      };

      stream.write(record);

      const expectedPayload = JSON.stringify({
        message: '',
        userId: '123'
      });

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expectedPayload
        })
      );
    });

    test('should handle missing message', () => {
      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: bunyan.INFO,
        time: Date.now(),
        name: 'logger',
        hostname: 'localhost',
        pid: process.pid,
        v: 0,
        event: 'user_action'
      };

      stream.write(record);

      const expectedPayload = JSON.stringify({
        message: '',
        event: 'user_action'
      });

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expectedPayload
        })
      );
    });

    test('should include global metadata in log entries', () => {
      const globalMetadata = {
        service: 'user-service',
        version: '2.0.0'
      };

      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app',
        metadata: globalMetadata
      });

      const record = {
        level: bunyan.INFO,
        msg: 'test',
        time: Date.now(),
        name: 'logger',
        hostname: 'localhost',
        pid: process.pid,
        v: 0
      };

      stream.write(record);

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            ...globalMetadata,
            bunyan_level: 'INFO',
            bunyan_name: 'logger',
            bunyan_hostname: 'localhost',
            bunyan_pid: String(process.pid)
          })
        })
      );
    });

    test('should handle client errors gracefully', () => {
      (mockBatchClient.addLogEntry as jest.Mock).mockRejectedValue(new Error('Client error'));

      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: bunyan.INFO,
        msg: 'test',
        time: Date.now(),
        name: 'logger',
        hostname: 'localhost',
        pid: process.pid,
        v: 0
      };

      stream.write(record);

      // Just verify the client method was called
      expect(mockBatchClient.addLogEntry).toHaveBeenCalled();
    });

    test('should ignore non-object records', () => {
      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      // Test various non-object inputs
      stream.write(null);
      stream.write(undefined);
      stream.write('string');
      stream.write(123);
      stream.write(true);

      expect(mockBatchClient.addLogEntry).not.toHaveBeenCalled();
    });

    test('should close stream and flush client', async () => {
      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      await stream.close();

      expect(mockBatchClient.flush).toHaveBeenCalled();
    });

    test('should handle complex nested fields', () => {
      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: bunyan.ERROR,
        msg: 'Database error',
        time: Date.now(),
        name: 'db-service',
        hostname: 'db-server',
        pid: 9999,
        v: 0,
        error: {
          code: 'ECONNREFUSED',
          errno: -61,
          address: '127.0.0.1',
          port: 5432
        },
        context: {
          userId: '123',
          operation: 'user_lookup',
          retryCount: 3
        }
      };

      stream.write(record);

      const expectedPayload = JSON.stringify({
        message: 'Database error',
        error: {
          code: 'ECONNREFUSED',
          errno: -61,
          address: '127.0.0.1',
          port: 5432
        },
        context: {
          userId: '123',
          operation: 'user_lookup',
          retryCount: 3
        }
      });

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expectedPayload,
          logLevel: LogLevel.Error
        })
      );
    });

    test('should handle missing standard fields gracefully', () => {
      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: bunyan.INFO,
        msg: 'test'
        // Missing time, name, hostname, pid, v
      };

      stream.write(record);

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: 'test',
          metadata: expect.objectContaining({
            bunyan_level: 'INFO',
            bunyan_name: '',
            bunyan_hostname: '',
            bunyan_pid: ''
          })
        })
      );
    });

    test('should handle non-numeric time field', () => {
      const stream = new LogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: bunyan.INFO,
        msg: 'test',
        time: 'invalid-time',
        name: 'logger',
        hostname: 'localhost',
        pid: process.pid,
        v: 0
      };

      stream.write(record);

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: 'test'
          // timestamp should be undefined/not set
        })
      );
    });
  });

  describe('createLogFluxStream', () => {
    test('should create Bunyan stream configuration', () => {
      const streamConfig = createLogFluxStream({
        client: mockBatchClient,
        source: 'test-app'
      });

      expect(streamConfig).toEqual({
        type: 'raw',
        stream: expect.any(LogFluxStream)
      });
    });

    test('should pass options to LogFluxStream constructor', () => {
      const options = {
        client: mockBatchClient,
        source: 'test-service',
        metadata: { version: '1.0' }
      };

      const streamConfig = createLogFluxStream(options);
      const stream = streamConfig.stream as LogFluxStream;

      const record = {
        level: bunyan.INFO,
        msg: 'test',
        time: Date.now(),
        name: 'logger',
        hostname: 'localhost',
        pid: process.pid,
        v: 0
      };

      stream.write(record);

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'test-service',
          metadata: expect.objectContaining({
            version: '1.0'
          })
        })
      );
    });
  });
});