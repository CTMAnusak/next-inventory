/**
 * สคริปต์สำหรับลบข้อมูลทั้งหมดใน collection "inventoryconfigs"
 * ใช้เพื่อลบการเก็บสีออกจากระบบ
 */

const { MongoClient } = require('mongodb');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/next-inventory';

async function clearInventoryConfigs() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔌 กำลังเชื่อมต่อ MongoDB...');
    await client.connect();
    console.log('✅ เชื่อมต่อ MongoDB สำเร็จ');
    
    const db = client.db();
    
    // ตรวจสอบว่ามี collection inventoryconfigs หรือไม่
    const collections = await db.listCollections().toArray();
    const inventoryConfigsExists = collections.some(col => col.name === 'inventoryconfigs');
    
    if (!inventoryConfigsExists) {
      console.log('⚠️  ไม่พบ collection "inventoryconfigs"');
      return;
    }
    
    // นับจำนวนเอกสารก่อนลบ
    const countBefore = await db.collection('inventoryconfigs').countDocuments();
    console.log(`📊 พบเอกสาร ${countBefore} รายการใน collection "inventoryconfigs"`);
    
    if (countBefore === 0) {
      console.log('✅ Collection "inventoryconfigs" ว่างเปล่าอยู่แล้ว');
      return;
    }
    
    // ลบข้อมูลทั้งหมดใน collection
    console.log('🗑️  กำลังลบข้อมูลทั้งหมด...');
    const result = await db.collection('inventoryconfigs').deleteMany({});
    
    console.log(`✅ ลบข้อมูลสำเร็จ: ${result.deletedCount} รายการ`);
    
    // ตรวจสอบจำนวนเอกสารหลังลบ
    const countAfter = await db.collection('inventoryconfigs').countDocuments();
    console.log(`📊 จำนวนเอกสารหลังลบ: ${countAfter} รายการ`);
    
    if (countAfter === 0) {
      console.log('🎉 ลบข้อมูลทั้งหมดเรียบร้อยแล้ว!');
    } else {
      console.log('⚠️  ยังมีข้อมูลเหลืออยู่');
    }
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
  } finally {
    await client.close();
    console.log('🔌 ปิดการเชื่อมต่อ MongoDB');
  }
}

// รันสคริปต์
if (require.main === module) {
  clearInventoryConfigs()
    .then(() => {
      console.log('🏁 สคริปต์ทำงานเสร็จสิ้น');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 สคริปต์ล้มเหลว:', error);
      process.exit(1);
    });
}

module.exports = { clearInventoryConfigs };
