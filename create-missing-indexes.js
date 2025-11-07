const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management';

async function createMissingIndexes() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    console.log('🔨 Creating Missing Indexes for Performance...\n');
    console.log('='.repeat(80));
    
    // 1. InventoryItem - Critical for owned equipment queries
    console.log('\n📦 InventoryItem Indexes:');
    const inventoryItems = db.collection('inventoryitems');
    
    try {
      await inventoryItems.createIndex(
        { 
          'currentOwnership.ownerType': 1, 
          'currentOwnership.userId': 1,
          'deletedAt': 1
        },
        { 
          name: 'idx_ownership_user_deleted',
          background: true 
        }
      );
      console.log('  ✅ Created: currentOwnership.ownerType + userId + deletedAt');
    } catch (e) {
      console.log('  ℹ️  Already exists or error:', e.message);
    }
    
    try {
      await inventoryItems.createIndex(
        { 'serialNumber': 1 },
        { 
          name: 'idx_serial_number',
          sparse: true,
          background: true 
        }
      );
      console.log('  ✅ Created: serialNumber (sparse)');
    } catch (e) {
      console.log('  ℹ️  Already exists or error:', e.message);
    }
    
    try {
      await inventoryItems.createIndex(
        { 'itemMasterId': 1 },
        { 
          name: 'idx_item_master_id',
          background: true 
        }
      );
      console.log('  ✅ Created: itemMasterId');
    } catch (e) {
      console.log('  ℹ️  Already exists or error:', e.message);
    }
    
    // 2. ReturnLog - For filtering pending returns
    console.log('\n🔙 ReturnLog Indexes:');
    const returnLogs = db.collection('returnlogs');
    
    try {
      await returnLogs.createIndex(
        { 'userId': 1, 'createdAt': -1 },
        { 
          name: 'idx_user_created',
          background: true 
        }
      );
      console.log('  ✅ Created: userId + createdAt');
    } catch (e) {
      console.log('  ℹ️  Already exists or error:', e.message);
    }
    
    try {
      await returnLogs.createIndex(
        { 'userId': 1, 'items.approvalStatus': 1 },
        { 
          name: 'idx_user_approval_status',
          background: true 
        }
      );
      console.log('  ✅ Created: userId + items.approvalStatus');
    } catch (e) {
      console.log('  ℹ️  Already exists or error:', e.message);
    }
    
    try {
      await returnLogs.createIndex(
        { 'items.itemId': 1 },
        { 
          name: 'idx_items_itemId',
          background: true 
        }
      );
      console.log('  ✅ Created: items.itemId');
    } catch (e) {
      console.log('  ℹ️  Already exists or error:', e.message);
    }
    
    // 3. RequestLog - For delivery location lookups
    console.log('\n📋 RequestLog Indexes:');
    const requestLogs = db.collection('requestlogs');
    
    try {
      await requestLogs.createIndex(
        { 'userId': 1, 'status': 1, 'requestType': 1, 'createdAt': -1 },
        { 
          name: 'idx_user_status_type_created',
          background: true 
        }
      );
      console.log('  ✅ Created: userId + status + requestType + createdAt');
    } catch (e) {
      console.log('  ℹ️  Already exists or error:', e.message);
    }
    
    // 4. Office - For office name lookups
    console.log('\n🏢 Office Indexes:');
    const offices = db.collection('offices');
    
    try {
      await offices.createIndex(
        { 'office_id': 1 },
        { 
          name: 'idx_office_id',
          unique: true,
          background: true 
        }
      );
      console.log('  ✅ Created: office_id (unique)');
    } catch (e) {
      console.log('  ℹ️  Already exists or error:', e.message);
    }
    
    try {
      await offices.createIndex(
        { 'isActive': 1, 'deletedAt': 1 },
        { 
          name: 'idx_active_deleted',
          background: true 
        }
      );
      console.log('  ✅ Created: isActive + deletedAt');
    } catch (e) {
      console.log('  ℹ️  Already exists or error:', e.message);
    }
    
    // 5. User - For user lookups
    console.log('\n👤 User Indexes:');
    const users = db.collection('users');
    
    try {
      await users.createIndex(
        { 'user_id': 1 },
        { 
          name: 'idx_user_id',
          unique: true,
          background: true 
        }
      );
      console.log('  ✅ Created: user_id (unique)');
    } catch (e) {
      console.log('  ℹ️  Already exists or error:', e.message);
    }
    
    try {
      await users.createIndex(
        { 'officeId': 1 },
        { 
          name: 'idx_office_id',
          background: true 
        }
      );
      console.log('  ✅ Created: officeId');
    } catch (e) {
      console.log('  ℹ️  Already exists or error:', e.message);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✨ Index creation completed!');
    console.log('📊 Run check-database-indexes.js to verify all indexes\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
createMissingIndexes().catch(console.error);

