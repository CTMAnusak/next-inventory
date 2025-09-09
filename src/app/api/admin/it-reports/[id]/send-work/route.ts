import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';
import { sendIssueUpdateNotification } from '@/lib/email';

// POST - Handle status transitions (Accept Job or Send Work)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    const requestData = await request.json().catch(() => ({}));

    // Find the issue
    const issue = await IssueLog.findById(id);
    if (!issue) {
      return NextResponse.json(
        { error: 'ไม่พบรายการที่ต้องการ' },
        { status: 404 }
      );
    }

    // Determine the next status based on current status
    let newStatus: string;
    let updateFields: any = { updatedAt: new Date() };
    
    if (issue.status === 'pending') {
      // Accept job: pending → in_progress
      newStatus = 'in_progress';
      updateFields.status = newStatus;
      
      // Add assigned admin info if provided
      if (requestData.assignedAdmin) {
        updateFields.assignedAdmin = requestData.assignedAdmin;
      }
    } else if (issue.status === 'in_progress') {
      // Send work: in_progress → completed
      newStatus = 'completed';
      updateFields.status = newStatus;
      updateFields.completedDate = new Date();
    } else {
      return NextResponse.json(
        { error: 'ไม่สามารถดำเนินการในสถานะปัจจุบันได้' },
        { status: 400 }
      );
    }

    // Update the issue
    const updatedIssue = await IssueLog.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    );

    // ส่งอีเมลแจ้งเตือนตามสถานะ
    console.log(`🔔 Email notification trigger - Status change: ${newStatus}`);
    
    try {
      if (newStatus === 'in_progress') {
        // 2. ส่งอีเมลแจ้งผู้แจ้งเมื่อ IT รับงาน
        console.log('📧 Triggering job accepted email notification...');
        const { sendJobAcceptedNotification } = await import('@/lib/email');
        const emailResult = await sendJobAcceptedNotification(updatedIssue);
        
        console.log('📊 Job accepted email result:', emailResult);
        
        if (emailResult.success) {
          console.log('✅ Job accepted email sent successfully to user');
        } else {
          console.error('❌ Failed to send job accepted email:', emailResult.error);
        }
      } else if (newStatus === 'completed') {
        // 3. ส่งอีเมลแจ้งผู้แจ้งเมื่อ IT ส่งงาน
        console.log('📧 Triggering work completed email notification...');
        const { sendWorkCompletedNotification } = await import('@/lib/email');
        const emailResult = await sendWorkCompletedNotification(updatedIssue);
        
        console.log('📊 Work completed email result:', emailResult);
        
        if (emailResult.success) {
          console.log('✅ Work completed email sent successfully to user');
        } else {
          console.error('❌ Failed to send work completed email:', emailResult.error);
        }
      }
    } catch (emailError) {
      console.error('Email notification error:', emailError);
      // ไม่ให้ email error ทำให้การอัพเดตล้มเหลว
    }

    // Return appropriate message based on status change
    const message = newStatus === 'in_progress' 
      ? 'รับงานเรียบร้อยแล้ว' 
      : 'ส่งงานเรียบร้อยแล้ว';

    return NextResponse.json({
      message,
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
