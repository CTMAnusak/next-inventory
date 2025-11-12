import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import migrateAddedByToArray from '@/scripts/migrate-addedby-to-array';

export async function POST(request: NextRequest) {
  try {
    // Verify admin token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload || (payload.userRole !== 'admin' && payload.userRole !== 'it_admin' && payload.userRole !== 'super_admin')) {
      return NextResponse.json(
        { error: 'ไม่ได้รับอนุญาต - ต้องเป็น admin เท่านั้น' },
        { status: 401 }
      );
    }

    
    // Run the migration
    await migrateAddedByToArray();
    
    return NextResponse.json({
      success: true,
      message: 'Migration สำเร็จ - แปลง addedBy เป็น array และ merge duplicate items แล้ว'
    });

  } catch (error) {
    console.error('❌ Migration API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการ migrate ข้อมูล' },
      { status: 500 }
    );
  }
}
