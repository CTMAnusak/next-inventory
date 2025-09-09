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
    console.log('🔄 Creating sample inventory data...');

    // สร้าง Mouse ที่มี Serial Number
    const mouseWithSN = await createInventoryItem({
      itemName: 'Mouse',
      category: 'อุปกรณ์คอมพิวเตอร์',
      serialNumber: 'Mouse001',
      addedBy: 'admin',
      initialOwnerType: 'admin_stock',
      notes: 'Sample mouse with serial number'
    });

    console.log('✅ Created Mouse with SN:', mouseWithSN.serialNumber);

    // สร้าง Mouse ที่ไม่มี Serial Number (5 ชิ้น)
    for (let i = 1; i <= 5; i++) {
      const mouseWithoutSN = await createInventoryItem({
        itemName: 'Mouse',
        category: 'อุปกรณ์คอมพิวเตอร์',
        addedBy: 'admin',
        initialOwnerType: 'admin_stock',
        notes: `Sample mouse without SN #${i}`
      });

      console.log(`✅ Created Mouse without SN #${i}`);
    }

    // สร้าง Keyboard ที่มี Serial Number
    const keyboardWithSN = await createInventoryItem({
      itemName: 'Keyboard',
      category: 'อุปกรณ์คอมพิวเตอร์',
      serialNumber: 'KB001',
      addedBy: 'admin',
      initialOwnerType: 'admin_stock',
      notes: 'Sample keyboard with serial number'
    });

    console.log('✅ Created Keyboard with SN:', keyboardWithSN.serialNumber);

    // สร้าง Monitor ที่มี Serial Number
    const monitorWithSN = await createInventoryItem({
      itemName: 'Monitor',
      category: 'อุปกรณ์คอมพิวเตอร์',
      serialNumber: 'MON001',
      addedBy: 'admin',
      initialOwnerType: 'admin_stock',
      notes: 'Sample monitor with serial number'
    });

    console.log('✅ Created Monitor with SN:', monitorWithSN.serialNumber);

    console.log('🎉 Sample data created successfully!');
    
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
