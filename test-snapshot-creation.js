/**
 * สคริปต์ทดสอบการสร้าง Snapshot
 * ใช้เพื่อตรวจสอบว่ามีการบันทึกข้อมูลลง MongoDB จริงหรือไม่
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const InventorySnapshotSchema = new mongoose.Schema({
  year: { type: Number, required: true, index: true },
  month: { type: Number, required: true, min: 1, max: 12, index: true },
  snapshotDate: { type: Date, required: true, index: true },
  totalInventoryItems: { type: Number, required: true, min: 0, default: 0 },
  totalInventoryCount: { type: Number, required: true, min: 0, default: 0 },
  lowStockItems: { type: Number, required: true, min: 0, default: 0 },
  itemDetails: [{
    masterId: { type: String, required: false },
    itemName: { type: String, required: true },
    categoryId: { type: String, required: true },
    categoryName: { type: String, required: true },
    totalQuantity: { type: Number, required: true, min: 0 },
    availableQuantity: { type: Number, required: true, min: 0 },
    userOwnedQuantity: { type: Number, required: true, min: 0 },
    isLowStock: { type: Boolean, default: false }
  }]
}, {
  timestamps: true
});

InventorySnapshotSchema.index({ year: 1, month: 1 }, { unique: true });
InventorySnapshotSchema.index({ snapshotDate: -1 });

const InventorySnapshot = mongoose.models.InventorySnapshots || 
  mongoose.model('InventorySnapshots', InventorySnapshotSchema);

async function testSnapshotCreation() {
  try {
    console.log('🔌 กำลังเชื่อมต่อ MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('ไม่พบ MONGODB_URI ใน environment variables');
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ เชื่อมต่อ MongoDB สำเร็จ\n');

    // ตรวจสอบ collection ที่มีอยู่
    const collections = await mongoose.connection.db.listCollections().toArray();
    const snapshotCollection = collections.find(c => c.name === 'inventorysnapshots');
    
    console.log('📊 ตรวจสอบ Collection:');
    console.log(`   - Collection "inventorysnapshots" ${snapshotCollection ? '✅ พบ' : '❌ ไม่พบ'}\n`);

    // ตรวจสอบจำนวน documents ที่มีอยู่
    const existingCount = await InventorySnapshot.countDocuments();
    console.log(`📈 จำนวน Snapshot ที่มีอยู่: ${existingCount}\n`);

    // ทดสอบสร้าง snapshot ใหม่
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const testMonth = lastMonth.getMonth() + 1;
    const testYear = lastMonth.getFullYear() + 543;
    const snapshotDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59);

    console.log('🧪 ทดสอบสร้าง Snapshot:');
    console.log(`   - ปี: ${testYear}`);
    console.log(`   - เดือน: ${testMonth}`);
    console.log(`   - Snapshot Date: ${snapshotDate.toISOString()}\n`);

    // ตรวจสอบว่ามี snapshot อยู่แล้วหรือไม่
    const existing = await InventorySnapshot.findOne({ year: testYear, month: testMonth });
    if (existing) {
      console.log('⚠️  พบ Snapshot ที่มีอยู่แล้ว จะทำการอัพเดต...\n');
      console.log('ข้อมูลเดิม:');
      console.log(JSON.stringify(existing.toObject(), null, 2));
    }

    // สร้างหรืออัพเดต snapshot
    const testSnapshot = await InventorySnapshot.findOneAndUpdate(
      { year: testYear, month: testMonth },
      {
        $set: {
          year: testYear,
          month: testMonth,
          snapshotDate: snapshotDate,
          totalInventoryItems: 10,
          totalInventoryCount: 50,
          lowStockItems: 2,
          itemDetails: [
            {
              masterId: 'master_test_001',
              itemName: 'ทดสอบ Item 1',
              categoryId: 'cat_test',
              categoryName: 'หมวดทดสอบ',
              totalQuantity: 20,
              availableQuantity: 15,
              userOwnedQuantity: 5,
              isLowStock: false
            },
            {
              masterId: 'master_test_002',
              itemName: 'ทดสอบ Item 2',
              categoryId: 'cat_test',
              categoryName: 'หมวดทดสอบ',
              totalQuantity: 5,
              availableQuantity: 1,
              userOwnedQuantity: 4,
              isLowStock: true
            }
          ]
        }
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    console.log('✅ สร้าง/อัพเดต Snapshot สำเร็จ!\n');
    console.log('📄 ข้อมูลที่บันทึก:');
    console.log(JSON.stringify(testSnapshot.toObject(), null, 2));
    console.log('\n');

    // ตรวจสอบอีกครั้งว่ามีข้อมูลจริง
    const verifyCount = await InventorySnapshot.countDocuments();
    const verifySnapshot = await InventorySnapshot.findOne({ year: testYear, month: testMonth });

    console.log('🔍 ตรวจสอบผลลัพธ์:');
    console.log(`   - จำนวน Snapshot ทั้งหมด: ${verifyCount}`);
    console.log(`   - พบ Snapshot ที่สร้าง: ${verifySnapshot ? '✅' : '❌'}`);
    
    if (verifySnapshot) {
      console.log(`   - _id: ${verifySnapshot._id}`);
      console.log(`   - totalInventoryItems: ${verifySnapshot.totalInventoryItems}`);
      console.log(`   - totalInventoryCount: ${verifySnapshot.totalInventoryCount}`);
      console.log(`   - lowStockItems: ${verifySnapshot.lowStockItems}`);
      console.log(`   - itemDetails count: ${verifySnapshot.itemDetails?.length || 0}`);
      console.log(`   - createdAt: ${verifySnapshot.createdAt}`);
      console.log(`   - updatedAt: ${verifySnapshot.updatedAt}`);
    }

    // ตรวจสอบโดยตรงจาก MongoDB
    console.log('\n🔍 ตรวจสอบจาก MongoDB โดยตรง:');
    const db = mongoose.connection.db;
    const directCount = await db.collection('inventorysnapshots').countDocuments();
    const directDoc = await db.collection('inventorysnapshots').findOne({ 
      year: testYear, 
      month: testMonth 
    });

    console.log(`   - จำนวน documents ใน collection: ${directCount}`);
    console.log(`   - พบ document ที่สร้าง: ${directDoc ? '✅' : '❌'}`);

    if (directDoc) {
      console.log('   - ข้อมูลจาก MongoDB:');
      console.log(JSON.stringify(directDoc, null, 2));
    }

    await mongoose.disconnect();
    console.log('\n✅ ทดสอบเสร็จสิ้น');

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testSnapshotCreation();

