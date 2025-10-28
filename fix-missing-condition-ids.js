const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function fixMissingConditionIds() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in .env.local');
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const inventoryItems = db.collection('inventoryitems');

    // Find items with null, undefined, or empty conditionId
    const itemsWithoutCondition = await inventoryItems.find({
      $or: [
        { conditionId: { $exists: false } },
        { conditionId: null },
        { conditionId: '' }
      ],
      deletedAt: { $exists: false }
    }).toArray();

    console.log(`Found ${itemsWithoutCondition.length} items without conditionId\n`);

    if (itemsWithoutCondition.length === 0) {
      console.log('✅ No items need fixing');
      await mongoose.connection.close();
      return;
    }

    console.log('Items without conditionId:');
    console.log('='.repeat(100));

    for (const item of itemsWithoutCondition) {
      console.log(`\n📦 ${item.itemName} (${item.categoryId})`);
      console.log(`   ID: ${item._id}`);
      console.log(`   Status: ${item.statusId || 'undefined'}`);
      console.log(`   Condition: ${item.conditionId || 'undefined'}`);
      console.log(`   Owner: ${item.currentOwnership?.ownerType || 'N/A'}`);
      console.log(`   SN: ${item.serialNumber || 'N/A'}`);
    }

    console.log('\n' + '='.repeat(100));
    console.log('\nFixing items by setting default conditionId to "cond_working"...\n');

    // Update all items without conditionId to have 'cond_working' as default
    const result = await inventoryItems.updateMany(
      {
        $or: [
          { conditionId: { $exists: false } },
          { conditionId: null },
          { conditionId: '' }
        ],
        deletedAt: { $exists: false }
      },
      {
        $set: {
          conditionId: 'cond_working'
        }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} items with default conditionId='cond_working'`);

    // Now update InventoryMaster for affected items
    const uniqueItems = [...new Set(itemsWithoutCondition.map(item => `${item.itemName}|${item.categoryId}`))];
    
    console.log(`\n📊 Need to update ${uniqueItems.length} InventoryMaster records...\n`);

    const InventoryMaster = db.collection('inventorymasters');
    let updatedMasters = 0;

    for (const key of uniqueItems) {
      const [itemName, categoryId] = key.split('|');
      
      // Recalculate availableQuantity
      const allItems = await inventoryItems.find({
        itemName,
        categoryId,
        deletedAt: { $exists: false }
      }).toArray();

      const adminStockItems = allItems.filter(item => 
        item.currentOwnership?.ownerType === 'admin_stock'
      );

      const availableToBorrow = adminStockItems.filter(item => 
        item.statusId === 'status_available' && item.conditionId === 'cond_working'
      );

      // Update condition breakdown
      const conditionBreakdown = {};
      allItems.forEach(item => {
        const conditionId = item.conditionId || 'undefined';
        conditionBreakdown[conditionId] = (conditionBreakdown[conditionId] || 0) + 1;
      });

      await InventoryMaster.updateOne(
        { itemName, categoryId },
        {
          $set: {
            availableQuantity: availableToBorrow.length,
            conditionBreakdown: conditionBreakdown,
            lastUpdated: new Date()
          }
        }
      );

      updatedMasters++;
      console.log(`✅ Updated ${itemName}: availableQuantity=${availableToBorrow.length}`);
    }

    console.log(`\n✅ Updated ${updatedMasters} InventoryMaster records`);
    console.log('\n✅ Fix completed!');

    await mongoose.connection.close();
    console.log('✅ Connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixMissingConditionIds();

