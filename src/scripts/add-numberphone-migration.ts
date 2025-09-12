/**
 * Migration script to add numberPhone field for SIM card category items
 * This script adds the numberPhone field to existing InventoryItem documents
 */

import { connectToDatabase } from '../lib/mongodb';
import { InventoryItem } from '../models/InventoryItem';

interface MigrationResult {
  totalProcessed: number;
  simCardItems: number;
  updated: number;
  errors: string[];
}

async function addNumberPhoneMigration(): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalProcessed: 0,
    simCardItems: 0,
    updated: 0,
    errors: []
  };

  try {
    await connectToDatabase();
    console.log('🔌 Connected to database');

    // Find all inventory items
    const allItems = await InventoryItem.find({});
    result.totalProcessed = allItems.length;
    console.log(`📊 Found ${result.totalProcessed} inventory items`);

    // Process each item
    for (const item of allItems) {
      try {
        // Check if item is in SIM card category
        if (item.category === 'ซิมการ์ด') {
          result.simCardItems++;
          
          // Add numberPhone field if not exists
          if (!item.numberPhone) {
            // Initialize with empty string or null - admin will need to populate manually
            item.numberPhone = '';
            await item.save();
            result.updated++;
            console.log(`✅ Updated SIM card item: ${item.itemName} (ID: ${item._id})`);
          }
        }
      } catch (error) {
        const errorMsg = `Error processing item ${item._id}: ${error}`;
        result.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`Total items processed: ${result.totalProcessed}`);
    console.log(`SIM card items found: ${result.simCardItems}`);
    console.log(`Items updated: ${result.updated}`);
    console.log(`Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }

    return result;

  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  addNumberPhoneMigration()
    .then((result) => {
      console.log('\n🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { addNumberPhoneMigration };
