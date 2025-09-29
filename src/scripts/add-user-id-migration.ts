/**
 * Migration Script: Add user_id to existing users
 * 
 * This script adds user_id field to existing users who don't have it yet
 */

import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

interface MigrationResult {
  total: number;
  updated: number;
  skipped: number;
  errors: number;
  details: string[];
}

export async function addUserIdToExistingUsers(): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  try {
    await dbConnect();
    console.log('Connected to database');

    // Get all users without user_id
    const usersWithoutUserId = await User.find({ 
      $or: [
        { user_id: { $exists: false } },
        { user_id: null },
        { user_id: '' }
      ]
    });
    
    result.total = usersWithoutUserId.length;

    for (const user of usersWithoutUserId) {
      try {
        // Generate unique user_id
        let newUserId;
        let isUnique = false;
        let attempts = 0;
        
        while (!isUnique && attempts < 10) {
          newUserId = 'USER' + Date.now() + Math.floor(Math.random() * 1000);
          const existingUser = await User.findOne({ user_id: newUserId });
          if (!existingUser) {
            isUnique = true;
          }
          attempts++;
        }

        if (!isUnique) {
          result.errors++;
          result.details.push(`Failed to generate unique user_id for user ${user.email}`);
          continue;
        }

        // Update user with new user_id
        await User.updateOne(
          { _id: user._id },
          { $set: { user_id: newUserId } }
        );

        result.updated++;
        result.details.push(`Added user_id ${newUserId} to user ${user.email}`);

      } catch (error) {
        result.errors++;
        result.details.push(`Error updating user ${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`Error updating user ${user.email}:`, error);
      }
    }

    console.log(`Total: ${result.total}, Updated: ${result.updated}, Skipped: ${result.skipped}, Errors: ${result.errors}`);

  } catch (error) {
    console.error('Migration failed:', error);
    result.details.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

// Run migration if called directly
if (require.main === module) {
  addUserIdToExistingUsers()
    .then((result) => {
      console.log('Migration Result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration Error:', error);
      process.exit(1);
    });
}
