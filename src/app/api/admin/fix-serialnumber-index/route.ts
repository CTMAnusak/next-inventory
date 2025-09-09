import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting serialNumber index fix via API...');
    
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection failed');
    }
    const collection = db.collection('inventoryitems');

    const results = {
      currentIndexes: [],
      droppedIndexes: [],
      newIndex: null,
      cleanupCount: 0,
      stats: {}
    };

    // 1. ดู indexes ที่มีอยู่
    console.log('\n📋 Current indexes:');
    const currentIndexes = await collection.listIndexes().toArray();
    results.currentIndexes = currentIndexes.map(index => ({ 
      name: index.name, 
      key: index.key,
      unique: index.unique,
      sparse: index.sparse,
      partialFilterExpression: index.partialFilterExpression
    }));

    // 2. ลบ index เก่าที่มีปัญหาทั้งหมด
    const indexesToDrop = ['serialNumber_1', 'serialNumber_sparse_unique', 'serialNumber_sparse_nonunique'];
    
    for (const indexName of indexesToDrop) {
      try {
        console.log(`\n🗑️ Dropping old index: ${indexName}...`);
        await collection.dropIndex(indexName);
        console.log(`✅ Index ${indexName} dropped successfully`);
        results.droppedIndexes.push(indexName);
      } catch (error: any) {
        if (error.codeName === 'IndexNotFound') {
          console.log(`ℹ️ Index ${indexName} not found (already dropped)`);
        } else {
          console.log(`⚠️ Error dropping index ${indexName}:`, error.message);
        }
      }
    }

    // 3. สร้าง partial index ใหม่ (เฉพาะ documents ที่มี serialNumber)
    console.log('\n🏗️ Creating new partial index for serialNumber...');
    const newIndexResult = await collection.createIndex(
      { serialNumber: 1 }, 
      { 
        unique: true,   // ยังคง unique สำหรับ SN ที่มีค่า
        partialFilterExpression: { 
          $and: [
            { serialNumber: { $exists: true } },
            { serialNumber: { $ne: null } },
            { serialNumber: { $ne: "" } }
          ]
        },
        name: 'serialNumber_partial_unique'
      }
    );
    console.log('✅ New partial unique index created (unique only for non-null serialNumbers)');
    results.newIndex = 'serialNumber_partial_unique';

    // 4. ทำความสะอาดข้อมูล - แปลง empty string เป็น undefined
    console.log('\n🧹 Cleaning up serialNumber data...');
    const cleanupResult = await collection.updateMany(
      { serialNumber: { $in: [null, ""] } },
      { $unset: { serialNumber: 1 } }
    );
    console.log(`✅ Cleaned up ${cleanupResult.modifiedCount} documents with null/empty serialNumber`);
    results.cleanupCount = cleanupResult.modifiedCount;

    // 5. ทดสอบโดยการนับ documents
    const nullSerialCount = await collection.countDocuments({ 
      $or: [
        { serialNumber: null },
        { serialNumber: { $exists: false } },
        { serialNumber: "" }
      ]
    });

    const validSerialCount = await collection.countDocuments({ 
      $and: [
        { serialNumber: { $exists: true } },
        { serialNumber: { $ne: null } },
        { serialNumber: { $ne: "" } }
      ]
    });

    results.stats = {
      nullEmptyCount: nullSerialCount,
      validSerialCount: validSerialCount,
      totalItems: nullSerialCount + validSerialCount
    };

    // 6. ตรวจสอบ indexes หลังการแก้ไข
    const updatedIndexes = await collection.listIndexes().toArray();
    
    console.log('\n🎉 Serial number index fix completed successfully!');
    
    return NextResponse.json({
      success: true,
      message: 'Serial number index fix completed successfully',
      results: {
        ...results,
        finalIndexes: updatedIndexes.map(index => ({ 
          name: index.name, 
          key: index.key,
          unique: index.unique,
          sparse: index.sparse,
          partialFilterExpression: index.partialFilterExpression
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error fixing serialNumber index:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'เกิดข้อผิดพลาดในการแก้ไข serialNumber index',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}