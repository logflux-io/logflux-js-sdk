// Jest setup file
// This file is run before each test suite

// Set up any global test configuration here
global.console = {
  ...console,
  // Suppress console.warn and console.error during tests unless explicitly needed
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};

// Dummy test to prevent Jest error
describe('Setup', () => {
  it('should set up test environment', () => {
    expect(true).toBe(true);
  });
});