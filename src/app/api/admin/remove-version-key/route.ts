/**
 * 🧹 API สำหรับลบ __v และ updatedAt ที่ไม่ต้องการ
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Removing unwanted fields: __v, updatedAt from root level...');
    
    await dbConnect();
    
    // ลบ __v และ updatedAt ที่ root level
    const result = await InventoryConfig.collection.updateMany(
      {},
      {
        $unset: {
          __v: "",
          updatedAt: ""  // root level updatedAt (ไม่ใช่ sub-config updatedAt)
        }
      }
    );
    
    
    // ตรวจสอบหลัง remove
    const updatedDoc = await InventoryConfig.findOne().lean();
    
    return NextResponse.json({
      success: true,
      message: 'ลบ __v และ updatedAt สำเร็จ',
      modifiedCount: result.modifiedCount,
      fieldsRemaining: Object.keys(updatedDoc || {})
    });

  } catch (error) {
    console.error('❌ Remove error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบ fields',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
