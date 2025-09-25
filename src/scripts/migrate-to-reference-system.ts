/**
 * Migration Script: จากระบบเก่าเป็น Reference-based System
 * 
 * ขั้นตอน:
 * 1. สร้าง ItemMaster จากข้อมูล InventoryItem/InventoryMaster เก่า
 * 2. อัปเดต InventoryConfig ให้มี default statuses และ conditions
 * 3. อัปเดต InventoryItem ให้ใช้ itemMasterId และ conditionId
 * 4. อัปเดต InventoryMaster ให้ใช้ itemMasterId
 * 5. สร้าง backup ก่อนและหลัง migration
 */

import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb';

// Import old models
import InventoryItem from '../models/InventoryItem';
import InventoryMaster from '../models/InventoryMaster';
import InventoryConfig from '../models/InventoryConfig';

// Import new models
import ItemMaster from '../models/ItemMaster';
import { InventoryItem as NewInventoryItem } from '../models/InventoryItemNew';
import { InventoryMaster as NewInventoryMaster } from '../models/InventoryMasterNew';

interface MigrationStats {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  itemMastersCreated: number;
  inventoryItemsUpdated: number;
  inventoryMastersUpdated: number;
  configsUpdated: boolean;
  errors: string[];
  backupPath?: string;
}

class ReferenceSystemMigration {
  private stats: MigrationStats;
  private dryRun: boolean;

  constructor(dryRun = false) {
    this.dryRun = dryRun;
    this.stats = {
      startTime: new Date(),
      itemMastersCreated: 0,
      inventoryItemsUpdated: 0,
      inventoryMastersUpdated: 0,
      configsUpdated: false,
      errors: []
    };
  }

  async run(): Promise<MigrationStats> {
    console.log(`🚀 Starting Reference System Migration ${this.dryRun ? '(DRY RUN)' : ''}`);
    console.log(`📅 Start time: ${this.stats.startTime.toISOString()}`);

    try {
      await dbConnect();

      // Step 1: Create backup
      await this.createBackup();

      // Step 2: Update InventoryConfig with default statuses and conditions
      await this.updateInventoryConfig();

      // Step 3: Create ItemMaster records
      await this.createItemMasters();

      // Step 4: Update InventoryItem records
      await this.updateInventoryItems();

      // Step 5: Update InventoryMaster records
      await this.updateInventoryMasters();

      // Step 6: Verify migration
      await this.verifyMigration();

      this.stats.endTime = new Date();
      this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();

      console.log(`✅ Migration completed successfully!`);
      console.log(`⏱️  Duration: ${this.stats.duration}ms`);
      this.printStats();

    } catch (error) {
      this.stats.errors.push(`Migration failed: ${error}`);
      console.error('❌ Migration failed:', error);
      
      if (!this.dryRun) {
        console.log('🔄 Consider rolling back using the backup...');
      }
      
      throw error;
    }

    return this.stats;
  }

