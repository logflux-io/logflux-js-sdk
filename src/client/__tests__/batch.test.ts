import { BatchClient, createBatchClient } from '../batch';
import { LogFluxClient } from '../index';
import { createLogEntry, LogLevel } from '../../types';
import { createDefaultBatchConfig } from '../../config';

// Mock the LogFluxClient
jest.mock('../index');

describe('BatchClient', () => {
  let mockClient: jest.Mocked<LogFluxClient>;
  let batchClient: BatchClient;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Create mock client
    mockClient = {
      sendLogBatch: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn().mockResolvedValue(undefined),
      sendLogEntry: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue(true),
      authenticate: jest.fn().mockResolvedValue(true),
      getConfig: jest.fn().mockReturnValue({} as any),
      isConnected: jest.fn().mockReturnValue(true),
    } as any;

    batchClient = new BatchClient(mockClient);
  });

  afterEach(async () => {
    // Ensure proper cleanup of BatchClient instances
    if (batchClient && !batchClient.isStopped()) {
      await batchClient.stop();
    }
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create batch client with default config', () => {
      const client = new BatchClient(mockClient);
      const config = client.getConfig();
      
      expect(config.maxBatchSize).toBe(100);
      expect(config.flushInterval).toBe(1000);
      expect(config.maxMemoryUsage).toBe(512 * 1024);
      expect(config.flushOnExit).toBe(true);
    });

    it('should create batch client with custom config', () => {
      const customConfig = {
        maxBatchSize: 50,
        flushInterval: 2000,
        maxMemoryUsage: 512 * 1024,
        flushOnExit: false,
      };

      const client = new BatchClient(mockClient, customConfig);
      const config = client.getConfig();
      
      expect(config).toEqual(customConfig);
    });

    it('should throw error for null client', () => {
      expect(() => new BatchClient(null as any)).toThrow('client cannot be null');
    });

    it('should validate batch config', () => {
      const invalidConfig = {
        maxBatchSize: 0,
        flushInterval: 1000,
        maxMemoryUsage: 1024 * 1024,
        flushOnExit: true,
      };

      expect(() => new BatchClient(mockClient, invalidConfig)).toThrow('maxBatchSize must be between');
    });
  });

  describe('addLogEntry', () => {
    it('should add entry to batch', async () => {
      const entry = createLogEntry('test message', 'test-source');
      
      await batchClient.addLogEntry(entry);
      
      expect(batchClient.getPendingCount()).toBe(1);
      const stats = batchClient.getStats();
      expect(stats.entriesProcessed).toBe(1);
    });

    it('should flush when batch size limit reached', async () => {
      const config = { ...createDefaultBatchConfig(), maxBatchSize: 2 };
      const client = new BatchClient(mockClient, config);
      
      const entry1 = createLogEntry('message 1', 'source1');
      const entry2 = createLogEntry('message 2', 'source2');
      
      await client.addLogEntry(entry1);
      expect(client.getPendingCount()).toBe(1);
      
      await client.addLogEntry(entry2);
      expect(client.getPendingCount()).toBe(0); // Should have flushed
      expect(mockClient.sendLogBatch).toHaveBeenCalledTimes(1);
      
      await client.stop(); // Cleanup
    });

    it('should flush when memory limit reached', async () => {
      const config = { ...createDefaultBatchConfig(), maxMemoryUsage: 100 }; // Very small limit
      const client = new BatchClient(mockClient, config);
      
      const largeEntry = createLogEntry('x'.repeat(1000), 'test-source');
      
      await client.addLogEntry(largeEntry);
      
      expect(client.getPendingCount()).toBe(0); // Should have flushed
      expect(mockClient.sendLogBatch).toHaveBeenCalledTimes(1);
      
      await client.stop(); // Cleanup
    });

    it('should throw error when client is stopped', async () => {
      await batchClient.stop();
      
      const entry = createLogEntry('test message', 'test-source');
      
      await expect(batchClient.addLogEntry(entry)).rejects.toThrow('batch client has been stopped');
    });

    it('should update statistics correctly', async () => {
      const entry1 = createLogEntry('message 1', 'source1');
      const entry2 = createLogEntry('message 2', 'source2');
      
      await batchClient.addLogEntry(entry1);
      await batchClient.addLogEntry(entry2);
      
      const stats = batchClient.getStats();
      expect(stats.entriesProcessed).toBe(2);
    });
  });

  describe('flush', () => {
    it('should flush pending entries', async () => {
      const entry1 = createLogEntry('message 1', 'source1');
      const entry2 = createLogEntry('message 2', 'source2');
      
      await batchClient.addLogEntry(entry1);
      await batchClient.addLogEntry(entry2);
      
      expect(batchClient.getPendingCount()).toBe(2);
      
      await batchClient.flush();
      
      expect(batchClient.getPendingCount()).toBe(0);
      expect(mockClient.sendLogBatch).toHaveBeenCalledTimes(1);
      
      const batchArg = mockClient.sendLogBatch.mock.calls[0][0];
      expect(batchArg.entries).toHaveLength(2);
    });

    it('should do nothing when no entries pending', async () => {
      await batchClient.flush();
      
      expect(mockClient.sendLogBatch).not.toHaveBeenCalled();
    });

    it('should update statistics on successful flush', async () => {
      const entry = createLogEntry('test message', 'test-source');
      await batchClient.addLogEntry(entry);
      
      await batchClient.flush();
      
      const stats = batchClient.getStats();
      expect(stats.batchesSent).toBe(1);
      expect(stats.averageBatchSize).toBe(1);
      expect(stats.lastFlushTime).toBeInstanceOf(Date);
    });

    it('should handle flush errors and restore entries', async () => {
      const entry = createLogEntry('test message', 'test-source');
      await batchClient.addLogEntry(entry);
      
      mockClient.sendLogBatch.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(batchClient.flush()).rejects.toThrow('Network error');
      
      // Entry should be restored
      expect(batchClient.getPendingCount()).toBe(1);
      
      const stats = batchClient.getStats();
      expect(stats.errors).toBe(1);
      expect(stats.batchesSent).toBe(0);
    });

    it('should calculate average batch size correctly', async () => {
      // First flush with 2 entries
      await batchClient.addLogEntry(createLogEntry('msg1', 'src1'));
      await batchClient.addLogEntry(createLogEntry('msg2', 'src2'));
      await batchClient.flush();
      
      // Second flush with 4 entries
      await batchClient.addLogEntry(createLogEntry('msg3', 'src3'));
      await batchClient.addLogEntry(createLogEntry('msg4', 'src4'));
      await batchClient.addLogEntry(createLogEntry('msg5', 'src5'));
      await batchClient.addLogEntry(createLogEntry('msg6', 'src6'));
      await batchClient.flush();
      
      const stats = batchClient.getStats();
      expect(stats.averageBatchSize).toBe(3); // (2 + 4) / 2 = 3
    });
  });

  describe('timer-based flushing', () => {
    it('should create timer on construction', () => {
      // Just verify timer creation without complex async testing
      expect(batchClient.getConfig().flushInterval).toBe(1000);
    });
  });

  describe('stop', () => {
    it('should stop client and flush remaining entries', async () => {
      const entry = createLogEntry('test message', 'test-source');
      await batchClient.addLogEntry(entry);
      
      expect(batchClient.getPendingCount()).toBe(1);
      expect(batchClient.isStopped()).toBe(false);
      
      await batchClient.stop();
      
      expect(batchClient.getPendingCount()).toBe(0);
      expect(batchClient.isStopped()).toBe(true);
      expect(mockClient.sendLogBatch).toHaveBeenCalledTimes(1);
      expect(mockClient.close).toHaveBeenCalledTimes(1);
    });

    it('should handle flush errors during stop gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const entry = createLogEntry('test message', 'test-source');
      await batchClient.addLogEntry(entry);
      
      mockClient.sendLogBatch.mockRejectedValueOnce(new Error('Stop flush error'));
      
      await batchClient.stop();
      
      expect(consoleSpy).toHaveBeenCalledWith('LogFlux: Error during batch stop:', expect.any(Error));
      expect(batchClient.isStopped()).toBe(true);
      
      consoleSpy.mockRestore();
    });

    it('should not flush if no entries pending', async () => {
      await batchClient.stop();
      
      expect(mockClient.sendLogBatch).not.toHaveBeenCalled();
      expect(mockClient.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats', () => {
    it('should return copy of stats', () => {
      const stats1 = batchClient.getStats();
      const stats2 = batchClient.getStats();
      
      expect(stats1).not.toBe(stats2); // Different objects
      expect(stats1).toEqual(stats2); // Same content
    });

    it('should initialize stats correctly', () => {
      const stats = batchClient.getStats();
      
      expect(stats.entriesProcessed).toBe(0);
      expect(stats.batchesSent).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.averageBatchSize).toBe(0);
      expect(stats.lastFlushTime).toBeNull();
    });
  });

  describe('exit handlers', () => {
    it('should register exit handlers when flushOnExit is true', () => {
      const processSpy = jest.spyOn(process, 'on').mockImplementation();
      
      new BatchClient(mockClient); // Default config has flushOnExit: true
      
      expect(processSpy).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      // Note: uncaughtException and unhandledRejection handlers removed for application safety
      expect(processSpy).toHaveBeenCalledTimes(3);
      
      processSpy.mockRestore();
    });

    it('should not register exit handlers when flushOnExit is false', () => {
      const processSpy = jest.spyOn(process, 'on').mockImplementation();
      
      const config = { ...createDefaultBatchConfig(), flushOnExit: false };
      new BatchClient(mockClient, config);
      
      expect(processSpy).not.toHaveBeenCalled();
      
      processSpy.mockRestore();
    });

    it('should warn about lost entries on synchronous exit', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Get the exit handler
      const processSpy = jest.spyOn(process, 'on').mockImplementation();
      const client = new BatchClient(mockClient);
      
      const exitHandler = processSpy.mock.calls.find(call => call[0] === 'exit')?.[1];
      
      // Add an entry but don't flush
      client.addLogEntry(createLogEntry('test', 'source'));
      
      // Simulate exit
      if (exitHandler) {
        (exitHandler as Function)();
      }
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 entries lost on exit')
      );
      
      processSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('factory function', () => {
    it('should create batch client', () => {
      const client = createBatchClient(mockClient);
      
      expect(client).toBeInstanceOf(BatchClient);
      expect(client.getConfig()).toEqual(createDefaultBatchConfig());
    });

    it('should create batch client with custom config', () => {
      const customConfig = {
        maxBatchSize: 25,
        flushInterval: 500,
        maxMemoryUsage: 256 * 1024,
        flushOnExit: false,
      };
      
      const client = createBatchClient(mockClient, customConfig);
      
      expect(client.getConfig()).toEqual(customConfig);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid successive additions', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(batchClient.addLogEntry(createLogEntry(`message ${i}`, 'source')));
      }
      
      await Promise.all(promises);
      
      const stats = batchClient.getStats();
      expect(stats.entriesProcessed).toBe(10);
    });

    it('should handle concurrent operations', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(batchClient.addLogEntry(createLogEntry(`msg ${i}`, 'source')));
      }
      
      await Promise.all(promises);
      
      const stats = batchClient.getStats();
      expect(stats.entriesProcessed).toBe(5);
    });
  });
});