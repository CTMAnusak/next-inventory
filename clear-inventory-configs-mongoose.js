/**
 * สคริปต์สำหรับลบข้อมูลทั้งหมดใน collection "inventoryconfigs"
 * ใช้ mongoose แทน mongodb driver
 */

const mongoose = require('mongoose');

// MongoDB connection string - ใช้ค่าเริ่มต้น
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/next-inventory';

async function clearInventoryConfigs() {
  try {
    console.log('🔌 กำลังเชื่อมต่อ MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    console.log('✅ เชื่อมต่อ MongoDB สำเร็จ');
    
    // ตรวจสอบว่ามี collection inventoryconfigs หรือไม่
    const collections = await mongoose.connection.db.listCollections().toArray();
    const inventoryConfigsExists = collections.some(col => col.name === 'inventoryconfigs');
    
    if (!inventoryConfigsExists) {
      console.log('⚠️  ไม่พบ collection "inventoryconfigs"');
      return;
    }
    
    // นับจำนวนเอกสารก่อนลบ
    const countBefore = await mongoose.connection.db.collection('inventoryconfigs').countDocuments();
    console.log(`📊 พบเอกสาร ${countBefore} รายการใน collection "inventoryconfigs"`);
    
    if (countBefore === 0) {
      console.log('✅ Collection "inventoryconfigs" ว่างเปล่าอยู่แล้ว');
      return;
    }
    
    // ลบข้อมูลทั้งหมดใน collection
    console.log('🗑️  กำลังลบข้อมูลทั้งหมด...');
    const result = await mongoose.connection.db.collection('inventoryconfigs').deleteMany({});
    
    console.log(`✅ ลบข้อมูลสำเร็จ: ${result.deletedCount} รายการ`);
    
    // ตรวจสอบจำนวนเอกสารหลังลบ
    const countAfter = await mongoose.connection.db.collection('inventoryconfigs').countDocuments();
    console.log(`📊 จำนวนเอกสารหลังลบ: ${countAfter} รายการ`);
    
    if (countAfter === 0) {
      console.log('🎉 ลบข้อมูลทั้งหมดเรียบร้อยแล้ว!');
    } else {
      console.log('⚠️  ยังมีข้อมูลเหลืออยู่');
    }
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 ข้อเสนอแนะ:');
      console.log('   1. ตรวจสอบว่า MongoDB กำลังรันอยู่หรือไม่');
      console.log('   2. ตรวจสอบ MONGODB_URI ใน environment variables');
      console.log('   3. ลองใช้ MongoDB Compass หรือ MongoDB Shell');
    }
  } finally {
    await mongoose.disconnect();
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
