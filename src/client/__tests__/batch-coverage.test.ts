import { BatchClient } from '../batch';
import { LogFluxClient } from '../index';
import { createLogEntry, LogLevel } from '../../types';
import { BatchConfig } from '../../config';

// Mock the process object for exit handler tests
const originalProcess = process;

describe('BatchClient Coverage Tests', () => {
  let mockClient: jest.Mocked<LogFluxClient>;
  let batchClient: BatchClient;

  beforeEach(() => {
    mockClient = {
      sendLogBatch: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      sendLogEntry: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue(true),
      authenticate: jest.fn().mockResolvedValue(true),
      isConnected: jest.fn().mockReturnValue(true),
      getConfig: jest.fn().mockReturnValue({} as any),
    } as any;
  });

  afterEach(async () => {
    if (batchClient && !batchClient.isStopped()) {
      await batchClient.stop();
    }
    jest.clearAllMocks();
  });

  describe('Circuit Breaker Tests', () => {
    it('should open circuit breaker after consecutive failures', async () => {
      const config: BatchConfig = {
        maxBatchSize: 5,
        flushInterval: 1000,
        maxMemoryUsage: 1024,
        flushOnExit: false,
        circuitBreakerFailureThreshold: 2, // Low threshold for testing
      };

      batchClient = new BatchClient(mockClient, config);

      // Mock failures
      mockClient.sendLogBatch.mockRejectedValue(new Error('Network error'));

      // Add entries to trigger flushes and failures
      const entry = createLogEntry('test', 'source');

      // First failure
      await batchClient.addLogEntry(entry);
      try {
        await batchClient.flush();
      } catch (error) {
        // Expected failure
      }

      // Second failure should open circuit
      await batchClient.addLogEntry(entry);
      try {
        await batchClient.flush();
      } catch (error) {
        // Expected failure that opens circuit
      }

      // Circuit should be open now - console.warn should be called
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await batchClient.addLogEntry(entry);
      await batchClient.flush();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker open, dropped')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle circuit breaker recovery after timeout', async () => {
      const config: BatchConfig = {
        maxBatchSize: 5,
        flushInterval: 1000,
        maxMemoryUsage: 1024,
        flushOnExit: false,
        circuitBreakerFailureThreshold: 1,
        circuitBreakerOpenTimeout: 100, // Short timeout for testing
      };

      batchClient = new BatchClient(mockClient, config);

      // Cause one failure to open circuit
      mockClient.sendLogBatch.mockRejectedValueOnce(new Error('Network error'));
      
      const entry = createLogEntry('test', 'source');
      await batchClient.addLogEntry(entry);

      try {
        await batchClient.flush();
      } catch (error) {
        // Expected failure
      }

      // Circuit should be open
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await batchClient.addLogEntry(entry);
      await batchClient.flush();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();

      // Wait for circuit timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Now mock success
      mockClient.sendLogBatch.mockResolvedValue(undefined);

      // Should work again after circuit timeout
      await batchClient.addLogEntry(entry);
      await expect(batchClient.flush()).resolves.toBeUndefined();
      expect(batchClient.getConsecutiveFailures()).toBe(0);
    });
  });

  describe('Exit Handler Tests', () => {
    it('should set up exit handlers when flushOnExit is true', () => {
      const addListenerSpy = jest.spyOn(process, 'on');
      
      const config: BatchConfig = {
        maxBatchSize: 10,
        flushInterval: 1000,
        maxMemoryUsage: 1024,
        flushOnExit: true,
      };

      batchClient = new BatchClient(mockClient, config);

      expect(addListenerSpy).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(addListenerSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(addListenerSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      addListenerSpy.mockRestore();
    });

    it('should handle sync exit with pending entries', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const config: BatchConfig = {
        maxBatchSize: 10,
        flushInterval: 1000,
        maxMemoryUsage: 1024,
        flushOnExit: true,
      };

      batchClient = new BatchClient(mockClient, config);
      
      // Add an entry without flushing
      const entry = createLogEntry('test', 'source');
      batchClient.addLogEntry(entry);

      // Get the sync exit handler that was registered
      const exitHandlers = (batchClient as any).exitHandlers;
      expect(exitHandlers).toBeDefined();

      // Call the sync exit handler
      exitHandlers.syncExitHandler();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 entries lost on exit')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle async exit gracefully', async () => {
      const config: BatchConfig = {
        maxBatchSize: 10,
        flushInterval: 1000,
        maxMemoryUsage: 1024,
        flushOnExit: true,
      };

      batchClient = new BatchClient(mockClient, config);
      
      // Add entries
      const entry = createLogEntry('test', 'source');
      await batchClient.addLogEntry(entry);
      await batchClient.addLogEntry(entry);

      // Get the async exit handler
      const exitHandlers = (batchClient as any).exitHandlers;
      expect(exitHandlers).toBeDefined();

      // Call the async exit handler
      await expect(exitHandlers.exitHandler()).resolves.toBeUndefined();
      
      // Should have flushed the entries
      expect(mockClient.sendLogBatch).toHaveBeenCalledWith({
        entries: [entry, entry]
      });
    });

    it('should handle async exit with flush error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const config: BatchConfig = {
        maxBatchSize: 10,
        flushInterval: 1000,
        maxMemoryUsage: 1024,
        flushOnExit: true,
      };

      batchClient = new BatchClient(mockClient, config);
      
      // Mock flush error
      mockClient.sendLogBatch.mockRejectedValue(new Error('Flush failed'));
      
      // Add an entry
      const entry = createLogEntry('test', 'source');
      await batchClient.addLogEntry(entry);

      // Get the async exit handler
      const exitHandlers = (batchClient as any).exitHandlers;
      
      // Call the async exit handler - should not throw
      await expect(exitHandlers.exitHandler()).resolves.toBeUndefined();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'LogFlux: Error during batch stop:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Timer and Memory Management', () => {
    it('should flush based on timer interval', async () => {
      const config: BatchConfig = {
        maxBatchSize: 10,
        flushInterval: 100, // Short interval for testing
        maxMemoryUsage: 1024,
        flushOnExit: false,
      };

      batchClient = new BatchClient(mockClient, config);
      
      // Add entries below batch size threshold
      const entry = createLogEntry('test', 'source');
      await batchClient.addLogEntry(entry);
      await batchClient.addLogEntry(entry);

      expect(batchClient.getPendingCount()).toBe(2);

      // Wait for timer to trigger flush
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(batchClient.getPendingCount()).toBe(0);
      expect(mockClient.sendLogBatch).toHaveBeenCalled();
    });

    it('should estimate memory usage correctly', () => {
      batchClient = new BatchClient(mockClient);
      
      // Add a large entry
      const largePayload = 'x'.repeat(1000);
      const entry = createLogEntry(largePayload, 'source');
      entry.metadata = {
        key1: 'value1',
        key2: 'value2'
      };
      
      // Get estimated memory usage
      const memoryUsage = (batchClient as any).getEstimatedMemoryUsage();
      expect(memoryUsage).toBe(0); // No entries yet

      // Add entry with large payload and check memory usage
      const largeEntry = createLogEntry('x'.repeat(1000), 'source'); // Large payload
      batchClient.addLogEntry(largeEntry);
      const memoryUsageAfter = (batchClient as any).getEstimatedMemoryUsage();
      expect(memoryUsageAfter).toBeGreaterThan(1000); // Should include payload size
    });

    it('should flush when memory usage exceeds limit', async () => {
      const config: BatchConfig = {
        maxBatchSize: 10,
        flushInterval: 5000, // Long interval
        maxMemoryUsage: 500, // Small memory limit
        flushOnExit: false,
      };

      batchClient = new BatchClient(mockClient, config);
      
      // Add a large entry that exceeds memory limit
      const largePayload = 'x'.repeat(600); // Exceeds 500 byte limit
      const entry = createLogEntry(largePayload, 'source');
      
      await batchClient.addLogEntry(entry);
      
      // Should have flushed due to memory limit
      expect(batchClient.getPendingCount()).toBe(0);
      expect(mockClient.sendLogBatch).toHaveBeenCalled();
    });
  });

  describe('Error Recovery and Stats', () => {
    it('should update average batch size correctly', async () => {
      batchClient = new BatchClient(mockClient);
      
      // Send batches of different sizes
      const entries1 = [createLogEntry('test1', 'source')];
      const entries2 = [
        createLogEntry('test2', 'source'),
        createLogEntry('test3', 'source')
      ];
      
      // Mock successful sends
      await batchClient.addLogEntry(entries1[0]);
      await batchClient.flush();
      
      for (const entry of entries2) {
        await batchClient.addLogEntry(entry);
      }
      await batchClient.flush();
      
      const stats = batchClient.getStats();
      expect(stats.batchesSent).toBe(2);
      expect(stats.averageBatchSize).toBe(1.5); // (1 + 2) / 2
      expect(stats.entriesProcessed).toBe(3);
      expect(stats.lastFlushTime).toBeInstanceOf(Date);
    });

    it('should track consecutive failures correctly', async () => {
      batchClient = new BatchClient(mockClient);
      
      // Mock multiple failures
      mockClient.sendLogBatch
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce(undefined);
      
      const entry = createLogEntry('test', 'source');
      
      // First failure
      await batchClient.addLogEntry(entry);
      try {
        await batchClient.flush();
      } catch (error) {
        // Expected
      }
      
      expect(batchClient.getConsecutiveFailures()).toBe(1);
      
      // Second failure
      try {
        await batchClient.flush();
      } catch (error) {
        // Expected
      }
      
      expect(batchClient.getConsecutiveFailures()).toBe(2);
      
      // Success should reset counter
      await batchClient.flush();
      expect(batchClient.getConsecutiveFailures()).toBe(0);
    });

    it('should calculate exponential backoff delay correctly', async () => {
      const config: BatchConfig = {
        maxBatchSize: 5,
        flushInterval: 1000,
        maxMemoryUsage: 1024,
        flushOnExit: false,
        initialRetryDelay: 100,
        maxRetryDelay: 1000,
        retryBackoffMultiplier: 2,
      };

      batchClient = new BatchClient(mockClient, config);
      
      // Mock failures to trigger backoff calculation
      mockClient.sendLogBatch.mockRejectedValue(new Error('Network error'));
      
      const entry = createLogEntry('test', 'source');
      await batchClient.addLogEntry(entry);
      
      // Get initial delay
      const initialDelay = (batchClient as any).nextRetryDelay;
      expect(initialDelay).toBe(100);
      
      // Trigger failure and backoff calculation
      try {
        await batchClient.flush();
      } catch (error) {
        // Expected
      }
      
      const newDelay = (batchClient as any).nextRetryDelay;
      expect(newDelay).toBe(200); // 100 * 2
      
      // Another failure
      try {
        await batchClient.flush();
      } catch (error) {
        // Expected
      }
      
      const nextDelay = (batchClient as any).nextRetryDelay;
      expect(nextDelay).toBe(400); // 200 * 2
    });

    it('should cap retry delay at maximum', async () => {
      const config: BatchConfig = {
        maxBatchSize: 5,
        flushInterval: 1000,
        maxMemoryUsage: 1024,
        flushOnExit: false,
        initialRetryDelay: 500,
        maxRetryDelay: 800, // Low max for testing
        retryBackoffMultiplier: 2,
      };

      batchClient = new BatchClient(mockClient, config);
      
      mockClient.sendLogBatch.mockRejectedValue(new Error('Network error'));
      
      const entry = createLogEntry('test', 'source');
      await batchClient.addLogEntry(entry);
      
      // Multiple failures to exceed max delay
      try {
        await batchClient.flush();
      } catch (error) {
        // Expected
      }
      
      try {
        await batchClient.flush();
      } catch (error) {
        // Expected
      }
      
      const delay = (batchClient as any).nextRetryDelay;
      expect(delay).toBe(800); // Should be capped at maxRetryDelay
    });
  });

  describe('Stop and Cleanup', () => {
    it('should clean up exit handlers on stop', async () => {
      const removeListenerSpy = jest.spyOn(process, 'off').mockImplementation();
      
      const config: BatchConfig = {
        maxBatchSize: 10,
        flushInterval: 1000,
        maxMemoryUsage: 1024,
        flushOnExit: true,
      };

      batchClient = new BatchClient(mockClient, config);
      
      await batchClient.stop();
      
      expect(removeListenerSpy).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(removeListenerSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(removeListenerSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      
      removeListenerSpy.mockRestore();
    });

    it('should handle stop when timer is already cleared', async () => {
      batchClient = new BatchClient(mockClient);
      
      // Clear timer manually
      const timer = (batchClient as any).flushTimer;
      clearInterval(timer);
      (batchClient as any).flushTimer = undefined;
      
      // Stop should not throw
      await expect(batchClient.stop()).resolves.toBeUndefined();
    });

    it('should handle stop with flush error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      batchClient = new BatchClient(mockClient);
      
      // Add entry to trigger flush on stop
      const entry = createLogEntry('test', 'source');
      await batchClient.addLogEntry(entry);
      
      // Mock flush error
      mockClient.sendLogBatch.mockRejectedValue(new Error('Flush failed on stop'));
      
      await expect(batchClient.stop()).resolves.toBeUndefined();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'LogFlux: Error during batch stop:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });
});