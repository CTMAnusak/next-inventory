/**
 * 🧹 ลบ statuses field เก่าออกจาก DB
 * 
 * Script สำหรับลบ statuses field เก่าที่ยังคงกลับมาใน DB
 * เหลือแค่ statusConfigs เท่านั้น
 */

import mongoose from 'mongoose';
import InventoryConfig from '@/models/InventoryConfig';
import dotenv from 'dotenv';

// โหลด environment variables จาก .env.local
dotenv.config({ path: '.env.local' });

const removeStatusesField = async () => {
  try {
    console.log('🧹 เริ่มลบ statuses field เก่า...');

    // เชื่อมต่อ database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI ไม่ได้ตั้งค่าใน environment variables');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ เชื่อมต่อ database สำเร็จ');

    // ตรวจสอบ document ปัจจุบัน
    const currentDoc = await InventoryConfig.findOne();
    console.log('📋 Document ปัจจุบัน:');
    console.log('- _id:', currentDoc?._id);
    console.log('- categoryConfigs length:', currentDoc?.categoryConfigs?.length || 0);
    console.log('- statusConfigs length:', currentDoc?.statusConfigs?.length || 0);
    console.log('- statuses (เก่า):', (currentDoc as any)?.statuses || 'ไม่มี');

    // ลบ statuses field เก่าออก
    const result = await InventoryConfig.collection.updateMany(
      {},
      {
        $unset: {
          statuses: ""  // ลบ statuses field เก่า
        }
      }
    );

    console.log(`✅ ลบ statuses field เก่าสำเร็จ: ${result.modifiedCount} documents`);

    // ตรวจสอบหลังลบ
    const updatedDoc = await InventoryConfig.findOne();
    console.log('🧽 Document หลังลบ statuses field:');
    console.log('- _id:', updatedDoc?._id);
    console.log('- categoryConfigs length:', updatedDoc?.categoryConfigs?.length || 0);
    console.log('- statusConfigs length:', updatedDoc?.statusConfigs?.length || 0);
    console.log('- statuses (เก่า):', (updatedDoc as any)?.statuses || 'ไม่มีแล้ว ✅');

    // ตรวจสอบ fields ทั้งหมด
    const allFields = Object.keys(updatedDoc?.toObject() || {});
    console.log('📝 Fields ทั้งหมดใน document:', allFields);

    const expectedFields = ['_id', 'statusConfigs', 'categoryConfigs'];
    const unexpectedFields = allFields.filter(field => !expectedFields.includes(field));
    
    if (unexpectedFields.length > 0) {
      console.log('⚠️ Fields ที่ไม่คาดหวัง:', unexpectedFields);
    } else {
      console.log('✅ Fields ถูกต้องแล้ว! มีเฉพาะ:', expectedFields);
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
  removeStatusesField();
}

export default removeStatusesField;
