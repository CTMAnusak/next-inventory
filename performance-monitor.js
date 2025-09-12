const { MongoClient } = require('mongodb');

// MongoDB connection string - adjust as needed
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management';

async function monitorPerformance() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    
    console.log('\n📊 Performance Monitoring Report');
    console.log('================================');
    
    // Check collection sizes
    console.log('\n📦 Collection Statistics:');
    const collections = ['inventoryitems', 'users', 'requestlogs', 'returnlogs', 'inventories'];
    
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const stats = await collection.stats();
        const count = await collection.countDocuments();
        
        console.log(`${collectionName}:`);
        console.log(`  Documents: ${count.toLocaleString()}`);
        console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Avg Doc Size: ${(stats.avgObjSize / 1024).toFixed(2)} KB`);
        
        // Check for large documents that might cause performance issues
        if (stats.avgObjSize > 50000) { // 50KB
          console.log(`  ⚠️  Warning: Large average document size detected`);
        }
        
        if (count > 10000) {
          console.log(`  ⚠️  Warning: Large collection - ensure proper indexing`);
        }
        
        console.log('');
      } catch (error) {
        console.log(`${collectionName}: Collection not found or error: ${error.message}`);
      }
    }
    
    // Check slow operations patterns
    console.log('\n🐌 Checking for Common Slow Query Patterns:');
    
    // Test user-owned equipment query performance
    console.log('\n1. Testing user-owned equipment query...');
    const testUserId = 'test-user';
    const start = Date.now();
    
    try {
      const inventoryItemCollection = db.collection('inventoryitems');
      await inventoryItemCollection.find({
        'currentOwnership.ownerType': 'user_owned',
        'currentOwnership.userId': testUserId
      }).limit(1).toArray();
      
      const duration = Date.now() - start;
      console.log(`   Query time: ${duration}ms`);
      
      if (duration > 100) {
        console.log(`   ⚠️  Warning: Slow query detected - consider adding index on currentOwnership fields`);
      } else {
        console.log(`   ✅ Good performance`);
      }
    } catch (error) {
      console.log(`   ❌ Error testing query: ${error.message}`);
    }
    
    // Test user lookup performance
    console.log('\n2. Testing user lookup query...');
    const userStart = Date.now();
    
    try {
      const userCollection = db.collection('users');
      await userCollection.findOne({ user_id: 'test-user' });
      
      const userDuration = Date.now() - userStart;
      console.log(`   Query time: ${userDuration}ms`);
      
      if (userDuration > 50) {
        console.log(`   ⚠️  Warning: Slow user lookup - ensure user_id index exists`);
      } else {
        console.log(`   ✅ Good performance`);
      }
    } catch (error) {
      console.log(`   ❌ Error testing user query: ${error.message}`);
    }
    
    // Test request logs aggregation
    console.log('\n3. Testing request logs query...');
    const requestStart = Date.now();
    
    try {
      const requestLogCollection = db.collection('requestlogs');
      await requestLogCollection.find({ requestType: 'user-owned' })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
      
      const requestDuration = Date.now() - requestStart;
      console.log(`   Query time: ${requestDuration}ms`);
      
      if (requestDuration > 200) {
        console.log(`   ⚠️  Warning: Slow request logs query - ensure indexes on requestType and createdAt`);
      } else {
        console.log(`   ✅ Good performance`);
      }
    } catch (error) {
      console.log(`   ❌ Error testing request logs query: ${error.message}`);
    }
    
    // Check current indexes
    console.log('\n📇 Current Indexes:');
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const indexes = await collection.indexes();
        
        console.log(`\n${collectionName}:`);
        if (indexes.length === 1) {
          console.log(`   ⚠️  Warning: Only default _id index found - consider adding performance indexes`);
        }
        
        indexes.forEach(index => {
          console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
        });
      } catch (error) {
        console.log(`${collectionName}: Error getting indexes: ${error.message}`);
      }
    }
    
    // Check for missing recommended indexes
    console.log('\n💡 Recommended Indexes:');
    
    try {
      const inventoryItemCollection = db.collection('inventoryitems');
      const inventoryIndexes = await inventoryItemCollection.indexes();
      
      const hasOwnershipIndex = inventoryIndexes.some(idx => 
        idx.name && idx.name.includes('ownership')
      );
      
      if (!hasOwnershipIndex) {
        console.log(`   📋 InventoryItems: Add index on { 'currentOwnership.ownerType': 1, 'currentOwnership.userId': 1 }`);
      }
      
      const userCollection = db.collection('users');
      const userIndexes = await userCollection.indexes();
      
      const hasUserIdIndex = userIndexes.some(idx => 
        idx.key && idx.key.user_id
      );
      
      if (!hasUserIdIndex) {
        console.log(`   👤 Users: Add unique index on { 'user_id': 1 }`);
      }
      
      const requestLogCollection = db.collection('requestlogs');
      const requestIndexes = await requestLogCollection.indexes();
      
      const hasRequestTypeIndex = requestIndexes.some(idx => 
        idx.key && (idx.key.requestType || idx.key.userId)
      );
      
      if (!hasRequestTypeIndex) {
        console.log(`   📋 RequestLogs: Add index on { 'userId': 1, 'requestType': 1 }`);
        console.log(`   📋 RequestLogs: Add index on { 'createdAt': -1 }`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error checking indexes: ${error.message}`);
    }
    
    console.log('\n🎯 Performance Recommendations:');
    console.log('1. Run optimize-database-indexes.js to create recommended indexes');
    console.log('2. Monitor slow queries using MongoDB profiler');
    console.log('3. Consider using lean() queries for read-only operations');
    console.log('4. Implement connection pooling for better database performance');
    console.log('5. Use field selection to limit returned data size');
    
  } catch (error) {
    console.error('❌ Error monitoring performance:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the monitoring
monitorPerformance().catch(console.error);
