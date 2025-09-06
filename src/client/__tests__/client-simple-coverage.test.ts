import { LogFluxClient, createUnixClient, createTCPClient } from '../index';
import { createLogEntry } from '../../types';
import { NetworkType } from '../../config';

describe('LogFluxClient (Coverage Tests)', () => {
  describe('batch validation edge cases', () => {
    it('should reject batch with more than 100 entries', async () => {
      const client = createUnixClient('/tmp/test.sock');
      
      // Set client as connected to skip connection logic
      (client as any).connected = true;
      (client as any).socket = { write: jest.fn() };
      
      const entries = Array(101).fill(null).map((_, i) => 
        createLogEntry(`message ${i}`, 'test-source')
      );
      const batch = { entries };

      await expect(client.sendLogBatch(batch)).rejects.toThrow('batch cannot contain more than 100 entries');
    });

    it('should reject empty batch', async () => {
      const client = createUnixClient('/tmp/test.sock');
      
      // Set client as connected to skip connection logic
      (client as any).connected = true;
      (client as any).socket = { write: jest.fn() };
      
      const batch = { entries: [] };

      await expect(client.sendLogBatch(batch)).rejects.toThrow('batch must contain at least one entry');
    });

    it('should reject batch with undefined entries', async () => {
      const client = createUnixClient('/tmp/test.sock');
      
      // Set client as connected to skip connection logic
      (client as any).connected = true;
      (client as any).socket = { write: jest.fn() };
      
      const batch = { entries: undefined as any };

      await expect(client.sendLogBatch(batch)).rejects.toThrow('batch must contain at least one entry');
    });
  });

  describe('configuration validation', () => {
    it('should handle invalid network type in sendData', async () => {
      const client = new LogFluxClient({
        network: 999 as any, // Invalid network type
        address: '/tmp/test.sock',
        timeout: 5000,
        batchSize: 10,
        flushInterval: 1000,
        maxRetries: 3,
        retryDelay: 1000,
      });

      // Manually set connected to bypass connection logic
      (client as any).connected = true;

      const entry = createLogEntry('test', 'source');
      await expect(client.sendLogEntry(entry)).rejects.toThrow('unsupported network type: 999');
    });

    it('should handle invalid network type in connect', async () => {
      const client = new LogFluxClient({
        network: 'invalid' as any,
        address: '/tmp/test.sock',
        timeout: 5000,
        batchSize: 10,
        flushInterval: 1000,
        maxRetries: 3,
        retryDelay: 1000,
      });

      await expect(client.connect()).rejects.toThrow('unsupported network type: invalid');
    });
  });

  describe('connection state management', () => {
    it('should skip connection if already connected', () => {
      const client = createUnixClient('/tmp/test.sock');
      
      // Manually set connected to true
      (client as any).connected = true;
      
      // Connection attempt should resolve immediately
      expect(client.connect()).resolves.toBeUndefined();
    });

    it('should handle close when socket exists', () => {
      const client = createUnixClient('/tmp/test.sock');
      
      // Create a mock socket
      const mockSocket = {
        destroy: jest.fn(),
      };
      
      (client as any).socket = mockSocket;
      (client as any).connected = true;
      
      client.close();
      
      expect(mockSocket.destroy).toHaveBeenCalled();
      expect(client.isConnected()).toBe(false);
    });

    it('should handle close when not connected', () => {
      const client = createUnixClient('/tmp/test.sock');
      
      expect(client.isConnected()).toBe(false);
      
      // Should not throw
      expect(() => client.close()).not.toThrow();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('authentication logic', () => {
    it('should return true for Unix socket authentication', async () => {
      const client = createUnixClient('/tmp/test.sock');
      
      // Unix sockets don't need authentication
      const result = await client.authenticate();
      expect(result).toBe(true);
    });

    it('should require shared secret for TCP authentication', async () => {
      const client = createTCPClient('localhost', 8080); // No shared secret
      
      await expect(client.authenticate()).rejects.toThrow('shared secret is required for TCP authentication');
    });
  });

  describe('factory functions', () => {
    it('should create Unix client with default socket path', () => {
      const client = createUnixClient();
      const config = client.getConfig();
      
      expect(config.network).toBe(NetworkType.Unix);
      expect(config.address).toBe('/tmp/logflux-agent.sock');
    });

    it('should create Unix client with custom socket path', () => {
      const customPath = '/custom/path.sock';
      const client = createUnixClient(customPath);
      const config = client.getConfig();
      
      expect(config.network).toBe(NetworkType.Unix);
      expect(config.address).toBe(customPath);
    });

    it('should create TCP client with shared secret', () => {
      const client = createTCPClient('localhost', 9999, 'test-secret');
      const config = client.getConfig();
      
      expect(config.network).toBe(NetworkType.TCP);
      expect(config.address).toBe('localhost:9999');
      expect(config.sharedSecret).toBe('test-secret');
    });

    it('should create TCP client without shared secret', () => {
      const client = createTCPClient('localhost', 9999);
      const config = client.getConfig();
      
      expect(config.network).toBe(NetworkType.TCP);
      expect(config.address).toBe('localhost:9999');
      expect(config.sharedSecret).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should throw error when trying to send data without socket', async () => {
      const client = createUnixClient('/tmp/test.sock');
      
      // Set connected but no socket
      (client as any).connected = true;
      (client as any).socket = undefined;
      
      const entry = createLogEntry('test', 'source');
      await expect(client.sendLogEntry(entry)).rejects.toThrow('No socket connection');
    });

    it('should throw error when trying to read response without socket', async () => {
      const client = createUnixClient('/tmp/test.sock');
      
      // Set connected but no socket
      (client as any).connected = true;
      (client as any).socket = undefined;
      
      const result = await client.ping();
      expect(result).toBe(false); // Ping should return false on error
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      const client = createUnixClient('/tmp/test.sock');
      
      const config1 = client.getConfig();
      const config2 = client.getConfig();
      
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Should be different objects
    });
  });
});