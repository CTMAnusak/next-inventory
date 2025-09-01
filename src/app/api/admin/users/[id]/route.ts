import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { hashPassword } from '@/lib/auth';

// PUT - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { firstName, lastName, nickname, department, office, phone, email, password, userType, userRole } = body;
    const { id } = params;

    // Validate required fields based on user type
    if (userType === 'individual') {
      if (!firstName || !lastName || !nickname || !department || !office || !phone || !email) {
        return NextResponse.json(
          { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
          { status: 400 }
        );
      }
    } else {
      if (!office || !phone || !email) {
        return NextResponse.json(
          { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
          { status: 400 }
        );
      }
    }

    // Validate phone number (must be exactly 10 digits)
    if (phone && phone.length !== 10) {
      return NextResponse.json(
        { error: 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'รูปแบบอีเมลล์ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Check if email already exists (excluding current user)
    const existingUser = await User.findOne({ 
      email, 
      _id: { $ne: id } 
    });
    if (existingUser) {
      return NextResponse.json(
        { error: 'อีเมลล์นี้มีอยู่ในระบบแล้ว' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      firstName: userType === 'individual' ? firstName : undefined,
      lastName: userType === 'individual' ? lastName : undefined,
      nickname: userType === 'individual' ? nickname : undefined,
      department: userType === 'individual' ? department : undefined,
      office,
      phone,
      email,
      userRole: userRole || 'user',
      updatedAt: new Date()
    };

    // Only update password if provided
    if (password && password.trim()) {
      updateData.password = await hashPassword(password);
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'ไม่พบผู้ใช้ที่ต้องการอัพเดต' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัพเดตผู้ใช้' },
      { status: 500 }
    );
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const { id } = params;

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return NextResponse.json(
        { error: 'ไม่พบผู้ใช้ที่ต้องการลบ' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'ลบผู้ใช้เรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบผู้ใช้' },
      { status: 500 }
    );
  }
}
