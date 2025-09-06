import { LogFluxClient, createUnixClient, createTCPClient } from '../index';
import { createLogEntry, LogLevel } from '../../types';
import { NetworkType } from '../../config';

// Simple tests without complex mocking
describe('LogFluxClient (Simple Tests)', () => {
  describe('constructor and configuration', () => {
    it('should create client with default config', () => {
      const client = new LogFluxClient();
      const config = client.getConfig();
      
      expect(config.network).toBe(NetworkType.Unix);
      expect(config.address).toBe('/tmp/logflux-agent.sock');
      expect(config.timeout).toBe(2000);
    });

    it('should create client with custom config', () => {
      const customConfig = {
        network: NetworkType.TCP,
        address: 'localhost:8080',
        timeout: 3000,
        sharedSecret: 'test-secret',
        batchSize: 20,
        flushInterval: 2000,
        maxRetries: 5,
        retryDelay: 500,
      };

      const client = new LogFluxClient(customConfig);
      const config = client.getConfig();
      
      expect(config).toEqual(customConfig);
    });

    it('should validate config on creation', () => {
      const invalidConfig = {
        network: NetworkType.Unix,
        address: '',
        timeout: 5000,
        batchSize: 10,
        flushInterval: 1000,
        maxRetries: 3,
        retryDelay: 1000,
      };

      expect(() => new LogFluxClient(invalidConfig)).toThrow('address is required');
    });

    it('should return connection status', () => {
      const client = new LogFluxClient();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('factory functions', () => {
    it('should create Unix client with default path', () => {
      const client = createUnixClient();
      const config = client.getConfig();
      
      expect(config.network).toBe(NetworkType.Unix);
      expect(config.address).toBe('/tmp/logflux-agent.sock');
    });

    it('should create Unix client with custom path', () => {
      const client = createUnixClient('/custom/path.sock');
      const config = client.getConfig();
      
      expect(config.network).toBe(NetworkType.Unix);
      expect(config.address).toBe('/custom/path.sock');
    });

    it('should create TCP client', () => {
      const client = createTCPClient('localhost', 9999, 'secret');
      const config = client.getConfig();
      
      expect(config.network).toBe(NetworkType.TCP);
      expect(config.address).toBe('localhost:9999');
      expect(config.sharedSecret).toBe('secret');
    });

    it('should create TCP client without secret', () => {
      const client = createTCPClient('localhost', 9999);
      const config = client.getConfig();
      
      expect(config.network).toBe(NetworkType.TCP);
      expect(config.address).toBe('localhost:9999');
      expect(config.sharedSecret).toBeUndefined();
    });
  });

  describe('data validation', () => {
    let client: LogFluxClient;

    beforeEach(() => {
      client = createUnixClient();
    });

    it('should validate log batch size limits', async () => {
      const entries = Array(101).fill(null).map((_, i) => 
        createLogEntry(`message ${i}`, 'test-source')
      );
      const batch = { entries, version: '1.0' };

      // This should fail because we're not connected, but should validate batch first
      await expect(client.sendLogBatch(batch)).rejects.toThrow('batch cannot contain more than 100 entries');
    });

    it('should validate empty batch', async () => {
      const batch = { entries: [], version: '1.0' };

      await expect(client.sendLogBatch(batch)).rejects.toThrow('batch must contain at least one entry');
    });
  });

  describe('authentication logic', () => {
    it('should return true for Unix authentication', async () => {
      const client = createUnixClient();
      const result = await client.authenticate();
      expect(result).toBe(true);
    });

    it('should require shared secret for TCP authentication', async () => {
      const client = createTCPClient('localhost', 8080); // No secret

      await expect(client.authenticate()).rejects.toThrow('shared secret is required for TCP authentication');
    });
  });

  describe('configuration edge cases', () => {
    it('should handle invalid timeout', () => {
      expect(() => {
        new LogFluxClient({
          network: NetworkType.Unix,
          address: '/tmp/test.sock',
          timeout: 0,
          batchSize: 10,
          flushInterval: 1000,
          maxRetries: 3,
          retryDelay: 1000,
        });
      }).toThrow('timeout must be positive');
    });

    it('should handle invalid batch size', () => {
      expect(() => {
        new LogFluxClient({
          network: NetworkType.Unix,
          address: '/tmp/test.sock',
          timeout: 5000,
          batchSize: 0,
          flushInterval: 1000,
          maxRetries: 3,
          retryDelay: 1000,
        });
      }).toThrow('batchSize must be between');
    });

    it('should warn about TCP without shared secret', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      new LogFluxClient({
        network: NetworkType.TCP,
        address: 'localhost:8080',
        timeout: 5000,
        batchSize: 10,
        flushInterval: 1000,
        maxRetries: 3,
        retryDelay: 1000,
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('TCP connection without shared secret may fail authentication');
      consoleSpy.mockRestore();
    });
  });

  describe('close behavior', () => {
    it('should handle close when not connected', async () => {
      const client = createUnixClient();
      
      // Should not throw
      await expect(client.close()).resolves.toBeUndefined();
      expect(client.isConnected()).toBe(false);
    });
  });
});