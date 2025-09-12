const { MongoClient } = require('mongodb');

// MongoDB connection string from your env
const uri = 'mongodb+srv://vsq-admin:vsqWedYykRQQjZtmHX9@cluster0.r3yibxs.mongodb.net/inventory-management?retryWrites=true&w=majority&appName=Cluster0';

async function createIndexSafely(collection, indexSpec, options = {}) {
  try {
    await collection.createIndex(indexSpec, options);
    console.log(`✅ Created index: ${JSON.stringify(indexSpec)}`);
  } catch (error) {
    if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
      console.log(`ℹ️  Index already exists: ${JSON.stringify(indexSpec)}`);
    } else {
      console.log(`⚠️  Warning creating index ${JSON.stringify(indexSpec)}: ${error.message}`);
    }
  }
}

async function createIndexes() {
  const client = new MongoClient(uri);
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully');
    
    const db = client.db();
    
    console.log('🔧 Creating indexes for performance optimization...');
    
    // RequestLogs indexes
    console.log('📝 Creating indexes for requestlogs...');
    const requestLogsCollection = db.collection('requestlogs');
    await createIndexSafely(requestLogsCollection, { userId: 1 });
    await createIndexSafely(requestLogsCollection, { userId: 1, createdAt: -1 });
    await createIndexSafely(requestLogsCollection, { status: 1, createdAt: -1 });
    await createIndexSafely(requestLogsCollection, { office: 1, createdAt: -1 });
    
    // ReturnLogs indexes
    console.log('📝 Creating indexes for returnlogs...');
    const returnLogsCollection = db.collection('returnlogs');
    await createIndexSafely(returnLogsCollection, { userId: 1 });
    await createIndexSafely(returnLogsCollection, { userId: 1, returnDate: -1 });
    await createIndexSafely(returnLogsCollection, { status: 1, returnDate: -1 });
    await createIndexSafely(returnLogsCollection, { office: 1, returnDate: -1 });
    
    // IssueLogs indexes
    console.log('📝 Creating indexes for issuelogs...');
    const issueLogsCollection = db.collection('issuelogs');
    await createIndexSafely(issueLogsCollection, { userId: 1 });
    await createIndexSafely(issueLogsCollection, { userId: 1, reportDate: -1 });
    await createIndexSafely(issueLogsCollection, { status: 1, reportDate: -1 });
    await createIndexSafely(issueLogsCollection, { office: 1, reportDate: -1 });
    await createIndexSafely(issueLogsCollection, { urgency: 1, status: 1 });
    
    // InventoryItems additional indexes (skip serialNumber as it already exists)
    console.log('📝 Creating additional indexes for inventoryitems...');
    const inventoryItemsCollection = db.collection('inventoryitems');
    await createIndexSafely(inventoryItemsCollection, { 'currentOwnership.userId': 1, status: 1 });
    await createIndexSafely(inventoryItemsCollection, { createdAt: -1 });
    // Skip serialNumber index as it already exists with unique constraint
    
    console.log('🎉 Index creation process completed!');
    console.log('📈 Database queries should now be optimized');
    
  } catch (error) {
    console.error('❌ Index creation process failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

createIndexes();
