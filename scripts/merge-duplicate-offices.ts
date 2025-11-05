/**
 * Script: รวม Office ที่ซ้ำกัน (case-insensitive)
 * 
 * วิธีใช้งาน:
 * npm run merge-duplicate-offices
 * หรือ
 * tsx scripts/merge-duplicate-offices.ts
 */

import Office from '../src/models/Office';
import User from '../src/models/User';
import RequestLog from '../src/models/RequestLog';
import ReturnLog from '../src/models/ReturnLog';
import IssueLog from '../src/models/IssueLog';
import InventoryItem from '../src/models/InventoryItem';
import DeletedUser from '../src/models/DeletedUser';
import dbConnect from '../src/lib/mongodb';

async function mergeDuplicateOffices() {
  try {
    console.log('🚀 Starting Office Merge Process...');
    console.log('📝 This script will:');
    console.log('   1. Find duplicate offices (case-insensitive)');
    console.log('   2. Select primary office (best name)');
    console.log('   3. Update all references to use primary officeId');
    console.log('   4. Delete duplicate offices');
    console.log('');
    
    await dbConnect();
    console.log('✅ Connected to database');
    
    // 1. ดึง Office ทั้งหมด
    console.log('\n📊 Step 1: Finding all offices...');
    const allOffices = await Office.find({ deletedAt: null }).select('office_id name').lean();
    console.log(`   Found ${allOffices.length} offices`);
    
    // 2. หา Office ที่ซ้ำกัน (case-insensitive)
    console.log('\n🔍 Step 2: Detecting duplicates...');
    const officeGroups = new Map<string, Array<{ office_id: string; name: string }>>();
    
    for (const office of allOffices) {
      const normalizedName = office.name.toLowerCase().trim();
      if (!officeGroups.has(normalizedName)) {
        officeGroups.set(normalizedName, []);
      }
      officeGroups.get(normalizedName)!.push({
        office_id: office.office_id,
        name: office.name
      });
    }
    
    // หา groups ที่มีมากกว่า 1 office
    const duplicates = Array.from(officeGroups.entries())
      .filter(([_, offices]) => offices.length > 1)
      .map(([normalizedName, offices]) => ({ normalizedName, offices }));
    
    if (duplicates.length === 0) {
      console.log('   ✅ No duplicate offices found!');
      process.exit(0);
    }
    
    console.log(`   Found ${duplicates.length} duplicate group(s):`);
    duplicates.forEach((dup, index) => {
      console.log(`   ${index + 1}. "${dup.normalizedName}" (${dup.offices.length} offices)`);
      dup.offices.forEach(office => {
        console.log(`      - ${office.office_id}: "${office.name}"`);
      });
    });
    
    // 3. เลือก Office หลักสำหรับแต่ละ group
    console.log('\n🎯 Step 3: Selecting primary offices...');
    const mergeOperations: Array<{
      primaryOfficeId: string;
      primaryOfficeName: string;
      duplicateOfficeIds: string[];
      duplicateOfficeNames: string[];
    }> = [];
    
    for (const dup of duplicates) {
      // เลือก Office หลัก: ใช้ตัวที่มีชื่อเหมาะสมที่สุด
      // 1. ตัวที่มีตัวพิมพ์ใหญ่ตัวแรก (Rasa One > rasa one)
      // 2. ตัวที่สั้นกว่า (ถ้าเท่ากัน)
      // 3. ตัวแรกถ้าเท่ากันทั้งหมด
      const primaryOffice = dup.offices.reduce((best, current) => {
        const bestFirstChar = best.name.charAt(0);
        const currentFirstChar = current.name.charAt(0);
        
        // ถ้าตัวปัจจุบันมีตัวพิมพ์ใหญ่ตัวแรก และตัวที่ดีที่สุดไม่มี
        if (currentFirstChar === currentFirstChar.toUpperCase() && bestFirstChar !== bestFirstChar.toUpperCase()) {
          return current;
        }
        
        // ถ้าตัวที่ดีที่สุดมีตัวพิมพ์ใหญ่ตัวแรก และตัวปัจจุบันไม่มี
        if (bestFirstChar === bestFirstChar.toUpperCase() && currentFirstChar !== currentFirstChar.toUpperCase()) {
          return best;
        }
        
        // ถ้าทั้งคู่มีตัวพิมพ์ใหญ่เหมือนกัน ใช้ตัวที่สั้นกว่า
        if (current.name.length < best.name.length) {
          return current;
        }
        
        return best;
      });
      
      const duplicateOffices = dup.offices.filter(o => o.office_id !== primaryOffice.office_id);
      
      mergeOperations.push({
        primaryOfficeId: primaryOffice.office_id,
        primaryOfficeName: primaryOffice.name,
        duplicateOfficeIds: duplicateOffices.map(o => o.office_id),
        duplicateOfficeNames: duplicateOffices.map(o => o.name)
      });
      
      console.log(`   ✅ Primary: ${primaryOffice.office_id} - "${primaryOffice.name}"`);
      console.log(`      Will merge: ${duplicateOffices.map(o => `${o.office_id} - "${o.name}"`).join(', ')}`);
    }
    
    // 4. อัพเดตทุกที่ที่อ้างอิง Office ที่ซ้ำ
    console.log('\n🔄 Step 4: Updating references...');
    let totalUpdated = 0;
    
    for (const operation of mergeOperations) {
      console.log(`\n   Processing: ${operation.primaryOfficeName} (${operation.primaryOfficeId})`);
      
      // 4.1 อัพเดต User Collection
      let userUpdated = 0;
      for (const duplicateId of operation.duplicateOfficeIds) {
        const result = await User.updateMany(
          { officeId: duplicateId },
          { 
            $set: { 
              officeId: operation.primaryOfficeId,
              officeName: operation.primaryOfficeName,
              office: operation.primaryOfficeName
            } 
          }
        );
        userUpdated += result.modifiedCount;
      }
      console.log(`      ✅ Updated ${userUpdated} users`);
      
      // 4.2 อัพเดต RequestLog Collection
      let requestLogUpdated = 0;
      for (const duplicateId of operation.duplicateOfficeIds) {
        const result = await RequestLog.updateMany(
          { requesterOfficeId: duplicateId },
          { 
            $set: { 
              requesterOfficeId: operation.primaryOfficeId,
              requesterOfficeName: operation.primaryOfficeName,
              requesterOffice: operation.primaryOfficeName
            } 
          }
        );
        requestLogUpdated += result.modifiedCount;
      }
      console.log(`      ✅ Updated ${requestLogUpdated} request logs`);
      
      // 4.3 อัพเดต ReturnLog Collection
      let returnLogUpdated = 0;
      for (const duplicateId of operation.duplicateOfficeIds) {
        const result = await ReturnLog.updateMany(
          { returnerOfficeId: duplicateId },
          { 
            $set: { 
              returnerOfficeId: operation.primaryOfficeId,
              returnerOfficeName: operation.primaryOfficeName,
              returnerOffice: operation.primaryOfficeName
            } 
          }
        );
        returnLogUpdated += result.modifiedCount;
      }
      console.log(`      ✅ Updated ${returnLogUpdated} return logs`);
      
      // 4.4 อัพเดต IssueLog Collection
      let issueLogUpdated = 0;
      for (const duplicateId of operation.duplicateOfficeIds) {
        const result = await IssueLog.updateMany(
          { officeId: duplicateId },
          { 
            $set: { 
              officeId: operation.primaryOfficeId,
              officeName: operation.primaryOfficeName,
              office: operation.primaryOfficeName
            } 
          }
        );
        issueLogUpdated += result.modifiedCount;
      }
      console.log(`      ✅ Updated ${issueLogUpdated} issue logs`);
      
      // 4.5 อัพเดต InventoryItem Collection (requesterInfo)
      let inventoryItemUpdated = 0;
      for (const duplicateId of operation.duplicateOfficeIds) {
        const result = await InventoryItem.updateMany(
          { 'requesterInfo.officeId': duplicateId },
          { 
            $set: { 
              'requesterInfo.officeId': operation.primaryOfficeId,
              'requesterInfo.officeName': operation.primaryOfficeName,
              'requesterInfo.office': operation.primaryOfficeName
            } 
          }
        );
        inventoryItemUpdated += result.modifiedCount;
      }
      console.log(`      ✅ Updated ${inventoryItemUpdated} inventory items`);
      
      // 4.6 อัพเดต DeletedUser Collection
      let deletedUserUpdated = 0;
      for (const duplicateId of operation.duplicateOfficeIds) {
        const result = await DeletedUser.updateMany(
          { officeId: duplicateId },
          { 
            $set: { 
              officeId: operation.primaryOfficeId,
              officeName: operation.primaryOfficeName,
              office: operation.primaryOfficeName
            } 
          }
        );
        deletedUserUpdated += result.modifiedCount;
      }
      console.log(`      ✅ Updated ${deletedUserUpdated} deleted users`);
      
      totalUpdated += userUpdated + requestLogUpdated + returnLogUpdated + issueLogUpdated + inventoryItemUpdated + deletedUserUpdated;
    }
    
    // 5. ลบ Office ที่ซ้ำ (soft delete)
    console.log('\n🗑️  Step 5: Deleting duplicate offices...');
    let deletedCount = 0;
    
    for (const operation of mergeOperations) {
      for (const duplicateId of operation.duplicateOfficeIds) {
        await Office.updateOne(
          { office_id: duplicateId },
          {
            $set: {
              isActive: false,
              deletedAt: new Date()
            }
          }
        );
        console.log(`   ✅ Deleted: ${duplicateId}`);
        deletedCount++;
      }
    }
    
    console.log('\n✅ Merge completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Processed ${mergeOperations.length} duplicate group(s)`);
    console.log(`   - Deleted ${deletedCount} duplicate office(s)`);
    console.log(`   - Updated ${totalUpdated} total references`);
    
    // แสดง Office ที่เหลือ
    const remainingOffices = await Office.find({ deletedAt: null }).select('office_id name').lean();
    console.log(`\n📋 Remaining offices (${remainingOffices.length}):`);
    remainingOffices.forEach(office => {
      console.log(`   - ${office.office_id}: "${office.name}"`);
    });
    
    console.log('\n🎉 All done! Duplicate offices have been merged.');
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Merge failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run merge
mergeDuplicateOffices();

