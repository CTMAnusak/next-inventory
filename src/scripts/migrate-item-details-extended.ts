import dbConnect from '@/lib/mongodb';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';
import { updateAllItemDetails } from '@/lib/inventory-helpers';

/**
 * Migration Script: อัปเดต itemDetails ให้เก็บข้อมูลแบบละเอียด
 * 
 * วิธีใช้งาน:
 * 1. npm run dev
 * 2. เข้า http://localhost:3000/api/admin/migrate-item-details-extended
 * 3. หรือรัน: node -r ts-node/register src/scripts/migrate-item-details-extended.ts
 */

async function migrateItemDetailsExtended() {
  try {
    
    await dbConnect();
    
    // ตรวจสอบว่ามี master items หรือไม่
    const masterCount = await InventoryMaster.countDocuments();
    
    if (masterCount === 0) {
      return;
    }
    
    // อัปเดต itemDetails สำหรับ master items ทั้งหมด
    await updateAllItemDetails();
    
    // ตรวจสอบผลลัพธ์
    const mastersWithNewStructure = await InventoryMaster.countDocuments({
      'itemDetails.withSerialNumber.count': { $exists: true }
    });
    
    
    // แสดงตัวอย่างข้อมูล
    const sampleMaster = await InventoryMaster.findOne({
      'itemDetails.withSerialNumber.count': { $exists: true }
    });
    
    if (sampleMaster) {
      console.log(`Item: ${sampleMaster.itemName}`);
      console.log(`With SN: ${sampleMaster.itemDetails?.withSerialNumber.count} items`);
      console.log(`With Phone: ${sampleMaster.itemDetails?.withPhoneNumber.count} items`);
      console.log(`Other: ${sampleMaster.itemDetails?.other.count} items`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// รัน migration ถ้าเรียกไฟล์โดยตรง
if (require.main === module) {
  migrateItemDetailsExtended()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export default migrateItemDetailsExtended;
