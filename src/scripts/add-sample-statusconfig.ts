/**
 * 🎯 เพิ่ม sample statusConfig เพื่อให้แสดงใน MongoDB Atlas UI
 */

import mongoose from 'mongoose';
import InventoryConfig, { createStatusConfig } from '@/models/InventoryConfig';
import dotenv from 'dotenv';

// โหลด environment variables จาก .env.local
dotenv.config({ path: '.env.local' });

const addSampleStatusConfig = async () => {
  try {
    console.log('🎯 เริ่มเพิ่ม sample statusConfig...');

    // เชื่อมต่อ database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI ไม่ได้ตั้งค่าใน environment variables');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ เชื่อมต่อ database สำเร็จ');

    // สร้าง sample statusConfig
    const sampleStatus = createStatusConfig("ใช้งานได้", 1);
    console.log('📝 Sample statusConfig:', JSON.stringify(sampleStatus, null, 2));

    // เพิ่มเข้า database
    const result = await InventoryConfig.updateOne(
      {},
      {
        $push: {
          statusConfigs: sampleStatus
        }
      }
    );

    console.log(`✅ เพิ่ม sample statusConfig สำเร็จ: ${result.modifiedCount} documents`);

    // ตรวจสอบผลลัพธ์
    const updatedDoc = await InventoryConfig.findOne();
    console.log('🧽 statusConfigs หลังเพิ่ม:', JSON.stringify(updatedDoc?.statusConfigs, null, 2));

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 ปิดการเชื่อมต่อ database');
  }
};

// รัน script
if (require.main === module) {
  addSampleStatusConfig();
}

export default addSampleStatusConfig;
