/**
 * Fast Migration script to add numberPhone field for SIM card category items
 * This script uses bulk operations for better performance
 */

import dbConnect from '../lib/mongodb';
import { InventoryItem } from '../models/InventoryItem';
import mongoose from 'mongoose';

interface MigrationResult {
  totalProcessed: number;
  simCardItems: number;
  updated: number;
  errors: string[];
}

async function addNumberPhoneMigrationFast(): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalProcessed: 0,
    simCardItems: 0,
    updated: 0,
    errors: []
  };

  try {
    // Add timeout for database connection
    const connectionTimeout = setTimeout(() => {
      console.error('❌ Database connection timeout (30 seconds)');
      process.exit(1);
    }, 30000);

    await dbConnect();
    clearTimeout(connectionTimeout);

    // Get total count first
    const totalItems = await InventoryItem.countDocuments({});

    // Find all SIM card items that don't have numberPhone field
    
    const simCardItemsToUpdate = await InventoryItem.find({
      category: 'ซิมการ์ด',
      $or: [
        { numberPhone: { $exists: false } },
        { numberPhone: null },
        { numberPhone: '' }
      ]
    }).select('_id itemName').lean();

    result.simCardItems = await InventoryItem.countDocuments({ category: 'ซิมการ์ด' });
    result.totalProcessed = totalItems;
    

    if (simCardItemsToUpdate.length === 0) {
      return result;
    }

    // Use bulk operation for better performance
    const bulkOps = simCardItemsToUpdate.map(item => ({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { numberPhone: null } }
      }
    }));

    // Execute bulk operation in chunks to avoid memory issues
    const chunkSize = 1000;
    for (let i = 0; i < bulkOps.length; i += chunkSize) {
      const chunk = bulkOps.slice(i, i + chunkSize);
      
      const bulkResult = await InventoryItem.bulkWrite(chunk, { 
        ordered: false,
        writeConcern: { w: 1 }
      });
      
      result.updated += bulkResult.modifiedCount;
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`Total items processed: ${result.totalProcessed}`);
    console.log(`SIM card items found: ${result.simCardItems}`);
    console.log(`Items updated: ${result.updated}`);
    console.log(`Errors: ${result.errors.length}`);

    return result;

  } catch (error) {
    console.error('💥 Migration failed:', error);
    result.errors.push(`Migration error: ${error}`);
    throw error;
  } finally {
    // Force close any hanging connections
    try {
      await mongoose.connection.close();
    } catch (closeError) {
      console.error('Error closing database:', closeError);
    }
  }
}

// Run migration if executed directly
if (require.main === module) {
  // Add a global timeout to force exit
  const globalTimeout = setTimeout(() => {
    console.error('🔄 Script timeout - forcing exit');
    process.exit(1);
  }, 60000); // 1 minute max for fast version

  addNumberPhoneMigrationFast()
    .then((result) => {
      clearTimeout(globalTimeout);
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    })
    .catch((error) => {
      clearTimeout(globalTimeout);
      console.error('💥 Fast Migration failed:', error);
      setTimeout(() => {
        process.exit(1);
      }, 2000);
    });
}

export { addNumberPhoneMigrationFast };
