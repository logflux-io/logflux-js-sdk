import { LogFluxClient, createUnixClient, createTCPClient } from '../index';
import { createLogEntry } from '../../types';
import { NetworkType } from '../../config';
import * as fs from 'fs';
import * as net from 'net';

jest.mock('fs');
jest.mock('net');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockNet = net as jest.Mocked<typeof net>;

describe('LogFluxClient Connection Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Unix Socket Connection', () => {
    it('should reject connection when socket file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const client = createUnixClient('/nonexistent/socket.sock');
      
      await expect(client.connect()).rejects.toThrow('Unix socket not found: /nonexistent/socket.sock');
    });

    it('should handle connection timeout', async () => {
      mockFs.existsSync.mockReturnValue(true);
      
      const mockSocket = {
        on: jest.fn(),
        destroy: jest.fn(),
      } as any;
      
      mockNet.createConnection.mockReturnValue(mockSocket);
      
      const client = createUnixClient('/tmp/test.sock');
      
      // Simulate timeout by not calling connect handler
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          // Don't call handler to simulate timeout
        }
      });
      
      const connectPromise = client.connect();
      
      // Fast-forward timers to trigger timeout
      setTimeout(() => {
        const errorHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
        if (errorHandler) {
          errorHandler(new Error('Connection timeout'));
        }
      }, 0);
      
      await expect(connectPromise).rejects.toThrow();
    });

    it('should handle connection error', async () => {
      mockFs.existsSync.mockReturnValue(true);
      
      const mockSocket = {
        on: jest.fn(),
        destroy: jest.fn(),
      } as any;
      
      mockNet.createConnection.mockReturnValue(mockSocket);
      
      const client = createUnixClient('/tmp/test.sock');
      
      // Simulate connection error
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          setTimeout(() => handler(new Error('Connection failed')), 0);
        }
      });
      
      await expect(client.connect()).rejects.toThrow('Connection failed');
    });

    it('should successfully connect to Unix socket', async () => {
      mockFs.existsSync.mockReturnValue(true);
      
      const mockSocket = {
        on: jest.fn(),
        destroy: jest.fn(),
      } as any;
      
      mockNet.createConnection.mockReturnValue(mockSocket);
      
      const client = createUnixClient('/tmp/test.sock');
      
      // Simulate successful connection
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });
      
      await expect(client.connect()).resolves.toBeUndefined();
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('TCP Connection', () => {
    it('should reject invalid TCP address format (missing port)', async () => {
      const client = new LogFluxClient({
        network: NetworkType.TCP,
        address: 'localhost', // Missing port
        timeout: 5000,
        batchSize: 10,
        flushInterval: 1000,
        maxRetries: 3,
        retryDelay: 1000,
      });
      
      await expect(client.connect()).rejects.toThrow('Invalid TCP address format: localhost');
    });

    it('should reject invalid TCP address format (missing host)', async () => {
      const client = new LogFluxClient({
        network: NetworkType.TCP,
        address: ':8080', // Missing host
        timeout: 5000,
        batchSize: 10,
        flushInterval: 1000,
        maxRetries: 3,
        retryDelay: 1000,
      });
      
      await expect(client.connect()).rejects.toThrow('Invalid TCP address format: :8080');
    });

    it('should handle TCP connection timeout', async () => {
      const mockSocket = {
        on: jest.fn(),
        destroy: jest.fn(),
      } as any;
      
      mockNet.createConnection.mockReturnValue(mockSocket);
      
      const client = createTCPClient('localhost', 8080);
      
      // Simulate timeout by not calling connect handler
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          // Don't call handler to simulate timeout
        }
      });
      
      const connectPromise = client.connect();
      
      // Fast-forward to trigger timeout
      setTimeout(() => {
        const errorHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
        if (errorHandler) {
          errorHandler(new Error('Connection timeout'));
        }
      }, 0);
      
      await expect(connectPromise).rejects.toThrow();
    });

    it('should successfully connect to TCP', async () => {
      const mockSocket = {
        on: jest.fn(),
        destroy: jest.fn(),
      } as any;
      
      mockNet.createConnection.mockReturnValue(mockSocket);
      
      const client = createTCPClient('localhost', 8080);
      
      // Simulate successful connection
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'connect') {
          setTimeout(() => handler(), 0);
        }
      });
      
      await expect(client.connect()).resolves.toBeUndefined();
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('Data Sending', () => {
    it('should handle send timeout', async () => {
      const mockSocket = {
        on: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
      } as any;
      
      const client = createUnixClient('/tmp/test.sock');
      (client as any).connected = true;
      (client as any).socket = mockSocket;
      
      // Simulate write timeout by never calling callback
      mockSocket.write.mockImplementation((data: string, callback: Function) => {
        // Don't call callback to simulate timeout
      });
      
      const entry = createLogEntry('test', 'source');
      await expect(client.sendLogEntry(entry)).rejects.toThrow('Send timeout');
    });

    it('should handle write error', async () => {
      const mockSocket = {
        on: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
      } as any;
      
      const client = createUnixClient('/tmp/test.sock');
      (client as any).connected = true;
      (client as any).socket = mockSocket;
      
      // Simulate write error
      mockSocket.write.mockImplementation((data: string, callback: Function) => {
        setTimeout(() => callback(new Error('Write failed')), 0);
      });
      
      const entry = createLogEntry('test', 'source');
      await expect(client.sendLogEntry(entry)).rejects.toThrow('Write failed');
    });

    it('should handle socket being undefined during write', async () => {
      const client = createUnixClient('/tmp/test.sock');
      (client as any).connected = true;
      (client as any).socket = {
        write: jest.fn()
      };
      
      const entry = createLogEntry('test', 'source');
      
      // Set socket to undefined after initial check
      const originalSendSocket = (client as any).sendSocket;
      (client as any).sendSocket = jest.fn(async (data: string) => {
        (client as any).socket = undefined;
        return originalSendSocket.call(client, data);
      });
      
      await expect(client.sendLogEntry(entry)).rejects.toThrow('No socket connection');
    });
  });

  describe('Response Reading', () => {
    it('should handle read timeout', async () => {
      const mockSocket = {
        on: jest.fn(),
        once: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
      } as any;
      
      const client = createUnixClient('/tmp/test.sock');
      (client as any).connected = true;
      (client as any).socket = mockSocket;
      
      // Mock successful write
      mockSocket.write.mockImplementation((data: string, callback: Function) => {
        setTimeout(() => callback(), 0);
      });
      
      // Simulate read timeout by never calling data handler
      mockSocket.once.mockImplementation((event: string, handler: Function) => {
        // Don't call handler to simulate timeout
      });
      
      const result = await client.ping();
      expect(result).toBe(false);
    });

    it('should handle invalid JSON response', async () => {
      const mockSocket = {
        on: jest.fn(),
        once: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
      } as any;
      
      const client = createUnixClient('/tmp/test.sock');
      (client as any).connected = true;
      (client as any).socket = mockSocket;
      
      // Mock successful write
      mockSocket.write.mockImplementation((data: string, callback: Function) => {
        setTimeout(() => callback(), 0);
      });
      
      // Simulate invalid JSON response
      mockSocket.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') {
          setTimeout(() => handler(Buffer.from('invalid json')), 0);
        }
      });
      
      const result = await client.ping();
      expect(result).toBe(false);
    });

    it('should handle socket being undefined during read', async () => {
      const client = createUnixClient('/tmp/test.sock');
      (client as any).connected = true;
      (client as any).socket = {
        write: jest.fn((data: string, callback: Function) => callback()),
        once: jest.fn()
      };
      
      // Override readResponse to set socket to undefined
      const originalReadResponse = (client as any).readResponse;
      (client as any).readResponse = jest.fn(async () => {
        (client as any).socket = undefined;
        return originalReadResponse.call(client);
      });
      
      const result = await client.ping();
      expect(result).toBe(false);
    });
  });

  describe('Authentication', () => {
    it('should handle authentication success', async () => {
      const mockSocket = {
        on: jest.fn(),
        once: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
      } as any;
      
      const client = createTCPClient('localhost', 8080, 'test-secret');
      (client as any).connected = true;
      (client as any).socket = mockSocket;
      
      // Mock successful write
      mockSocket.write.mockImplementation((data: string, callback: Function) => {
        setTimeout(() => callback(), 0);
      });
      
      // Mock successful auth response
      mockSocket.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') {
          setTimeout(() => handler(Buffer.from('{"status":"success"}')), 0);
        }
      });
      
      const result = await client.authenticate();
      expect(result).toBe(true);
    });

    it('should handle authentication failure', async () => {
      const mockSocket = {
        on: jest.fn(),
        once: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
      } as any;
      
      const client = createTCPClient('localhost', 8080, 'wrong-secret');
      (client as any).connected = true;
      (client as any).socket = mockSocket;
      
      // Mock successful write
      mockSocket.write.mockImplementation((data: string, callback: Function) => {
        setTimeout(() => callback(), 0);
      });
      
      // Mock auth failure response
      mockSocket.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') {
          setTimeout(() => handler(Buffer.from('{"status":"error"}')), 0);
        }
      });
      
      const result = await client.authenticate();
      expect(result).toBe(false);
    });

    it('should handle authentication error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const client = createTCPClient('localhost', 8080, 'test-secret');
      (client as any).connected = true;
      (client as any).socket = {
        write: jest.fn((data: string, callback: Function) => {
          setTimeout(() => callback(new Error('Send failed')), 0);
        })
      };
      
      const result = await client.authenticate();
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Authentication failed:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});