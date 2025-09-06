# Integration Tests

This directory contains integration tests that test the LogFlux JavaScript SDK against a real running LogFlux agent.

## Files

- **`logflux-agent.test.ts`** - Main integration tests for Unix socket and TCP connections
- **`setup-integration.ts`** - Test setup and configuration for integration tests

## Running Integration Tests

```bash
# Run integration tests
npm run test:integration

# Run with coverage
npm run test:integration:coverage
```

## Prerequisites

The integration tests require a running LogFlux agent. See [INTEGRATION_TESTS.md](../../../INTEGRATION_TESTS.md) for setup instructions.

## Environment Variables

- `LOGFLUX_SOCKET_PATH` - Unix socket path (default: `/tmp/logflux-agent.sock`)
- `LOGFLUX_TCP_HOST` - TCP host (default: `localhost`)
- `LOGFLUX_TCP_PORT` - TCP port (default: `8080`)
- `LOGFLUX_SHARED_SECRET` - TCP shared secret (default: `test-secret`)
- `SKIP_INTEGRATION_TESTS` - Set to `'true'` to skip tests