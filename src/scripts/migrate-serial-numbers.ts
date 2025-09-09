import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb';
import Inventory from '../models/Inventory';
import RequestLog from '../models/RequestLog';

async function migrateSerialNumbers() {
  try {
    await dbConnect();
    console.log('🔗 Connected to MongoDB');

    // Migrate Inventory items
    console.log('📦 Starting Inventory migration...');
    const inventoryItems = await Inventory.find({});
    let inventoryUpdated = 0;

    for (const item of inventoryItems) {
      if (item.serialNumber && item.serialNumber.trim() !== '') {
        // Convert old serialNumber to serialNumbers array
        await Inventory.findByIdAndUpdate(item._id, {
          $set: {
            serialNumbers: [item.serialNumber.trim()],
            quantity: 1,
            totalQuantity: 1
          },
          $unset: { serialNumber: 1 }
        });
        inventoryUpdated++;
        console.log(`✅ Updated inventory item: ${item.itemName} with serial number: ${item.serialNumber}`);
      }
    }

    console.log(`📦 Inventory migration completed: ${inventoryUpdated} items updated`);

    // Migrate RequestLog items
    console.log('📋 Starting RequestLog migration...');
    const requestLogs = await RequestLog.find({});
    let requestLogsUpdated = 0;

    for (const log of requestLogs) {
      let logUpdated = false;
      
      for (const item of log.items) {
        if (item.serialNumber && item.serialNumber.trim() !== '') {
          // Convert old serialNumber to serialNumbers array
          item.serialNumbers = [item.serialNumber.trim()];
          delete item.serialNumber;
          logUpdated = true;
        }
      }
      
      if (logUpdated) {
        await RequestLog.findByIdAndUpdate(log._id, { items: log.items });
        requestLogsUpdated++;
        console.log(`✅ Updated request log: ${log._id}`);
      }
    }

    console.log(`📋 RequestLog migration completed: ${requestLogsUpdated} logs updated`);

    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateSerialNumbers();
}

export default migrateSerialNumbers;
