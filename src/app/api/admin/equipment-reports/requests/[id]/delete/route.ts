import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import { verifyTokenFromRequest } from '@/lib/auth';

// DELETE - ลบคำขอเบิกอุปกรณ์
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

    const requestId = params.id;

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

    // Delete the request
    await RequestLog.findByIdAndDelete(requestId);


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
