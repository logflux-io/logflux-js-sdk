jest.mock('debug', () => {
  const mockDebugInstance = {
    namespace: 'test:app',
    enabled: true,
    log: jest.fn()
  };

  const mockDebugFactory = Object.assign(jest.fn(() => mockDebugInstance), {
    log: jest.fn(),
    enabled: jest.fn()
  });

  return mockDebugFactory;
});

import { 
  attachDebugToLogFlux, 
  createLogFluxDebug, 
  detachDebugFromLogFlux 
} from '../debug';
import { LogFluxClient } from '../../client';
import { LogLevel, EntryType } from '../../types';

// Get the mocked debug factory
const debug = require('debug');

// Mock LogFluxClient
const mockClient = {
  sendLogEntry: jest.fn(),
  connect: jest.fn(),
  close: jest.fn()
} as unknown as LogFluxClient;

describe('Debug LogFlux Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockClient.sendLogEntry as jest.Mock).mockResolvedValue(undefined);
    debug.log = jest.fn();
  });

  describe('attachDebugToLogFlux', () => {
    test('should override debug.log to intercept output', () => {
      const originalLog = debug.log;
      
      attachDebugToLogFlux(mockClient, 'test-source');

      expect(debug.log).not.toBe(originalLog);
    });

    test('should send debug output to LogFlux', async () => {
      attachDebugToLogFlux(mockClient, 'test-source');

      debug.log('test:namespace debug message');

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'test-source',
          payload: 'debug message',
          logLevel: LogLevel.Debug,
          entryType: EntryType.Log,
          metadata: expect.objectContaining({
            debugNamespace: 'test:namespace',
            debugLevel: 'debug'
          })
        })
      );
    });

    test('should handle messages without namespace', async () => {
      attachDebugToLogFlux(mockClient, 'test-source');

      debug.log('plain message');

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: 'message',
          metadata: expect.objectContaining({
            debugNamespace: 'plain'
          })
        })
      );
    });

    test('should use custom log level when provided', async () => {
      attachDebugToLogFlux(mockClient, 'test-source', {
        logLevel: LogLevel.Info
      });

      debug.log('test message');

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          logLevel: LogLevel.Info
        })
      );
    });

    test('should include custom metadata', async () => {
      attachDebugToLogFlux(mockClient, 'test-source', {
        metadata: {
          service: 'api-gateway',
          version: '1.0.0'
        }
      });

      debug.log('test message');

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            service: 'api-gateway',
            version: '1.0.0',
            debugNamespace: 'test',
            debugLevel: 'debug'
          })
        })
      );
    });
  });

  describe('createLogFluxDebug', () => {
    test('should create debug instance that sends to LogFlux', async () => {
      const logFluxDebug = createLogFluxDebug(mockClient, 'app:database', 'test-source');

      logFluxDebug('test message');

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'test-source',
          payload: 'test message',
          logLevel: LogLevel.Debug,
          entryType: EntryType.Log,
          metadata: expect.objectContaining({
            debugNamespace: 'app:database',
            debugLevel: 'debug'
          })
        })
      );
    });

    test('should handle multiple arguments', async () => {
      const logFluxDebug = createLogFluxDebug(mockClient, 'app:test', 'test-source');

      logFluxDebug('User', 'login', 'successful', 123);

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: 'User login successful 123'
        })
      );
    });

    test('should use custom options', async () => {
      const logFluxDebug = createLogFluxDebug(mockClient, 'app:test', 'test-source', {
        logLevel: LogLevel.Warning,
        metadata: { component: 'auth' }
      });

      logFluxDebug('test message');

      expect(mockClient.sendLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          logLevel: LogLevel.Warning,
          metadata: expect.objectContaining({
            component: 'auth',
            debugNamespace: 'app:test',
            debugLevel: 'debug'
          })
        })
      );
    });
  });

  describe('detachDebugFromLogFlux', () => {
    test('should remove debug.log override', () => {
      debug.log = jest.fn();
      
      attachDebugToLogFlux(mockClient, 'test-source');
      const attachedLog = debug.log;
      
      detachDebugFromLogFlux();
      
      expect(debug.log).not.toBe(attachedLog);
    });
  });
});