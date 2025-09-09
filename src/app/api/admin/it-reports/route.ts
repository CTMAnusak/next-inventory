import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';

// GET - Fetch all IT issues
export async function GET() {
  try {
    await dbConnect();
    
    const issues = await IssueLog.find({}).sort({ reportDate: -1 });
    
    return NextResponse.json(issues);
  } catch (error) {
    console.error('Error fetching IT issues:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
