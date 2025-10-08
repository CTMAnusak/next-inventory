const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/next-inventory';

async function debugUserAA() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Check all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📋 Available collections:');
    collections.forEach(col => console.log(`- ${col.name}`));
    
    // Check InventoryItems collection for user AA
    console.log('\n🔍 Checking InventoryItems collection for user AA...');
    const inventoryItems = await db.collection('inventoryitems').find({
      'currentOwnership.ownerType': 'user_owned',
      'currentOwnership.userId': 'AA',
      deletedAt: { $exists: false }
    }).toArray();
    console.log(`Items owned by user AA in inventoryitems: ${inventoryItems.length}`);
    
    // Check InventoryItems collection (with capital I)
    console.log('\n🔍 Checking InventoryItems collection (capital I) for user AA...');
    const inventoryItemsCapital = await db.collection('InventoryItems').find({
      'currentOwnership.ownerType': 'user_owned',
      'currentOwnership.userId': 'AA',
      deletedAt: { $exists: false }
    }).toArray();
    console.log(`Items owned by user AA in InventoryItems: ${inventoryItemsCapital.length}`);
    
    // Check all user-owned items in both collections
    console.log('\n🔍 All user-owned items in inventoryitems:');
    const allUserOwned = await db.collection('inventoryitems').find({
      'currentOwnership.ownerType': 'user_owned',
      deletedAt: { $exists: false }
    }).toArray();
    console.log(`Total user-owned items: ${allUserOwned.length}`);
    allUserOwned.forEach((item, index) => {
      console.log(`${index + 1}. User: ${item.currentOwnership?.userId}, Item: ${item.itemName}`);
    });
    
    console.log('\n🔍 All user-owned items in InventoryItems (capital I):');
    const allUserOwnedCapital = await db.collection('InventoryItems').find({
      'currentOwnership.ownerType': 'user_owned',
      deletedAt: { $exists: false }
    }).toArray();
    console.log(`Total user-owned items: ${allUserOwnedCapital.length}`);
    allUserOwnedCapital.forEach((item, index) => {
      console.log(`${index + 1}. User: ${item.currentOwnership?.userId}, Item: ${item.itemName}`);
    });
    
    // Check users collection
    console.log('\n👥 Checking users collection...');
    const userAA = await db.collection('users').find({ user_id: 'AA' }).toArray();
    console.log(`User AA records: ${userAA.length}`);
    if (userAA.length > 0) {
      userAA.forEach((user, index) => {
        console.log(`${index + 1}. Name: ${user.firstName} ${user.lastName}, Nickname: ${user.nickname}`);
      });
    }
    
    // Check all users with 'AA' in their name
    console.log('\n👥 All users with AA in their name:');
    const usersWithAA = await db.collection('users').find({
      $or: [
        { firstName: { $regex: 'AA', $options: 'i' } },
        { lastName: { $regex: 'AA', $options: 'i' } },
        { nickname: { $regex: 'AA', $options: 'i' } }
      ]
    }).toArray();
    console.log(`Users with AA in name: ${usersWithAA.length}`);
    usersWithAA.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.user_id}, Name: ${user.firstName} ${user.lastName}, Nickname: ${user.nickname}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the debug function
debugUserAA();
