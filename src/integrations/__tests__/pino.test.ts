import { LogFluxDestination, createLogFluxDestination } from '../pino';
import { BatchClient } from '../../client/batch';
import { LogLevel, EntryType } from '../../types';

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

describe('Pino LogFlux Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockBatchClient.addLogEntry as jest.Mock).mockResolvedValue(undefined);
    (mockBatchClient.flush as jest.Mock).mockResolvedValue(undefined);
  });

  describe('LogFluxDestination', () => {
    test('should create destination with required options', () => {
      const destination = new LogFluxDestination({
        client: mockBatchClient,
        source: 'test-app'
      });

      expect(destination).toBeInstanceOf(LogFluxDestination);
    });

    test('should throw error if client is not provided', () => {
      expect(() => {
        new LogFluxDestination({
          client: null as any,
          source: 'test-app'
        });
      }).toThrow('client is required for LogFluxDestination');
    });

    test('should use default source if not provided', () => {
      const destination = new LogFluxDestination({
        client: mockBatchClient
      });

      const pinoRecord = {
        level: 30,
        msg: 'test message',
        time: Date.now(),
        name: 'test-logger',
        hostname: 'localhost',
        pid: process.pid
      };

      destination.write(JSON.stringify(pinoRecord));

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'pino'
        })
      );
    });

    test('should handle valid Pino log record', () => {
      const destination = new LogFluxDestination({
        client: mockBatchClient,
        source: 'test-app'
      });

      const timestamp = Date.now();
      const pinoRecord = {
        level: 30, // INFO
        msg: 'test message',
        time: timestamp,
        name: 'test-logger',
        hostname: 'test-host',
        pid: 12345
      };

      destination.write(JSON.stringify(pinoRecord));

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'test-app',
          payload: 'test message',
          logLevel: LogLevel.Info,
          entryType: EntryType.Log,
          timestamp: new Date(timestamp).toISOString(),
          metadata: expect.objectContaining({
            pino_level: '30',
            pino_name: 'test-logger',
            pino_hostname: 'test-host',
            pino_pid: '12345'
          })
        })
      );
    });

    test('should map Pino levels to LogFlux levels correctly', () => {
      const destination = new LogFluxDestination({
        client: mockBatchClient,
        source: 'test-app'
      });

      const levelMappings = [
        [10, LogLevel.Debug],   // trace
        [20, LogLevel.Debug],   // debug
        [30, LogLevel.Info],    // info
        [40, LogLevel.Warning], // warn
        [50, LogLevel.Error],   // error
        [60, LogLevel.Critical] // fatal
      ];

      levelMappings.forEach(([pinoLevel, expectedLevel]) => {
        const record = {
          level: pinoLevel,
          msg: 'test',
          time: Date.now(),
          name: 'test',
          hostname: 'localhost',
          pid: process.pid
        };

        destination.write(JSON.stringify(record));
        expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
          expect.objectContaining({
            logLevel: expectedLevel
          })
        );
        jest.clearAllMocks();
      });
    });

    test('should handle unknown level with Info fallback', () => {
      const destination = new LogFluxDestination({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: 999, // unknown level
        msg: 'test',
        time: Date.now(),
        name: 'test',
        hostname: 'localhost',
        pid: process.pid
      };

      destination.write(JSON.stringify(record));

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          logLevel: LogLevel.Info
        })
      );
    });

    test('should handle structured logging with additional fields', () => {
      const destination = new LogFluxDestination({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: 30,
        msg: 'user login',
        time: Date.now(),
        name: 'auth-service',
        hostname: 'localhost',
        pid: process.pid,
        userId: '123',
        action: 'login',
        ip: '192.168.1.100'
      };

      destination.write(JSON.stringify(record));

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
      const destination = new LogFluxDestination({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: 30,
        msg: 'simple message',
        time: Date.now(),
        name: 'logger',
        hostname: 'localhost',
        pid: process.pid
      };

      destination.write(JSON.stringify(record));

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: 'simple message'
        })
      );
    });

    test('should handle empty message', () => {
      const destination = new LogFluxDestination({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: 30,
        msg: '',
        time: Date.now(),
        name: 'logger',
        hostname: 'localhost',
        pid: process.pid,
        userId: '123'
      };

      destination.write(JSON.stringify(record));

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
      const destination = new LogFluxDestination({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: 30,
        time: Date.now(),
        name: 'logger',
        hostname: 'localhost',
        pid: process.pid,
        event: 'user_action'
      };

      destination.write(JSON.stringify(record));

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

      const destination = new LogFluxDestination({
        client: mockBatchClient,
        source: 'test-app',
        metadata: globalMetadata
      });

      const record = {
        level: 30,
        msg: 'test',
        time: Date.now(),
        name: 'logger',
        hostname: 'localhost',
        pid: process.pid
      };

      destination.write(JSON.stringify(record));

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            ...globalMetadata,
            pino_level: '30',
            pino_name: 'logger',
            pino_hostname: 'localhost',
            pino_pid: String(process.pid)
          })
        })
      );
    });

    test('should handle client errors gracefully', () => {
      (mockBatchClient.addLogEntry as jest.Mock).mockRejectedValue(new Error('Client error'));

      const destination = new LogFluxDestination({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: 30,
        msg: 'test',
        time: Date.now(),
        name: 'logger',
        hostname: 'localhost',
        pid: process.pid
      };

      destination.write(JSON.stringify(record));

      // Verify client method was called
      expect(mockBatchClient.addLogEntry).toHaveBeenCalled();
    });

    test('should handle invalid JSON gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const destination = new LogFluxDestination({
        client: mockBatchClient,
        source: 'test-app'
      });

      destination.write('invalid json {');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to parse Pino log record:',
        expect.any(Error)
      );
      expect(mockBatchClient.addLogEntry).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    test('should close destination and flush client', async () => {
      const destination = new LogFluxDestination({
        client: mockBatchClient,
        source: 'test-app'
      });

      await destination.close();

      expect(mockBatchClient.flush).toHaveBeenCalled();
    });

    test('should handle complex nested fields', () => {
      const destination = new LogFluxDestination({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: 50, // ERROR
        msg: 'Database error',
        time: Date.now(),
        name: 'db-service',
        hostname: 'db-server',
        pid: 9999,
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

      destination.write(JSON.stringify(record));

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

    test('should handle missing timestamp', () => {
      const destination = new LogFluxDestination({
        client: mockBatchClient,
        source: 'test-app'
      });

      const record = {
        level: 30,
        msg: 'test',
        name: 'logger',
        hostname: 'localhost',
        pid: process.pid
        // no time field
      };

      destination.write(JSON.stringify(record));

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: 'test'
          // timestamp should be undefined/not set
        })
      );
    });
  });

  describe('createLogFluxDestination', () => {
    test('should create LogFluxDestination instance', () => {
      const destination = createLogFluxDestination({
        client: mockBatchClient,
        source: 'test-app'
      });

      expect(destination).toBeInstanceOf(LogFluxDestination);
    });

    test('should pass options to LogFluxDestination constructor', () => {
      const options = {
        client: mockBatchClient,
        source: 'test-service',
        metadata: { version: '1.0' }
      };

      const destination = createLogFluxDestination(options);

      const record = {
        level: 30,
        msg: 'test',
        time: Date.now(),
        name: 'logger',
        hostname: 'localhost',
        pid: process.pid
      };

      destination.write(JSON.stringify(record));

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