import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import { populateRequestLogCompleteBatchOptimized } from '@/lib/optimized-populate-helpers';

// GET - Fetch all equipment request logs
export async function GET() {
  try {
    await dbConnect();

    // Use requestDate (fallback to createdAt) for newest-first ordering
    const requests = await RequestLog.find({ requestType: 'request' })
      .sort({ requestDate: -1, createdAt: -1 });
    
    console.log('🔍 Raw requests from DB:', requests.length);

    // ใช้ optimized populate function เพื่อแก้ปัญหา N+1 query
    const populatedRequests = await populateRequestLogCompleteBatchOptimized(requests);

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
