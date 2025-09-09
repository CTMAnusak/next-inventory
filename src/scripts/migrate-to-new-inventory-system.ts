#!/usr/bin/env tsx

/**
 * Migration Script: Convert from old Inventory model to new InventoryItem + InventoryMaster system
 * 
 * This script will:
 * 1. Read all existing Inventory records
 * 2. Convert them to new InventoryItem records
 * 3. Generate InventoryMaster summary records
 * 4. Create TransferLog entries for audit trail
 * 5. Update RequestLog and ReturnLog references
 */

import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb';

// Import old model (for reading)
const OldInventorySchema = new mongoose.Schema({
  itemName: String,
  category: String,
  serialNumbers: [String],
  quantity: Number,
  totalQuantity: Number,
  status: String,
  dateAdded: Date,
  addedBy: [{
    role: String,
    userId: String,
    quantity: Number,
    dateAdded: Date
  }]
}, { timestamps: true });

const OldInventory = mongoose.models.OldInventory || mongoose.model('OldInventory', OldInventorySchema, 'inventories');

// Import new models
import InventoryItem from '../models/InventoryItem';
import InventoryMaster from '../models/InventoryMaster';
import TransferLog from '../models/TransferLog';
import RequestLog from '../models/RequestLog';
import ReturnLog from '../models/ReturnLog';

interface MigrationStats {
  oldRecords: number;
  newItemsCreated: number;
  masterRecordsCreated: number;
  transferLogsCreated: number;
  requestLogsUpdated: number;
  returnLogsUpdated: number;
  errors: string[];
}

async function migrateInventorySystem(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    oldRecords: 0,
    newItemsCreated: 0,
    masterRecordsCreated: 0,
    transferLogsCreated: 0,
    requestLogsUpdated: 0,
    returnLogsUpdated: 0,
    errors: []
  };

  try {
    await dbConnect();
    console.log('🔄 Starting inventory system migration...');

    // Step 1: Read all old inventory records
    const oldInventories = await OldInventory.find({});
    stats.oldRecords = oldInventories.length;
    console.log(`📊 Found ${stats.oldRecords} old inventory records`);

    // Step 2: Convert to new system
    for (const oldItem of oldInventories) {
      try {
        await migrateInventoryItem(oldItem, stats);
      } catch (error) {
        const errorMsg = `Error migrating item ${oldItem._id}: ${error}`;
        console.error(errorMsg);
        stats.errors.push(errorMsg);
      }
    }

    // Step 3: Generate InventoryMaster records
    await generateMasterRecords(stats);

    // Step 4: Update RequestLog and ReturnLog references
    await updateLogReferences(stats);

    console.log('✅ Migration completed!');
    console.log('📊 Migration Statistics:', stats);

    return stats;

  } catch (error) {
    console.error('❌ Migration failed:', error);
    stats.errors.push(`Migration failed: ${error}`);
    throw error;
  }
}

async function migrateInventoryItem(oldItem: any, stats: MigrationStats) {
  console.log(`🔄 Migrating: ${oldItem.itemName} (${oldItem._id})`);

  // Handle items with serial numbers
  if (oldItem.serialNumbers && oldItem.serialNumbers.length > 0) {
    // Create separate InventoryItem for each serial number
    for (const sn of oldItem.serialNumbers) {
      if (sn && sn.trim() !== '' && sn !== '-') {
        await createInventoryItem(oldItem, sn, stats);
      }
    }
  } else {
    // Create items based on quantity (for items without SN)
    const quantity = oldItem.quantity || oldItem.totalQuantity || 1;
    for (let i = 0; i < quantity; i++) {
      await createInventoryItem(oldItem, undefined, stats);
    }
  }
}

