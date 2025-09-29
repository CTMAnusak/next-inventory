import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { addUserIdToExistingUsers } from '@/scripts/add-user-id-migration';

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

    const result = await addUserIdToExistingUsers();

    return NextResponse.json({
      success: true,
      message: 'User ID migration completed successfully',
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
    message: 'User ID Migration API',
    description: 'Use POST method to add user_id to existing users',
    usage: 'POST /api/admin/add-user-id-migration'
  });
}
