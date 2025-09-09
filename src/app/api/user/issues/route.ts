import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';
import { verifyToken } from '@/lib/auth';

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

    // Find issues by user email (since IssueLog stores email)
    // We'll also try to find by userId if it exists
    const issues = await IssueLog.find({
      $or: [
        { userId: payload.userId },
        { email: payload.email }
      ]
    }).sort({ reportDate: -1 }); // Sort by newest first

    // Format the response
    const formattedIssues = issues.map(issue => {
      const statusText = {
        'pending': 'รอ Admin รับงาน',
        'in_progress': 'กำลังดำเนินการ',
        'completed': 'รอตรวจสอบผลงาน',
        'closed': 'ปิดงานแล้ว'
      }[issue.status] || issue.status;

      return {
        _id: issue._id.toString(),
        issueId: issue.issueId,
        issueCategory: issue.issueCategory,
        customCategory: issue.customCategory,
        urgency: issue.urgency,
        description: issue.description,
        status: issue.status,
        statusText: statusText,
        reportDate: issue.reportDate,
        completedDate: issue.completedDate,
        closedDate: issue.closedDate,
        notes: issue.notes,
        images: issue.images || [],
        assignedAdmin: issue.assignedAdmin // เพิ่มข้อมูล IT Admin ที่รับงาน
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
