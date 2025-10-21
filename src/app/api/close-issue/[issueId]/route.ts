import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';

// GET - Fetch issue by issueId
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    await dbConnect();
    
    const { issueId } = await params;

    const issue = await IssueLog.findOne({ issueId });
    
    if (!issue) {
      return NextResponse.json(
        { error: 'ไม่พบ Issue ID ที่ระบุ' },
        { status: 404 }
      );
    }

    return NextResponse.json(issue);
  } catch (error) {
    console.error('Error fetching issue:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
