import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import { verifyTokenFromRequest } from '@/lib/auth';

// DELETE - ลบคำขอเบิกอุปกรณ์ (ยกเลิก)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    // Verify admin authentication
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const { id: requestId } = await params;
    const body = await request.json();
    const { cancellationReason } = body; // เหตุผลการยกเลิก

    // Validate cancellation reason
    if (!cancellationReason || cancellationReason.trim() === '') {
      return NextResponse.json(
        { error: 'กรุณาระบุเหตุผลในการยกเลิก' },
        { status: 400 }
      );
    }

    // Find the request
    const requestLog = await RequestLog.findById(requestId);
    if (!requestLog) {
      return NextResponse.json(
        { error: 'ไม่พบคำขอที่ต้องการลบ' },
        { status: 404 }
      );
    }

    // Check if request is already completed
    if (requestLog.status === 'completed') {
      return NextResponse.json(
        { error: 'ไม่สามารถลบคำขอที่อนุมัติแล้วได้' },
        { status: 400 }
      );
    }

    // Get admin name
    const User = (await import('@/models/User')).default;
    const adminUser = await User.findById(payload.userId);
    const adminName = adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : 'Admin';

    // Update request log with cancellation info before deleting
    requestLog.cancelledAt = new Date();
    requestLog.cancelledBy = payload.userId;
    requestLog.cancelledByName = adminName;
    requestLog.cancellationReason = cancellationReason.trim();
    requestLog.status = 'rejected';
    await requestLog.save();

    // Delete the request
    await RequestLog.findByIdAndDelete(requestId);

    // Send email notifications
    try {
      const { sendEquipmentRequestCancellationNotification } = await import('@/lib/email');
      const emailData = {
        ...requestLog.toObject(),
        cancellationReason: cancellationReason.trim(),
        cancelledByName: adminName
      };
      await sendEquipmentRequestCancellationNotification(emailData);
    } catch (emailError) {
      console.error('Email notification error:', emailError);
      // ไม่ให้ email error ทำให้การลบล้มเหลว
    }

    return NextResponse.json({
      message: 'ลบคำขอเรียบร้อยแล้ว',
      requestId: requestId
    });

  } catch (error) {
    console.error('Error deleting request:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบคำขอ' },
      { status: 500 }
    );
  }
}
