const mongoose = require('mongoose');

// Import models
require('dotenv').config();
const dbConnect = require('./src/lib/mongodb').default;
const InventoryItem = require('./src/models/InventoryItem').default;

async function debugLogitechItems() {
  try {
    await dbConnect();
    
    const itemName = 'Logitech';
    const categoryId = 'cat_mouse'; // ปรับตาม categoryId จริง
    
    console.log(`\n🔍 Searching for: ${itemName}`);
    console.log(`📂 Category: ${categoryId}\n`);
    
    // Query items
    const items = await InventoryItem.find({
      itemName: { $regex: itemName, $options: 'i' },
      serialNumber: { $in: [null, ''] },
      numberPhone: { $in: [null, ''] },
      'currentOwnership.ownerType': 'admin_stock',
      deletedAt: { $exists: false }
    }).select('itemName categoryId statusId conditionId _id');
    
    console.log(`📊 Total items found: ${items.length}\n`);
    
    // Group by statusId and conditionId
    const groups = {};
    items.forEach(item => {
      const statusId = item.statusId || 'status_available';
      const conditionId = item.conditionId || 'cond_working';
      const key = `${statusId}_${conditionId}`;
      
      if (!groups[key]) {
        groups[key] = {
          statusId,
          conditionId,
          count: 0,
          items: []
        };
      }
      
      groups[key].count++;
      groups[key].items.push({
        _id: item._id,
        statusId: item.statusId,
        conditionId: item.conditionId
      });
    });
    
    console.log('📋 Grouping Results:\n');
    Object.entries(groups).forEach(([key, data]) => {
      console.log(`🔹 ${key}:`);
      console.log(`   Status: ${data.statusId}`);
      console.log(`   Condition: ${data.conditionId}`);
      console.log(`   Count: ${data.count}`);
      console.log(`   Items:`, data.items.map(i => ({
        _id: i._id.toString().slice(-6),
        statusId: i.statusId || 'undefined',
        conditionId: i.conditionId || 'undefined'
      })));
      console.log('');
    });
    
    console.log('\n✅ Debug complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugLogitechItems();

