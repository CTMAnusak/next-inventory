/**
 * Migration Script: เพิ่ม officeId และ officeName ใน requesterInfo
 * 
 * วิธีใช้งาน:
 * npm run migrate-inventoryitems-office
 * หรือ
 * npx tsx scripts/migrate-inventoryitems-office-to-id.ts
 * 
 * สคริปต์นี้จะ:
 * 1. ดึงข้อมูล InventoryItem ที่มี requesterInfo แต่ไม่มี officeId
 * 2. หา officeId จาก User collection (ผ่าน currentOwnership.userId)
 * 3. หรือหา officeId จากชื่อสาขาใน offices collection (ถ้ามี requesterInfo.office)
 * 4. อัพเดต requesterInfo ให้มี officeId และ officeName
 */

import mongoose from 'mongoose';
import Office from '../src/models/Office';
import InventoryItem from '../src/models/InventoryItem';
import User from '../src/models/User';
import dbConnect from '../src/lib/mongodb';

async function migrateInventoryItemsOfficeToId() {
  try {
    console.log('🚀 Starting InventoryItems Office Migration...');
    console.log('📝 This script will update requesterInfo.office to use officeId\n');
    
    await dbConnect();
    console.log('✅ Connected to database\n');
    
    // 1. ดึงข้อมูล Office ทั้งหมด
    console.log('📊 Step 1: Loading offices...');
    const offices = await Office.find({ deletedAt: null }).lean();
    
    if (offices.length === 0) {
      console.log('⚠️  No offices found. Please run migrate-office-to-id.ts first.');
      process.exit(1);
    }
    
    console.log(`   Found ${offices.length} offices`);
    
    // สร้าง map: office name → office_id
    const officeNameMap = new Map<string, { office_id: string; name: string }>();
    offices.forEach(office => {
      // เก็บ exact match
      officeNameMap.set(office.name, { office_id: office.office_id, name: office.name });
      // เก็บ trimmed + lowercase สำหรับ fuzzy match
      officeNameMap.set(office.name.trim().toLowerCase(), { office_id: office.office_id, name: office.name });
    });
    
    console.log('   Office map created\n');
    
    // 2. ดึง InventoryItem ที่มี requesterInfo แต่ไม่มี officeId
    console.log('📦 Step 2: Finding items to migrate...');
    const itemsToMigrate = await InventoryItem.find({
      'currentOwnership.ownerType': 'user_owned',
      'currentOwnership.userId': { $exists: true },
      'requesterInfo': { $exists: true },
      $or: [
        { 'requesterInfo.officeId': { $exists: false } },
        { 'requesterInfo.officeId': null },
        { 'requesterInfo.officeId': '' }
      ]
    }).lean();
    
    console.log(`   Found ${itemsToMigrate.length} items to migrate\n`);
    
    if (itemsToMigrate.length === 0) {
      console.log('✅ No items need migration. All done!');
      process.exit(0);
    }
    
    // 3. ดึงข้อมูล User ทั้งหมดเพื่อ lookup
    console.log('👥 Step 3: Loading users for office lookup...');
    const users = await User.find({}).select('user_id officeId officeName userType').lean();
    const userMap = new Map<string, { officeId?: string; officeName?: string; userType?: string }>();
    users.forEach((user: any) => {
      userMap.set(user.user_id, {
        officeId: user.officeId,
        officeName: user.officeName,
        userType: user.userType
      });
    });
    console.log(`   Loaded ${users.length} users\n`);
    
    // 4. อัพเดตแต่ละ item
    console.log('🔄 Step 4: Migrating items...');
    let updatedCount = 0;
    let notFoundCount = 0;
    let noUserCount = 0;
    const notFoundOffices = new Set<string>();
    
    for (const item of itemsToMigrate) {
      const userId = (item as any).currentOwnership?.userId;
      const requesterInfo = (item as any).requesterInfo || {};
      
      if (!userId) {
        noUserCount++;
        continue;
      }
      
      // หา officeId จาก User collection
      const user = userMap.get(userId);
      let officeId: string | undefined = undefined;
      let officeName: string | undefined = undefined;
      
      if (user?.officeId) {
        // ✅ Priority 1: ใช้ officeId จาก User
        officeId = user.officeId;
        // Lookup officeName จาก Office collection
        const officeData = offices.find((o: any) => o.office_id === officeId);
        officeName = officeData?.name || user.officeName;
      } else if (requesterInfo.office) {
        // ✅ Priority 2: หาจาก office name ใน requesterInfo
        const officeNameStr = requesterInfo.office;
        let officeData = officeNameMap.get(officeNameStr);
        
        if (!officeData) {
          officeData = officeNameMap.get(officeNameStr.trim().toLowerCase());
        }
        
        if (officeData) {
          officeId = officeData.office_id;
          officeName = officeData.name;
        }
      }
      
      if (officeId) {
        // อัพเดต item
        await InventoryItem.updateOne(
          { _id: item._id },
          {
            $set: {
              'requesterInfo.officeId': officeId,
              'requesterInfo.officeName': officeName
            }
          }
        );
        updatedCount++;
        
        if (updatedCount % 10 === 0) {
          console.log(`   ✅ Updated ${updatedCount} items...`);
        }
      } else {
        // ไม่เจอ office → ใช้ default
        notFoundCount++;
        if (requesterInfo.office) {
          notFoundOffices.add(requesterInfo.office);
        }
        
        const defaultOfficeId = 'UNSPECIFIED_OFFICE';
        await InventoryItem.updateOne(
          { _id: item._id },
          {
            $set: {
              'requesterInfo.officeId': defaultOfficeId,
              'requesterInfo.officeName': 'ไม่ระบุสาขา'
            }
          }
        );
        updatedCount++;
      }
    }
    
    console.log(`\n✅ Migration completed!`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Total items processed: ${itemsToMigrate.length}`);
    console.log(`   - Successfully updated: ${updatedCount}`);
    console.log(`   - No userId found: ${noUserCount}`);
    console.log(`   - Office not found: ${notFoundCount}`);
    
    if (notFoundOffices.size > 0) {
      console.log(`\n⚠️  Office names not found (mapped to default):`);
      Array.from(notFoundOffices).forEach((name, index) => {
        console.log(`     ${index + 1}. "${name}"`);
      });
      console.log(`\n   These items were assigned to "ไม่ระบุสาขา"`);
    }
    
    console.log('\n🎉 All done!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
migrateInventoryItemsOfficeToId();

