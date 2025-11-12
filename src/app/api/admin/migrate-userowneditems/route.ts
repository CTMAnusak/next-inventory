import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { migrateUserOwnedItems } from '@/scripts/migrate-userowneditems';

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check if user is admin or it_admin or super_admin
    if (payload.userRole !== 'admin' && payload.userRole !== 'it_admin' && payload.userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }

    const result = await migrateUserOwnedItems();

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      result
    });

  } catch (error) {
    console.error('Migration API error:', error);
    return NextResponse.json(
      { 
        error: 'เกิดข้อผิดพลาดในการ migrate ข้อมูล',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'UserOwnedItems Migration API',
    description: 'Use POST method to start migration from UserOwnedItems to Inventory',
    usage: 'POST /api/admin/migrate-userowneditems'
  });
}
