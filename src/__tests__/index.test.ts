import * as LogFluxSDK from '../index';

describe('LogFlux SDK Exports', () => {
  it('should export VERSION constant', () => {
    expect(LogFluxSDK.VERSION).toBe('0.1.0-beta');
    expect(typeof LogFluxSDK.VERSION).toBe('string');
  });

  it('should export types', () => {
    // Test key type exports
    expect(LogFluxSDK.LogLevel).toBeDefined();
    expect(LogFluxSDK.EntryType).toBeDefined();
    expect(LogFluxSDK.createLogEntry).toBeDefined();
  });

  it('should export configuration', () => {
    // Test config exports
    expect(LogFluxSDK.NetworkType).toBeDefined();
    expect(LogFluxSDK.createDefaultConfig).toBeDefined();
    expect(LogFluxSDK.validateConfig).toBeDefined();
  });

  it('should export client classes', () => {
    // Test client exports
    expect(LogFluxSDK.LogFluxClient).toBeDefined();
    expect(LogFluxSDK.createUnixClient).toBeDefined();
    expect(LogFluxSDK.createTCPClient).toBeDefined();
  });

  it('should export batch client', () => {
    // Test batch client exports
    expect(LogFluxSDK.BatchClient).toBeDefined();
    expect(LogFluxSDK.createBatchClient).toBeDefined();
  });
});