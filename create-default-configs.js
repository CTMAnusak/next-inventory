/**
 * สคริปต์สำหรับสร้างข้อมูล default configs ใหม่ที่ไม่มีสี
 * ใช้หลังจากที่ลบข้อมูลทั้งหมดใน inventoryconfigs แล้ว
 */

const mongoose = require('mongoose');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/next-inventory';

async function createDefaultConfigs() {
  try {
    console.log('🔌 กำลังเชื่อมต่อ MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    console.log('✅ เชื่อมต่อ MongoDB สำเร็จ');
    
    // ตรวจสอบว่ามีข้อมูลอยู่แล้วหรือไม่
    const existingConfig = await mongoose.connection.db.collection('inventoryconfigs').findOne({});
    
    if (existingConfig) {
      console.log('⚠️  มีข้อมูล config อยู่แล้ว');
      console.log('📊 ข้อมูลที่มีอยู่:', JSON.stringify(existingConfig, null, 2));
      return;
    }
    
    // สร้างข้อมูล default ใหม่ที่ไม่มีสี
    const defaultConfig = {
      statusConfigs: [
        {
          id: 'status_available',
          name: 'มี',
          order: 1,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'status_missing',
          name: 'หาย',
          order: 2,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      conditionConfigs: [
        {
          id: 'cond_working',
          name: 'ใช้งานได้',
          order: 1,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'cond_damaged',
          name: 'ชำรุด',
          order: 2,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      categoryConfigs: [
        {
          id: 'cat_sim_card',
          name: 'ซิมการ์ด',
          isSystemCategory: true,
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'cat_unassigned',
          name: 'ไม่ระบุ',
          isSystemCategory: true,
          order: 999,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // เพิ่มข้อมูลใหม่
    const result = await mongoose.connection.db.collection('inventoryconfigs').insertOne(defaultConfig);
    console.log('✅ สร้างข้อมูล default สำเร็จ!');
    console.log('📄 Document ID:', result.insertedId);
    
    // แสดงข้อมูลที่สร้าง
    console.log('\n📊 ข้อมูลที่สร้าง:');
    console.log('Status Configs:', defaultConfig.statusConfigs.length, 'รายการ');
    defaultConfig.statusConfigs.forEach((status, index) => {
      console.log(`  ${index + 1}. ${status.name} (${status.id})`);
    });
    
    console.log('Condition Configs:', defaultConfig.conditionConfigs.length, 'รายการ');
    defaultConfig.conditionConfigs.forEach((condition, index) => {
      console.log(`  ${index + 1}. ${condition.name} (${condition.id})`);
    });
    
    console.log('Category Configs:', defaultConfig.categoryConfigs.length, 'รายการ');
    defaultConfig.categoryConfigs.forEach((category, index) => {
      console.log(`  ${index + 1}. ${category.name} (${category.id})`);
    });
    
    console.log('\n🎉 ระบบพร้อมใช้งานแล้ว (ไม่มีสี)!');
    
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
  createDefaultConfigs()
    .then(() => {
      console.log('🏁 สคริปต์ทำงานเสร็จสิ้น');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 สคริปต์ล้มเหลว:', error);
      process.exit(1);
    });
}

module.exports = { createDefaultConfigs };
