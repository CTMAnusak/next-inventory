import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import { verifyTokenFromRequest } from '@/lib/auth';

// DELETE - ลบรายการอุปกรณ์ทีละรายการจากคำขอ
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemIndex: string }> }
) {
  try {
    await dbConnect();

    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const { id, itemIndex } = await params;
    const idx = Number(itemIndex);
    if (!Number.isInteger(idx) || idx < 0) {
      return NextResponse.json({ error: 'itemIndex ไม่ถูกต้อง' }, { status: 400 });
    }

    const reqLog = await RequestLog.findById(id);
    if (!reqLog) {
      return NextResponse.json({ error: 'ไม่พบคำขอ' }, { status: 404 });
    }

    if (reqLog.status === 'completed') {
      return NextResponse.json({ error: 'คำขอที่อนุมัติแล้วไม่สามารถลบได้' }, { status: 400 });
    }

    if (idx >= reqLog.items.length) {
      return NextResponse.json({ error: 'itemIndex เกินจำนวนรายการ' }, { status: 400 });
    }

    // ลบรายการตาม index
    reqLog.items.splice(idx, 1);

    if (reqLog.items.length === 0) {
      await RequestLog.findByIdAndDelete(id);
      return NextResponse.json({ message: 'ลบรายการและคำขอเรียบร้อยแล้ว', deletedRequest: true, remainingItems: 0 });
    }

    await reqLog.save();
    return NextResponse.json({ message: 'ลบรายการเรียบร้อยแล้ว', deletedRequest: false, remainingItems: reqLog.items.length });
  } catch (error) {
    console.error('Error deleting request item:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบรายการ' }, { status: 500 });
  }
}


