/**
 * 🔧 แก้ไขปัญหา statusConfigs ที่หายไปใน MongoDB Atlas UI
 * 
 * เพิ่ม statusConfigs field ให้แสดงใน UI โดยใส่ค่า empty array ไว้ชัดเจน
 */

import mongoose from 'mongoose';
import InventoryConfig from '@/models/InventoryConfig';
import dotenv from 'dotenv';

// โหลด environment variables จาก .env.local
dotenv.config({ path: '.env.local' });

const fixStatusConfigs = async () => {
  try {

    // เชื่อมต่อ database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI ไม่ได้ตั้งค่าใน environment variables');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    // ดู document ปัจจุบัน
    const currentDoc = await InventoryConfig.findOne();
    console.log('- _id:', currentDoc?._id);
    console.log('- categoryConfigs length:', currentDoc?.categoryConfigs?.length || 0);
    console.log('- statusConfigs:', currentDoc?.statusConfigs);
    console.log('- statusConfigs type:', typeof currentDoc?.statusConfigs);
    console.log('- statusConfigs is array:', Array.isArray(currentDoc?.statusConfigs));

    // Force update เพื่อให้ statusConfigs แสดงใน UI
    const result = await InventoryConfig.collection.updateOne(
      { _id: currentDoc?._id },
      {
        $set: {
          statusConfigs: []  // Force set เป็น empty array
        }
      }
    );


    // ตรวจสอบหลังอัปเดต
    const updatedDoc = await InventoryConfig.findOne();
    console.log('🧽 Document หลังอัปเดต:');
    console.log('- _id:', updatedDoc?._id);
    console.log('- categoryConfigs length:', updatedDoc?.categoryConfigs?.length || 0);
    console.log('- statusConfigs:', updatedDoc?.statusConfigs);
    console.log('- statusConfigs type:', typeof updatedDoc?.statusConfigs);
    console.log('- statusConfigs is array:', Array.isArray(updatedDoc?.statusConfigs));

    // ตรวจสอบ fields ทั้งหมด
    const allFields = Object.keys(updatedDoc?.toObject() || {});

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
  } finally {
    await mongoose.disconnect();
  }
};

// รัน script
if (require.main === module) {
  fixStatusConfigs();
}

export default fixStatusConfigs;
