const { MongoClient } = require('mongodb');

// MongoDB connection string - adjust as needed
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management';

async function createOptimizedIndexes() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    
    // Create indexes for InventoryItem collection (performance-critical)
    console.log('\n📊 Creating InventoryItem indexes...');
    const inventoryItemCollection = db.collection('inventoryitems');
    
    // Index for user-owned equipment queries
    await inventoryItemCollection.createIndex({
      'currentOwnership.ownerType': 1,
      'currentOwnership.userId': 1
    }, { name: 'idx_ownership_user' });
    console.log('✅ Created ownership user index');
    
    // Index for serial number lookups
    await inventoryItemCollection.createIndex({
      'serialNumber': 1
    }, { name: 'idx_serial_number', sparse: true });
    console.log('✅ Created serial number index');
    
    // Index for item name and category queries
    await inventoryItemCollection.createIndex({
      'itemName': 1,
      'category': 1
    }, { name: 'idx_item_category' });
    console.log('✅ Created item name + category index');
    
    // Create indexes for User collection
    console.log('\n👤 Creating User indexes...');
    const userCollection = db.collection('users');
    
    // Index for user_id lookups (main user identifier)
    await userCollection.createIndex({
      'user_id': 1
    }, { name: 'idx_user_id', unique: true });
    console.log('✅ Created user_id index');
    
    // Index for pendingDeletion flag
    await userCollection.createIndex({
      'pendingDeletion': 1
    }, { name: 'idx_pending_deletion', sparse: true });
    console.log('✅ Created pendingDeletion index');
    
    // Create indexes for RequestLog collection
    console.log('\n📋 Creating RequestLog indexes...');
    const requestLogCollection = db.collection('requestlogs');
    
    // Index for user requests lookups
    await requestLogCollection.createIndex({
      'userId': 1,
      'requestType': 1
    }, { name: 'idx_user_request_type' });
    console.log('✅ Created user + request type index');
    
    // Index for firstName + lastName lookups
    await requestLogCollection.createIndex({
      'firstName': 1,
      'lastName': 1,
      'office': 1
    }, { name: 'idx_user_name_office' });
    console.log('✅ Created user name + office index');
    
    // Index for creation date sorting
    await requestLogCollection.createIndex({
      'createdAt': -1
    }, { name: 'idx_created_desc' });
    console.log('✅ Created creation date index');
    
    // Create indexes for ReturnLog collection
    console.log('\n🔙 Creating ReturnLog indexes...');
    const returnLogCollection = db.collection('returnlogs');
    
    // Index for return date sorting
    await returnLogCollection.createIndex({
      'createdAt': -1
    }, { name: 'idx_return_created_desc' });
    console.log('✅ Created return creation date index');
    
    // Index for user return lookups
    await returnLogCollection.createIndex({
      'firstName': 1,
      'lastName': 1
    }, { name: 'idx_return_user_name' });
    console.log('✅ Created return user name index');
    
    // Create indexes for Inventory collection (if still used)
    console.log('\n📦 Creating Inventory indexes...');
    const inventoryCollection = db.collection('inventories');
    
    // Index for item name and category
    await inventoryCollection.createIndex({
      'itemName': 1,
      'category': 1
    }, { name: 'idx_inventory_item_category' });
    console.log('✅ Created inventory item + category index');
    
    // Index for status queries
    await inventoryCollection.createIndex({
      'status': 1
    }, { name: 'idx_inventory_status' });
    console.log('✅ Created inventory status index');
    
    console.log('\n🎉 All indexes created successfully!');
    
    // Show existing indexes for verification
    console.log('\n📊 Current indexes:');
    const collections = ['inventoryitems', 'users', 'requestlogs', 'returnlogs', 'inventories'];
    
    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      const indexes = await collection.indexes();
      console.log(`\n${collectionName}:`);
      indexes.forEach(index => {
        console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the optimization
createOptimizedIndexes().catch(console.error);
