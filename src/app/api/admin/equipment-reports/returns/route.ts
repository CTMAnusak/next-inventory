import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import { populateReturnLogCompleteBatch } from '@/lib/equipment-populate-helpers';

// GET - Fetch all equipment return logs with enriched item data
export async function GET() {
  try {
    await dbConnect();
    
    const returns = await ReturnLog.find({})
      .sort({ submittedAt: -1 });
    
    // ใช้ populate functions เพื่อ populate ข้อมูลล่าสุด
    // - Populate User info (ถ้า User ยังมีอยู่)
    // - Populate Item names, Categories, Status, Condition (ถ้ายังมีอยู่)
    // - ถ้าข้อมูลถูกลบ จะใช้ Snapshot ที่เก็บไว้
    const populatedReturns = await populateReturnLogCompleteBatch(returns);
    
    return NextResponse.json(populatedReturns);
  } catch (error) {
    console.error('Error fetching return logs:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
