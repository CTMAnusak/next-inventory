import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';
import { verifyToken } from '@/lib/auth';
import { populateIssueInfoBatch } from '@/lib/issue-helpers';

export async function GET(request: NextRequest) {
  try {
    // Get user from token
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'ไม่พบการยืนยันตัวตน' },
        { status: 401 }
      );
    }

    const payload: any = verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลผู้ใช้' },
        { status: 401 }
      );
    }

    await dbConnect();

    // Find issues by requesterId for individual users or email for branch users
    const issues = await IssueLog.find({
      $or: [
        { requesterId: payload.userId }, // For individual users
        { userId: payload.userId }, // Backward compatibility
        { email: payload.email } // For branch users or legacy data
      ]
    }).sort({ reportDate: -1 }); // Sort by newest first

    // Populate both requester and admin information
    const populatedIssues = await populateIssueInfoBatch(issues);

    // Format the response
    const formattedIssues = populatedIssues.map(issue => {
      const statusText = {
        'pending': 'รอดำเนินการ',
        'in_progress': 'กำลังดำเนินการ',
        'completed': 'รอตรวจสอบผลงาน',
        'closed': 'ปิดงานแล้ว'
      }[issue.status] || issue.status;

      return {
        _id: issue._id.toString(),
        issueId: issue.issueId,
        firstName: issue.firstName,
        lastName: issue.lastName,
        nickname: issue.nickname,
        email: issue.email,
        phone: issue.phone,
        department: issue.department,
        office: issue.office,
        issueCategory: issue.issueCategory,
        customCategory: issue.customCategory,
        urgency: issue.urgency,
        description: issue.description,
        status: issue.status,
        statusText: statusText,
        reportDate: issue.reportDate,
        acceptedDate: issue.acceptedDate,
        completedDate: issue.completedDate,
        closedDate: issue.closedDate,
        notes: issue.notes,
        images: issue.images || [],
        assignedAdmin: issue.assignedAdmin, // เพิ่มข้อมูล IT Admin ที่รับงาน
        requesterType: issue.requesterType,
        requesterId: issue.requesterId,
        // เพิ่มข้อมูล feedback ที่หายไป
        userFeedback: issue.userFeedback,
        userFeedbackHistory: issue.userFeedbackHistory || [],
        notesHistory: issue.notesHistory || []
      };
    });

    return NextResponse.json({
      issues: formattedIssues
    });

  } catch (error) {
    console.error('Get user issues error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
