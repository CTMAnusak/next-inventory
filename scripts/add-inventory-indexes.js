/**
 * Add database indexes for Inventory-related collections
 * This improves performance for Dashboard and equipment pages
 */

const mongoose = require('mongoose');
const path = require('path');

// Try to load .env.local first, then fallback to .env
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.MONGODB_URI) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
}

async function addIndexes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ========================================
    // 1. InventoryItem Indexes
    // ========================================
    console.log('📊 Adding indexes to InventoryItem collection...\n');
    const InventoryItem = mongoose.connection.collection('inventoryitems');

    // Index for owned equipment query (most important!)
    await InventoryItem.createIndex(
      { 
        'currentOwnership.ownerType': 1,
        'currentOwnership.userId': 1,
        'deletedAt': 1,
        'currentOwnership.ownedSince': -1
      },
      { background: true, name: 'owned_equipment_lookup' }
    );
    console.log('✅ Created compound index: currentOwnership.ownerType + userId + deletedAt + ownedSince');

    // Index for itemMasterId lookup
    await InventoryItem.createIndex({ itemMasterId: 1 }, { background: true });
    console.log('✅ Created index: itemMasterId');

    // Index for serial number search
    await InventoryItem.createIndex({ serialNumber: 1 }, { background: true, sparse: true });
    console.log('✅ Created index: serialNumber (sparse)');

    // Index for category
    await InventoryItem.createIndex({ categoryId: 1 }, { background: true });
    console.log('✅ Created index: categoryId');

    // ========================================
    // 2. ReturnLog Indexes
    // ========================================
    console.log('\n📊 Adding indexes to ReturnLog collection...\n');
    const ReturnLog = mongoose.connection.collection('returnlogs');

    // Index for user's return logs
    await ReturnLog.createIndex(
      { 
        userId: 1,
        'items.approvalStatus': 1,
        createdAt: -1
      },
      { background: true, name: 'user_returns_lookup' }
    );
    console.log('✅ Created compound index: userId + items.approvalStatus + createdAt');

    // Index for item tracking in returns
    await ReturnLog.createIndex({ 'items.itemId': 1 }, { background: true });
    console.log('✅ Created index: items.itemId');

    // ========================================
    // 3. RequestLog Indexes
    // ========================================
    console.log('\n📊 Adding indexes to RequestLog collection...\n');
    const RequestLog = mongoose.connection.collection('requestlogs');

    // Index for user's approved requests
    await RequestLog.createIndex(
      { 
        userId: 1,
        status: 1,
        requestType: 1,
        createdAt: -1
      },
      { background: true, name: 'user_requests_lookup' }
    );
    console.log('✅ Created compound index: userId + status + requestType + createdAt');

    // Index for item tracking in requests
    await RequestLog.createIndex({ 'items.assignedItemIds': 1 }, { background: true });
    console.log('✅ Created index: items.assignedItemIds');

    // ========================================
    // 4. InventoryMaster Indexes
    // ========================================
    console.log('\n📊 Adding indexes to InventoryMaster collection...\n');
    const InventoryMaster = mongoose.connection.collection('inventorymasters');

    // Index for master item lookup (non-unique to handle null values)
    await InventoryMaster.createIndex({ masterId: 1 }, { background: true, sparse: true });
    console.log('✅ Created index: masterId (sparse)');

    // Index for category
    await InventoryMaster.createIndex({ categoryId: 1 }, { background: true });
    console.log('✅ Created index: categoryId');

    // Index for name search
    await InventoryMaster.createIndex({ masterName: 'text' }, { background: true });
    console.log('✅ Created text index: masterName');

    // ========================================
    // 5. Office Indexes (if not exists)
    // ========================================
    console.log('\n📊 Adding indexes to Office collection...\n');
    const Office = mongoose.connection.collection('offices');

    // Index for office lookup
    await Office.createIndex({ office_id: 1 }, { background: true, unique: true });
    console.log('✅ Created index: office_id (unique)');

    console.log('\n🎉 All indexes created successfully!\n');

    // Show summary
    console.log('📋 Index Summary:');
    console.log('  InventoryItem: 4 indexes (owned equipment optimization)');
    console.log('  ReturnLog: 2 indexes (return history optimization)');
    console.log('  RequestLog: 2 indexes (request history optimization)');
    console.log('  InventoryMaster: 3 indexes (master item lookup)');
    console.log('  Office: 1 index (office name lookup)');
    console.log('  Total: 12 new indexes\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

addIndexes();

