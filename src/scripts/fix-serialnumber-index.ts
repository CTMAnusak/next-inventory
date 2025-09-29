import dbConnect from '../lib/mongodb';
import mongoose from 'mongoose';

async function fixSerialNumberIndex() {
  try {
    
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection failed');
    }
    const collection = db.collection('inventoryitems');

    // 1. ดู indexes ที่มีอยู่
    const currentIndexes = await collection.listIndexes().toArray();
    currentIndexes.forEach(index => {
      console.log(`  - ${JSON.stringify(index)}`);
    });

    // 2. ลบ index เก่าที่มีปัญหาทั้งหมด
    const indexesToDrop = ['serialNumber_1', 'serialNumber_sparse_unique', 'serialNumber_sparse_nonunique'];
    
    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
      } catch (error: any) {
        if (error.codeName === 'IndexNotFound') {
        } else {
          console.log(`⚠️ Error dropping index ${indexName}:`, error.message);
        }
      }
    }

    // 3. สร้าง partial index ใหม่ (เฉพาะ documents ที่มี serialNumber)
    await collection.createIndex(
      { serialNumber: 1 }, 
      { 
        unique: true,   // ยังคง unique สำหรับ SN ที่มีค่า
        partialFilterExpression: { 
          $and: [
            { serialNumber: { $exists: true } },
            { serialNumber: { $ne: null } },
            { serialNumber: { $ne: "" } }
          ]
        },
        name: 'serialNumber_partial_unique'
      }
    );

    // 4. ตรวจสอบ indexes ใหม่
    const updatedIndexes = await collection.listIndexes().toArray();
    updatedIndexes.forEach(index => {
      console.log(`  - ${JSON.stringify(index)}`);
    });

    // 5. ทำความสะอาดข้อมูล - แปลง empty string เป็น undefined
    console.log('\n🧹 Cleaning up serialNumber data...');
    const cleanupResult = await collection.updateMany(
      { serialNumber: { $in: [null, ""] } },
      { $unset: { serialNumber: 1 } }
    );

    // 6. ทดสอบโดยการนับ documents ที่มี serialNumber เป็น null
    const nullSerialCount = await collection.countDocuments({ 
      $or: [
        { serialNumber: null },
        { serialNumber: { $exists: false } },
        { serialNumber: "" }
      ]
    });

    // 7. ทดสอบโดยการนับ documents ที่มี serialNumber ที่มีค่า
    const validSerialCount = await collection.countDocuments({ 
      $and: [
        { serialNumber: { $exists: true } },
        { serialNumber: { $ne: null } },
        { serialNumber: { $ne: "" } }
      ]
    });

    
  } catch (error) {
    console.error('❌ Error fixing serialNumber index:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  fixSerialNumberIndex()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { fixSerialNumberIndex };
