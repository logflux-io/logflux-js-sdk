# LogFlux JavaScript/TypeScript SDK

## Repository Overview
This repository contains the official LogFlux JavaScript/TypeScript SDK for Node.js applications. The SDK provides a lightweight client library for communicating with the LogFlux agent via Unix sockets or TCP connections.

## Architecture

### Core Components
- **Types** (`src/types/`) - TypeScript interfaces and types that match the LogFlux Agent API specification
- **Client** (`src/client/`) - Core client implementations including basic client and batch client
- **Config** (`src/config/`) - Configuration management and validation
- **Integrations** (`src/integrations/`) - Popular logging library integrations (Winston, Bunyan, Pino, etc.)

### Key Features
- **Transport Support**: Unix socket (preferred) and TCP with authentication
- **Batching**: Automatic batching for high-throughput scenarios
- **Type Safety**: Full TypeScript support with strict typing
- **Integration Ready**: Built-in support for popular Node.js logging frameworks
- **API Compliant**: Matches logflux-agent-api-v1.yaml specification

## API Compliance
The SDK fully implements the LogFlux Agent Local Server API v1.0 specification:
- LogEntry, LogBatch, PingRequest, AuthRequest message types
- Unix socket communication via `/tmp/logflux-agent.sock`
- TCP communication with shared secret authentication
- Proper error handling and retry logic
- Validation according to API constraints (batch size limits, etc.)

## Build and Development
- **Language**: TypeScript (ES2020 target)
- **Module System**: ESNext modules with CommonJS compatibility
- **Build Tool**: Rollup for bundling
- **Testing**: Jest with comprehensive unit and integration tests
- **Linting**: ESLint with TypeScript, security, and best practices rules
- **Coverage**: Maintained at 75%+ test coverage

## File Structure
```
src/
├── types/           # TypeScript definitions and API types
├── client/          # Client implementations
├── config/          # Configuration management
├── integrations/    # Logging library integrations
└── __tests__/       # Test files and integration tests
```

## Dependencies
- **Runtime**: None (peer dependencies for integrations)
- **Development**: TypeScript, Jest, ESLint, Rollup
- **Peer Dependencies**: winston, bunyan, pino (optional)

## Distribution
- **Package**: `@logflux-io/logflux-js-sdk`
- **Formats**: CommonJS (`dist/index.js`) and ES Modules (`dist/index.esm.js`)
- **Types**: Full TypeScript definitions included
- **Node.js**: Requires Node.js 16+

## Testing Strategy
- **Unit Tests**: All core functionality covered
- **Integration Tests**: Real agent communication tests (skippable)
- **Coverage**: Statement, branch, and function coverage monitoring
- **Performance**: Load testing for high-throughput scenarios

## Security Considerations
- **ESLint Security Plugin**: Enabled for security best practices
- **No Secrets**: No hardcoded credentials or sensitive data
- **Input Validation**: All API inputs validated
- **Safe Defaults**: Secure configuration defaults

## Open Source Readiness
- **License**: Apache License 2.0
- **Documentation**: Comprehensive README with examples
- **Contributing**: Clear contribution guidelines
- **Security**: Security policy and vulnerability reporting process
- **CI/CD**: GitHub Actions for testing and validation