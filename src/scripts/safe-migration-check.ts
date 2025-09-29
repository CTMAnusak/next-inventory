#!/usr/bin/env tsx

/**
 * ตรวจสอบข้อมูลใน Database ก่อนทำการ Migration
 */

import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb';

// สร้าง temporary schema สำหรับ Inventory เก่า
const OldInventorySchema = new mongoose.Schema({
  itemName: String,
  category: String,
  serialNumbers: [String],
  quantity: Number,
  totalQuantity: Number,
  status: String,
  dateAdded: Date,
  addedBy: [{
    role: String,
    userId: String,
    quantity: Number,
    dateAdded: Date
  }]
}, { timestamps: true });

async function checkDatabaseStatus() {
  try {
    await dbConnect();

    // ตรวจสอบ Collections ที่มีอยู่
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    collectionNames.forEach(name => console.log(`  - ${name}`));
    console.log('');

    // ตรวจสอบข้อมูลใน Inventory เก่า
    if (collectionNames.includes('inventories')) {
      const OldInventory = mongoose.models.OldInventory || 
        mongoose.model('OldInventory', OldInventorySchema, 'inventories');
      
      const oldCount = await OldInventory.countDocuments();
      
      if (oldCount > 0) {
        const samples = await OldInventory.find({}).limit(3);
        samples.forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.itemName} - จำนวน: ${item.quantity}`);
        });
      }
    } else {
      console.log('❌ ไม่พบ Collection "inventories" (Inventory เก่า)');
    }
    
    console.log('');

    // ตรวจสอบข้อมูลใน Models ใหม่
    const newCollections = ['inventoryitems', 'inventorymasters', 'transferlogs'];
    for (const collName of newCollections) {
      if (collectionNames.includes(collName)) {
        const count = await mongoose.connection.db.collection(collName).countDocuments();
      } else {
        console.log(`⚪ ${collName}: ยังไม่มีข้อมูล`);
      }
    }

    
    if (collectionNames.includes('inventories')) {
      const oldCount = await mongoose.connection.db.collection('inventories').countDocuments();
      if (oldCount > 0) {
      }
    }
    
    const hasNewData = newCollections.some(name => collectionNames.includes(name));
    if (hasNewData) {
    } else {
    }

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  checkDatabaseStatus();
}

export { checkDatabaseStatus };
