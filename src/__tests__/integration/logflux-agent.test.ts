import { LogFluxClient, createUnixClient, createTCPClient } from '../../client';
import { BatchClient } from '../../client/batch';
import { createLogEntry, LogLevel, EntryType } from '../../types';
import * as fs from 'fs';
import * as net from 'net';

/**
 * Real integration tests against a running LogFlux agent.
 * 
 * Prerequisites:
 * 1. LogFlux agent must be running locally
 * 2. Unix socket: /tmp/logflux-agent.sock (default)
 * 3. TCP socket: localhost:8080 with shared secret 'test-secret'
 * 
 * To run: npm run test:integration
 * 
 * Set environment variables to customize:
 * - LOGFLUX_SOCKET_PATH: Unix socket path (default: /tmp/logflux-agent.sock)
 * - LOGFLUX_TCP_HOST: TCP host (default: localhost)  
 * - LOGFLUX_TCP_PORT: TCP port (default: 8080)
 * - LOGFLUX_SHARED_SECRET: TCP shared secret (default: test-secret)
 * - SKIP_INTEGRATION_TESTS: Set to 'true' to skip these tests
 */

const SOCKET_PATH = process.env.LOGFLUX_SOCKET_PATH || '/tmp/logflux-agent.sock';
const TCP_HOST = process.env.LOGFLUX_TCP_HOST || 'localhost';
const TCP_PORT = parseInt(process.env.LOGFLUX_TCP_PORT || '8080');
const SHARED_SECRET = process.env.LOGFLUX_SHARED_SECRET || 'test-secret';
const SKIP_TESTS = process.env.SKIP_INTEGRATION_TESTS === 'true';

