# Integration Tests

This document describes how to run integration tests against a real LogFlux agent.

## Prerequisites

### 1. LogFlux Agent Setup

You need a running LogFlux agent for the integration tests. The agent should support:

- **Unix Socket**: `/tmp/logflux.sock` (default path)
- **TCP Socket**: `localhost:8080` with shared secret authentication

### 2. Agent Configuration

Configure your LogFlux agent with these settings:

```yaml
# Unix socket configuration
unix_socket:
  path: "/tmp/logflux.sock"
  enabled: true

# TCP socket configuration  
tcp_socket:
  host: "localhost"
  port: 8080
  enabled: true
  shared_secret: "test-secret"
```

## Running Integration Tests

### Quick Start

```bash
# Run all integration tests
npm run test:integration

# Run with coverage
npm run test:integration:coverage
```

### Environment Variables

Customize test configuration with environment variables:

```bash
# Custom socket path
LOGFLUX_SOCKET_PATH=/custom/path/logflux.sock npm run test:integration

# Custom TCP configuration
LOGFLUX_TCP_HOST=192.168.1.100 \
LOGFLUX_TCP_PORT=9090 \
LOGFLUX_SHARED_SECRET=my-secret \
npm run test:integration

# Skip tests if agent is not available
SKIP_INTEGRATION_TESTS=true npm run test:integration
```

### Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `LOGFLUX_SOCKET_PATH` | `/tmp/logflux.sock` | Unix socket path |
| `LOGFLUX_TCP_HOST` | `localhost` | TCP host |
| `LOGFLUX_TCP_PORT` | `8080` | TCP port |
| `LOGFLUX_SHARED_SECRET` | `test-secret` | TCP shared secret |
| `SKIP_INTEGRATION_TESTS` | `false` | Skip all integration tests |

## Test Scenarios

The integration tests cover:

### Unix Socket Tests
- Connection establishment
- Log entry transmission
- Health check (ping)
- Batch processing
- Error handling

### TCP Socket Tests  
- Connection establishment
- Authentication flow
- Log entry transmission
- Health check (ping)
- Batch processing
- Authentication failure handling

### Batch Client Tests
- Automatic flushing (size-based)
- Timer-based flushing
- Error recovery
- High-volume processing

### Load Tests
- Concurrent log entry submission
- High-volume batch processing
- Performance measurement

### Data Validation
- Different log levels (Debug, Info, Warning, Error, Critical)
- Different entry types
- JSON payload handling
- Unicode and special characters

## Docker Setup (Optional)

If you don't have a LogFlux agent, you can run one using Docker:

```bash
# Run LogFlux agent with default settings
docker run -d \
  --name logflux-agent \
  -v /tmp:/tmp \
  -p 8080:8080 \
  logflux/agent:latest

# Wait for agent to start
sleep 2

# Run integration tests
npm run test:integration
```

## Troubleshooting

### Agent Not Detected

If you see:
```
LogFlux agent not detected:
   Unix socket: /tmp/logflux.sock - No
   TCP socket: localhost:8080 - No
   Skipping integration tests. Start the agent to run these tests.
```

**Solutions:**
1. Start the LogFlux agent
2. Check the socket path exists: `ls -la /tmp/logflux.sock`
3. Check TCP port is listening: `nc -zv localhost 8080`
4. Use `SKIP_INTEGRATION_TESTS=true` to skip

### Permission Denied

If you get permission errors accessing the Unix socket:
```bash
# Check socket permissions
ls -la /tmp/logflux.sock

# Fix permissions if needed (agent should handle this)
sudo chmod 666 /tmp/logflux.sock
```

### Connection Refused

For TCP connection issues:
1. Verify agent is listening: `netstat -an | grep 8080`
2. Check firewall rules
3. Verify shared secret matches agent configuration

### Test Timeouts

Integration tests have a 30-second timeout. If tests are timing out:
1. Check agent performance and resource usage
2. Reduce test volume in load tests
3. Check network latency

## CI/CD Integration

For continuous integration, you can:

### Skip Tests When Agent Unavailable
```bash
# In CI pipeline - skip if agent not available
SKIP_INTEGRATION_TESTS=true npm run test:integration
```

### Conditional Testing
```bash
# Only run integration tests if socket exists
if [ -S "/tmp/logflux.sock" ]; then
  npm run test:integration
else
  echo "LogFlux agent not available, skipping integration tests"
fi
```

### Docker-based CI
```yaml
# Example GitHub Actions
services:
  logflux-agent:
    image: logflux/agent:latest
    ports:
      - 8080:8080
    volumes:
      - /tmp:/tmp

steps:
  - name: Run Integration Tests
    run: npm run test:integration
```

## Performance Expectations

Based on typical hardware, expected performance:

- **Single entries**: >1000 entries/second
- **Batch processing**: >5000 entries/second  
- **Connection time**: <100ms (Unix), <200ms (TCP)
- **Authentication**: <50ms

Performance may vary based on:
- Agent configuration
- Network latency (TCP)
- System resources
- Log entry size

## Monitoring Test Results

Integration tests provide detailed logging:

```
LogFlux agent detected:
   Unix socket: /tmp/logflux.sock - Yes
   TCP socket: localhost:8080 - Yes

Sent 50 entries in 125ms (400.0 entries/sec)
Processed 100 entries via batching in 1200ms
Batches sent: 10, Average batch size: 10
```

Monitor these metrics to verify agent performance and SDK efficiency.