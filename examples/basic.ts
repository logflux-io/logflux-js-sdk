import { 
  createUnixClient, 
  createTCPClient, 
  createLogEntry, 
  LogLevel 
} from '../src';

async function basicExample() {
  // Create a client using Unix socket (default)
  const client = createUnixClient();
  
  try {
    // Connect to the agent
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Send a simple log entry
    const entry = createLogEntry('Hello from LogFlux JS SDK!', 'basic-example');
    await client.sendLogEntry(entry);
    console.log('Sent log entry');

    // Send a log entry with custom level and metadata
    const customEntry = createLogEntry('Custom log entry', 'basic-example');
    customEntry.logLevel = LogLevel.Warning;
    customEntry.metadata = {
      userId: '12345',
      action: 'user_login',
      ip: '192.168.1.100'
    };
    
    await client.sendLogEntry(customEntry);
    console.log('Sent custom log entry');

    // Test ping
    const pingResult = await client.ping();
    console.log('Ping result:', pingResult ? 'success' : 'failed');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Always close the client
    await client.close();
    console.log('Client closed');
  }
}

async function tcpExample() {
  // Create a TCP client
  const client = createTCPClient('localhost', 8080, 'shared-secret-123');
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent via TCP');

    // Authenticate (required for TCP)
    const authResult = await client.authenticate();
    if (!authResult) {
      throw new Error('Authentication failed');
    }
    console.log('Authenticated successfully');

    // Send log entry
    const entry = createLogEntry('TCP connection log', 'tcp-example');
    await client.sendLogEntry(entry);
    console.log('Sent log entry via TCP');

  } catch (error) {
    console.error('TCP Error:', error);
  } finally {
    await client.close();
  }
}

// Run examples
async function main() {
  console.log('=== Basic Unix Socket Example ===');
  await basicExample();
  
  console.log('\n=== TCP Example ===');
  await tcpExample();
}

if (require.main === module) {
  main().catch(console.error);
}