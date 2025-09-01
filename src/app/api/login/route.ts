import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { verifyPassword, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกอีเมลและรหัสผ่าน' },
        { status: 400 }
      );
    }

    // ตรวจสอบผู้ใช้ใน database
    await dbConnect();

    // ใช้ MongoDB Native เพราะ Mongoose มีปัญหา select user_id
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management';
    const client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db();
    const collection = db.collection('users');
    
    const user = await collection.findOne({ email });
    await client.close();
    
    if (!user) {
      return NextResponse.json(
        { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.user_id, // ใช้ user_id แทน _id
      email: user.email,
      userType: user.userType
    });

    // Create response with token in cookie
    const response = NextResponse.json({
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        id: user.user_id, // ใช้ user_id แทน _id
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        office: user.office,
        isMainAdmin: user.isMainAdmin || false,
        userRole: user.userRole || 'user'
      }
    });

    // Set cookie (ไม่ใช่ HttpOnly เพื่อให้ JavaScript อ่านได้)
    response.cookies.set('auth-token', token, {
      httpOnly: false, // เปลี่ยนเป็น false เพื่อให้ JavaScript อ่านได้
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    });
    
    // เพิ่ม Set-Cookie header แบบ manual
    response.headers.set('Set-Cookie', `auth-token=${token}; Max-Age=${60 * 60 * 24 * 7}; Path=/; SameSite=lax`);

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Logout endpoint
  const response = NextResponse.json({ message: 'ออกจากระบบสำเร็จ' });
  response.cookies.delete('auth-token');
  return response;
}
