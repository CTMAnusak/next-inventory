/**
 * Script: Remove office field from User collection (เก็บแค่ officeName)
 * 
 * วิธีใช้งาน:
 * npm run migrate-office-to-officename
 * หรือ
 * tsx scripts/migrate-office-to-officename.ts
 */

import User from '../src/models/User';
import dbConnect from '../src/lib/mongodb';

async function migrateOfficeToOfficeName() {
  try {
    console.log('🚀 Starting Office Field Removal Migration...');
    console.log('📝 This script will:');
    console.log('   1. Set officeName = office for all users that have office but no officeName');
    console.log('   2. Remove office field from all users (เก็บแค่ officeName)');
    console.log('');
    
    await dbConnect();
    console.log('✅ Connected to database');
    
    // 1. อัพเดต users ที่มี office แต่ไม่มี officeName
    console.log('\n📊 Step 1: Updating users with office but no officeName...');
    const usersWithOffice = await User.find({
      office: { $exists: true, $nin: [null, ''] },
      $or: [
        { officeName: { $exists: false } },
        { officeName: null },
        { officeName: '' }
      ]
    }).select('_id office officeName').lean();
    
    console.log(`   Found ${usersWithOffice.length} users to update`);
    
    let updatedCount = 0;
    for (const user of usersWithOffice) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            officeName: user.office || 'ไม่ระบุสาขา'
          },
          $unset: {
            office: '' // ลบ office field ออกจาก DB
          }
        }
      );
      updatedCount++;
    }
    console.log(`   ✅ Updated ${updatedCount} users`);
    
    // 2. อัพเดต users ที่มีทั้ง office และ officeName ให้ใช้ officeName และลบ office
    console.log('\n📊 Step 2: Syncing office and officeName, then removing office...');
    const usersWithBoth = await User.find({
      office: { $exists: true, $nin: [null, ''] },
      officeName: { $exists: true, $nin: [null, ''] }
    }).select('_id office officeName').lean();
    
    console.log(`   Found ${usersWithBoth.length} users with both fields`);
    
    let syncedCount = 0;
    for (const user of usersWithBoth) {
      // ถ้า office และ officeName ไม่เหมือนกัน ให้ใช้ officeName เป็นหลัก
      if (user.office !== user.officeName) {
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              officeName: user.officeName || user.office // ใช้ officeName เป็นหลัก
            },
            $unset: {
              office: '' // ลบ office field ออกจาก DB
            }
          }
        );
      } else {
        // ถ้าเหมือนกัน ให้ลบ office ออก
        await User.updateOne(
          { _id: user._id },
          {
            $unset: {
              office: '' // ลบ office field ออกจาก DB
            }
          }
        );
      }
      syncedCount++;
    }
    console.log(`   ✅ Processed ${syncedCount} users`);
    
    // 3. อัพเดต users ที่ไม่มี officeName ให้ใช้ default
    console.log('\n📊 Step 3: Setting default officeName for users without it...');
    const usersWithoutOfficeName = await User.find({
      $or: [
        { officeName: { $exists: false } },
        { officeName: null },
        { officeName: '' }
      ]
    }).select('_id officeId office').lean();
    
    console.log(`   Found ${usersWithoutOfficeName.length} users without officeName`);
    
    let defaultedCount = 0;
    for (const user of usersWithoutOfficeName) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            officeName: user.office || 'ไม่ระบุสาขา',
            officeId: user.officeId || 'UNSPECIFIED_OFFICE'
          },
          $unset: {
            office: '' // ลบ office field ออกจาก DB
          }
        }
      );
      defaultedCount++;
    }
    console.log(`   ✅ Set default for ${defaultedCount} users`);
    
    // 4. ลบ office field ออกจาก users ที่เหลือทั้งหมด
    console.log('\n📊 Step 4: Removing office field from ALL remaining users...');
    const remainingUsers = await User.updateMany(
      { office: { $exists: true } },
      {
        $unset: {
          office: '' // ลบ office field ออกจาก DB
        }
      }
    );
    console.log(`   ✅ Removed office field from ${remainingUsers.modifiedCount} users`);
    
    console.log('\n✅ Migration completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Updated ${updatedCount} users (office → officeName)`);
    console.log(`   - Processed ${syncedCount} users (both fields)`);
    console.log(`   - Set default for ${defaultedCount} users`);
    console.log(`   - Removed office field from ${remainingUsers.modifiedCount} users`);
    console.log('\n🎉 All done! Now only officeName is stored in DB (no office field).');
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
migrateOfficeToOfficeName();


