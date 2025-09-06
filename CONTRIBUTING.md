# Contributing to LogFlux JavaScript/TypeScript SDK

Thank you for your interest in contributing to the LogFlux JavaScript/TypeScript SDK! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- **Node.js 16.0 or later** - Required for building and testing
- **npm** - Package manager (comes with Node.js)
- **LogFlux Agent** - Required for integration tests
- **Docker** - Optional, for containerized development

### Getting Started

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd logflux-js-sdk
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run tests**:
   ```bash
   npm test              # Unit tests only
   npm run test:coverage # Unit tests with coverage report
   ```

4. **Build the project**:
   ```bash
   npm run build
   ```

## Development Workflow

### Making Changes

1. **Create a feature branch** from main:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding standards:
   - Follow TypeScript best practices
   - Use existing project conventions
   - Maintain consistent code style

3. **Write tests** for your changes:
   - Unit tests for all new functions
   - Integration tests for agent interaction features
   - Aim for high test coverage

4. **Format and lint your code**:
   ```bash
   npm run lint        # Check for linting issues
   npm run lint:fix    # Auto-fix linting issues
   npm run typecheck   # TypeScript type checking
   ```

5. **Run all tests**:
   ```bash
   npm test
   npm run test:coverage
   ```

### Testing

#### Unit Tests
Run unit tests with:
```bash
npm test
npm run test:watch    # Watch mode for development
```

#### Integration Tests
Integration tests require a running LogFlux agent:

```bash
# Start LogFlux agent first
docker run -d --name logflux-agent -v /tmp:/tmp logflux/agent:latest

# Run integration tests (if available)
# Note: Integration test setup may vary - check test files
```

#### Coverage Reports
Generate coverage reports with:
```bash
npm run test:coverage
# Opens coverage report in browser
```

### Code Quality Standards

#### TypeScript/JavaScript Code Standards
- **MUST** pass ESLint checks
- **MUST** pass TypeScript type checking
- **MUST** document all exported functions and types with JSDoc
- **MUST** handle errors properly with proper error types
- **MUST** use async/await for asynchronous operations
- **SHOULD** achieve high test coverage

Example error handling:
```typescript
try {
  await client.connect();
} catch (error) {
  throw new Error(`Failed to connect to agent: ${error.message}`);
}
```

#### Documentation
- **MUST** use proper JSDoc format for all exported items
- **SHOULD** include usage examples in comments
- **MUST** update documentation when changing APIs

#### Testing Standards
- **MUST** test all exported functions
- **MUST** test error conditions and edge cases
- **SHOULD** use descriptive test names
- **MUST** include integration tests for agent interactions (when applicable)

## Project Structure

### Package Organization
```
src/
├── types/          # Core types (LogEntry, LogBatch, etc.)
├── client/         # Client implementations
├── config/         # Configuration management
├── integrations/   # Logger integrations (winston, bunyan, pino, etc.)
└── utils/          # Utility functions
examples/           # Usage examples
dist/               # Built output (generated)
docs/               # ALL documentation (markdown only)
├── standards/      # Coding and project standards
└── schemas/        # Database schemas (if applicable)
test/               # Test files
tmp/                # Temporary files, builds, logs
```

### File Naming
- Source files: `*.ts` in appropriate directories
- Test files: `*.test.ts` or `*.spec.ts`
- Documentation: `*.md` in `/docs` directory
- Build outputs: `/dist` for distribution, `/tmp` for temporary

## Build System

### NPM Scripts
The project uses npm scripts for build tasks:

```bash
npm run build          # Build for production
npm run build:watch    # Build in watch mode
npm test               # Run unit tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage
npm run lint           # Check code style
npm run lint:fix       # Fix code style issues
npm run typecheck      # TypeScript type checking
npm run clean          # Remove build artifacts
```

### Before Committing
Always run the full validation pipeline:
```bash
npm run typecheck && npm run lint && npm test && npm run build
```

This ensures your code:
- Passes TypeScript compilation
- Follows code style guidelines
- Passes all unit tests
- Builds successfully

## Submitting Changes

### Pull Request Process

1. **Ensure your branch is up to date**:
   ```bash
   git checkout main
   git pull origin main
   git checkout your-feature-branch
   git rebase main
   ```

2. **Run the full validation pipeline**:
   ```bash
   npm run typecheck && npm run lint && npm test && npm run build
   ```

3. **Run integration tests** (if applicable and agent is available)

4. **Push your branch** and create a pull request

5. **Write a clear PR description** including:
   - What changes were made
   - Why the changes were necessary
   - Any breaking changes
   - Testing performed

### Commit Message Format
Use conventional commits format:
```
type(scope): short description

Longer description if needed

Breaking changes and additional details
```

Examples:
- `feat(client): add retry mechanism for failed connections`
- `fix(batch): resolve race condition in batch processing`
- `docs: update integration test setup instructions`

## Integration Guidelines

### Logger Integrations
When adding new logger integrations:

1. **Create integration in** `src/integrations/<logger>/`
2. **Follow existing patterns** from other integrations
3. **Include comprehensive tests** with real logger instances
4. **Add usage example** in `examples/integrations/<logger>/`
5. **Update documentation** in relevant files
6. **Add peer dependency** in `package.json` if needed

### New Features
For significant new features:

1. **Discuss the design** first (create an issue)
2. **Update relevant documentation** in `/docs`
3. **Include comprehensive tests**
4. **Add usage examples**
5. **Ensure backwards compatibility**

## Security Guidelines

- **NEVER** commit secrets or credentials
- **ALWAYS** validate external inputs
- **MUST** use secure communication protocols
- **SHOULD** implement proper authentication
- **NEVER** log sensitive information

## Getting Help

- **Documentation**: Check `/docs` directory
- **Examples**: See `examples/` directory
- **Issues**: Use the project's issue tracker
- **Testing**: Run `npm test` for unit tests

## License

By contributing to this project, you agree that your contributions will be licensed under the Apache License 2.0. See [LICENSE-APACHE-2.0](LICENSE-APACHE-2.0) for details.

## Code of Conduct

This project follows standard open source community guidelines. Be respectful, constructive, and professional in all interactions.