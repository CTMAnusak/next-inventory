import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';
import { sendIssueUpdateNotification } from '@/lib/email';

// POST - Send work completion notification
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const { id } = params;

    // Find the issue
    const issue = await IssueLog.findById(id);
    if (!issue) {
      return NextResponse.json(
        { error: 'ไม่พบรายการที่ต้องการ' },
        { status: 404 }
      );
    }

    // Update status to in_progress
    const updatedIssue = await IssueLog.findByIdAndUpdate(
      id,
      {
        status: 'in_progress',
        updatedAt: new Date()
      },
      { new: true }
    );

    // Send email notification to user
    try {
      await sendIssueUpdateNotification({
        issueId: issue.issueId,
        firstName: issue.firstName,
        lastName: issue.lastName,
        nickname: issue.nickname,
        phone: issue.phone,
        email: issue.email,
        department: issue.department,
        office: issue.office,
        issueCategory: issue.issueCategory,
        customCategory: issue.customCategory,
        urgency: issue.urgency,
        description: issue.description,
        images: issue.images,
        reportDate: issue.reportDate,
        notes: issue.notes
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Continue even if email fails
    }

    return NextResponse.json({
      message: 'ส่งงานเรียบร้อยแล้ว',
      issue: updatedIssue
    });
  } catch (error) {
    console.error('Error sending work:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการส่งงาน' },
      { status: 500 }
    );
  }
}
