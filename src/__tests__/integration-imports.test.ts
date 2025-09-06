import {
  // Debug integration
  attachDebugToLogFlux,
  createLogFluxDebug,
  detachDebugFromLogFlux,

  // Log4js integration  
  LogFluxAppender,
  registerLogFluxAppender,
  createLog4jsConfig,

  // Consola integration
  LogFluxReporter,
  createLogFluxReporter,
  addLogFluxReporter,
  createLogFluxConsola,
  ConsolaLevels,

  // Loglevel integration
  attachLoglevelToLogFlux,
  createLogFluxLoglevel,
  setupLoglevelWithLogFlux,
  detachLoglevelFromLogFlux,
  LoglevelLevels
} from '../integrations';

describe('Integration Imports', () => {
  test('should import Debug integration functions', () => {
    expect(typeof attachDebugToLogFlux).toBe('function');
    expect(typeof createLogFluxDebug).toBe('function');  
    expect(typeof detachDebugFromLogFlux).toBe('function');
  });

  test('should import Log4js integration classes and functions', () => {
    expect(typeof LogFluxAppender).toBe('function'); // constructor
    expect(typeof registerLogFluxAppender).toBe('function');
    expect(typeof createLog4jsConfig).toBe('function');
  });

  test('should import Consola integration classes and functions', () => {
    expect(typeof LogFluxReporter).toBe('function'); // constructor
    expect(typeof createLogFluxReporter).toBe('function');
    expect(typeof addLogFluxReporter).toBe('function');
    expect(typeof createLogFluxConsola).toBe('function');
    expect(typeof ConsolaLevels).toBe('object');
    expect(ConsolaLevels.silent).toBe(0);
    expect(ConsolaLevels.fatal).toBe(1);
    expect(ConsolaLevels.error).toBe(2);
    expect(ConsolaLevels.warn).toBe(3);
    expect(ConsolaLevels.info).toBe(4);
    expect(ConsolaLevels.debug).toBe(5);
    expect(ConsolaLevels.trace).toBe(6);
  });

  test('should import Loglevel integration functions', () => {
    expect(typeof attachLoglevelToLogFlux).toBe('function');
    expect(typeof createLogFluxLoglevel).toBe('function');
    expect(typeof setupLoglevelWithLogFlux).toBe('function');
    expect(typeof detachLoglevelFromLogFlux).toBe('function');
    expect(typeof LoglevelLevels).toBe('object');
    expect(LoglevelLevels.TRACE).toBe(0);
    expect(LoglevelLevels.DEBUG).toBe(1);
    expect(LoglevelLevels.INFO).toBe(2);
    expect(LoglevelLevels.WARN).toBe(3);
    expect(LoglevelLevels.ERROR).toBe(4);
    expect(LoglevelLevels.SILENT).toBe(5);
  });
});