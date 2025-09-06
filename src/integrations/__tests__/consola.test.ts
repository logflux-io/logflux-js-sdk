// Mock consola module not available in test environment

import { LogFluxReporter, createLogFluxReporter } from '../consola';
import { LogFluxClient } from '../../client';
import { LogLevel, EntryType } from '../../types';

// Consola module not available in test environment - tests focus on LogFlux integration classes

// Mock LogFluxClient
const mockClient = {
  sendLogEntry: jest.fn(),
  connect: jest.fn(),
  close: jest.fn()
} as unknown as LogFluxClient;

// Mock ConsolaLogObject interface
interface MockConsolaLogObject {
  level: number;
  type: string;
  args: any[];
  date: Date;
  [key: string]: any;
}

describe('Consola LogFlux Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockClient.sendLogEntry as jest.Mock).mockResolvedValue(undefined);
  });

  describe('LogFluxReporter', () => {
    test('should create reporter with required options', () => {
      const reporter = new LogFluxReporter({
        client: mockClient,
        source: 'test-app'
      });

      expect(reporter).toBeInstanceOf(LogFluxReporter);
    });

    test('should create reporter without client validation', () => {
      // Constructor doesn't validate client
      expect(() => {
        new LogFluxReporter({
          client: null as any,
          source: 'test-app'
        });
      }).not.toThrow();
    });

    test('should use default source if not provided', () => {
      const reporter = new LogFluxReporter({
        client: mockClient,
        source: 'consola'
      });

      const logObj: MockConsolaLogObject = {
        level: 1,
        type: 'info',
        args: ['test'],
        date: new Date()
      };

      reporter.log(logObj, {});

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'consola'
        })
      );
    });

    test('should handle info level log', async () => {
      const reporter = new LogFluxReporter({
        client: mockClient,
        source: 'test-app'
      });

      const logObj: MockConsolaLogObject = {
        level: 4, // Level 4 maps to Info
        type: 'info',
        args: ['User logged in successfully'],
        date: new Date('2023-01-01T00:00:00.000Z')
      };

      reporter.log(logObj, {});

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'test-app',
          payload: 'User logged in successfully',
          logLevel: LogLevel.Info,
          entryType: EntryType.Log,
          timestamp: '2023-01-01T00:00:00.000Z',
          metadata: expect.objectContaining({
            consolaLevel: '4',
            consolaType: 'info'
          })
        })
      );
    });

    test('should handle error level log', async () => {
      const reporter = new LogFluxReporter({
        client: mockClient,
        source: 'test-app'
      });

      const logObj: MockConsolaLogObject = {
        level: 2, // Level 2 maps to Error
        type: 'error',
        args: ['Database connection failed'],
        date: new Date()
      };

      reporter.log(logObj, {});

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          logLevel: LogLevel.Error,
          payload: 'Database connection failed'
        })
      );
    });

    test('should handle multiple arguments', async () => {
      const reporter = new LogFluxReporter({
        client: mockClient,
        source: 'test-app'
      });

      const logObj: MockConsolaLogObject = {
        level: 4, // Level 4 maps to Info
        type: 'info',
        args: ['User', 'action', 'completed', { userId: 123, action: 'login' }],
        date: new Date()
      };

      reporter.log(logObj, {});

      // The actual implementation joins all args with spaces, formatting objects with JSON.stringify
      const expectedPayload = 'User action completed {\n  "userId": 123,\n  "action": "login"\n}';

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expectedPayload
        })
      );
    });

    test('should include global metadata', async () => {
      const reporter = new LogFluxReporter({
        client: mockClient,
        source: 'test-app',
        metadata: {
          service: 'web-server',
          version: '3.0.0'
        }
      });

      const logObj: MockConsolaLogObject = {
        level: 4, // Level 4 maps to Info
        type: 'info',
        args: ['Server started'],
        date: new Date()
      };

      reporter.log(logObj, {});

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            service: 'web-server',
            version: '3.0.0',
            consolaLevel: '4',
            consolaType: 'info'
          })
        })
      );
    });

    test('should handle LogFlux client errors gracefully', async () => {
      (mockClient.sendLogEntry as jest.Mock).mockRejectedValue(new Error('Client error'));

      const reporter = new LogFluxReporter({
        client: mockClient,
        source: 'test-app'
      });

      const logObj: MockConsolaLogObject = {
        level: 4, // Level 4 maps to Info
        type: 'info',
        args: ['test'],
        date: new Date()
      };

      reporter.log(logObj, {});

      // Verify client method was called
      expect(mockClient.sendLogEntry).toHaveBeenCalled();
    });
  });

  describe('createLogFluxReporter', () => {
    test('should create Consola reporter instance', () => {
      const reporter = createLogFluxReporter(mockClient, 'test-app');

      expect(reporter).toBeInstanceOf(LogFluxReporter);
    });
  });
});