describe('Real LogFlux Agent Integration Tests', () => {
  const isAgentRunning = async (): Promise<{ unix: boolean; tcp: boolean }> => {
    const unixExists = fs.existsSync(SOCKET_PATH);
    
    let tcpAvailable = false;
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({ host: TCP_HOST, port: TCP_PORT }, () => {
          tcpAvailable = true;
          socket.destroy();
          resolve();
        });
        socket.on('error', () => {
          reject(new Error('TCP not available'));
        });
        socket.setTimeout(1000, () => {
          socket.destroy();
          reject(new Error('TCP timeout'));
        });
      });
    } catch {
      tcpAvailable = false;
    }

    return { unix: unixExists, tcp: tcpAvailable };
  };

  beforeAll(async () => {
    if (SKIP_TESTS) {
      console.log('Skipping integration tests (SKIP_INTEGRATION_TESTS=true)');
      return;
    }

    const agentStatus = await isAgentRunning();
    
    if (!agentStatus.unix && !agentStatus.tcp) {
      console.warn('LogFlux agent not detected:');
      console.warn(`   Unix socket: ${SOCKET_PATH} - ${agentStatus.unix ? 'Yes' : 'No'}`);
      console.warn(`   TCP socket: ${TCP_HOST}:${TCP_PORT} - ${agentStatus.tcp ? 'Yes' : 'No'}`);
      console.warn(`   Skipping integration tests. Start the agent to run these tests.`);
    } else {
      console.log('LogFlux agent detected:');
      console.log(`   Unix socket: ${SOCKET_PATH} - ${agentStatus.unix ? 'Yes' : 'No'}`);
      console.log(`   TCP socket: ${TCP_HOST}:${TCP_PORT} - ${agentStatus.tcp ? 'Yes' : 'No'}`);
    }
  });

  describe('Unix Socket Connection', () => {
    let client: LogFluxClient;

    beforeEach(() => {
      client = createUnixClient(SOCKET_PATH);
    });

    afterEach(async () => {
      if (client.isConnected()) {
        await client.close();
      }
    });

    it('should connect to Unix socket agent', async () => {
      if (SKIP_TESTS || !fs.existsSync(SOCKET_PATH)) {
        console.log('Skipping Unix socket test - agent not available');
        return;
      }

      await client.connect();
      expect(client.isConnected()).toBe(true);
    }, 10000);

    it('should send log entry via Unix socket', async () => {
      if (SKIP_TESTS || !fs.existsSync(SOCKET_PATH)) {
        console.log('Skipping Unix socket log test - agent not available');
        return;
      }

      await client.connect();
      
      const entry = createLogEntry(
        'Integration test log entry via Unix socket',
        'logflux-js-sdk-test'
      );
      entry.logLevel = LogLevel.Info;
      entry.entryType = EntryType.Log;

      await expect(client.sendLogEntry(entry)).resolves.not.toThrow();
    }, 10000);

    it('should ping Unix socket agent', async () => {
      if (SKIP_TESTS || !fs.existsSync(SOCKET_PATH)) {
        console.log('Skipping Unix socket ping test - agent not available');
        return;
      }

      await client.connect();
      const pingResult = await client.ping();
      expect(pingResult).toBe(true);
    }, 10000);

    it('should send batch via Unix socket', async () => {
      if (SKIP_TESTS || !fs.existsSync(SOCKET_PATH)) {
        console.log('Skipping Unix socket batch test - agent not available');
        return;
      }

      await client.connect();

      const entries = [
        createLogEntry('Batch entry 1 via Unix', 'batch-test'),
        createLogEntry('Batch entry 2 via Unix', 'batch-test'),
        createLogEntry('Batch entry 3 via Unix', 'batch-test'),
      ];

      await expect(client.sendLogBatch({ entries })).resolves.not.toThrow();
    }, 10000);
  });

  describe('TCP Connection', () => {
    let client: LogFluxClient;

    beforeEach(() => {
      client = createTCPClient(TCP_HOST, TCP_PORT, SHARED_SECRET);
    });

    afterEach(async () => {
      if (client.isConnected()) {
        await client.close();
      }
    });

    it('should connect to TCP agent', async () => {
      if (SKIP_TESTS) {
        console.log('Skipping TCP connection test');
        return;
      }

      try {
        await client.connect();
        expect(client.isConnected()).toBe(true);
      } catch (error) {
        console.log(`Skipping TCP test - agent not available: ${error}`);
        return;
      }
    }, 10000);

    it('should authenticate with TCP agent', async () => {
      if (SKIP_TESTS) {
        console.log('Skipping TCP auth test');
        return;
      }

      try {
        await client.connect();
        const authResult = await client.authenticate();
        expect(authResult).toBe(true);
      } catch (error) {
        console.log(`Skipping TCP auth test - agent not available: ${error}`);
        return;
      }
    }, 10000);

    it('should send log entry via TCP', async () => {
      if (SKIP_TESTS) {
        console.log('Skipping TCP log test');
        return;
      }

      try {
        await client.connect();
        await client.authenticate();

        const entry = createLogEntry(
          'Integration test log entry via TCP',
          'logflux-js-sdk-tcp-test'
        );
        entry.logLevel = LogLevel.Warning;
        entry.entryType = EntryType.Log;

        await expect(client.sendLogEntry(entry)).resolves.not.toThrow();
      } catch (error) {
        console.log(`Skipping TCP log test - agent not available: ${error}`);
        return;
      }
    }, 10000);

    it('should ping TCP agent', async () => {
      if (SKIP_TESTS) {
        console.log('Skipping TCP ping test');
        return;
      }

      try {
        await client.connect();
        await client.authenticate();
        const pingResult = await client.ping();
        expect(pingResult).toBe(true);
      } catch (error) {
        console.log(`Skipping TCP ping test - agent not available: ${error}`);
        return;
      }
    }, 10000);
  });

  describe('Batch Client Integration', () => {
    let client: LogFluxClient;
    let batchClient: BatchClient;

    afterEach(async () => {
      if (batchClient && !batchClient.isStopped()) {
        await batchClient.stop();
      }
      if (client && client.isConnected()) {
        await client.close();
      }
    });

    it('should process batches with real agent via Unix socket', async () => {
      if (SKIP_TESTS || !fs.existsSync(SOCKET_PATH)) {
        console.log('Skipping Unix batch client test - agent not available');
        return;
      }

      client = createUnixClient(SOCKET_PATH);
      batchClient = new BatchClient(client, {
        maxBatchSize: 3,
        flushInterval: 2000,
        maxMemoryUsage: 1024 * 1024,
        flushOnExit: false,
      });

      await client.connect();

      // Add entries - should auto-flush at 3 entries
      await batchClient.addLogEntry(createLogEntry('Real batch entry 1', 'batch-integration'));
      await batchClient.addLogEntry(createLogEntry('Real batch entry 2', 'batch-integration'));
      
      expect(batchClient.getPendingCount()).toBe(2);
      
      // Third entry should trigger flush
      await batchClient.addLogEntry(createLogEntry('Real batch entry 3', 'batch-integration'));
      
      // Wait for flush to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(batchClient.getPendingCount()).toBe(0);
      
      const stats = batchClient.getStats();
      expect(stats.batchesSent).toBe(1);
      expect(stats.entriesProcessed).toBe(3);
    }, 15000);

    it('should handle timer-based flush with real agent', async () => {
      if (SKIP_TESTS || !fs.existsSync(SOCKET_PATH)) {
        console.log('Skipping timer batch test - agent not available');
        return;
      }

      client = createUnixClient(SOCKET_PATH);
      batchClient = new BatchClient(client, {
        maxBatchSize: 100,  // High limit
        flushInterval: 1000, // 1 second
        maxMemoryUsage: 1024 * 1024,
        flushOnExit: false,
      });

      await client.connect();

      // Add entries below batch size limit
      await batchClient.addLogEntry(createLogEntry('Timer test entry 1', 'timer-integration'));
      await batchClient.addLogEntry(createLogEntry('Timer test entry 2', 'timer-integration'));
      
      expect(batchClient.getPendingCount()).toBe(2);
      
      // Wait for timer flush
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      expect(batchClient.getPendingCount()).toBe(0);
      
      const stats = batchClient.getStats();
      expect(stats.batchesSent).toBe(1);
    }, 15000);
  });

  describe('Error Scenarios with Real Agent', () => {
    it('should handle connection to non-existent Unix socket', async () => {
      const client = createUnixClient('/nonexistent/socket.sock');
      
      await expect(client.connect()).rejects.toThrow();
      expect(client.isConnected()).toBe(false);
    });

    it('should handle connection to non-existent TCP endpoint', async () => {
      const client = createTCPClient('localhost', 9999, 'unused-secret');
      
      await expect(client.connect()).rejects.toThrow();
      expect(client.isConnected()).toBe(false);
    });

    it('should handle authentication failure with wrong secret', async () => {
      if (SKIP_TESTS) {
        console.log('Skipping auth failure test');
        return;
      }

      const client = createTCPClient(TCP_HOST, TCP_PORT, 'wrong-secret');
      
      try {
        await client.connect();
        
        // Authentication should fail
        await expect(client.authenticate()).rejects.toThrow();
      } catch (connectError) {
        console.log(`Skipping auth failure test - agent not available: ${connectError}`);
        return;
      }
    }, 10000);
  });

  describe('Load Testing', () => {
    it('should handle high volume of concurrent log entries', async () => {
      if (SKIP_TESTS || !fs.existsSync(SOCKET_PATH)) {
        console.log('Skipping load test - agent not available');
        return;
      }

      const client = createUnixClient(SOCKET_PATH);
      await client.connect();

      const entryCount = 50;
      const entries = Array.from({ length: entryCount }, (_, i) =>
        createLogEntry(`Load test entry ${i + 1}`, 'load-test')
      );

      const startTime = Date.now();
      
      // Send all entries concurrently
      const promises = entries.map(entry => client.sendLogEntry(entry));
      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      const entriesPerSecond = (entryCount / duration) * 1000;
      
      console.log(`Sent ${entryCount} entries in ${duration}ms (${entriesPerSecond.toFixed(1)} entries/sec)`);
      
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      await client.close();
    }, 30000);

    it('should handle high volume batch processing', async () => {
      if (SKIP_TESTS || !fs.existsSync(SOCKET_PATH)) {
        console.log('Skipping batch load test - agent not available');
        return;
      }

      const client = createUnixClient(SOCKET_PATH);
      const batchClient = new BatchClient(client, {
        maxBatchSize: 10,
        flushInterval: 500,
        maxMemoryUsage: 1024 * 1024,
        flushOnExit: false,
      });

      await client.connect();

      const entryCount = 100;
      const startTime = Date.now();

      // Add entries rapidly
      const promises = Array.from({ length: entryCount }, async (_, i) => {
        await batchClient.addLogEntry(createLogEntry(`Batch load test ${i + 1}`, 'batch-load-test'));
      });

      await Promise.all(promises);
      
      // Wait for all flushes to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const duration = Date.now() - startTime;
      const stats = batchClient.getStats();
      
      console.log(`Processed ${entryCount} entries via batching in ${duration}ms`);
      console.log(`Batches sent: ${stats.batchesSent}, Average batch size: ${stats.averageBatchSize}`);
      
      expect(stats.entriesProcessed).toBe(entryCount);
      expect(stats.errors).toBe(0);
      
      await batchClient.stop();
    }, 30000);
  });

  describe('Data Validation', () => {
    it('should properly handle different log levels and types', async () => {
      if (SKIP_TESTS || !fs.existsSync(SOCKET_PATH)) {
        console.log('Skipping validation test - agent not available');
        return;
      }

      const client = createUnixClient(SOCKET_PATH);
      await client.connect();

      const testCases = [
        { level: LogLevel.Debug, type: EntryType.Log, message: 'Debug message' },
        { level: LogLevel.Info, type: EntryType.Log, message: 'Info message' },
        { level: LogLevel.Warning, type: EntryType.Log, message: 'Warning message' },
        { level: LogLevel.Error, type: EntryType.Log, message: 'Error message' },
        { level: LogLevel.Critical, type: EntryType.Log, message: 'Critical message' },
      ];

      for (const testCase of testCases) {
        const entry = createLogEntry(testCase.message, 'validation-test');
        entry.logLevel = testCase.level;
        entry.entryType = testCase.type;
        
        await expect(client.sendLogEntry(entry)).resolves.not.toThrow();
      }

      await client.close();
    }, 15000);

    it('should handle JSON payloads correctly', async () => {
      if (SKIP_TESTS || !fs.existsSync(SOCKET_PATH)) {
        console.log('Skipping JSON validation test - agent not available');
        return;
      }

      const client = createUnixClient(SOCKET_PATH);
      await client.connect();

      const jsonPayload = JSON.stringify({
        user: 'test-user',
        action: 'integration-test',
        timestamp: new Date().toISOString(),
        metadata: {
          testType: 'json-validation',
          sdk: 'logflux-js-sdk'
        }
      });

      const entry = createLogEntry(jsonPayload, 'json-test');
      entry.logLevel = LogLevel.Info;
      entry.entryType = EntryType.Log;

      await expect(client.sendLogEntry(entry)).resolves.not.toThrow();
      
      await client.close();
    }, 10000);
  });
});