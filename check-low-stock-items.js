const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database-name';

mongoose.connect(MONGODB_URI);

const InventoryMasterSchema = new mongoose.Schema({}, { strict: false, collection: 'inventorymasters' });
const InventoryItemSchema = new mongoose.Schema({}, { strict: false, collection: 'inventoryitems' });

const InventoryMaster = mongoose.model('InventoryMaster', InventoryMasterSchema);
const InventoryItem = mongoose.model('InventoryItem', InventoryItemSchema);

async function checkLowStockItems() {
  try {
    console.log('🔍 กำลังตรวจสอบรายการอุปกรณ์ที่ใกล้หมด (≤ 2)...\n');

    // นับจำนวนรายการที่มี availableQuantity <= 2 และ >= 0
    const lowStockCount = await InventoryMaster.countDocuments({
      availableQuantity: { $lte: 2, $gte: 0 }
    });

    console.log(`✅ จำนวนรายการอุปกรณ์ที่ใกล้หมด (≤ 2): ${lowStockCount} รายการ\n`);
    console.log('='.repeat(80));

    // แสดงรายละเอียดของรายการที่ใกล้หมด
    const lowStockItems = await InventoryMaster.find({
      availableQuantity: { $lte: 2, $gte: 0 }
    })
    .select('itemName categoryId totalQuantity availableQuantity userOwnedQuantity createdAt')
    .sort({ availableQuantity: 1, itemName: 1 })
    .lean();

    console.log(`รายละเอียด ${lowStockItems.length} รายการ:`);
    console.log('='.repeat(80));

    lowStockItems.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.itemName}`);
      console.log(`   หมวดหมู่ ID: ${item.categoryId}`);
      console.log(`   จำนวนที่เบิกได้: ${item.availableQuantity || 0} (ใกล้หมด/หมด)`);
      console.log(`   จำนวนทั้งหมด: ${item.totalQuantity || 0}`);
      console.log(`   จำนวนที่ user ถือ: ${item.userOwnedQuantity || 0}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('สรุปผล:');
    console.log('='.repeat(80));
    console.log(`📊 จำนวนรายการที่ใกล้หมด (≤ 2): ${lowStockCount} รายการ`);
    
    // แยกตามระดับความใกล้หมด
    const zeroStock = lowStockItems.filter(item => (item.availableQuantity || 0) === 0).length;
    const oneStock = lowStockItems.filter(item => (item.availableQuantity || 0) === 1).length;
    const twoStock = lowStockItems.filter(item => (item.availableQuantity || 0) === 2).length;

    console.log(`    - หมด (0): ${zeroStock} รายการ`);
    console.log(`    - เหลือ 1: ${oneStock} รายการ`);
    console.log(`    - เหลือ 2: ${twoStock} รายการ`);

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkLowStockItems();

