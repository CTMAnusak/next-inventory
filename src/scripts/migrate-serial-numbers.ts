import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb';
import Inventory from '../models/Inventory';
import RequestLog from '../models/RequestLog';

async function migrateSerialNumbers() {
  try {
    await dbConnect();

    // Migrate Inventory items
    const inventoryItems = await Inventory.find({}).lean();
    let inventoryUpdated = 0;

    for (const item of inventoryItems) {
      const itemData = item as any;
      if (itemData.serialNumber && itemData.serialNumber.trim() !== '') {
        // Convert old serialNumber to serialNumbers array
        await Inventory.findByIdAndUpdate(item._id, {
          $set: {
            serialNumbers: [itemData.serialNumber.trim()],
            quantity: 1,
            totalQuantity: 1
          },
          $unset: { serialNumber: 1 }
        });
        inventoryUpdated++;
      }
    }


    // Migrate RequestLog items
    const requestLogs = await RequestLog.find({}).lean();
    let requestLogsUpdated = 0;

    for (const log of requestLogs) {
      let logUpdated = false;
      const logData = log as any;
      
      for (const item of logData.items) {
        if (item.serialNumber && item.serialNumber.trim() !== '') {
          // Convert old serialNumber to serialNumbers array
          item.serialNumbers = [item.serialNumber.trim()];
          delete item.serialNumber;
          logUpdated = true;
        }
      }
      
      if (logUpdated) {
        await RequestLog.findByIdAndUpdate(log._id, { items: logData.items });
        requestLogsUpdated++;
      }
    }


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
