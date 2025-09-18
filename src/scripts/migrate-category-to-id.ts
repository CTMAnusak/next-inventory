/**
 * Migration Script: Convert category strings to categoryId references
 * 
 * This script migrates:
 * 1. InventoryItem.category (string) -> InventoryItem.categoryId (ID)
 * 2. InventoryMaster.category (string) -> InventoryMaster.categoryId (ID)
 * 
 * Run: npx tsx src/scripts/migrate-category-to-id.ts
 */

import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';

interface MigrationStats {
  inventoryItemsProcessed: number;
  inventoryItemsUpdated: number;
  inventoryMastersProcessed: number;
  inventoryMastersUpdated: number;
  categoriesFound: number;
  unmatchedCategories: string[];
  errors: string[];
}

async function migrateCategoryToId() {
  console.log('🚀 Starting category string to ID migration...');
  
  try {
    // Connect to DB
    console.log('Connecting to MongoDB...');
    await dbConnect();
    console.log('✅ MongoDB connected successfully');

    // Get category mapping
    console.log('📊 Loading category configurations...');
    const config = await InventoryConfig.findOne({});
    if (!config || !config.categoryConfigs || config.categoryConfigs.length === 0) {
      console.error('❌ No categoryConfigs found in InventoryConfig');
      process.exit(1);
    }

    // Create category name -> ID mapping
    const categoryMap = new Map<string, string>();
    config.categoryConfigs.forEach(cat => {
      categoryMap.set(cat.name, cat.id);
    });

    console.log(`📋 Found ${categoryMap.size} categories to map:`);
    categoryMap.forEach((id, name) => {
      console.log(`   ${name} -> ${id}`);
    });

    const stats: MigrationStats = {
      inventoryItemsProcessed: 0,
      inventoryItemsUpdated: 0,
      inventoryMastersProcessed: 0,
      inventoryMastersUpdated: 0,
      categoriesFound: categoryMap.size,
      unmatchedCategories: [],
      errors: []
    };

    // === Migrate InventoryItems ===
    console.log('\n🔄 Migrating InventoryItems...');
    
    const inventoryItems = await InventoryItem.find({
      category: { $exists: true, $ne: null },
      categoryId: { $exists: false }
    });

    console.log(`📦 Found ${inventoryItems.length} InventoryItems to migrate`);

    for (const item of inventoryItems) {
      stats.inventoryItemsProcessed++;
      
      const categoryId = categoryMap.get(item.category!);
      if (categoryId) {
        try {
          await InventoryItem.updateOne(
            { _id: item._id },
            { 
              $set: { 
                categoryId: categoryId 
                // Keep category field for backward compatibility
              }
            }
          );
          stats.inventoryItemsUpdated++;
          
          if (stats.inventoryItemsUpdated % 100 === 0) {
            console.log(`   📈 Migrated ${stats.inventoryItemsUpdated}/${inventoryItems.length} InventoryItems`);
          }
        } catch (error) {
          const errorMsg = `Failed to update InventoryItem ${item._id}: ${error}`;
          console.error(`   ❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      } else {
        const unmatchedCategory = item.category!;
        if (!stats.unmatchedCategories.includes(unmatchedCategory)) {
          stats.unmatchedCategories.push(unmatchedCategory);
          console.warn(`   ⚠️  Unmatched category: "${unmatchedCategory}"`);
        }
      }
    }

    // === Migrate InventoryMasters ===
    console.log('\n🔄 Migrating InventoryMasters...');
    
    const inventoryMasters = await InventoryMaster.find({
      category: { $exists: true, $ne: null },
      categoryId: { $exists: false }
    });

    console.log(`📦 Found ${inventoryMasters.length} InventoryMasters to migrate`);

    for (const master of inventoryMasters) {
      stats.inventoryMastersProcessed++;
      
      const categoryId = categoryMap.get(master.category!);
      if (categoryId) {
        try {
          await InventoryMaster.updateOne(
            { _id: master._id },
            { 
              $set: { 
                categoryId: categoryId 
                // Keep category field for backward compatibility
              }
            }
          );
          stats.inventoryMastersUpdated++;
          
          if (stats.inventoryMastersUpdated % 50 === 0) {
            console.log(`   📈 Migrated ${stats.inventoryMastersUpdated}/${inventoryMasters.length} InventoryMasters`);
          }
        } catch (error) {
          const errorMsg = `Failed to update InventoryMaster ${master._id}: ${error}`;
          console.error(`   ❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      } else {
        const unmatchedCategory = master.category!;
        if (!stats.unmatchedCategories.includes(unmatchedCategory)) {
          stats.unmatchedCategories.push(unmatchedCategory);
          console.warn(`   ⚠️  Unmatched category: "${unmatchedCategory}"`);
        }
      }
    }

    // === Handle Unmatched Categories ===
    if (stats.unmatchedCategories.length > 0) {
      console.log('\n🔍 Handling unmatched categories...');
      
      // Find or create "ไม่ระบุ" category
      let unassignedCategoryId = categoryMap.get('ไม่ระบุ');
      if (!unassignedCategoryId) {
        console.log('⚠️  "ไม่ระบุ" category not found, using fallback ID');
        unassignedCategoryId = 'cat_unassigned';
      }

      for (const unmatchedCategory of stats.unmatchedCategories) {
        console.log(`   🔄 Assigning unmatched category "${unmatchedCategory}" to "ไม่ระบุ" (${unassignedCategoryId})`);
        
        // Update InventoryItems
        const itemUpdateResult = await InventoryItem.updateMany(
          { category: unmatchedCategory, categoryId: { $exists: false } },
          { $set: { categoryId: unassignedCategoryId } }
        );
        
        // Update InventoryMasters
        const masterUpdateResult = await InventoryMaster.updateMany(
          { category: unmatchedCategory, categoryId: { $exists: false } },
          { $set: { categoryId: unassignedCategoryId } }
        );
        
        console.log(`     📊 Updated ${itemUpdateResult.modifiedCount} InventoryItems, ${masterUpdateResult.modifiedCount} InventoryMasters`);
        
        stats.inventoryItemsUpdated += itemUpdateResult.modifiedCount;
        stats.inventoryMastersUpdated += masterUpdateResult.modifiedCount;
      }
    }

    // === Final Report ===
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📈 Final Statistics:');
    console.log(`Categories found: ${stats.categoriesFound}`);
    console.log(`InventoryItems processed: ${stats.inventoryItemsProcessed}`);
    console.log(`InventoryItems updated: ${stats.inventoryItemsUpdated}`);
    console.log(`InventoryMasters processed: ${stats.inventoryMastersProcessed}`);
    console.log(`InventoryMasters updated: ${stats.inventoryMastersUpdated}`);
    console.log(`Unmatched categories: ${stats.unmatchedCategories.length}`);
    console.log(`Errors: ${stats.errors.length}`);

    if (stats.unmatchedCategories.length > 0) {
      console.log('\n⚠️  Unmatched categories (assigned to "ไม่ระบุ"):');
      stats.unmatchedCategories.forEach(cat => console.log(`   - ${cat}`));
    }

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errors.forEach(error => console.log(`   - ${error}`));
    }

    console.log('\n✅ All items now have categoryId field for relational integrity!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateCategoryToId().then(() => {
    console.log('🏁 Migration script completed');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
}

export { migrateCategoryToId };
