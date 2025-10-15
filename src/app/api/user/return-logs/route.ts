import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import { verifyToken } from '@/lib/auth';

// GET - ดึงประวัติการคืนของผู้ใช้
export async function GET(request: NextRequest) {
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
    
    const userId = payload.userId;
    
    // Get user's return logs
    const returnLogs = await ReturnLog.find({
      userId: userId
    }).sort({ returnDate: -1 });

    // ใช้ populate functions เพื่อ populate ข้อมูลล่าสุด
    const { populateReturnLogCompleteBatch } = await import('@/lib/equipment-populate-helpers');
    const populatedLogs = await populateReturnLogCompleteBatch(returnLogs);
    
    return NextResponse.json({
      returnLogs: populatedLogs
    });
    
  } catch (error) {
    console.error('Error fetching return logs:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการคืน' },
      { status: 500 }
    );
  }
}

