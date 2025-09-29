import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    console.log('=== CREATE ADMIN USER ===');
    
    // รับข้อมูลจาก request body
    const { 
      email, 
      password = 'admin123', 
      firstName = 'Admin', 
      lastName = 'User',
      nickname = 'Admin',
      department = 'Management',
      office = 'สำนักงานใหญ่',
      phone = '000-000-0000',
      userRole = 'admin',
      isMainAdmin = false
    } = await request.json();

    if (!email) {
      return NextResponse.json({
        success: false,
        message: 'กรุณาระบุอีเมล'
      }, { status: 400 });
    }
    
    // ตรวจสอบว่าอีเมลซ้ำหรือไม่
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return NextResponse.json({
        success: false,
        message: 'อีเมลนี้มีอยู่ในระบบแล้ว',
        existing_user: {
          email: existingUser.email,
          user_id: existingUser.user_id,
          userRole: existingUser.userRole
        }
      }, { status: 400 });
    }
    
    // สร้าง admin user ใหม่
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // สร้าง user_id สำหรับ admin
    const admin_user_id = 'ADMIN' + Date.now() + Math.floor(Math.random() * 1000);
    
    // ใช้ MongoDB Native เพื่อให้แน่ใจ
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management';
    const client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db();
    const collection = db.collection('users');
    
    const adminData = {
      user_id: admin_user_id,
      firstName,
      lastName,
      nickname,
      department,
      office,
      phone,
      email,
      password: hashedPassword,
      userType: 'individual',
      isMainAdmin,
      userRole,
      registrationMethod: 'manual',
      isApproved: true,
      profileCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
      user_id: adminData.user_id,
      email: adminData.email,
      userRole: adminData.userRole
    });
    
    const insertResult = await collection.insertOne(adminData);
    const newAdmin = await collection.findOne({ _id: insertResult.insertedId });
    
    await client.close();
    
    return NextResponse.json({
      success: true,
      message: 'สร้าง Admin User เรียบร้อยแล้ว',
      admin: {
        _id: newAdmin._id,
        user_id: newAdmin.user_id,
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName,
        email: newAdmin.email,
        userRole: newAdmin.userRole,
        isMainAdmin: newAdmin.isMainAdmin
      },
      login_info: {
        email: newAdmin.email,
        password: password,
        note: 'ใช้สำหรับ login และสร้าง users อื่น ๆ'
      }
    });
    
  } catch (error) {
    console.error('Create admin user error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message
      },
      { status: 500 }
    );
  }
}
