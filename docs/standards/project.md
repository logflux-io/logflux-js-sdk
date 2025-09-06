# Project Standards and Conventions

This document defines the project standards and conventions for the LogFlux JavaScript/TypeScript SDK.

## Table of Contents

- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Quality](#code-quality)
- [Documentation Standards](#documentation-standards)
- [Testing Standards](#testing-standards)
- [Release Process](#release-process)
- [Security Standards](#security-standards)
- [Performance Standards](#performance-standards)

## Project Structure

### Directory Layout

```
logflux-js-sdk/
├── docs/                          # Documentation
│   ├── README.md                  # Main SDK documentation
│   ├── api-reference.md           # Complete API reference
│   ├── integrations.md            # Logging library integrations
│   ├── configuration.md           # Configuration guide
│   ├── testing.md                 # Testing guide
│   └── standards/                 # Standards and conventions
│       ├── typescript.md          # TypeScript standards
│       └── project.md             # This file
├── src/                           # Source code
│   ├── types/                     # Type definitions
│   ├── client/                    # Client implementations
│   ├── config/                    # Configuration management
│   ├── integrations/              # Logging library integrations
│   ├── utils/                     # Utility functions
│   └── __tests__/                 # Test files
│       ├── unit/                  # Unit tests
│       ├── integration/           # Integration tests
│       └── fixtures/              # Test fixtures and mocks
├── examples/                      # Usage examples
├── dist/                          # Built distribution files
├── coverage/                      # Test coverage reports
├── node_modules/                  # Dependencies
├── .github/                       # GitHub workflows and templates
├── package.json                   # Package configuration
├── tsconfig.json                  # TypeScript configuration
├── jest.config.js                 # Jest testing configuration
├── rollup.config.js               # Build configuration
├── .eslintrc.js                   # ESLint configuration
├── .prettierrc                    # Prettier configuration
├── .gitignore                     # Git ignore rules
├── README.md                      # Project overview and quick start
├── CONTRIBUTING.md                # Contribution guidelines
├── SECURITY.md                    # Security policy
├── LICENSE-APACHE-2.0             # Apache 2.0 license
├── INTEGRATION_TESTS.md           # Integration test documentation
└── CLAUDE.md                      # Project metadata for development tools
```

### File Naming Conventions

#### Source Files
- **TypeScript files**: Use kebab-case with `.ts` extension
  - `log-flux-client.ts`
  - `batch-client.ts`
  - `connection-manager.ts`

- **Type definition files**: Use kebab-case with `.ts` extension
  - `log-entry.ts`
  - `client-config.ts`
  - `api-types.ts`

- **Test files**: Use kebab-case with `.test.ts` extension
  - `client.test.ts`
  - `batch-processing.test.ts`
  - `integration.test.ts`

#### Documentation
- Use kebab-case for markdown files
- Use descriptive names that reflect content
- Group related documentation in subdirectories

## Development Workflow

### Branch Strategy

#### Main Branches
- **`main`**: Production-ready code, always deployable
- **`develop`**: Integration branch for features, used for development releases

#### Supporting Branches
- **Feature branches**: `feature/feature-name`
  - Branch from: `develop`
  - Merge back to: `develop`
  - Naming: `feature/batch-processing`, `feature/winston-integration`

- **Bugfix branches**: `bugfix/issue-description`
  - Branch from: `develop` (or `main` for hotfixes)
  - Merge back to: `develop` (and `main` for hotfixes)
  - Naming: `bugfix/connection-timeout`, `bugfix/memory-leak`

- **Release branches**: `release/version-number`
  - Branch from: `develop`
  - Merge to: `main` and `develop`
  - Naming: `release/1.2.0`, `release/2.0.0-beta.1`

### Commit Messages

Follow the Conventional Commits specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, missing semi-colons, etc.)
- **refactor**: Code refactoring without functionality changes
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Changes to build system or dependencies
- **ci**: Changes to CI configuration
- **chore**: Maintenance tasks

#### Examples
```
feat(client): add TCP connection support

Implement TCP client with shared secret authentication
Support for remote LogFlux agent connections

Closes #123

fix(batch): resolve memory leak in batch processing

- Clear references to processed entries
- Add proper cleanup in stop() method
- Update tests to verify memory usage

docs(api): update API reference for batch client

- Document new configuration options
- Add performance considerations
- Include usage examples

test(integration): add TCP integration tests

Add comprehensive integration tests for TCP client including:
- Connection establishment
- Authentication flow  
- Error handling scenarios
```

### Pull Request Process

#### PR Requirements
1. **Branch is up to date** with target branch
2. **All tests pass** (unit and integration)
3. **Code coverage** maintained at 80%+
4. **ESLint** passes with no errors
5. **TypeScript** compilation succeeds
6. **Documentation** updated if needed
7. **CHANGELOG** entry added for user-facing changes

#### PR Template
```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass  
- [ ] New tests added for new functionality
- [ ] Manual testing completed

## Documentation
- [ ] Documentation updated
- [ ] API reference updated
- [ ] Examples updated if needed

## Checklist
- [ ] Code follows the project's TypeScript standards
- [ ] Self-review completed
- [ ] Code coverage maintained
- [ ] Breaking changes documented
```

## Code Quality

### Linting and Formatting

#### ESLint Configuration
```javascript
// .eslintrc.js
module.exports = {
  extends: [
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
    'plugin:security/recommended'
  ],
  rules: {
    // Enforce explicit function return types for public APIs
    '@typescript-eslint/explicit-function-return-type': ['error', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
      allowHigherOrderFunctions: false
    }],
    
    // Prevent any type usage
    '@typescript-eslint/no-explicit-any': 'error',
    
    // Enforce consistent naming conventions
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'interface',
        format: ['PascalCase']
      },
      {
        selector: 'typeAlias',
        format: ['PascalCase']
      },
      {
        selector: 'enum',
        format: ['PascalCase']
      }
    ]
  }
};
```

#### Prettier Configuration
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### Code Review Standards

#### Review Checklist
- [ ] **Correctness**: Does the code do what it's supposed to do?
- [ ] **Performance**: Are there any obvious performance issues?
- [ ] **Security**: Are there any security vulnerabilities?
- [ ] **Maintainability**: Is the code readable and maintainable?
- [ ] **Testing**: Are there adequate tests for the changes?
- [ ] **Documentation**: Is the code properly documented?
- [ ] **Standards**: Does the code follow project standards?

#### Review Process
1. **Automated checks** must pass before human review
2. **At least one approval** required from code owner
3. **Address all comments** before merging
4. **Squash commits** when merging to maintain clean history

## Documentation Standards

### README Structure
1. **Project description** and key features
2. **Installation** instructions
3. **Quick start** examples
4. **API overview** with links to detailed docs
5. **Configuration** basics
6. **Examples** and common use cases
7. **Development** setup instructions
8. **Contributing** guidelines
9. **License** information

### API Documentation
- **JSDoc comments** for all public APIs
- **TypeScript types** as primary documentation
- **Examples** for complex functionality
- **Error cases** documented
- **Performance notes** where relevant

### Code Comments
```typescript
// Use comments sparingly - prefer self-documenting code
// Good: Explains why, not what
function calculateRetryDelay(attempt: number): number {
  // Exponential backoff with jitter to avoid thundering herd
  const baseDelay = this.retryDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.1 * baseDelay;
  return Math.min(baseDelay + jitter, 30000);
}

// Bad: Explains what the code does (obvious from reading)
// Increment the counter by 1
counter++;
```

## Testing Standards

### Coverage Requirements
- **Minimum 80%** statement coverage
- **Minimum 75%** branch coverage
- **Minimum 80%** function coverage
- **100%** coverage for public API functions

### Test Categories

#### Unit Tests
- Test individual functions and classes in isolation
- Use mocks for external dependencies
- Fast execution (< 1 second per test)
- No network or file system access

#### Integration Tests
- Test complete workflows with real agent
- May be skipped if agent unavailable
- Reasonable timeouts (30 seconds max)
- Clean up resources properly

#### Performance Tests
- Measure throughput and latency
- Establish performance baselines
- Run on representative hardware
- Include memory usage monitoring

### Test Structure
```typescript
describe('Component', () => {
  describe('method', () => {
    test('should handle normal case', () => {
      // Arrange
      const input = createTestInput();
      
      // Act  
      const result = component.method(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
    });
    
    test('should handle edge case', () => {
      // Test edge cases
    });
    
    test('should throw error for invalid input', () => {
      // Test error cases
    });
  });
});
```

## Release Process

### Versioning Strategy
Follow Semantic Versioning (SemVer):
- **Major** (x.0.0): Breaking changes
- **Minor** (x.y.0): New features, backward compatible
- **Patch** (x.y.z): Bug fixes, backward compatible

### Release Checklist
1. [ ] All tests pass
2. [ ] Documentation updated
3. [ ] CHANGELOG.md updated
4. [ ] Version bumped in package.json
5. [ ] Git tag created
6. [ ] NPM package published
7. [ ] GitHub release created
8. [ ] Documentation deployed

### Pre-release Testing
- [ ] Unit tests pass
- [ ] Integration tests pass with multiple agent versions
- [ ] Performance benchmarks within acceptable ranges
- [ ] Memory leak testing completed
- [ ] Security scan completed
- [ ] Cross-platform testing (if applicable)

## Security Standards

### Dependency Management
- **Regular updates**: Update dependencies monthly
- **Security audits**: Run `npm audit` before releases
- **Minimal dependencies**: Avoid unnecessary dependencies
- **Trusted sources**: Only use well-maintained packages

### Code Security
- **Input validation**: Validate all external input
- **No secrets in code**: Use environment variables
- **Safe defaults**: Secure configuration by default
- **Error handling**: Don't leak sensitive information

### Security Testing
```typescript
describe('Security', () => {
  test('should not log sensitive configuration', () => {
    const client = createTCPClient('host', 8080, 'secret-key');
    const logOutput = client.toString();
    
    expect(logOutput).not.toContain('secret-key');
  });
  
  test('should sanitize log payloads', () => {
    const maliciousPayload = 'test\x00\x01\x02control-chars';
    const entry = createLogEntry(maliciousPayload, 'test');
    
    expect(entry.payload).not.toMatch(/[\x00-\x08\x0E-\x1F]/);
  });
});
```

## Performance Standards

### Performance Targets
- **Single entry throughput**: >1,000 entries/second
- **Batch throughput**: >5,000 entries/second
- **Connection time**: <200ms (TCP), <100ms (Unix)
- **Memory usage**: <10MB for typical workloads
- **CPU usage**: <5% for sustained logging

### Performance Testing
```typescript
describe('Performance', () => {
  test('should maintain throughput under load', async () => {
    const client = createBatchClient(createUnixClient());
    const startTime = Date.now();
    const entryCount = 10000;
    
    for (let i = 0; i < entryCount; i++) {
      await client.addLogEntry(createLogEntry(`Test ${i}`, 'perf-test'));
    }
    
    await client.flush();
    const duration = Date.now() - startTime;
    const throughput = (entryCount / duration) * 1000;
    
    expect(throughput).toBeGreaterThan(5000);
  });
});
```

### Memory Management
- **Object pooling** for frequently created objects
- **Proper cleanup** in destructors and stop methods  
- **Avoid memory leaks** in event handlers and timers
- **Monitor memory usage** in long-running processes

### Code Optimization
- **Profile before optimizing**: Use actual performance data
- **Optimize hot paths**: Focus on frequently executed code
- **Minimize allocations**: Reduce garbage collection pressure
- **Use efficient data structures**: Arrays vs Objects vs Maps

## Monitoring and Metrics

### Development Metrics
- **Build time**: Keep under 30 seconds
- **Test execution time**: Keep under 2 minutes
- **Bundle size**: Monitor and minimize
- **Type checking time**: Keep under 10 seconds

### Runtime Metrics
```typescript
// Example metrics collection
interface SDKMetrics {
  totalEntriesSent: number;
  totalBatchesSent: number;
  averageBatchSize: number;
  connectionErrors: number;
  authenticationErrors: number;
  averageLatency: number;
}

class MetricsCollector {
  private metrics: SDKMetrics = {
    totalEntriesSent: 0,
    totalBatchesSent: 0,
    averageBatchSize: 0,
    connectionErrors: 0,
    authenticationErrors: 0,
    averageLatency: 0
  };
  
  recordEntrySent(): void {
    this.metrics.totalEntriesSent++;
  }
  
  getMetrics(): Readonly<SDKMetrics> {
    return { ...this.metrics };
  }
}
```

## Maintenance Guidelines

### Regular Maintenance Tasks
- **Monthly**: Update dependencies, security audit
- **Quarterly**: Performance benchmarking, code review
- **Yearly**: Architecture review, technology updates

### Technical Debt Management
- **Track technical debt** in issues
- **Allocate 20%** of development time to technical debt
- **Prioritize** based on impact and effort
- **Document decisions** in ADRs (Architecture Decision Records)

### Deprecation Process
1. **Mark as deprecated** with clear timeline
2. **Provide migration path** in documentation
3. **Log warnings** in deprecated features
4. **Remove** in next major version
5. **Update** breaking change documentation

This document serves as the foundation for maintaining high-quality, secure, and performant code in the LogFlux JavaScript/TypeScript SDK project.