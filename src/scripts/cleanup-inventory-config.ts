/**
 * 🧹 ทำความสะอาด Collection inventoryconfigs
 * 
 * ลบ fields ที่ไม่จำเป็น:
 * - statuses (เก่า)
 * - createdAt/updatedAt (redundant - แต่ละ config มี timestamps แล้ว)
 * - __v (Mongoose version key)
 * 
 * เหลือแค่:
 * - _id (MongoDB จำเป็น)
 * - statusConfigs
 * - categoryConfigs
 */

import mongoose from 'mongoose';
import InventoryConfig from '@/models/InventoryConfig';
import dotenv from 'dotenv';

// โหลด environment variables จาก .env.local
dotenv.config({ path: '.env.local' });

const cleanup = async () => {
  try {
    console.log('🧹 เริ่มทำความสะอาด Collection inventoryconfigs...');

    // เชื่อมต่อ database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI ไม่ได้ตั้งค่าใน environment variables');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ เชื่อมต่อ database สำเร็จ');

    // ดู document ปัจจุบัน
    const currentDoc = await InventoryConfig.findOne();
    console.log('📋 Document ปัจจุบัน:', JSON.stringify(currentDoc, null, 2));

    // ลบ fields ที่ไม่ต้องการ - รอบที่ 1
    const result1 = await InventoryConfig.updateMany(
      {},
      {
        $unset: {
          statuses: "",          // ลบ statuses เก่า
          createdAt: "",         // ลบ createdAt (redundant)
          updatedAt: "",         // ลบ updatedAt (redundant)
          __v: ""               // ลบ Mongoose version key
        }
      }
    );

    console.log(`✅ รอบที่ 1 สำเร็จ: ${result1.modifiedCount} documents`);

    // ลบ fields ที่ไม่ต้องการ - รอบที่ 2 (กรณีที่ Mongoose สร้าง updatedAt ใหม่)
    const result2 = await InventoryConfig.collection.updateMany(
      {},
      {
        $unset: {
          updatedAt: "",         // ลบ updatedAt อีกครั้ง
          createdAt: "",         // ลบ createdAt อีกครั้ง (กรณีที่เหลืออยู่)
        }
      }
    );

    console.log(`✅ รอบที่ 2 สำเร็จ: ${result2.modifiedCount} documents`);

    console.log(`✅ ทำความสะอาดสำเร็จทั้งหมด!`);

    // ดู document หลังทำความสะอาด
    const cleanedDoc = await InventoryConfig.findOne();
    console.log('🧽 Document หลังทำความสะอาด:', JSON.stringify(cleanedDoc, null, 2));

    // ตรวจสอบว่ามีเฉพาะ fields ที่ต้องการ
    const expectedFields = ['_id', 'statusConfigs', 'categoryConfigs'];
    const actualFields = Object.keys(cleanedDoc?.toObject() || {});
    
    console.log('🎯 Fields ที่ต้องการ:', expectedFields);
    console.log('📝 Fields จริง:', actualFields);
    
    const unexpectedFields = actualFields.filter(field => !expectedFields.includes(field));
    if (unexpectedFields.length > 0) {
      console.log('⚠️ Fields ที่ไม่คาดหวัง:', unexpectedFields);
    } else {
      console.log('✅ Fields ถูกต้องแล้ว!');
    }

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 ปิดการเชื่อมต่อ database');
  }
};

// รัน script
if (require.main === module) {
  cleanup();
}

export default cleanup;
