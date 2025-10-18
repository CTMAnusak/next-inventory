import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { authenticateUser } from '@/lib/auth-helpers';
import IssueLog from '@/models/IssueLog';
import { formatIssueForEmail } from '@/lib/issue-helpers';

export async function POST(request: NextRequest) {
  try {
    // 🆕 ตรวจสอบ authentication และ user ใน database
    const { error, user } = await authenticateUser(request);
    if (error) return error;

    const { issueId, action, reason } = await request.json();
    
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
    const ownsIssue = 
      issue.requesterId === user!.user_id || // New way: check requesterId
      issue.userId === user!.user_id || // Legacy: check userId
      issue.email === user!.email; // Fallback: check email
      
    if (!ownsIssue) {
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

    // Create new feedback entry
    const newFeedback = {
      action: action === 'approve' ? 'approved' : 'rejected',
      reason: reason || (action === 'approve' ? 'ผู้ใช้อนุมัติงาน' : 'ผู้ใช้ไม่อนุมัติผลงาน'),
      submittedAt: new Date()
    };

    // Update issue based on action
    const updateData: any = {
      updatedAt: new Date(),
      // เพิ่ม feedback ใหม่เข้าไปใน history array
      $push: { userFeedbackHistory: newFeedback },
      // อัปเดต userFeedback เดิมเพื่อ backward compatibility
      userFeedback: newFeedback
    };

    if (action === 'approve') {
      updateData.status = 'closed';
      updateData.closedAt = new Date();
      updateData.closedDate = new Date();
    } else if (action === 'reject') {
      updateData.status = 'in_progress'; // Send back to admin
      updateData.completedDate = null; // ล้างวันที่ดำเนินการเสร็จเพื่อให้แสดง "-"
      updateData.closedDate = null; // ล้างวันที่ปิดงานเพื่อให้แสดง "-"
    }

    console.log('Updating issue with data:', updateData);
    const updatedIssue = await IssueLog.findByIdAndUpdate(issueId, updateData, { new: true });

    const actionText = action === 'approve' ? 'อนุมัติผลงาน' : 'ส่งกลับให้แก้ไข';
    
    // 4. ส่งอีเมลแจ้ง IT Admin เมื่อผู้ใช้ตอบกลับ (ผ่าน/ไม่ผ่าน)
    try {
      // Populate requester information before sending email
      const emailData = await formatIssueForEmail(updatedIssue);
      
      const { sendUserApprovalNotification } = await import('@/lib/email');
      const emailResult = await sendUserApprovalNotification(emailData, updateData.userFeedback);
      
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
