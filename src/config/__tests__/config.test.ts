import {
  createDefaultConfig,
  createDefaultBatchConfig,
  createTCPConfig,
  validateConfig,
  validateBatchConfig,
  NetworkType,
  MIN_BATCH_SIZE,
  MAX_BATCH_SIZE
} from '../index';

describe('Config', () => {
  describe('createDefaultConfig', () => {
    it('should create default configuration', () => {
      const config = createDefaultConfig();
      
      expect(config.network).toBe(NetworkType.Unix);
      expect(config.address).toBe('/tmp/logflux-agent.sock');
      expect(config.timeout).toBe(2000);
      expect(config.batchSize).toBe(10);
      expect(config.flushInterval).toBe(1000);
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelay).toBe(1000);
    });
  });

  describe('createDefaultBatchConfig', () => {
    it('should create default batch configuration', () => {
      const config = createDefaultBatchConfig();
      
      expect(config.maxBatchSize).toBe(MAX_BATCH_SIZE);
      expect(config.flushInterval).toBe(1000);
      expect(config.maxMemoryUsage).toBe(512 * 1024);
      expect(config.flushOnExit).toBe(true);
    });
  });

  describe('createTCPConfig', () => {
    it('should create TCP configuration', () => {
      const config = createTCPConfig('localhost', 8080, 'secret');
      
      expect(config.network).toBe(NetworkType.TCP);
      expect(config.address).toBe('localhost:8080');
      expect(config.sharedSecret).toBe('secret');
    });

    it('should create TCP configuration without secret', () => {
      const config = createTCPConfig('localhost', 8080);
      
      expect(config.network).toBe(NetworkType.TCP);
      expect(config.address).toBe('localhost:8080');
      expect(config.sharedSecret).toBeUndefined();
    });
  });


  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const config = createDefaultConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw error for missing address', () => {
      const config = { ...createDefaultConfig(), address: '' };
      expect(() => validateConfig(config)).toThrow('address is required');
    });

    it('should throw error for invalid timeout', () => {
      const config = { ...createDefaultConfig(), timeout: -1 };
      expect(() => validateConfig(config)).toThrow('timeout must be positive');
    });

    it('should throw error for invalid batch size', () => {
      const config = { ...createDefaultConfig(), batchSize: 0 };
      expect(() => validateConfig(config)).toThrow('batchSize must be between');
      
      const config2 = { ...createDefaultConfig(), batchSize: 101 };
      expect(() => validateConfig(config2)).toThrow('batchSize must be between');
    });

    it('should throw error for invalid flush interval', () => {
      const config = { ...createDefaultConfig(), flushInterval: 0 };
      expect(() => validateConfig(config)).toThrow('flushInterval must be positive');
    });

    it('should throw error for negative max retries', () => {
      const config = { ...createDefaultConfig(), maxRetries: -1 };
      expect(() => validateConfig(config)).toThrow('maxRetries must be non-negative');
    });

    it('should throw error for negative retry delay', () => {
      const config = { ...createDefaultConfig(), retryDelay: -1 };
      expect(() => validateConfig(config)).toThrow('retryDelay must be non-negative');
    });

    it('should warn for TCP without shared secret', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const config = { ...createDefaultConfig(), network: NetworkType.TCP };
      
      validateConfig(config);
      expect(consoleSpy).toHaveBeenCalledWith('TCP connection without shared secret may fail authentication');
      
      consoleSpy.mockRestore();
    });
  });

  describe('validateBatchConfig', () => {
    it('should validate valid batch configuration', () => {
      const config = createDefaultBatchConfig();
      expect(() => validateBatchConfig(config)).not.toThrow();
    });

    it('should throw error for invalid max batch size', () => {
      const config = { ...createDefaultBatchConfig(), maxBatchSize: 0 };
      expect(() => validateBatchConfig(config)).toThrow('maxBatchSize must be between');
    });

    it('should throw error for invalid flush interval', () => {
      const config = { ...createDefaultBatchConfig(), flushInterval: -1 };
      expect(() => validateBatchConfig(config)).toThrow('flushInterval must be positive');
    });

    it('should throw error for invalid memory usage', () => {
      const config = { ...createDefaultBatchConfig(), maxMemoryUsage: 0 };
      expect(() => validateBatchConfig(config)).toThrow('maxMemoryUsage must be positive');
    });
  });
});