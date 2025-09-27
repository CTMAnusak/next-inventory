const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testInventorySync() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management';
  console.log('🔗 Connecting to:', uri);
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('🔍 Testing Inventory Sync...');
    
    // Check InventoryItems
    const inventoryItems = await db.collection('inventoryitems').find({}).toArray();
    console.log('📦 InventoryItems count:', inventoryItems.length);
    
    // Check InventoryMasters
    const inventoryMasters = await db.collection('inventorymasters').find({}).toArray();
    console.log('📊 InventoryMasters count:', inventoryMasters.length);
    
    // Show details
    console.log('\n📦 InventoryItems:');
    inventoryItems.forEach(item => {
      console.log(`  - ${item.itemName} (${item.categoryId}): ${item.currentOwnership?.ownerType || 'unknown'}`);
    });
    
    console.log('\n📊 InventoryMasters:');
    inventoryMasters.forEach(master => {
      console.log(`  - ${master.itemName} (${master.categoryId}): Total=${master.totalQuantity}, Available=${master.availableQuantity}, UserOwned=${master.userOwnedQuantity}`);
    });
    
    // Check for missing masters
    const itemNames = [...new Set(inventoryItems.map(item => `${item.itemName}|${item.categoryId}`))];
    const masterNames = [...new Set(inventoryMasters.map(master => `${master.itemName}|${master.categoryId}`))];
    
    console.log('\n🔍 Missing Masters:');
    const missingMasters = itemNames.filter(name => !masterNames.includes(name));
    missingMasters.forEach(name => {
      console.log(`  - Missing master for: ${name}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

testInventorySync();