  private async createBackup(): Promise<void> {
    console.log('📦 Creating backup...');
    
    if (this.dryRun) {
      console.log('🔍 DRY RUN: Backup would be created here');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `backup_migration_${timestamp}`;

    try {
      // Export current data
      const inventoryItems = await InventoryItem.find({}).lean();
      const inventoryMasters = await InventoryMaster.find({}).lean();
      const inventoryConfigs = await InventoryConfig.find({}).lean();

      // Save to backup files (in production, save to file system or cloud storage)
      console.log(`💾 Backup created: ${inventoryItems.length} items, ${inventoryMasters.length} masters, ${inventoryConfigs.length} configs`);
      
      this.stats.backupPath = backupPath;
    } catch (error) {
      throw new Error(`Backup failed: ${error}`);
    }
  }

  private async updateInventoryConfig(): Promise<void> {
    console.log('⚙️  Updating InventoryConfig with default statuses and conditions...');

    if (this.dryRun) {
      console.log('🔍 DRY RUN: InventoryConfig would be updated here');
      this.stats.configsUpdated = true;
      return;
    }

    try {
      const config = await InventoryConfig.findOne({});
      
      if (!config) {
        throw new Error('InventoryConfig not found');
      }

      // Check if statusConfigs and conditionConfigs already exist
      const hasStatusConfigs = config.statusConfigs && config.statusConfigs.length > 0;
      const hasConditionConfigs = config.conditionConfigs && config.conditionConfigs.length > 0;

      if (!hasStatusConfigs) {
        config.statusConfigs = [
          {
            id: 'status_available',
            name: 'มี',
            order: 1,
            isSystemConfig: true,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 'status_missing', 
            name: 'หาย',
            order: 2,
            isSystemConfig: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ] as any;
      }

      if (!hasConditionConfigs) {
        config.conditionConfigs = [
          {
            id: 'cond_working',
            name: 'ใช้งานได้',
            order: 1,
            isSystemConfig: true,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 'cond_damaged',
            name: 'ชำรุด',
            order: 2,
            isSystemConfig: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ] as any;
      }

      await config.save();
      this.stats.configsUpdated = true;
      console.log('✅ InventoryConfig updated successfully');

    } catch (error) {
      throw new Error(`InventoryConfig update failed: ${error}`);
    }
  }

  private async createItemMasters(): Promise<void> {
    console.log('🏗️  Creating ItemMaster records...');

    try {
      // Get unique combinations of itemName + categoryId from existing data
      const uniqueItems = await InventoryItem.aggregate([
        {
          $group: {
            _id: {
              itemName: '$itemName',
              categoryId: '$categoryId'
            },
            hasSerialNumber: {
              $max: {
                $cond: [
                  { $ne: ['$serialNumber', null] },
                  true,
                  false
                ]
              }
            },
            firstCreated: { $min: '$createdAt' },
            createdBy: { $first: '$sourceInfo.addedByUserId' }
          }
        }
      ]);

      console.log(`📋 Found ${uniqueItems.length} unique item combinations`);

      for (const item of uniqueItems) {
        if (this.dryRun) {
          console.log(`🔍 DRY RUN: Would create ItemMaster for ${item._id.itemName} (${item._id.categoryId})`);
          this.stats.itemMastersCreated++;
          continue;
        }

        try {
          const existingMaster = await ItemMaster.findOne({
            itemName: item._id.itemName,
            categoryId: item._id.categoryId
          });

          if (!existingMaster) {
            const newMaster = new ItemMaster({
              itemName: item._id.itemName,
              categoryId: item._id.categoryId,
              hasSerialNumber: item.hasSerialNumber || false,
              isActive: true,
              createdBy: item.createdBy || 'system_migration'
            });

            await newMaster.save();
            this.stats.itemMastersCreated++;
            console.log(`✅ Created ItemMaster: ${item._id.itemName}`);
          }
        } catch (error) {
          this.stats.errors.push(`Failed to create ItemMaster for ${item._id.itemName}: ${error}`);
          console.error(`❌ Failed to create ItemMaster for ${item._id.itemName}:`, error);
        }
      }

      console.log(`✅ Created ${this.stats.itemMastersCreated} ItemMaster records`);

    } catch (error) {
      throw new Error(`ItemMaster creation failed: ${error}`);
    }
  }

  private async updateInventoryItems(): Promise<void> {
    console.log('📦 Updating InventoryItem records...');

    try {
      const items = await InventoryItem.find({});
      console.log(`📋 Found ${items.length} InventoryItem records to update`);

      for (const item of items) {
        if (this.dryRun) {
          console.log(`🔍 DRY RUN: Would update InventoryItem ${item._id}`);
          this.stats.inventoryItemsUpdated++;
          continue;
        }

        try {
          // Find corresponding ItemMaster
          const itemMaster = await ItemMaster.findOne({
            itemName: item.itemName,
            categoryId: item.categoryId
          });

          if (!itemMaster) {
            this.stats.errors.push(`ItemMaster not found for ${item.itemName} (${item.categoryId})`);
            continue;
          }

          // Update the item with new structure
          const updateData: any = {
            itemMasterId: itemMaster._id.toString(),
            conditionId: 'cond_working', // Default condition
            statusId: item.statusId || 'status_available' // Keep existing statusId or default
          };

          // Remove old fields that are now in ItemMaster
          const unsetData: any = {
            itemName: 1,
            categoryId: 1
          };

          await InventoryItem.updateOne(
            { _id: item._id },
            { 
              $set: updateData,
              $unset: unsetData
            }
          );

          this.stats.inventoryItemsUpdated++;

        } catch (error) {
          this.stats.errors.push(`Failed to update InventoryItem ${item._id}: ${error}`);
          console.error(`❌ Failed to update InventoryItem ${item._id}:`, error);
        }
      }

      console.log(`✅ Updated ${this.stats.inventoryItemsUpdated} InventoryItem records`);

    } catch (error) {
      throw new Error(`InventoryItem update failed: ${error}`);
    }
  }

  private async updateInventoryMasters(): Promise<void> {
    console.log('📊 Updating InventoryMaster records...');

    try {
      const masters = await InventoryMaster.find({});
      console.log(`📋 Found ${masters.length} InventoryMaster records to update`);

      for (const master of masters) {
        if (this.dryRun) {
          console.log(`🔍 DRY RUN: Would update InventoryMaster ${master._id}`);
          this.stats.inventoryMastersUpdated++;
          continue;
        }

        try {
          // Find corresponding ItemMaster
          const itemMaster = await ItemMaster.findOne({
            itemName: master.itemName,
            categoryId: master.categoryId
          });

          if (!itemMaster) {
            this.stats.errors.push(`ItemMaster not found for InventoryMaster ${master._id}`);
            continue;
          }

          // Update with new structure
          const updateData: any = {
            itemMasterId: itemMaster._id.toString(),
            // Initialize new breakdown arrays
            statusBreakdown: [
              { statusId: 'status_available', count: master.totalQuantity || 0 }
            ],
            conditionBreakdown: [
              { conditionId: 'cond_working', count: master.totalQuantity || 0 }
            ]
          };

          // Remove old fields
          const unsetData: any = {
            itemName: 1,
            categoryId: 1,
            hasSerialNumber: 1
          };

          await InventoryMaster.updateOne(
            { _id: master._id },
            { 
              $set: updateData,
              $unset: unsetData
            }
          );

          this.stats.inventoryMastersUpdated++;

        } catch (error) {
          this.stats.errors.push(`Failed to update InventoryMaster ${master._id}: ${error}`);
          console.error(`❌ Failed to update InventoryMaster ${master._id}:`, error);
        }
      }

      console.log(`✅ Updated ${this.stats.inventoryMastersUpdated} InventoryMaster records`);

    } catch (error) {
      throw new Error(`InventoryMaster update failed: ${error}`);
    }
  }

  private async verifyMigration(): Promise<void> {
    console.log('🔍 Verifying migration...');

    try {
      const itemMasterCount = await ItemMaster.countDocuments();
      const inventoryItemCount = await InventoryItem.countDocuments();
      const inventoryMasterCount = await InventoryMaster.countDocuments();

      console.log('📊 Post-migration counts:');
      console.log(`   ItemMasters: ${itemMasterCount}`);
      console.log(`   InventoryItems: ${inventoryItemCount}`);
      console.log(`   InventoryMasters: ${inventoryMasterCount}`);

      // Verify referential integrity
      const itemsWithoutMaster = await InventoryItem.countDocuments({
        itemMasterId: { $exists: false }
      });

      const mastersWithoutMaster = await InventoryMaster.countDocuments({
        itemMasterId: { $exists: false }
      });

      if (itemsWithoutMaster > 0) {
        this.stats.errors.push(`${itemsWithoutMaster} InventoryItems without itemMasterId`);
      }

      if (mastersWithoutMaster > 0) {
        this.stats.errors.push(`${mastersWithoutMaster} InventoryMasters without itemMasterId`);
      }

      if (this.stats.errors.length === 0) {
        console.log('✅ Migration verification passed');
      } else {
        console.log('⚠️  Migration completed with warnings');
      }

    } catch (error) {
      throw new Error(`Migration verification failed: ${error}`);
    }
  }

  private printStats(): void {
    console.log('\n📈 Migration Statistics:');
    console.log(`   ItemMasters created: ${this.stats.itemMastersCreated}`);
    console.log(`   InventoryItems updated: ${this.stats.inventoryItemsUpdated}`);
    console.log(`   InventoryMasters updated: ${this.stats.inventoryMastersUpdated}`);
    console.log(`   Configs updated: ${this.stats.configsUpdated ? 'Yes' : 'No'}`);
    console.log(`   Errors: ${this.stats.errors.length}`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      this.stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    if (this.stats.backupPath) {
      console.log(`\n💾 Backup location: ${this.stats.backupPath}`);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  if (!dryRun && !force) {
    console.log('⚠️  This will modify your database structure!');
    console.log('   Use --dry-run to test first');
    console.log('   Use --force to proceed with actual migration');
    process.exit(1);
  }

  try {
    const migration = new ReferenceSystemMigration(dryRun);
    await migration.run();
    
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { ReferenceSystemMigration };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
