import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

// POST - Set user role
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const { id } = params;
    const { userRole } = await request.json();

    // Validate role
    if (!['user', 'admin', 'it_admin'].includes(userRole)) {
      return NextResponse.json(
        { error: 'สถานะไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json(
        { error: 'ไม่พบผู้ใช้ที่ต้องการ' },
        { status: 404 }
      );
    }

    // Prevent changing main admin role
    if (user.isMainAdmin && userRole !== 'it_admin') {
      return NextResponse.json(
        { error: 'ไม่สามารถเปลี่ยนสถานะของ Admin หลักได้' },
        { status: 400 }
      );
    }

    // Update user's role
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { userRole: userRole },
      { new: true }
    ).select('-password');

    const roleNames = {
      'user': 'ทั่วไป',
      'admin': 'Admin',
      'it_admin': 'Admin ทีม IT'
    };

    return NextResponse.json({
      message: `เปลี่ยนสถานะเป็น "${roleNames[userRole]}" เรียบร้อยแล้ว`,
      user: updatedUser
    });

  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัพเดตสถานะ' },
      { status: 500 }
    );
  }
}
