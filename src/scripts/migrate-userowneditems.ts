/**
 * Migration Script: UserOwnedItems to Inventory
 * 
 * This script migrates data from UserOwnedItem collection to Inventory collection
 * with new fields: userId, userRole, addedBy
 */

import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';
import Inventory from '@/models/Inventory';
import User from '@/models/User';

interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  details: string[];
}

export async function migrateUserOwnedItems(): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  try {
    await dbConnect();
    console.log('Connected to database');

    // Get all UserOwnedItems from the database collection
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection failed');
    }
    
    const userOwnedItems = await db.collection('userowneditems').find({}).toArray();
    result.total = userOwnedItems.length;
    

    for (const item of userOwnedItems) {
      try {
        // Try to find user by userId first, then by name/office
        let user = null;
        if (item.userId) {
          user = await User.findById(item.userId);
        }
        
        if (!user && item.firstName && item.lastName && item.office) {
          user = await User.findOne({
            firstName: item.firstName,
            lastName: item.lastName,
            office: item.office
          });
        }

        // Check if item already exists in inventory
        const existingInventory = await Inventory.findOne({
          itemName: item.itemName,
          category: item.category,
          serialNumber: item.serialNumber || { $exists: false },
          userId: user?._id || item.userId,
          addedBy: 'user'
        });

        if (existingInventory) {
          // Update quantity if exists
          existingInventory.quantity = (existingInventory.quantity || 0) + (item.quantity || 1);
          existingInventory.totalQuantity = (existingInventory.totalQuantity || 0) + (item.quantity || 1);
          await existingInventory.save();
          
          result.details.push(`Updated existing item: ${item.itemName} (${item.serialNumber || 'no SN'}) for user ${user?.email || 'unknown'}`);
          result.migrated++;
        } else {
          // Create new inventory item
          const newInventoryItem = new Inventory({
            itemName: item.itemName,
            category: item.category,
            serialNumber: item.serialNumber || undefined,
            price: 0, // Default price for user-added items
            quantity: item.quantity || 1,
            totalQuantity: item.quantity || 1,
            status: 'active',
            dateAdded: item.createdAt || new Date(),
            userId: user?._id || item.userId || undefined,
            userRole: user?.userRole || 'user',
            addedBy: 'user'
          });

          await newInventoryItem.save();
          
          result.details.push(`Migrated: ${item.itemName} (${item.serialNumber || 'no SN'}) for user ${user?.email || 'unknown'}`);
          result.migrated++;
        }

      } catch (error) {
        result.errors++;
        result.details.push(`Error migrating item ${item.itemName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`Error migrating item ${item.itemName}:`, error);
      }
    }

    console.log(`Total: ${result.total}, Migrated: ${result.migrated}, Skipped: ${result.skipped}, Errors: ${result.errors}`);

  } catch (error) {
    console.error('Migration failed:', error);
    result.details.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

// Run migration if called directly
if (require.main === module) {
  migrateUserOwnedItems()
    .then((result) => {
      console.log('Migration Result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration Error:', error);
      process.exit(1);
    });
}
