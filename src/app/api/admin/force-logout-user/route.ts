import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenFromRequest } from '@/lib/auth';

// In-memory store สำหรับเก็บ user IDs ที่ต้อง logout
// ในการใช้งานจริง ควรใช้ Redis หรือ database
const forceLogoutUsers = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ userId' },
        { status: 400 }
      );
    }

    // เพิ่ม userId เข้าไปใน force logout list
    forceLogoutUsers.add(userId);

    // Set timeout to remove from list after 5 minutes (cleanup)
    setTimeout(() => {
      forceLogoutUsers.delete(userId);
      console.log(`🧹 Cleaned up force logout entry for user ${userId}`);
    }, 5 * 60 * 1000); // 5 minutes

    return NextResponse.json({
      success: true,
      message: `User ${userId} marked for force logout`
    });

  } catch (error) {
    console.error('Error in force logout user:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดำเนินการ' },
      { status: 500 }
    );
  }
}

// GET endpoint สำหรับ client ตรวจสอบว่าต้อง logout หรือไม่
export async function GET(request: NextRequest) {
  try {
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json({ shouldLogout: false });
    }

    const shouldLogout = forceLogoutUsers.has(payload.userId);
    
    if (shouldLogout) {
      // Remove from list after checking
      forceLogoutUsers.delete(payload.userId);
    }

    return NextResponse.json({ shouldLogout });

  } catch (error) {
    console.error('Error checking force logout status:', error);
    return NextResponse.json({ shouldLogout: false });
  }
}
