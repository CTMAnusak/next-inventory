import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';

// POST - Don't close issue (add notes and set back to pending)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    await dbConnect();
    
    const { issueId } = params;
    const body = await request.json();
    const { notes } = body;

    if (!notes || !notes.trim()) {
      return NextResponse.json(
        { error: 'กรุณากรอกหมายเหตุ' },
        { status: 400 }
      );
    }

    // Find and update the issue
    const updatedIssue = await IssueLog.findOneAndUpdate(
      { issueId },
      {
        status: 'pending',
        notes: notes.trim(),
        updatedAt: new Date()
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
      message: 'บันทึกหมายเหตุเรียบร้อยแล้ว',
      issue: updatedIssue
    });
  } catch (error) {
    console.error('Error updating issue notes:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึกหมายเหตุ' },
      { status: 500 }
    );
  }
}
