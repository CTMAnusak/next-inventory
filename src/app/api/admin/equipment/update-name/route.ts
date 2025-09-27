import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { updateEquipmentGroupName } from '@/lib/inventory-helpers';
import { verifyToken } from '@/lib/auth';

// PUT - อัปเดตชื่ออุปกรณ์ทั้ง group
export async function PUT(request: NextRequest) {
  try {
    // Verify admin token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    
    await dbConnect();
    
    const { itemId, newItemName } = await request.json();
    
    // Validate required fields
    if (!itemId || !newItemName) {
      return NextResponse.json(
        { error: 'กรุณาระบุ itemId และ newItemName' },
        { status: 400 }
      );
    }
    
    if (newItemName.trim() === '') {
      return NextResponse.json(
        { error: 'ชื่ออุปกรณ์ไม่สามารถเป็นค่าว่างได้' },
        { status: 400 }
      );
    }
    
    console.log('🔄 Admin updating equipment name:', { itemId, newItemName, adminId: payload.userId });
    
    // อัปเดตชื่อทั้ง group
    const result = await updateEquipmentGroupName(
      itemId, 
      newItemName.trim(), 
      payload.userId
    );
    
    return NextResponse.json({
      success: true,
      message: `อัปเดตชื่ออุปกรณ์เรียบร้อยแล้ว (${result.updatedCount} รายการ)`,
      ...result
    });
    
  } catch (error) {
    console.error('❌ Update equipment name error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          success: false,
          error: error.message.includes('not found') 
            ? 'ไม่พบอุปกรณ์ที่ระบุ' 
            : 'เกิดข้อผิดพลาดในการอัปเดตชื่ออุปกรณ์',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: error.message.includes('not found') ? 404 : 500 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'เกิดข้อผิดพลาดในระบบ',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}
