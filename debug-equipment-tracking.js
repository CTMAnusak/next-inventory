const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/next-inventory';

async function debugEquipmentTracking() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get collections
    const db = mongoose.connection.db;
    
    // Check InventoryItems collection
    console.log('\n🔍 Checking InventoryItems collection...');
    const inventoryItems = await db.collection('inventoryitems').find({}).toArray();
    console.log(`Total InventoryItems: ${inventoryItems.length}`);
    
    // Check user-owned items
    const userOwnedItems = await db.collection('inventoryitems').find({
      'currentOwnership.ownerType': 'user_owned',
      deletedAt: { $exists: false }
    }).toArray();
    console.log(`User-owned items: ${userOwnedItems.length}`);
    
    // Check for user AA specifically
    const userAAItems = await db.collection('inventoryitems').find({
      'currentOwnership.ownerType': 'user_owned',
      'currentOwnership.userId': 'AA',
      deletedAt: { $exists: false }
    }).toArray();
    console.log(`Items owned by user AA: ${userAAItems.length}`);
    
    if (userAAItems.length > 0) {
      console.log('\n📋 User AA items:');
      userAAItems.forEach((item, index) => {
        console.log(`${index + 1}. Item: ${item.itemName}, Category: ${item.categoryId}, Status: ${item.statusId}`);
        console.log(`   Ownership: ${JSON.stringify(item.currentOwnership)}`);
        console.log(`   Source: ${JSON.stringify(item.sourceInfo)}`);
      });
    }
    
    // Check Users collection
    console.log('\n👥 Checking Users collection...');
    const users = await db.collection('users').find({}).toArray();
    console.log(`Total Users: ${users.length}`);
    
    // Check for user AA
    const userAA = await db.collection('users').find({ user_id: 'AA' }).toArray();
    console.log(`User AA records: ${userAA.length}`);
    
    if (userAA.length > 0) {
      console.log('\n👤 User AA details:');
      userAA.forEach((user, index) => {
        console.log(`${index + 1}. Name: ${user.firstName} ${user.lastName}, Nickname: ${user.nickname}`);
        console.log(`   Department: ${user.department}, Office: ${user.office}`);
        console.log(`   Phone: ${user.phone}`);
      });
    }
    
    // Check RequestLogs for approved requests
    console.log('\n📝 Checking RequestLogs...');
    const approvedRequests = await db.collection('requestlogs').find({
      status: 'approved',
      requestType: 'request'
    }).toArray();
    console.log(`Approved requests: ${approvedRequests.length}`);
    
    // Check for requests by user AA
    const userAARequests = await db.collection('requestlogs').find({
      userId: 'AA',
      status: 'approved'
    }).toArray();
    console.log(`Approved requests by user AA: ${userAARequests.length}`);
    
    if (userAARequests.length > 0) {
      console.log('\n📋 User AA approved requests:');
      userAARequests.forEach((req, index) => {
        console.log(`${index + 1}. Request Date: ${req.requestDate}`);
        console.log(`   Items: ${JSON.stringify(req.items)}`);
      });
    }
    
    // Check InventoryConfig
    console.log('\n⚙️ Checking InventoryConfig...');
    const configs = await db.collection('inventoryconfigs').find({}).toArray();
    console.log(`InventoryConfig records: ${configs.length}`);
    
    if (configs.length > 0) {
      const config = configs[0];
      console.log(`Category configs: ${config.categoryConfigs?.length || 0}`);
      console.log(`Status configs: ${config.statusConfigs?.length || 0}`);
      console.log(`Condition configs: ${config.conditionConfigs?.length || 0}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the debug function
debugEquipmentTracking();
