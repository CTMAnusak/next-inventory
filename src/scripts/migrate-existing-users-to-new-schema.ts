#!/usr/bin/env tsx

/**
 * Migration Script: Update existing users to support new Google OAuth schema
 * 
 * This script will:
 * 1. Find all existing users without new Google OAuth fields
 * 2. Set default values for new fields
 * 3. Mark them as manual registration and approved
 * 4. Set profileCompleted to true for existing users
 */

// Load environment variables
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local from project root
const result = dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Debug environment variables
console.log('🔍 Environment Variables Check:');
console.log('Current working directory:', process.cwd());
console.log('Dotenv result:', result.error ? result.error.message : 'Success');
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('MONGODB_URI value:', process.env.MONGODB_URI ? 'Set' : 'Not set');

interface MigrationResult {
  total: number;
  updated: number;
  skipped: number;
  errors: number;
  details: string[];
}

export async function migrateExistingUsersToNewSchema(): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  try {
    // Dynamic import after environment variables are loaded
    const { default: dbConnect } = await import('../lib/mongodb');
    const { default: User } = await import('../models/User');
    
    await dbConnect();
    console.log('🔗 Connected to database');

    // Find users that need migration (missing new fields)
    const usersNeedingMigration = await User.find({
      $or: [
        { registrationMethod: { $exists: false } },
        { registrationMethod: null },
        { isApproved: { $exists: false } },
        { isApproved: null },
        { profileCompleted: { $exists: false } },
        { profileCompleted: null }
      ]
    });
    
    result.total = usersNeedingMigration.length;
    console.log(`📊 Found ${result.total} users needing migration`);

    for (const user of usersNeedingMigration) {
      try {
        console.log(`🔄 Migrating user: ${user.email}`);

        // Set default values for existing users
        const updateData: any = {};

        // Set registration method to 'manual' for existing users
        if (!user.registrationMethod) {
          updateData.registrationMethod = 'manual';
        }

        // Set isApproved to true for existing users (they were already using the system)
        if (user.isApproved === undefined || user.isApproved === null) {
          updateData.isApproved = true;
        }

        // Set profileCompleted to true for existing users
        if (user.profileCompleted === undefined || user.profileCompleted === null) {
          updateData.profileCompleted = true;
        }

        // Set approvedAt if not exists and user is approved
        if (updateData.isApproved && !user.approvedAt) {
          updateData.approvedAt = user.createdAt || new Date();
        }

        // Update the user
        await User.updateOne(
          { _id: user._id },
          { $set: updateData }
        );

        result.updated++;
        result.details.push(`✅ Updated user: ${user.email} - Set ${Object.keys(updateData).join(', ')}`);

      } catch (error) {
        result.errors++;
        const errorMsg = `❌ Error updating user ${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.details.push(errorMsg);
        console.error(errorMsg);
      }
    }

    console.log('🎉 Migration completed!');
    console.log(`📊 Results: Total: ${result.total}, Updated: ${result.updated}, Skipped: ${result.skipped}, Errors: ${result.errors}`);

    // Verification
    await verifyMigration();

  } catch (error) {
    console.error('❌ Migration failed:', error);
    result.errors++;
    result.details.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

async function verifyMigration() {
  try {
    console.log('\n🔍 Verifying migration...');
    
    // Dynamic import for verification
    const { default: User } = await import('../models/User');
    
    const totalUsers = await User.countDocuments({});
    const manualUsers = await User.countDocuments({ registrationMethod: 'manual' });
    const googleUsers = await User.countDocuments({ registrationMethod: 'google' });
    const approvedUsers = await User.countDocuments({ isApproved: true });
    const pendingUsers = await User.countDocuments({ isApproved: false });
    const completedProfiles = await User.countDocuments({ profileCompleted: true });
    
    console.log('📊 Migration Verification:');
    console.log(`   👥 Total Users: ${totalUsers}`);
    console.log(`   📝 Manual Registration: ${manualUsers}`);
    console.log(`   🔗 Google Registration: ${googleUsers}`);
    console.log(`   ✅ Approved Users: ${approvedUsers}`);
    console.log(`   ⏳ Pending Users: ${pendingUsers}`);
    console.log(`   📋 Completed Profiles: ${completedProfiles}`);
    
    // Check for users with missing fields
    const usersWithMissingFields = await User.find({
      $or: [
        { registrationMethod: { $exists: false } },
        { registrationMethod: null },
        { isApproved: { $exists: false } },
        { isApproved: null }
      ]
    });
    
    if (usersWithMissingFields.length > 0) {
      console.log(`⚠️  Warning: ${usersWithMissingFields.length} users still have missing fields`);
      usersWithMissingFields.forEach(user => {
        console.log(`   - ${user.email}: registrationMethod=${user.registrationMethod}, isApproved=${user.isApproved}`);
      });
    } else {
      console.log('✅ All users have required fields');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateExistingUsersToNewSchema()
    .then((result) => {
      console.log('\n📋 Final Migration Report:');
      result.details.forEach(detail => console.log(detail));
      process.exit(result.errors > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

export default migrateExistingUsersToNewSchema;
