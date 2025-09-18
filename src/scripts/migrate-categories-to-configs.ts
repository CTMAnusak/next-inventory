/**
 * Migration Script: Categories to CategoryConfigs
 * 
 * This script migrates the existing categories array to the new categoryConfigs structure
 * in the inventoryconfigs collection.
 * 
 * Usage:
 * - Run this script once to migrate existing data
 * - Safe to run multiple times (idempotent)
 */

import dbConnect from '@/lib/mongodb';
import InventoryConfig, { 
  ICategoryConfig, 
  generateCategoryId, 
  DEFAULT_CATEGORY_CONFIGS 
} from '@/models/InventoryConfig';

interface MigrationStats {
  documentsProcessed: number;
  categoriesMigrated: number;
  errors: string[];
  skipped: number;
}

/**
 * Convert a legacy category name to a category config
 */
const createCategoryConfigFromName = (name: string, order: number): ICategoryConfig => {
  // Check if this is a special category (you can customize this logic)
  const specialCategories = ['ซิมการ์ด'];
  const isSpecial = specialCategories.includes(name);
  
  return {
    id: generateCategoryId(),
    name,
    isSpecial,
    backgroundColor: isSpecial ? '#fed7aa' : '#ffffff', // Orange for special categories
    isSystemCategory: name === 'ไม่ระบุ', // "ไม่ระบุ" is a system category
    order: name === 'ไม่ระบุ' ? 999 : order, // "ไม่ระบุ" always at bottom
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

/**
 * Main migration function
 */
export async function migrateCategoryConfigs(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    documentsProcessed: 0,
    categoriesMigrated: 0,
    errors: [],
    skipped: 0
  };

  try {
    console.log('🚀 Starting category migration...');
    
    // Connect to database
    await dbConnect();
    
    // Find all inventory config documents
    const configs = await InventoryConfig.find({});
    
    console.log(`📊 Found ${configs.length} inventory config documents`);
    
    for (const config of configs) {
      stats.documentsProcessed++;
      
      try {
        // Skip if categoryConfigs already exists and has data
        if (config.categoryConfigs && config.categoryConfigs.length > 0) {
          console.log(`⏭️  Skipping document ${config._id} - categoryConfigs already exists`);
          stats.skipped++;
          continue;
        }
        
        // Create categoryConfigs from existing categories array
        const categoryConfigs: ICategoryConfig[] = [];
        
        if (config.categories && config.categories.length > 0) {
          // Migrate existing categories
          config.categories.forEach((categoryName, index) => {
            const categoryConfig = createCategoryConfigFromName(categoryName, index + 1);
            categoryConfigs.push(categoryConfig);
            stats.categoriesMigrated++;
          });
        } else {
          // Use default categories if no existing categories
          categoryConfigs.push(...DEFAULT_CATEGORY_CONFIGS);
          stats.categoriesMigrated += DEFAULT_CATEGORY_CONFIGS.length;
        }
        
        // Ensure "ไม่ระบุ" category exists
        const hasUnassigned = categoryConfigs.some(cat => cat.name === 'ไม่ระบุ');
        if (!hasUnassigned) {
          categoryConfigs.push({
            id: 'cat_unassigned',
            name: 'ไม่ระบุ',
            isSpecial: false,
            backgroundColor: '#fef3c7', // Yellow background
            isSystemCategory: true, // Cannot be deleted
            order: 999,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          stats.categoriesMigrated++;
        }
        
        // Update the document
        await InventoryConfig.findByIdAndUpdate(
          config._id,
          { 
            $set: { 
              categoryConfigs: categoryConfigs,
              updatedAt: new Date()
            } 
          },
          { new: true }
        );
        
        console.log(`✅ Migrated ${categoryConfigs.length} categories for document ${config._id}`);
        
      } catch (error) {
        const errorMsg = `Error processing document ${config._id}: ${error}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }
    
    console.log('🎉 Migration completed successfully!');
    console.log(`📈 Statistics:`, stats);
    
    return stats;
    
  } catch (error) {
    const errorMsg = `Fatal migration error: ${error}`;
    console.error(`💥 ${errorMsg}`);
    stats.errors.push(errorMsg);
    throw error;
  }
}

/**
 * Rollback function (optional - removes categoryConfigs)
 */
export async function rollbackCategoryConfigs(): Promise<void> {
  try {
    console.log('🔄 Rolling back category configs migration...');
    
    await dbConnect();
    
    const result = await InventoryConfig.updateMany(
      {},
      { 
        $unset: { categoryConfigs: 1 },
        $set: { updatedAt: new Date() }
      }
    );
    
    console.log(`✅ Rollback completed. ${result.modifiedCount} documents updated.`);
    
  } catch (error) {
    console.error(`❌ Rollback error: ${error}`);
    throw error;
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateCategoryConfigs()
    .then((stats) => {
      console.log('\n📊 Final Migration Statistics:');
      console.log(`Documents processed: ${stats.documentsProcessed}`);
      console.log(`Categories migrated: ${stats.categoriesMigrated}`);
      console.log(`Documents skipped: ${stats.skipped}`);
      console.log(`Errors: ${stats.errors.length}`);
      
      if (stats.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        stats.errors.forEach(error => console.log(`  - ${error}`));
        process.exit(1);
      }
      
      console.log('\n🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}
