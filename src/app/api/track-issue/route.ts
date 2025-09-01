import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';

export async function POST(request: NextRequest) {
  try {
    const { issueId } = await request.json();

    if (!issueId) {
      return NextResponse.json(
        { error: 'กรุณากรอก Issue ID' },
        { status: 400 }
      );
    }

    await dbConnect();

    const issue = await IssueLog.findOne({ issueId });
    
    if (!issue) {
      return NextResponse.json(
        { error: 'ไม่พบ Issue ID นี้ในระบบ' },
        { status: 404 }
      );
    }

    // Get status in Thai
    const statusText = {
      'pending': 'รอดำเนินการ',
      'in_progress': 'กำลังดำเนินการ',
      'completed': 'ดำเนินการแล้ว',
      'closed': 'ปิดงาน'
    }[issue.status] || issue.status;

    return NextResponse.json({
      issue: {
        issueId: issue.issueId,
        status: issue.status,
        statusText: statusText,
        reportDate: issue.reportDate,
        completedDate: issue.completedDate,
        closedDate: issue.closedDate,
        firstName: issue.firstName,
        lastName: issue.lastName,
        issueCategory: issue.issueCategory,
        urgency: issue.urgency,
        description: issue.description,
        notes: issue.notes
      }
    });

  } catch (error) {
    console.error('Track issue error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
