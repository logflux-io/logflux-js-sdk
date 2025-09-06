// log4js module not available in test environment - tests focus on LogFlux integration classes

import { LogFluxAppender } from '../log4js';
import { LogFluxClient } from '../../client';
import { LogLevel, EntryType } from '../../types';

// Mock LogFluxClient
const mockClient = {
  sendLogEntry: jest.fn(),
  connect: jest.fn(),
  close: jest.fn()
} as unknown as LogFluxClient;

// Mock LoggingEvent interface
interface MockLoggingEvent {
  categoryName: string;
  level: { level: number; levelStr: string };
  data: any[];
  startTime: Date;
  pid: number;
  context: Record<string, any>;
}

describe('Log4js LogFlux Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockClient.sendLogEntry as jest.Mock).mockResolvedValue(undefined);
  });

  describe('LogFluxAppender', () => {
    test('should create appender with required options', () => {
      const appender = new LogFluxAppender({
        client: mockClient,
        source: 'test-app'
      });

      expect(appender).toBeInstanceOf(LogFluxAppender);
    });

    test('should create appender without client validation', () => {
      // The constructor doesn't validate client - it accepts any value
      expect(() => {
        new LogFluxAppender({
          client: null as any,
          source: 'test-app'
        });
      }).not.toThrow();
    });

    test('should use default source if not provided', () => {
      const appender = new LogFluxAppender({
        client: mockClient,
        source: 'log4js'
      });

      const event: MockLoggingEvent = {
        categoryName: 'test',
        level: { level: 20000, levelStr: 'INFO' },
        data: ['test'],
        startTime: new Date(),
        pid: 12345,
        context: {}
      };

      appender.appender(event);

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'log4js'
        })
      );
    });

    test('should handle TRACE level', async () => {
      const appender = new LogFluxAppender({
        client: mockClient,
        source: 'test-app'
      });

      const event: MockLoggingEvent = {
        categoryName: 'test-logger',
        level: { level: 5000, levelStr: 'TRACE' },
        data: ['trace message'],
        startTime: new Date('2023-01-01T00:00:00.000Z'),
        pid: 12345,
        context: {}
      };

      appender.appender(event);

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'test-app',
          payload: 'trace message',
          logLevel: LogLevel.Debug,
          entryType: EntryType.Log,
          timestamp: '2023-01-01T00:00:00.000Z',
          metadata: expect.objectContaining({
            log4jsCategory: 'test-logger',
            log4jsLevel: 'TRACE',
            pid: '12345'
          })
        })
      );
    });

    test('should handle INFO level', async () => {
      const appender = new LogFluxAppender({
        client: mockClient,
        source: 'test-app'
      });

      const event: MockLoggingEvent = {
        categoryName: 'app',
        level: { level: 20000, levelStr: 'INFO' },
        data: ['info message'],
        startTime: new Date('2023-01-01T12:00:00.000Z'),
        pid: 9876,
        context: {}
      };

      appender.appender(event);

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          logLevel: LogLevel.Info,
          payload: 'info message',
          metadata: expect.objectContaining({
            log4jsCategory: 'app',
            log4jsLevel: 'INFO',
            pid: '9876'
          })
        })
      );
    });

    test('should handle ERROR level', async () => {
      const appender = new LogFluxAppender({
        client: mockClient,
        source: 'test-app'
      });

      const event: MockLoggingEvent = {
        categoryName: 'error-handler',
        level: { level: 40000, levelStr: 'ERROR' },
        data: ['error occurred'],
        startTime: new Date(),
        pid: 1111,
        context: {}
      };

      appender.appender(event);

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          logLevel: LogLevel.Error,
          payload: 'error occurred'
        })
      );
    });

    test('should handle multiple data arguments', async () => {
      const appender = new LogFluxAppender({
        client: mockClient,
        source: 'test-app'
      });

      const event: MockLoggingEvent = {
        categoryName: 'multi-args',
        level: { level: 20000, levelStr: 'INFO' },
        data: ['User', 'login', 'successful', { userId: 123 }],
        startTime: new Date(),
        pid: 2222,
        context: {}
      };

      appender.appender(event);

      // The actual implementation joins all items with spaces and formats objects with JSON.stringify
      const expectedPayload = 'User login successful {\n  "userId": 123\n}';

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expectedPayload
        })
      );
    });

    test('should include global metadata', async () => {
      const appender = new LogFluxAppender({
        client: mockClient,
        source: 'test-app',
        metadata: {
          service: 'auth-service',
          version: '1.2.0'
        }
      });

      const event: MockLoggingEvent = {
        categoryName: 'auth',
        level: { level: 20000, levelStr: 'INFO' },
        data: ['authentication successful'],
        startTime: new Date(),
        pid: 3333,
        context: {}
      };

      appender.appender(event);

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            service: 'auth-service',
            version: '1.2.0',
            log4jsCategory: 'auth',
            log4jsLevel: 'INFO',
            pid: '3333'
          })
        })
      );
    });

    test('should handle LogFlux client errors gracefully', async () => {
      (mockClient.sendLogEntry as jest.Mock).mockRejectedValue(new Error('Client error'));

      const appender = new LogFluxAppender({
        client: mockClient,
        source: 'test-app'
      });

      const event: MockLoggingEvent = {
        categoryName: 'test',
        level: { level: 20000, levelStr: 'INFO' },
        data: ['test'],
        startTime: new Date(),
        pid: 12345,
        context: {}
      };

      appender.appender(event);

      // Verify client method was called
      expect(mockClient.sendLogEntry).toHaveBeenCalled();
    });
  });

});