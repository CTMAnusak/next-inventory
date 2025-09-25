/**
 * สคริปต์สำหรับลบฟิลด์ color ออกจากข้อมูลที่มีอยู่ในฐานข้อมูล
 * ใช้หลังจากที่ user ลบข้อมูลทั้งหมดใน inventoryconfigs แล้ว
 * และระบบสร้างข้อมูลใหม่ที่ยังมีฟิลด์ color อยู่
 */

const mongoose = require('mongoose');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/next-inventory';

async function removeColorFields() {
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
    
    // ดึงข้อมูลทั้งหมด
    const configs = await mongoose.connection.db.collection('inventoryconfigs').find({}).toArray();
    console.log(`📊 พบ ${configs.length} เอกสารใน collection "inventoryconfigs"`);
    
    if (configs.length === 0) {
      console.log('ℹ️  ไม่มีข้อมูลในฐานข้อมูล');
      return;
    }
    
    let updateCount = 0;
    
    for (const config of configs) {
      let needsUpdate = false;
      const updateData = {};
      
      // ตรวจสอบและลบฟิลด์ color จาก statusConfigs
      if (config.statusConfigs && Array.isArray(config.statusConfigs)) {
        const cleanedStatusConfigs = config.statusConfigs.map(status => {
          const { color, ...statusWithoutColor } = status;
          return statusWithoutColor;
        });
        
        // ตรวจสอบว่ามีการเปลี่ยนแปลงหรือไม่
        if (config.statusConfigs.some(status => status.hasOwnProperty('color'))) {
          updateData.statusConfigs = cleanedStatusConfigs;
          needsUpdate = true;
          console.log(`🔧 จะลบฟิลด์ color จาก statusConfigs ใน document ${config._id}`);
        }
      }
      
      // ตรวจสอบและลบฟิลด์ color จาก conditionConfigs
      if (config.conditionConfigs && Array.isArray(config.conditionConfigs)) {
        const cleanedConditionConfigs = config.conditionConfigs.map(condition => {
          const { color, ...conditionWithoutColor } = condition;
          return conditionWithoutColor;
        });
        
        // ตรวจสอบว่ามีการเปลี่ยนแปลงหรือไม่
        if (config.conditionConfigs.some(condition => condition.hasOwnProperty('color'))) {
          updateData.conditionConfigs = cleanedConditionConfigs;
          needsUpdate = true;
          console.log(`🔧 จะลบฟิลด์ color จาก conditionConfigs ใน document ${config._id}`);
        }
      }
      
      // อัปเดตเอกสารหากจำเป็น
      if (needsUpdate) {
        await mongoose.connection.db.collection('inventoryconfigs').updateOne(
          { _id: config._id },
          { $set: updateData }
        );
        updateCount++;
        console.log(`✅ อัปเดต document ${config._id} เรียบร้อยแล้ว`);
      }
    }
    
    console.log(`🎉 เสร็จสิ้น! อัปเดต ${updateCount} เอกสาร`);
    
    if (updateCount === 0) {
      console.log('ℹ️  ไม่พบฟิลด์ color ที่ต้องลบ ข้อมูลสะอาดแล้ว');
    }
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 ข้อเสนอแนะ:');
      console.log('   1. ตรวจสอบว่า MongoDB กำลังรันอยู่หรือไม่');
      console.log('   2. ตรวจสอบ MONGODB_URI ใน environment variables');
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 ปิดการเชื่อมต่อ MongoDB');
  }
}

// รันสคริปต์
if (require.main === module) {
  removeColorFields()
    .then(() => {
      console.log('🏁 สคริปต์ทำงานเสร็จสิ้น');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 สคริปต์ล้มเหลว:', error);
      process.exit(1);
    });
}

module.exports = { removeColorFields };
