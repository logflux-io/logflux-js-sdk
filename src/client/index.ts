import { LogEntry, LogBatch, PingRequest, AuthRequest, createPingRequest, createAuthRequest } from '../types';
import { Config, NetworkType, createDefaultConfig, validateConfig } from '../config';
import * as net from 'net';
import * as fs from 'fs';

/**
 * Client is a lightweight client for communicating with LogFlux agent local server.
 * It supports Unix socket and TCP connections with automatic retry logic.
 */
export class LogFluxClient {
  private config: Config;
  private socket?: net.Socket;
  private connected: boolean = false;

  /**
   * Creates a new SDK client with the given configuration.
   * If config is null, uses default configuration with Unix socket transport.
   */
  constructor(config?: Config) {
    this.config = config ?? createDefaultConfig();
    validateConfig(this.config);
  }

  /**
   * Connects to the LogFlux agent
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    switch (this.config.network) {
      case NetworkType.Unix:
        await this.connectUnix();
        break;
      case NetworkType.TCP:
        await this.connectTCP();
        break;
      default:
        throw new Error(`unsupported network type: ${this.config.network}`);
    }

    this.connected = true;
  }

  /**
   * Disconnects from the LogFlux agent
   */
  async close(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = undefined;
    }
    this.connected = false;
  }

  /**
   * Sends a single log entry to the agent
   */
  async sendLogEntry(entry: LogEntry): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    await this.sendData(entry);
  }

  /**
   * Sends a batch of log entries to the agent
   */
  async sendLogBatch(batch: LogBatch): Promise<void> {
    // Validate batch before attempting connection
    if (!batch.entries || batch.entries.length === 0) {
      throw new Error('batch must contain at least one entry');
    }

    if (batch.entries.length > 100) {
      throw new Error('batch cannot contain more than 100 entries');
    }

    if (!this.connected) {
      await this.connect();
    }

    await this.sendData(batch);
  }

  /**
   * Sends a ping request to check agent health
   */
  async ping(): Promise<boolean> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const pingRequest = createPingRequest();
      await this.sendData(pingRequest);


      // For socket connections, read the pong response
      const response = await this.readResponse();
      return Boolean(response && response.status === 'pong');
    } catch {
      return false;
    }
  }

  /**
   * Authenticates with the agent (TCP connections only)
   */
  async authenticate(): Promise<boolean> {
    if (this.config.network !== NetworkType.TCP) {
      return true; // No authentication needed for Unix sockets
    }

    if (!this.config.sharedSecret) {
      throw new Error('shared secret is required for TCP authentication');
    }

    if (!this.connected) {
      await this.connect();
    }

    try {
      const authRequest = createAuthRequest(this.config.sharedSecret);
      await this.sendData(authRequest);

      const response = await this.readResponse();
      return Boolean(response && response.status === 'success');
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  private async connectUnix(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if socket file exists
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(this.config.address)) {
        reject(new Error(`Unix socket not found: ${this.config.address}`));
        return;
      }

      this.socket = net.createConnection(this.config.address);

      const timeout = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error('Connection timeout'));
      }, this.config.timeout);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async connectTCP(): Promise<void> {
    return new Promise((resolve, reject) => {
      const [host, portStr] = this.config.address.split(':');
      const port = parseInt(portStr, 10);

      if (!host || !port) {
        reject(new Error(`Invalid TCP address format: ${this.config.address}`));
        return;
      }

      this.socket = net.createConnection(port, host);

      const timeout = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error('Connection timeout'));
      }, this.config.timeout);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }


  private async sendData(data: LogEntry | LogBatch | PingRequest | AuthRequest): Promise<void> {
    const jsonData = JSON.stringify(data);

    switch (this.config.network) {
      case NetworkType.Unix:
      case NetworkType.TCP:
        await this.sendSocket(jsonData);
        break;
      default:
        throw new Error(`unsupported network type: ${this.config.network}`);
    }
  }

  private async sendSocket(data: string): Promise<void> {
    if (!this.socket) {
      throw new Error('No socket connection');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Send timeout'));
      }, this.config.timeout);

      if (!this.socket) {
        reject(new Error('No socket connection'));
        return;
      }

      this.socket.write(`${data}\n`, (error) => {
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }


  private async readResponse(): Promise<{ status?: string } | null> {
    if (!this.socket) {
      throw new Error('No socket connection');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Read timeout'));
      }, this.config.timeout);

      // Socket is already checked above, but TypeScript needs this for type safety
      if (!this.socket) {
        reject(new Error('No socket connection'));
        return;
      }

      this.socket.once('data', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString().trim());
          resolve(response);
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
  }

  /**
   * Gets the current configuration
   */
  getConfig(): Config {
    return { ...this.config };
  }

  /**
   * Checks if the client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Creates a new client with Unix socket configuration
 */
export function createUnixClient(socketPath?: string): LogFluxClient {
  return new LogFluxClient({
    ...createDefaultConfig(),
    network: NetworkType.Unix,
    address: socketPath ?? '/tmp/logflux-agent.sock',
  });
}

/**
 * Creates a new client with TCP configuration
 */
export function createTCPClient(host: string, port: number, sharedSecret?: string): LogFluxClient {
  return new LogFluxClient({
    ...createDefaultConfig(),
    network: NetworkType.TCP,
    address: `${host}:${port}`,
    sharedSecret,
  });
}

