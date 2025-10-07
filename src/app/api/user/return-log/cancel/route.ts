import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import { verifyToken } from '@/lib/auth';

// POST - ยกเลิกการคืน (สำหรับรายการที่ pending เท่านั้น)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Verify user token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    
    const { returnLogId, itemId } = await request.json();
    
    if (!returnLogId || !itemId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ Return Log ID และ Item ID' },
        { status: 400 }
      );
    }
    
    // Find the return log
    const returnLog = await ReturnLog.findById(returnLogId);
    
    if (!returnLog) {
      return NextResponse.json(
        { error: 'ไม่พบรายการคืนอุปกรณ์' },
        { status: 404 }
      );
    }
    
    // Verify ownership
    if (returnLog.userId !== payload.userId) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์ยกเลิกรายการคืนนี้' },
        { status: 403 }
      );
    }
    
    // Find the item in the return log
    const itemIndex = returnLog.items.findIndex((item: any) => item.itemId === itemId);
    
    if (itemIndex === -1) {
      return NextResponse.json(
        { error: 'ไม่พบรายการอุปกรณ์ที่ต้องการยกเลิก' },
        { status: 404 }
      );
    }
    
    const item = returnLog.items[itemIndex];
    
    // Check if item is still pending
    if (item.approvalStatus !== 'pending') {
      return NextResponse.json(
        { error: 'ไม่สามารถยกเลิกรายการที่อนุมัติแล้ว' },
        { status: 400 }
      );
    }
    
    // Remove the item from the return log
    returnLog.items.splice(itemIndex, 1);
    
    // If no items left, delete the entire return log
    if (returnLog.items.length === 0) {
      await ReturnLog.findByIdAndDelete(returnLogId);
      return NextResponse.json({
        message: 'ยกเลิกการคืนเรียบร้อยแล้ว (ลบรายการคืนทั้งหมด)',
        deletedEntireLog: true
      });
    }
    
    // Otherwise, just update the return log
    await returnLog.save();
    
    return NextResponse.json({
      message: 'ยกเลิกการคืนเรียบร้อยแล้ว',
      deletedEntireLog: false
    });
    
  } catch (error) {
    console.error('Error canceling return:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการยกเลิกการคืน' },
      { status: 500 }
    );
  }
}

