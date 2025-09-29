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

    // เชื่อมต่อ database
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI ไม่ได้ตั้งค่าใน environment variables');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    // สร้าง sample statusConfig
    const sampleStatus = createStatusConfig("ใช้งานได้", 1);

    // เพิ่มเข้า database
    const result = await InventoryConfig.updateOne(
      {},
      {
        $push: {
          statusConfigs: sampleStatus
        }
      }
    );


    // ตรวจสอบผลลัพธ์
    const updatedDoc = await InventoryConfig.findOne();
    console.log('🧽 statusConfigs หลังเพิ่ม:', JSON.stringify(updatedDoc?.statusConfigs, null, 2));

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
  } finally {
    await mongoose.disconnect();
  }
};

// รัน script
if (require.main === module) {
  addSampleStatusConfig();
}

export default addSampleStatusConfig;
