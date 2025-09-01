import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { hashPassword } from '@/lib/auth';

// GET - Fetch all users
export async function GET() {
  try {
    await dbConnect();
    
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { firstName, lastName, nickname, department, office, phone, email, password, userType, userRole } = body;

    // Validate required fields based on user type
    if (userType === 'individual') {
      if (!firstName || !lastName || !nickname || !department || !office || !phone || !email || !password) {
        return NextResponse.json(
          { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
          { status: 400 }
        );
      }
    } else {
      if (!office || !phone || !email || !password) {
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

    // ใช้ MongoDB Native เพราะ Mongoose มีปัญหา select user_id
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management';
    const client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db();
    const collection = db.collection('users');

    // Check if email already exists
    const existingUser = await collection.findOne({ email });
    if (existingUser) {
      await client.close();
      return NextResponse.json(
        { error: 'อีเมลล์นี้มีอยู่ในระบบแล้ว' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate unique user_id
    let user_id;
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      user_id = 'USER' + Date.now() + Math.floor(Math.random() * 1000);
      const existingUser = await User.findOne({ user_id });
      if (!existingUser) {
        isUnique = true;
      }
      attempts++;
      // Small delay to ensure different timestamps
      if (!isUnique) await new Promise(resolve => setTimeout(resolve, 1));
    }

    if (!isUnique) {
      await client.close();
      return NextResponse.json(
        { error: 'ไม่สามารถสร้าง user_id ที่ไม่ซ้ำได้' },
        { status: 500 }
      );
    }

    // สร้าง user ด้วย MongoDB Native
    const newUserData = {
      user_id, // เพิ่ม user_id ที่สร้างขึ้น
      firstName: userType === 'individual' ? firstName : undefined,
      lastName: userType === 'individual' ? lastName : undefined,
      nickname: userType === 'individual' ? nickname : undefined,
      department: userType === 'individual' ? department : undefined,
      office,
      phone,
      email,
      password: hashedPassword,
      userType,
      userRole: userRole || 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const insertResult = await collection.insertOne(newUserData);
    const newUser = await collection.findOne({ _id: insertResult.insertedId });
    
    await client.close();
    
    console.log('Created user with user_id:', newUser.user_id);

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser;
    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' },
      { status: 500 }
    );
  }
}
