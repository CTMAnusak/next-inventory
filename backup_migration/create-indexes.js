const { MongoClient } = require('mongodb');

// MongoDB connection string from your env
const uri = 'mongodb+srv://vsq-admin:vsqWedYykRQQjZtmHX9@cluster0.r3yibxs.mongodb.net/inventory-management?retryWrites=true&w=majority&appName=Cluster0';

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
    await requestLogsCollection.createIndex({ userId: 1 });
    await requestLogsCollection.createIndex({ userId: 1, createdAt: -1 });
    await requestLogsCollection.createIndex({ status: 1, createdAt: -1 });
    await requestLogsCollection.createIndex({ office: 1, createdAt: -1 });
    console.log('✅ RequestLogs indexes created');
    
    // ReturnLogs indexes
    console.log('📝 Creating indexes for returnlogs...');
    const returnLogsCollection = db.collection('returnlogs');
    await returnLogsCollection.createIndex({ userId: 1 });
    await returnLogsCollection.createIndex({ userId: 1, returnDate: -1 });
    await returnLogsCollection.createIndex({ status: 1, returnDate: -1 });
    await returnLogsCollection.createIndex({ office: 1, returnDate: -1 });
    console.log('✅ ReturnLogs indexes created');
    
    // IssueLogs indexes
    console.log('📝 Creating indexes for issuelogs...');
    const issueLogsCollection = db.collection('issuelogs');
    await issueLogsCollection.createIndex({ userId: 1 });
    await issueLogsCollection.createIndex({ userId: 1, reportDate: -1 });
    await issueLogsCollection.createIndex({ status: 1, reportDate: -1 });
    await issueLogsCollection.createIndex({ office: 1, reportDate: -1 });
    await issueLogsCollection.createIndex({ urgency: 1, status: 1 });
    console.log('✅ IssueLogs indexes created');
    
    // InventoryItems additional indexes
    console.log('📝 Creating additional indexes for inventoryitems...');
    const inventoryItemsCollection = db.collection('inventoryitems');
    await inventoryItemsCollection.createIndex({ 'currentOwnership.userId': 1, status: 1 });
    await inventoryItemsCollection.createIndex({ serialNumber: 1 }, { sparse: true });
    await inventoryItemsCollection.createIndex({ createdAt: -1 });
    console.log('✅ InventoryItems indexes created');
    
    console.log('🎉 All indexes created successfully!');
    console.log('📈 Database queries should now be much faster');
    
  } catch (error) {
    console.error('❌ Index creation failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

createIndexes();
