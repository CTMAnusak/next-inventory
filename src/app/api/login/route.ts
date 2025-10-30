import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { verifyPassword, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      console.log('❌ Missing email or password');
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
      console.log('❌ User not found for email:', email);
      return NextResponse.json(
        { 
          error: 'ไม่พบผู้ใช้ในระบบ',
          errorType: 'user_not_found',
          details: 'กรุณาสมัครสมาชิก หรือติดต่อทีม IT Support (เบอร์ : 092-591-9889 (คุณเบลล์) , Line ID : vsqitsupport)'
        },
        { status: 404 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    
    if (!isValid) {
      console.log('❌ Invalid password for email:', email);
      return NextResponse.json(
        { 
          error: 'รหัสผ่านไม่ถูกต้อง',
          errorType: 'invalid_password'
        },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.user_id, // ใช้ user_id แทน _id
      email: user.email,
      userType: user.userType,
      userRole: user.userRole || 'user',
      isMainAdmin: user.isMainAdmin || false,
      pendingDeletion: user.pendingDeletion || false // เพิ่ม pendingDeletion status
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

    // Set secure cookie with debug - 7 days = 7 * 24 * 60 * 60 = 604800 seconds
    const maxAge = 7 * 24 * 60 * 60; // 7 วัน
    
    // ลองใช้ manual Set-Cookie header แทน
    response.headers.set('Set-Cookie', 
      `auth-token=${token}; Path=/; Max-Age=${maxAge}; SameSite=Strict`
    );
    

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
  
  // ลบ cookie ด้วยการตั้งค่าใหม่ที่มี Max-Age = 0
  response.cookies.set('auth-token', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    sameSite: 'strict'
  });
  
  return response;
}
