import { 
  createUnixClient, 
  createBatchClient,
  createLogEntry, 
  LogLevel,
  BatchConfig
} from '../src';

async function batchExample() {
  // Create underlying client
  const client = createUnixClient();
  
  // Create batch client with custom configuration
  const batchConfig: BatchConfig = {
    maxBatchSize: 25,
    flushInterval: 2000, // 2 seconds
    maxMemoryUsage: 512 * 1024, // 512KB
    flushOnExit: true
  };
  
  const batchClient = createBatchClient(client, batchConfig);
  
  try {
    console.log('Starting batch logging example...');
    
    // Send multiple log entries - they will be batched automatically
    for (let i = 1; i <= 50; i++) {
      const entry = createLogEntry(
        `Batch log entry #${i} with some data: ${Math.random()}`,
        'batch-example'
      );
      
      // Vary log levels
      if (i % 10 === 0) {
        entry.logLevel = LogLevel.Warning;
      } else if (i % 15 === 0) {
        entry.logLevel = LogLevel.Error;
      } else {
        entry.logLevel = LogLevel.Info;
      }
      
      // Add some metadata
      entry.metadata = {
        iteration: String(i),
        timestamp: new Date().toISOString(),
        batch: 'true'
      };
      
      await batchClient.addLogEntry(entry);
      
      // Small delay to see batching in action
      if (i % 10 === 0) {
        console.log(`Added ${i} entries...`);
        
        // Show current stats
        const stats = batchClient.getStats();
        console.log('Batch stats:', {
          pending: batchClient.getPendingCount(),
          processed: stats.entriesProcessed,
          batches: stats.batchesSent,
          errors: stats.errors,
          avgSize: stats.averageBatchSize
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('\nManually flushing remaining entries...');
    await batchClient.flush();
    
    // Final stats
    const finalStats = batchClient.getStats();
    console.log('\nFinal batch statistics:', {
      entriesProcessed: finalStats.entriesProcessed,
      batchesSent: finalStats.batchesSent,
      errors: finalStats.errors,
      averageBatchSize: finalStats.averageBatchSize,
      lastFlushTime: finalStats.lastFlushTime
    });
    
  } catch (error) {
    console.error('Batch error:', error);
  } finally {
    // Stop will flush remaining entries and close the client
    await batchClient.stop();
    console.log('Batch client stopped');
  }
}

async function highThroughputExample() {
  const client = createUnixClient();
  const batchClient = createBatchClient(client);
  
  try {
    console.log('\n=== High Throughput Example ===');
    console.log('Sending 1000 log entries as fast as possible...');
    
    const start = Date.now();
    
    // Send 1000 entries rapidly
    const promises = [];
    for (let i = 1; i <= 1000; i++) {
      const entry = createLogEntry(`High throughput log #${i}`, 'throughput-test');
      promises.push(batchClient.addLogEntry(entry));
    }
    
    await Promise.all(promises);
    await batchClient.flush();
    
    const end = Date.now();
    const stats = batchClient.getStats();
    
    console.log(`Completed in ${end - start}ms`);
    console.log('Final stats:', {
      entriesProcessed: stats.entriesProcessed,
      batchesSent: stats.batchesSent,
      averageBatchSize: stats.averageBatchSize,
      entriesPerSecond: Math.round(stats.entriesProcessed / ((end - start) / 1000))
    });
    
  } catch (error) {
    console.error('High throughput error:', error);
  } finally {
    await batchClient.stop();
  }
}

// Run examples
async function main() {
  await batchExample();
  await highThroughputExample();
}

if (require.main === module) {
  main().catch(console.error);
}