async function createInventoryItem(oldItem: any, serialNumber: string | undefined, stats: MigrationStats) {
  // Determine ownership based on addedBy information
  let ownerType: 'admin_stock' | 'user_owned' = 'admin_stock';
  let userId: string | undefined;
  let addedBy: 'admin' | 'user' = 'admin';
  let addedByUserId: string | undefined;
  let acquisitionMethod: 'self_reported' | 'admin_purchased' | 'transferred' = 'admin_purchased';

  // Analyze addedBy array to determine ownership
  if (oldItem.addedBy && oldItem.addedBy.length > 0) {
    const lastEntry = oldItem.addedBy[oldItem.addedBy.length - 1];
    
    if (lastEntry.role === 'user') {
      ownerType = 'user_owned';
      userId = lastEntry.userId;
      addedBy = 'user';
      addedByUserId = lastEntry.userId;
      acquisitionMethod = 'self_reported';
    }
  }

  // Create new InventoryItem
  const newItem = new InventoryItem({
    itemName: oldItem.itemName,
    category: oldItem.category || 'ไม่ระบุ',
    serialNumber: serialNumber,
    status: oldItem.status || 'active',
    
    currentOwnership: {
      ownerType: ownerType,
      userId: userId,
      ownedSince: oldItem.dateAdded || oldItem.createdAt || new Date()
    },
    
    sourceInfo: {
      addedBy: addedBy,
      addedByUserId: addedByUserId,
      dateAdded: oldItem.dateAdded || oldItem.createdAt || new Date(),
      initialOwnerType: ownerType,
      acquisitionMethod: acquisitionMethod,
      notes: `Migrated from old inventory system. Original ID: ${oldItem._id}`
    }
  });

  const savedItem = await newItem.save();
  stats.newItemsCreated++;

  // Create TransferLog entry
  await TransferLog.logTransfer({
    itemId: savedItem._id.toString(),
    itemName: savedItem.itemName,
    category: savedItem.category,
    serialNumber: savedItem.serialNumber,
    transferType: addedBy === 'user' ? 'user_report' : 'admin_add',
    fromOwnership: {
      ownerType: 'new_item'
    },
    toOwnership: {
      ownerType: ownerType,
      userId: userId
    },
    transferDate: oldItem.dateAdded || oldItem.createdAt || new Date(),
    reason: 'Migrated from old inventory system'
  });
  
  stats.transferLogsCreated++;

  console.log(`  ✅ Created InventoryItem: ${savedItem.itemName} ${serialNumber ? `(SN: ${serialNumber})` : ''}`);
}

async function generateMasterRecords(stats: MigrationStats) {
  console.log('🔄 Generating InventoryMaster records...');

  // Get unique combinations of itemName + category
  const combinations = await InventoryItem.aggregate([
    {
      $group: {
        _id: {
          itemName: '$itemName',
          category: '$category'
        }
      }
    }
  ]);

  for (const combo of combinations) {
    try {
      await InventoryMaster.updateSummary(combo._id.itemName, combo._id.category);
      stats.masterRecordsCreated++;
      console.log(`  ✅ Created/Updated InventoryMaster: ${combo._id.itemName} (${combo._id.category})`);
    } catch (error) {
      const errorMsg = `Error creating master record for ${combo._id.itemName}: ${error}`;
      console.error(errorMsg);
      stats.errors.push(errorMsg);
    }
  }
}

async function updateLogReferences(stats: MigrationStats) {
  console.log('🔄 Updating RequestLog and ReturnLog references...');

  // Note: This is a complex migration that would need to map old inventory IDs to new InventoryItem IDs
  // For now, we'll log this as a manual step needed
  console.log('⚠️  RequestLog and ReturnLog reference updates need to be done manually');
  console.log('    This involves mapping old inventory._id to new InventoryItem._id values');
  
  // TODO: Implement detailed log reference updates if needed
}

// Dry run function to preview changes without making them
async function dryRun(): Promise<void> {
  try {
    await dbConnect();
    console.log('🔍 DRY RUN: Analyzing current inventory data...');

    const oldInventories = await OldInventory.find({});
    console.log(`📊 Found ${oldInventories.length} old inventory records`);

    let totalItemsToCreate = 0;
    const summaryByCategory: Record<string, number> = {};

    for (const oldItem of oldInventories) {
      const category = oldItem.category || 'ไม่ระบุ';
      
      if (oldItem.serialNumbers && oldItem.serialNumbers.length > 0) {
        const validSNs = oldItem.serialNumbers.filter((sn: string) => sn && sn.trim() !== '' && sn !== '-');
        totalItemsToCreate += validSNs.length;
        summaryByCategory[category] = (summaryByCategory[category] || 0) + validSNs.length;
      } else {
        const quantity = oldItem.quantity || oldItem.totalQuantity || 1;
        totalItemsToCreate += quantity;
        summaryByCategory[category] = (summaryByCategory[category] || 0) + quantity;
      }
    }

    console.log(`📊 Migration will create ${totalItemsToCreate} new InventoryItem records`);
    console.log('📊 Summary by category:', summaryByCategory);
    console.log(`📊 Estimated ${Object.keys(summaryByCategory).length} InventoryMaster records will be created`);

  } catch (error) {
    console.error('❌ Dry run failed:', error);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  try {
    if (isDryRun) {
      await dryRun();
    } else {
      const stats = await migrateInventorySystem();
      
      if (stats.errors.length > 0) {
        console.log('\n⚠️  Migration completed with errors:');
        stats.errors.forEach(error => console.log(`  - ${error}`));
      }
    }
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Export functions for use in other scripts
export {
  migrateInventorySystem,
  dryRun
};

// Run if called directly
if (require.main === module) {
  main();
}
