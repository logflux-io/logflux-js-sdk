import { validateApiKey, loadOptionsFromEnv } from '../options';

describe('validateApiKey', () => {
  test('valid eu key', () => {
    expect(() => validateApiKey('eu-lf_abc123')).not.toThrow();
  });

  test('valid us key', () => {
    expect(() => validateApiKey('us-lf_xyz789')).not.toThrow();
  });

  test('all valid regions', () => {
    for (const region of ['eu', 'us', 'ca', 'au', 'ap']) {
      expect(() => validateApiKey(`${region}-lf_test123`)).not.toThrow();
    }
  });

  test('rejects key without dash', () => {
    expect(() => validateApiKey('eulf_abc123')).toThrow('must be <region>-lf_<key>');
  });

  test('rejects invalid region', () => {
    expect(() => validateApiKey('xx-lf_abc123')).toThrow('Invalid API key region');
  });

  test('rejects key without lf_ prefix', () => {
    expect(() => validateApiKey('eu-xx_abc123')).toThrow('key must start with lf_');
  });

  test('rejects empty key body', () => {
    expect(() => validateApiKey('eu-lf_')).toThrow('key body is empty');
  });
});

describe('loadOptionsFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('loads required API key', () => {
    process.env.LOGFLUX_API_KEY = 'eu-lf_test123';
    const opts = loadOptionsFromEnv('test-node');
    expect(opts.apiKey).toBe('eu-lf_test123');
    expect(opts.node).toBe('test-node');
  });

  test('throws without API key', () => {
    delete process.env.LOGFLUX_API_KEY;
    expect(() => loadOptionsFromEnv()).toThrow('LOGFLUX_API_KEY environment variable is required');
  });

  test('loads optional environment vars', () => {
    process.env.LOGFLUX_API_KEY = 'eu-lf_test123';
    process.env.LOGFLUX_ENVIRONMENT = 'production';
    process.env.LOGFLUX_LOG_GROUP = 'my-group';
    process.env.LOGFLUX_QUEUE_SIZE = '500';
    process.env.LOGFLUX_BATCH_SIZE = '50';
    process.env.LOGFLUX_FLUSH_INTERVAL = '10';
    process.env.LOGFLUX_HTTP_TIMEOUT = '60';
    process.env.LOGFLUX_DEBUG = 'true';

    const opts = loadOptionsFromEnv();
    expect(opts.environment).toBe('production');
    expect(opts.logGroup).toBe('my-group');
    expect(opts.queueSize).toBe(500);
    expect(opts.batchSize).toBe(50);
    expect(opts.flushIntervalMs).toBe(10000);
    expect(opts.httpTimeoutMs).toBe(60000);
    expect(opts.debug).toBe(true);
  });

  test('defaults failsafe and compression to true', () => {
    process.env.LOGFLUX_API_KEY = 'eu-lf_test123';
    const opts = loadOptionsFromEnv();
    expect(opts.failsafe).toBe(true);
    expect(opts.enableCompression).toBe(true);
  });
});
