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
  
  try {
    // Connect to DB
    console.log('Connecting to MongoDB...');
    await dbConnect();

    // Get category mapping
    const config = await InventoryConfig.findOne({});
    if (!config || !config.categoryConfigs || config.categoryConfigs.length === 0) {
      console.error('❌ No categoryConfigs found in InventoryConfig');
      process.exit(1);
    }

    // Create category name -> ID mapping
    const categoryMap = new Map<string, string>();
    config.categoryConfigs.forEach((cat: any) => {
      categoryMap.set(cat.name, cat.id);
    });

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
    
    const inventoryItems = await InventoryItem.find({
      category: { $exists: true, $ne: null },
      categoryId: { $exists: false }
    }).lean();


    for (const item of inventoryItems) {
      stats.inventoryItemsProcessed++;
      
      const categoryId = categoryMap.get((item as any).category!);
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
          }
        } catch (error) {
          const errorMsg = `Failed to update InventoryItem ${item._id}: ${error}`;
          console.error(`   ❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      } else {
        const unmatchedCategory = (item as any).category!;
        if (!stats.unmatchedCategories.includes(unmatchedCategory)) {
          stats.unmatchedCategories.push(unmatchedCategory);
          console.warn(`   ⚠️  Unmatched category: "${unmatchedCategory}"`);
        }
      }
    }

    // === Migrate InventoryMasters ===
    
    const inventoryMasters = await InventoryMaster.find({
      category: { $exists: true, $ne: null },
      categoryId: { $exists: false }
    }).lean();


    for (const master of inventoryMasters) {
      stats.inventoryMastersProcessed++;
      
      const categoryId = categoryMap.get((master as any).category!);
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
          }
        } catch (error) {
          const errorMsg = `Failed to update InventoryMaster ${master._id}: ${error}`;
          console.error(`   ❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      } else {
        const unmatchedCategory = (master as any).category!;
        if (!stats.unmatchedCategories.includes(unmatchedCategory)) {
          stats.unmatchedCategories.push(unmatchedCategory);
          console.warn(`   ⚠️  Unmatched category: "${unmatchedCategory}"`);
        }
      }
    }

    // === Handle Unmatched Categories ===
    if (stats.unmatchedCategories.length > 0) {
      
      // Find or create "ไม่ระบุ" category
      let unassignedCategoryId = categoryMap.get('ไม่ระบุ');
      if (!unassignedCategoryId) {
        unassignedCategoryId = 'cat_unassigned';
      }

      for (const unmatchedCategory of stats.unmatchedCategories) {
        
        // Update InventoryItems
        const itemUpdateResult = await InventoryItem.updateMany(
          { category: unmatchedCategory, categoryId: { $exists: false } },
          { $set: { categoryId: unassignedCategoryId } }
        );
        
        // Update InventoryMasters (use lean query to access raw data)
        const masterUpdateResult = await InventoryMaster.collection.updateMany(
          { category: unmatchedCategory, categoryId: { $exists: false } },
          { $set: { categoryId: unassignedCategoryId } }
        );
        
        
        stats.inventoryItemsUpdated += itemUpdateResult.modifiedCount;
        stats.inventoryMastersUpdated += masterUpdateResult.modifiedCount;
      }
    }

    // === Final Report ===
    console.log(`InventoryItems processed: ${stats.inventoryItemsProcessed}`);
    console.log(`InventoryMasters processed: ${stats.inventoryMastersProcessed}`);
    console.log(`Unmatched categories: ${stats.unmatchedCategories.length}`);
    console.log(`Errors: ${stats.errors.length}`);

    if (stats.unmatchedCategories.length > 0) {
      stats.unmatchedCategories.forEach(cat => console.log(`   - ${cat}`));
    }

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errors.forEach(error => console.log(`   - ${error}`));
    }

    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateCategoryToId().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
}

export { migrateCategoryToId };
