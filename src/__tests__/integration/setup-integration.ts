/**
 * Setup for integration tests against real LogFlux agent
 */

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global setup logging
beforeAll(() => {
  console.log('Starting LogFlux JavaScript SDK Integration Tests');
  console.log('Test Configuration:');
  console.log(`   Socket Path: ${process.env.LOGFLUX_SOCKET_PATH ?? '/tmp/logflux-agent.sock'}`);
  console.log(`   TCP Endpoint: ${process.env.LOGFLUX_TCP_HOST ?? 'localhost'}:${process.env.LOGFLUX_TCP_PORT ?? '8080'}`);
  console.log(`   Shared Secret: ${process.env.LOGFLUX_SHARED_SECRET ? '[SET]' : '[DEFAULT]'}`);
  console.log(`   Skip Tests: ${process.env.SKIP_INTEGRATION_TESTS ?? 'false'}`);
  console.log('');
});

afterAll(() => {
  console.log('Integration tests completed');
});