const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const InventorySnapshotSchema = new mongoose.Schema({
  year: Number,
  month: Number,
  snapshotDate: Date,
  totalInventoryItems: Number,
  totalInventoryCount: Number,
  lowStockItems: Number,
  itemDetails: Array
}, { timestamps: true });

const InventorySnapshot = mongoose.model('InventorySnapshots', InventorySnapshotSchema);

async function checkSnapshots() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const snapshots = await InventorySnapshot.find({}).sort({ year: -1, month: -1 });
    
    console.log('📊 Snapshots ใน Database:');
    console.log('จำนวนทั้งหมด:', snapshots.length);
    console.log('');
    
    snapshots.forEach((snapshot, index) => {
      console.log(`${index + 1}. ปี ${snapshot.year} เดือน ${snapshot.month}`);
      console.log(`   - totalInventoryItems: ${snapshot.totalInventoryItems}`);
      console.log(`   - totalInventoryCount: ${snapshot.totalInventoryCount}`);
      console.log(`   - lowStockItems: ${snapshot.lowStockItems}`);
      console.log(`   - itemDetails: ${snapshot.itemDetails?.length || 0} รายการ`);
      console.log(`   - สร้างเมื่อ: ${snapshot.createdAt}`);
      console.log('');
    });
    
    await mongoose.disconnect();
    console.log('✅ เสร็จสิ้น');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSnapshots();
