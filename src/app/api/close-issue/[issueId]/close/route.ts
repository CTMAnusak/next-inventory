import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';

// POST - Close issue
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    await dbConnect();
    
    const { issueId } = await params;

    // Find and update the issue
    const updatedIssue = await IssueLog.findOneAndUpdate(
      { issueId },
      {
        status: 'completed',
        closedAt: new Date()
      },
      { new: true }
    );

    if (!updatedIssue) {
      return NextResponse.json(
        { error: 'ไม่พบ Issue ID ที่ระบุ' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'ปิดงานเรียบร้อยแล้ว',
      issue: updatedIssue
    });
  } catch (error) {
    console.error('Error closing issue:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการปิดงาน' },
      { status: 500 }
    );
  }
}
