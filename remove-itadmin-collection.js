/**
 * Script: ลบ ITAdmin Collection
 * 
 * สคริปต์นี้จะ:
 * 1. สำรองข้อมูล ITAdmin collection (ถ้ามี)
 * 2. ลบ collection itadmins ออกจากฐานข้อมูล
 * 3. ตรวจสอบว่าลบสำเร็จ
 * 
 * วิธีใช้งาน:
 * node remove-itadmin-collection.js
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management';

async function removeITAdminCollection() {
  let client;
  
  try {
    console.log('🗑️  เริ่มลบ ITAdmin Collection');
    console.log('📡 กำลังเชื่อมต่อ MongoDB...');
    
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    const itAdminCollection = db.collection('itadmins');
    
    // 1. ตรวจสอบว่ามี collection หรือไม่
    const collections = await db.listCollections({ name: 'itadmins' }).toArray();
    
    if (collections.length === 0) {
      console.log('✅ Collection itadmins ไม่มีอยู่แล้ว - ไม่ต้องลบ');
      return;
    }
    
    // 2. ตรวจสอบจำนวนข้อมูลใน collection
    const count = await itAdminCollection.countDocuments();
    console.log(`📊 พบข้อมูลใน itadmins collection: ${count} รายการ`);
    
    // 3. สำรองข้อมูลก่อนลบ (ถ้ามีข้อมูล)
    if (count > 0) {
      const backupDir = './backup_migration';
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
      }
      
      const backupFile = path.join(backupDir, `backup_itadmins_before_delete_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      const data = await itAdminCollection.find({}).toArray();
      fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
      console.log(`💾 สำรองข้อมูลไว้ที่: ${backupFile}`);
    }
    
    // 4. ลบ collection
    console.log('🗑️  กำลังลบ collection itadmins...');
    await db.dropCollection('itadmins');
    
    // 5. ตรวจสอบว่าลบสำเร็จ
    const collectionsAfter = await db.listCollections({ name: 'itadmins' }).toArray();
    
    if (collectionsAfter.length === 0) {
      console.log('✅ ลบ collection itadmins สำเร็จ!');
    } else {
      console.log('❌ ไม่สามารถลบ collection ได้');
    }
    
    // 6. แสดงรายการ collections ที่เหลือ
    console.log('\n📋 Collections ที่เหลือในฐานข้อมูล:');
    const allCollections = await db.listCollections().toArray();
    allCollections.forEach((collection, index) => {
      console.log(`   ${index + 1}. ${collection.name}`);
    });
    
    console.log('\n🎉 การลบ collection เสร็จสิ้น!');
    console.log('💡 ระบบจะใช้ userRole ใน users collection แทน');
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการลบ collection:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n📡 ปิดการเชื่อมต่อ MongoDB');
    }
  }
}

// รันการลบ collection
if (require.main === module) {
  removeITAdminCollection()
    .then(() => {
      console.log('\n✅ Script เสร็จสิ้น');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script ล้มเหลว:', error);
      process.exit(1);
    });
}

module.exports = { removeITAdminCollection };
