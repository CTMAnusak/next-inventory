/**
 * Migration Script: Remove category field from inventoryitems collection
 * 
 * This script removes the redundant 'category' field from all documents
 * in the inventoryitems collection since we now use 'categoryId' exclusively.
 * 
 * Usage: npx ts-node src/scripts/remove-category-field-migration.ts
 */

import dbConnect from '../lib/mongodb';
import InventoryItem from '../models/InventoryItem';
import InventoryMaster from '../models/InventoryMaster';

async function removeCategoryFieldMigration() {
  console.log('🚀 Starting migration to remove category field from inventoryitems collection...');
  
  try {
    await dbConnect();
    console.log('✅ Connected to database');

    // First, let's check how many documents have the category field
    const inventoryItemsWithCategory = await InventoryItem.countDocuments({ category: { $exists: true } });
    const inventoryMastersWithCategory = await InventoryMaster.countDocuments({ category: { $exists: true } });
    
    console.log(`📊 Found ${inventoryItemsWithCategory} InventoryItem documents with category field`);
    console.log(`📊 Found ${inventoryMastersWithCategory} InventoryMaster documents with category field`);

    if (inventoryItemsWithCategory === 0 && inventoryMastersWithCategory === 0) {
      console.log('✅ No documents found with category field. Migration not needed.');
      return;
    }

    // Remove category field from InventoryItem collection
    if (inventoryItemsWithCategory > 0) {
      console.log('🔄 Removing category field from InventoryItem documents...');
      const result1 = await InventoryItem.updateMany(
        { category: { $exists: true } },
        { $unset: { category: 1 } }
      );
      console.log(`✅ Removed category field from ${result1.modifiedCount} InventoryItem documents`);
    }

    // Remove category field from InventoryMaster collection
    if (inventoryMastersWithCategory > 0) {
      console.log('🔄 Removing category field from InventoryMaster documents...');
      const result2 = await InventoryMaster.updateMany(
        { category: { $exists: true } },
        { $unset: { category: 1 } }
      );
      console.log(`✅ Removed category field from ${result2.modifiedCount} InventoryMaster documents`);
    }

    // Verify the migration
    const remainingInventoryItems = await InventoryItem.countDocuments({ category: { $exists: true } });
    const remainingInventoryMasters = await InventoryMaster.countDocuments({ category: { $exists: true } });
    
    if (remainingInventoryItems === 0 && remainingInventoryMasters === 0) {
      console.log('🎉 Migration completed successfully! No documents have category field anymore.');
    } else {
      console.warn(`⚠️ Migration incomplete. ${remainingInventoryItems} InventoryItems and ${remainingInventoryMasters} InventoryMasters still have category field.`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  removeCategoryFieldMigration()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

export default removeCategoryFieldMigration;
