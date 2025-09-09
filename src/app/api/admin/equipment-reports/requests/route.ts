import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';

// GET - Fetch all equipment request logs
export async function GET() {
  try {
    await dbConnect();
    
    const requests = await RequestLog.find({ requestType: 'request' }).sort({ submittedAt: -1 });
    
    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching request logs:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
