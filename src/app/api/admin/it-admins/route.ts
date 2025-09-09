import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import ITAdmin from '@/models/ITAdmin';

// GET - Get all IT admins
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'ไม่พบการยืนยันตัวตน' },
        { status: 401 }
      );
    }

    const payload: any = verifyToken(token);
    console.log('IT Admin GET - Token payload:', payload);
    
    // Check if user is admin (userId starts with "ADMIN" or has admin flags)
    const isAdmin = payload && (
      payload.isMainAdmin || 
      payload.isAdmin || 
      (payload.userId && payload.userId.toString().startsWith('ADMIN'))
    );
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }

    await connectDB();
    const itAdmins = await ITAdmin.find({}).sort({ createdAt: -1 });

    // Format for frontend
    const formattedAdmins = itAdmins.map(admin => ({
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email
    }));

    return NextResponse.json({ admins: formattedAdmins });
  } catch (error) {
    console.error('Get IT admins error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}

// POST - Add new IT admin
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'ไม่พบการยืนยันตัวตน' },
        { status: 401 }
      );
    }

    const payload: any = verifyToken(token);
    console.log('IT Admin POST - Token payload:', payload);
    
    // Check if user is admin (userId starts with "ADMIN" or has admin flags)
    const isAdmin = payload && (
      payload.isMainAdmin || 
      payload.isAdmin || 
      (payload.userId && payload.userId.toString().startsWith('ADMIN'))
    );
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }

    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อและอีเมล' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if email already exists
    const existingAdmin = await ITAdmin.findOne({ email: email.trim().toLowerCase() });
    if (existingAdmin) {
      return NextResponse.json(
        { error: 'อีเมลนี้มีอยู่ในระบบแล้ว' },
        { status: 400 }
      );
    }

    // Create new IT Admin
    const newAdmin = new ITAdmin({
      name: name.trim(),
      email: email.trim().toLowerCase()
    });

    await newAdmin.save();

    return NextResponse.json({
      message: 'เพิ่ม IT Admin เรียบร้อยแล้ว',
      admin: {
        id: newAdmin._id.toString(),
        name: newAdmin.name,
        email: newAdmin.email
      }
    });
  } catch (error) {
    console.error('Add IT admin error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}

// DELETE - Remove IT admin
export async function DELETE(request: NextRequest) {
  try {
    // Verify admin access
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'ไม่พบการยืนยันตัวตน' },
        { status: 401 }
      );
    }

    const payload: any = verifyToken(token);
    console.log('IT Admin DELETE - Token payload:', payload);
    
    // Check if user is admin (userId starts with "ADMIN" or has admin flags)
    const isAdmin = payload && (
      payload.isMainAdmin || 
      payload.isAdmin || 
      (payload.userId && payload.userId.toString().startsWith('ADMIN'))
    );
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }

    const { adminId } = await request.json();

    if (!adminId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ Admin ID' },
        { status: 400 }
      );
    }

    await connectDB();

    const deletedAdmin = await ITAdmin.findByIdAndDelete(adminId);

    if (!deletedAdmin) {
      return NextResponse.json(
        { error: 'ไม่พบ IT Admin ที่ต้องการลบ' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'ลบ IT Admin เรียบร้อยแล้ว'
    });
  } catch (error) {
    console.error('Delete IT admin error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}