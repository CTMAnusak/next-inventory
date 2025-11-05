/**
 * Migration Script: แปลงข้อมูล Office จาก String เป็น Office ID
 * 
 * วิธีใช้งาน:
 * npm run migrate-office-to-id
 * หรือ
 * tsx scripts/migrate-office-to-id.ts
 */

import mongoose from 'mongoose';
import Office from '../src/models/Office';
import User from '../src/models/User';
import RequestLog from '../src/models/RequestLog';
import ReturnLog from '../src/models/ReturnLog';
import IssueLog from '../src/models/IssueLog';
import InventoryItem from '../src/models/InventoryItem';
import DeletedUser from '../src/models/DeletedUser';
import dbConnect from '../src/lib/mongodb';

async function migrateOfficeToId() {
  try {
    console.log('🚀 Starting Office Migration...');
    console.log('📝 This script will:');
    console.log('   1. Collect all unique office names from User collection');
    console.log('   2. Create Office records in Office collection');
    console.log('   3. Update all collections with officeId');
    console.log('');
    
    await dbConnect();
    console.log('✅ Connected to database');
    
    // 1. รวบรวมชื่อ Office ทั้งหมดจาก User Collection
    console.log('\n📊 Step 1: Collecting unique office names...');
    const users = await User.find({}).select('office').lean();
    const uniqueOfficeNames = new Set<string>();
    
    users.forEach(user => {
      if (user.office && user.office.trim()) {
        uniqueOfficeNames.add(user.office.trim());
      }
    });
    
    console.log(`   Found ${uniqueOfficeNames.size} unique office names`);
    
    if (uniqueOfficeNames.size === 0) {
      console.log('⚠️  No office names found. Migration may not be needed.');
      console.log('   You can proceed without migration if this is a new project.');
      process.exit(0);
    }
    
    // แสดงรายชื่อ Office ที่พบ
    console.log('   Office names found:');
    Array.from(uniqueOfficeNames).sort().forEach((name, index) => {
      console.log(`     ${index + 1}. ${name}`);
    });
    
    // 2. สร้าง Office Collection สำหรับแต่ละชื่อ
    console.log('\n📝 Step 2: Creating Office records...');
    const officeMap = new Map<string, string>(); // Map<officeName, officeId>
    let officeIdCounter = 1;
    
    // ตรวจสอบ Office ที่มีอยู่แล้ว
    const existingOffices = await Office.find({}).select('office_id name').lean();
    const existingOfficeMap = new Map<string, string>();
    existingOffices.forEach(office => {
      existingOfficeMap.set(office.name, office.office_id);
    });
    
    // หาเลข ID ที่สูงสุด
    if (existingOffices.length > 0) {
      const maxId = existingOffices.reduce((max, office) => {
        const num = parseInt(office.office_id.replace('OFF', ''));
        return num > max ? num : max;
      }, 0);
      officeIdCounter = maxId + 1;
    }
    
    for (const officeName of Array.from(uniqueOfficeNames).sort()) {
      // ตรวจสอบว่ามีอยู่แล้วหรือไม่
      let office = existingOfficeMap.has(officeName) 
        ? { office_id: existingOfficeMap.get(officeName)!, name: officeName }
        : null;
      
      if (!office) {
        // สร้าง Office ใหม่
        const newOfficeId = `OFF${officeIdCounter.toString().padStart(3, '0')}`;
        const newOffice = await Office.create({
          office_id: newOfficeId,
          name: officeName,
          description: `Migrated from old system`,
          isActive: true
        });
        console.log(`   ✅ Created: ${newOfficeId} - ${officeName}`);
        officeMap.set(officeName, newOfficeId);
        officeIdCounter++;
      } else {
        console.log(`   ℹ️  Exists: ${office.office_id} - ${officeName}`);
        officeMap.set(officeName, office.office_id);
      }
    }
    
    // 3. อัพเดต User Collection
    console.log('\n👥 Step 3: Updating User Collection...');
    let userUpdated = 0;
    for (const user of users) {
      if (user.office && officeMap.has(user.office.trim())) {
        const officeId = officeMap.get(user.office.trim())!;
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              officeId: officeId,
              officeName: user.office.trim()
            }
          }
        );
        userUpdated++;
      }
    }
    console.log(`   ✅ Updated ${userUpdated} users`);
    
    // 4. อัพเดต RequestLog Collection
    console.log('\n📋 Step 4: Updating RequestLog Collection...');
    const requestLogs = await RequestLog.find({}).select('requesterOffice').lean();
    let requestLogUpdated = 0;
    for (const log of requestLogs) {
      if (log.requesterOffice && officeMap.has(log.requesterOffice.trim())) {
        const officeId = officeMap.get(log.requesterOffice.trim())!;
        await RequestLog.updateOne(
          { _id: log._id },
          {
            $set: {
              requesterOfficeId: officeId,
              requesterOfficeName: log.requesterOffice.trim()
            }
          }
        );
        requestLogUpdated++;
      }
    }
    console.log(`   ✅ Updated ${requestLogUpdated} request logs`);
    
    // 5. อัพเดต ReturnLog Collection
    console.log('\n📋 Step 5: Updating ReturnLog Collection...');
    const returnLogs = await ReturnLog.find({}).select('returnerOffice').lean();
    let returnLogUpdated = 0;
    for (const log of returnLogs) {
      if (log.returnerOffice && officeMap.has(log.returnerOffice.trim())) {
        const officeId = officeMap.get(log.returnerOffice.trim())!;
        await ReturnLog.updateOne(
          { _id: log._id },
          {
            $set: {
              returnerOfficeId: officeId,
              returnerOfficeName: log.returnerOffice.trim()
            }
          }
        );
        returnLogUpdated++;
      }
    }
    console.log(`   ✅ Updated ${returnLogUpdated} return logs`);
    
    // 6. อัพเดต IssueLog Collection
    console.log('\n📋 Step 6: Updating IssueLog Collection...');
    const issueLogs = await IssueLog.find({}).select('office officeId').lean();
    let issueLogUpdated = 0;
    for (const log of issueLogs) {
      if (log.office && !log.officeId && officeMap.has(log.office.trim())) {
        const officeId = officeMap.get(log.office.trim())!;
        await IssueLog.updateOne(
          { _id: log._id },
          {
            $set: {
              officeId: officeId,
              officeName: log.office.trim()
            }
          }
        );
        issueLogUpdated++;
      }
    }
    console.log(`   ✅ Updated ${issueLogUpdated} issue logs`);
    
    // 7. อัพเดต InventoryItem Collection (requesterInfo)
    console.log('\n📦 Step 7: Updating InventoryItem Collection...');
    const inventoryItems = await InventoryItem.find({
      'requesterInfo.office': { $exists: true }
    }).select('requesterInfo').lean();
    let inventoryItemUpdated = 0;
    for (const item of inventoryItems) {
      const officeName = (item.requesterInfo as any)?.office;
      if (officeName && officeMap.has(officeName.trim())) {
        const officeId = officeMap.get(officeName.trim())!;
        await InventoryItem.updateOne(
          { _id: item._id },
          {
            $set: {
              'requesterInfo.officeId': officeId,
              'requesterInfo.officeName': officeName.trim()
            }
          }
        );
        inventoryItemUpdated++;
      }
    }
    console.log(`   ✅ Updated ${inventoryItemUpdated} inventory items`);
    
    // 8. อัพเดต DeletedUser Collection
    console.log('\n🗑️  Step 8: Updating DeletedUser Collection...');
    const deletedUsers = await DeletedUser.find({}).select('office').lean();
    let deletedUserUpdated = 0;
    for (const deletedUser of deletedUsers) {
      if (deletedUser.office && officeMap.has(deletedUser.office.trim())) {
        const officeId = officeMap.get(deletedUser.office.trim())!;
        await DeletedUser.updateOne(
          { _id: deletedUser._id },
          {
            $set: {
              officeId: officeId,
              officeName: deletedUser.office.trim()
            }
          }
        );
        deletedUserUpdated++;
      }
    }
    console.log(`   ✅ Updated ${deletedUserUpdated} deleted users`);
    
    console.log('\n✅ Migration completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Created/Found ${officeMap.size} offices`);
    console.log(`   - Updated ${userUpdated} users`);
    console.log(`   - Updated ${requestLogUpdated} request logs`);
    console.log(`   - Updated ${returnLogUpdated} return logs`);
    console.log(`   - Updated ${issueLogUpdated} issue logs`);
    console.log(`   - Updated ${inventoryItemUpdated} inventory items`);
    console.log(`   - Updated ${deletedUserUpdated} deleted users`);
    console.log('\n🎉 All done! Your data is now migrated to the new Office system.');
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
migrateOfficeToId();

