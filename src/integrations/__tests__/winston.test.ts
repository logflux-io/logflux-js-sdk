import { LogFluxTransport } from '../winston';
import { BatchClient } from '../../client/batch';
import { LogFluxClient } from '../../client';
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

describe('Winston LogFlux Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockBatchClient.addLogEntry as jest.Mock).mockResolvedValue(undefined);
    (mockBatchClient.flush as jest.Mock).mockResolvedValue(undefined);
  });

  describe('LogFluxTransport', () => {
    test('should create transport with required options', () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app'
      });

      expect(transport).toBeInstanceOf(LogFluxTransport);
    });

    test('should throw error if client is not provided', () => {
      expect(() => {
        new LogFluxTransport({
          client: null as any,
          source: 'test-app'
        });
      }).toThrow('client is required for LogFluxTransport');
    });

    test('should use default source if not provided', () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient
      });

      transport.log({ level: 'info', message: 'test' }, () => {});

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'winston'
        })
      );
    });

    test('should handle basic log message', () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app'
      });

      transport.log({ level: 'info', message: 'test message' }, () => {});

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'test-app',
          payload: 'test message',
          logLevel: LogLevel.Info,
          entryType: EntryType.Log,
          metadata: expect.objectContaining({
            winston_level: 'info'
          })
        })
      );
    });

    test('should map Winston levels to LogFlux levels correctly', () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app'
      });

      const levelMappings = [
        ['error', LogLevel.Error],
        ['warn', LogLevel.Warning],
        ['info', LogLevel.Info],
        ['debug', LogLevel.Debug],
        ['verbose', LogLevel.Debug],
        ['silly', LogLevel.Debug],
        ['emerg', LogLevel.Emergency],
        ['alert', LogLevel.Alert],
        ['crit', LogLevel.Critical],
        ['warning', LogLevel.Warning],
        ['notice', LogLevel.Notice]
      ];

      levelMappings.forEach(([winstonLevel, expectedLevel]) => {
        transport.log({ level: winstonLevel as string, message: 'test' }, () => {});
        expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
          expect.objectContaining({
            logLevel: expectedLevel
          })
        );
        jest.clearAllMocks();
      });
    });

    test('should handle unknown level with Info fallback', () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app'
      });

      transport.log({ level: 'unknown', message: 'test' }, () => {});

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          logLevel: LogLevel.Info
        })
      );
    });

    test('should handle structured logging with metadata', () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app'
      });

      const logInfo = {
        level: 'info',
        message: 'user login',
        userId: '123',
        action: 'login',
        ip: '192.168.1.100'
      };

      transport.log(logInfo, () => {});

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

    test('should handle object message', () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app'
      });

      const objectMessage = { event: 'user_login', userId: '123' };
      
      transport.log({ 
        level: 'info', 
        message: objectMessage as any 
      }, () => {});

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: JSON.stringify(objectMessage)
        })
      );
    });

    test('should handle timestamp from Winston', () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app'
      });

      const timestamp = new Date('2023-12-01T10:00:00.000Z');
      
      transport.log({ 
        level: 'info', 
        message: 'test',
        timestamp 
      }, () => {});

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: '2023-12-01T10:00:00.000Z'
        })
      );
    });

    test('should handle string timestamp from Winston', () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app'
      });

      const timestamp = '2023-12-01T10:00:00.000Z';
      
      transport.log({ 
        level: 'info', 
        message: 'test',
        timestamp 
      }, () => {});

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: '2023-12-01T10:00:00.000Z'
        })
      );
    });

    test('should include global metadata in log entries', () => {
      const globalMetadata = {
        service: 'api-gateway',
        version: '1.0.0'
      };

      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app',
        metadata: globalMetadata
      });

      transport.log({ level: 'info', message: 'test' }, () => {});

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            ...globalMetadata,
            winston_level: 'info'
          })
        })
      );
    });

    test('should handle client errors gracefully', () => {
      (mockBatchClient.addLogEntry as jest.Mock).mockRejectedValue(new Error('Client error'));

      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app'
      });

      const callback = jest.fn();
      transport.log({ level: 'info', message: 'test' }, callback);

      // Should still call callback even if client fails
      expect(callback).toHaveBeenCalled();
      // Verify client method was called
      expect(mockBatchClient.addLogEntry).toHaveBeenCalled();
    });

    test('should call provided callback', () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app'
      });

      const callback = jest.fn();
      transport.log({ level: 'info', message: 'test' }, callback);

      expect(callback).toHaveBeenCalled();
    });

    test('should handle empty metadata correctly', () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app'
      });

      transport.log({ 
        level: 'info', 
        message: 'simple message'
      }, () => {});

      expect(mockBatchClient.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: 'simple message'
        })
      );
    });

    test('should close transport and flush client', async () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app'
      });

      await transport.close();

      expect(mockBatchClient.flush).toHaveBeenCalled();
    });

    test('should set default level to info', () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app'
      });

      // Access private field for testing
      expect((transport as any).level).toBe('info');
    });

    test('should use custom level when provided', () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app',
        level: 'debug'
      });

      // Access private field for testing
      expect((transport as any).level).toBe('debug');
    });

    test('should handle complex nested metadata', () => {
      const transport = new LogFluxTransport({
        client: mockBatchClient,
        source: 'test-app'
      });

      const complexLogInfo = {
        level: 'error',
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
      };

      transport.log(complexLogInfo, () => {});

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
  });
});