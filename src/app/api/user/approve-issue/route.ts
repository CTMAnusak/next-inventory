import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import IssueLog from '@/models/IssueLog';

export async function POST(request: NextRequest) {
  console.log('🚀 USER APPROVE/REJECT API CALLED');
  try {
    // Verify user authentication
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'ไม่พบการยืนยันตัวตน' },
        { status: 401 }
      );
    }

    const payload: any = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token ไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    const { issueId, action, reason } = await request.json();
    console.log('📝 Request data:', { issueId, action, reason });
    
    if (!issueId || !action) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Action ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find the issue and verify ownership
    const issue = await IssueLog.findById(issueId);
    if (!issue) {
      return NextResponse.json(
        { error: 'ไม่พบรายการงานนี้' },
        { status: 404 }
      );
    }

    // Verify the user owns this issue
    if (issue.userId !== payload.userId && issue.email !== payload.email) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึงรายการงานนี้' },
        { status: 403 }
      );
    }

    // Check if issue is in correct status
    if (issue.status !== 'completed') {
      return NextResponse.json(
        { error: 'ไม่สามารถดำเนินการได้ เนื่องจากสถานะงานไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Update issue based on action
    const updateData: any = {
      updatedAt: new Date()
    };

    if (action === 'approve') {
      updateData.status = 'closed';
      updateData.closedAt = new Date();
      updateData.userFeedback = {
        action: 'approved',
        reason: reason || 'ผู้ใช้อนุมัติงาน',
        submittedAt: new Date()
      };
    } else if (action === 'reject') {
      updateData.status = 'in_progress'; // Send back to admin
      updateData.userFeedback = {
        action: 'rejected',
        reason: reason || 'ผู้ใช้ไม่อนุมัติผลงาน',
        submittedAt: new Date()
      };
    }

    console.log('Updating issue with data:', updateData);
    const updatedIssue = await IssueLog.findByIdAndUpdate(issueId, updateData, { new: true });
    console.log('Updated issue:', updatedIssue);

    const actionText = action === 'approve' ? 'อนุมัติผลงาน' : 'ส่งกลับให้แก้ไข';
    
    // 4. ส่งอีเมลแจ้ง IT Admin เมื่อผู้ใช้ตอบกลับ (ผ่าน/ไม่ผ่าน)
    try {
      const { sendUserApprovalNotification } = await import('@/lib/email');
      const emailResult = await sendUserApprovalNotification(updatedIssue, updateData.userFeedback);
      
      if (emailResult.success) {
        console.log(`User ${actionText} email sent to ${emailResult.totalSent} IT admins successfully`);
      } else {
        console.error('Failed to send user approval email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('User approval email notification error:', emailError);
      // ไม่ให้ email error ทำให้การอัพเดตล้มเหลว
    }

    return NextResponse.json({
      message: `${actionText}เรียบร้อยแล้ว`,
      newStatus: updateData.status
    });

  } catch (error) {
    console.error('❌ User approve/reject error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
