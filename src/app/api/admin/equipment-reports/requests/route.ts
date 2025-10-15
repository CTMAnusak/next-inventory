import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import { populateRequestLogCompleteBatch } from '@/lib/equipment-populate-helpers';

// GET - Fetch all equipment request logs
export async function GET() {
  try {
    await dbConnect();

    // Use requestDate (fallback to createdAt) for newest-first ordering
    const requests = await RequestLog.find({ requestType: 'request' })
      .sort({ requestDate: -1, createdAt: -1 });
    
    console.log('🔍 Raw requests from DB:', requests.length);

    // ใช้ populate functions เพื่อ populate ข้อมูลล่าสุด
    // - Populate User info (ถ้า User ยังมีอยู่)
    // - Populate Item names, Categories, Status, Condition (ถ้ายังมีอยู่)
    // - ถ้าข้อมูลถูกลบ จะใช้ Snapshot ที่เก็บไว้
    const populatedRequests = await populateRequestLogCompleteBatch(requests);

    console.log('📋 API returning populated requests:', populatedRequests.length, 'items');
    return NextResponse.json(populatedRequests);
  } catch (error) {
    console.error('Error fetching request logs:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
