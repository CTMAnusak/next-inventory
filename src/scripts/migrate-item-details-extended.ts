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
    console.log('🚀 Starting migration: Update itemDetails structure...');
    
    await dbConnect();
    console.log('✅ Connected to database');
    
    // ตรวจสอบว่ามี master items หรือไม่
    const masterCount = await InventoryMaster.countDocuments();
    console.log(`📊 Found ${masterCount} master items`);
    
    if (masterCount === 0) {
      console.log('⚠️ No master items found. Migration completed.');
      return;
    }
    
    // อัปเดต itemDetails สำหรับ master items ทั้งหมด
    console.log('🔄 Updating itemDetails for all master items...');
    await updateAllItemDetails();
    
    // ตรวจสอบผลลัพธ์
    const mastersWithNewStructure = await InventoryMaster.countDocuments({
      'itemDetails.withSerialNumber.count': { $exists: true }
    });
    
    console.log(`✅ Migration completed successfully!`);
    console.log(`📊 Updated ${mastersWithNewStructure} master items with new itemDetails structure`);
    
    // แสดงตัวอย่างข้อมูล
    const sampleMaster = await InventoryMaster.findOne({
      'itemDetails.withSerialNumber.count': { $exists: true }
    });
    
    if (sampleMaster) {
      console.log('\n📋 Sample data:');
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
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export default migrateItemDetailsExtended;
