/**
 * Test script to check if assignedItemIds are saved in RequestLog
 * Usage: node test-assigned-items.js
 */

require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory';

async function testAssignedItems() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Define RequestLog schema (simplified)
    const RequestLogSchema = new mongoose.Schema({}, { strict: false });
    const RequestLog = mongoose.models.RequestLog || mongoose.model('RequestLog', RequestLogSchema);

    // Find the most recent approved request
    const recentRequests = await RequestLog.find({ status: 'approved' })
      .sort({ approvedAt: -1 })
      .limit(5)
      .lean();

    if (recentRequests.length === 0) {
      console.log('❌ No approved requests found');
      return;
    }

    console.log(`📋 Found ${recentRequests.length} recent approved requests:\n`);

    recentRequests.forEach((req, idx) => {
      console.log(`${idx + 1}. RequestLog ID: ${req._id}`);
      console.log(`   Status: ${req.status}`);
      console.log(`   User ID: ${req.userId}`);
      console.log(`   Approved At: ${req.approvedAt}`);
      console.log(`   Delivery Location: ${req.deliveryLocation}`);
      console.log(`   Items:`);
      
      req.items?.forEach((item, itemIdx) => {
        console.log(`      ${itemIdx + 1}. masterId: ${item.masterId || 'N/A'}`);
        console.log(`         quantity: ${item.quantity}`);
        console.log(`         assignedQuantity: ${item.assignedQuantity || 0}`);
        console.log(`         itemApproved: ${item.itemApproved || false}`);
        console.log(`         assignedItemIds: ${item.assignedItemIds ? `[${item.assignedItemIds.join(', ')}]` : 'undefined/empty'}`);
        console.log(`         assignedSerialNumbers: ${item.assignedSerialNumbers ? `[${item.assignedSerialNumbers.join(', ')}]` : 'undefined/empty'}`);
      });
      console.log('');
    });

    // Now check InventoryItem to see if those items are actually transferred
    console.log('📦 Checking InventoryItem ownership:\n');

    const InventoryItemSchema = new mongoose.Schema({}, { strict: false });
    const InventoryItem = mongoose.models.InventoryItem || mongoose.model('InventoryItem', InventoryItemSchema);

    for (const req of recentRequests) {
      console.log(`\n📋 Request ${req._id}:`);
      
      for (const item of req.items || []) {
        if (item.assignedItemIds && item.assignedItemIds.length > 0) {
          console.log(`   Checking assigned items for masterId ${item.masterId}:`);
          
          for (const itemId of item.assignedItemIds) {
            const inventoryItem = await InventoryItem.findById(itemId).lean();
            
            if (inventoryItem) {
              console.log(`      ✅ Found: ${inventoryItem.itemName} (${itemId})`);
              console.log(`         ownerType: ${inventoryItem.currentOwnership?.ownerType}`);
              console.log(`         userId: ${inventoryItem.currentOwnership?.userId}`);
              console.log(`         serialNumber: ${inventoryItem.serialNumber || 'ไม่มี'}`);
            } else {
              console.log(`      ❌ Not found: ${itemId}`);
            }
          }
        } else {
          console.log(`   ⚠️ No assignedItemIds for masterId ${item.masterId}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testAssignedItems();

