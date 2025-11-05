/**
 * Script: สร้าง Default Office "ไม่ระบุสาขา"
 * 
 * วิธีใช้งาน:
 * npm run create-default-office
 * หรือ
 * tsx scripts/create-default-office.ts
 */

import Office from '../src/models/Office';
import dbConnect from '../src/lib/mongodb';

const DEFAULT_OFFICE_ID = 'UNSPECIFIED_OFFICE';
const DEFAULT_OFFICE_NAME = 'ไม่ระบุสาขา';

async function createDefaultOffice() {
  try {
    console.log('🚀 Creating Default Office...');
    console.log('📝 Office ID:', DEFAULT_OFFICE_ID);
    console.log('📝 Office Name:', DEFAULT_OFFICE_NAME);
    console.log('');
    
    await dbConnect();
    console.log('✅ Connected to database');
    
    // ตรวจสอบว่ามีอยู่แล้วหรือไม่
    const existingOffice = await Office.findOne({ office_id: DEFAULT_OFFICE_ID });
    
    if (existingOffice) {
      // อัพเดตให้เป็น system office และ active
      existingOffice.isSystemOffice = true;
      existingOffice.isActive = true;
      existingOffice.deletedAt = null;
      await existingOffice.save();
      console.log('✅ Default Office already exists. Updated to system office.');
    } else {
      // สร้างใหม่
      const defaultOffice = new Office({
        office_id: DEFAULT_OFFICE_ID,
        name: DEFAULT_OFFICE_NAME,
        description: 'Default office for users without a specific branch assignment',
        isActive: true,
        isSystemOffice: true
      });
      
      await defaultOffice.save();
      console.log('✅ Default Office created successfully!');
    }
    
    // แสดงผล
    const office = await Office.findOne({ office_id: DEFAULT_OFFICE_ID });
    console.log('\n📋 Default Office Details:');
    console.log(`   - ID: ${office?.office_id}`);
    console.log(`   - Name: ${office?.name}`);
    console.log(`   - System Office: ${office?.isSystemOffice}`);
    console.log(`   - Active: ${office?.isActive}`);
    
    console.log('\n🎉 Default Office setup completed!');
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Failed to create default office:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
createDefaultOffice();

