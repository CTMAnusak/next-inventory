#!/usr/bin/env tsx

/**
 * สร้างข้อมูลตัวอย่างสำหรับ InventoryItem และ InventoryMaster
 */

import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb';
import { createInventoryItem } from '../lib/inventory-helpers';

async function createSampleData() {
  try {
    await dbConnect();

    // สร้าง Mouse ที่มี Serial Number
    const mouseWithSN = await createInventoryItem({
      itemName: 'Mouse',
      categoryId: 'อุปกรณ์คอมพิวเตอร์',
      serialNumber: 'Mouse001',
      addedBy: 'admin',
      initialOwnerType: 'admin_stock',
      notes: 'Sample mouse with serial number'
    });


    // สร้าง Mouse ที่ไม่มี Serial Number (5 ชิ้น)
    for (let i = 1; i <= 5; i++) {
      const mouseWithoutSN = await createInventoryItem({
        itemName: 'Mouse',
        categoryId: 'อุปกรณ์คอมพิวเตอร์',
        addedBy: 'admin',
        initialOwnerType: 'admin_stock',
        notes: `Sample mouse without SN #${i}`
      });

    }

    // สร้าง Keyboard ที่มี Serial Number
    const keyboardWithSN = await createInventoryItem({
      itemName: 'Keyboard',
      categoryId: 'อุปกรณ์คอมพิวเตอร์',
      serialNumber: 'KB001',
      addedBy: 'admin',
      initialOwnerType: 'admin_stock',
      notes: 'Sample keyboard with serial number'
    });


    // สร้าง Monitor ที่มี Serial Number
    const monitorWithSN = await createInventoryItem({
      itemName: 'Monitor',
      categoryId: 'อุปกรณ์คอมพิวเตอร์',
      serialNumber: 'MON001',
      addedBy: 'admin',
      initialOwnerType: 'admin_stock',
      notes: 'Sample monitor with serial number'
    });


    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  createSampleData();
}

export { createSampleData };
