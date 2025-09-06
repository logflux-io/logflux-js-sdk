import debug from 'debug';
import { 
  createUnixClient,
  attachDebugToLogFlux, 
  createLogFluxDebug,
  detachDebugFromLogFlux 
} from '../src';

async function debugGlobalAttachExample() {
  console.log('=== Debug Global Attach Example ===');
  
  const client = createUnixClient();
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Attach all debug output to LogFlux
    attachDebugToLogFlux(client, 'debug-example', {
      logLevel: debug.enabled('*') ? 'debug' : 'info',
      keepConsoleOutput: true,
      metadata: { 
        integration: 'debug',
        mode: 'global-attach'
      }
    });

    // Enable debug namespaces
    debug.enabled = () => true; // Enable all for demo

    // Create debug instances - these will now send to LogFlux
    const dbDebug = debug('app:database');
    const httpDebug = debug('app:http');
    const authDebug = debug('app:auth');

    // Use debug normally - output goes to both console and LogFlux
    dbDebug('Connecting to database...');
    httpDebug('Starting HTTP server on port 3000');
    authDebug('User authentication attempt');
    
    dbDebug('Database connection established');
    httpDebug('HTTP server listening');
    authDebug('Authentication successful for user %s', 'john_doe');

    console.log('Debug messages sent to LogFlux');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Detach from LogFlux
    detachDebugFromLogFlux();
    console.log('Detached debug from LogFlux');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

async function debugTargetedExample() {
  console.log('\n=== Debug Targeted Example ===');
  
  const client = createUnixClient();
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    // Create specific debug instance that sends to LogFlux
    const logFluxDebug = createLogFluxDebug(
      client, 
      'app:database', 
      'debug-targeted-example',
      {
        keepConsoleOutput: true,
        metadata: { 
          integration: 'debug',
          mode: 'targeted',
          component: 'database'
        }
      }
    );

    // Create regular debug instance (won't send to LogFlux)
    const regularDebug = debug('app:regular');

    // Use the LogFlux debug instance
    logFluxDebug('Database query executed in %dms', 42);
    logFluxDebug('Connection pool size: %d', 10);
    
    // This won't be sent to LogFlux, only console
    regularDebug('This is a regular debug message');

    console.log('Targeted debug messages sent to LogFlux');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

async function debugWithErrorsExample() {
  console.log('\n=== Debug with Errors Example ===');
  
  const client = createUnixClient();
  
  try {
    await client.connect();
    console.log('Connected to LogFlux agent');

    const logFluxDebug = createLogFluxDebug(
      client, 
      'app:errors', 
      'debug-errors-example'
    );

    // Debug with various data types
    logFluxDebug('Simple string message');
    logFluxDebug('Number value: %d', 12345);
    logFluxDebug('Object:', { user: 'jane', role: 'admin' });
    
    // Debug with error objects
    const error = new Error('Database connection failed');
    error.stack = `Error: Database connection failed
    at connectDB (/app/db.js:15:10)
    at async main (/app/index.js:8:5)`;
    
    logFluxDebug('Error occurred:', error);
    
    // Multiple arguments
    logFluxDebug('User %s performed action %s at %s', 'alice', 'login', new Date().toISOString());

    console.log('Debug error examples sent to LogFlux');

    // Wait a moment for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run examples
async function main() {
  await debugGlobalAttachExample();
  await debugTargetedExample();
  await debugWithErrorsExample();
}

if (require.main === module) {
  main().catch(console.error);
}