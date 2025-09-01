import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function POST() {
  try {
    await dbConnect();
    
    console.log('=== CREATE ADMIN USER ===');
    
    // ตรวจสอบว่ามี admin user หรือยัง
    const existingAdmin = await User.findOne({ userRole: 'admin' });
    
    if (existingAdmin) {
      return NextResponse.json({
        success: false,
        message: 'มี admin user อยู่แล้ว',
        existing_admin: {
          email: existingAdmin.email,
          user_id: existingAdmin.user_id,
          userRole: existingAdmin.userRole
        }
      });
    }
    
    // สร้าง admin user ใหม่
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
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
      firstName: 'Admin',
      lastName: 'Manager',
      nickname: 'Admin',
      department: 'Management',
      office: 'สำนักงานใหญ่',
      phone: '090-000-0000',
      email: 'admin@company.com',
      password: hashedPassword,
      userType: 'individual',
      isMainAdmin: false, // ไม่ใช่ main admin
      userRole: 'admin', // เป็น admin ธรรมดา
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('Creating admin user:', {
      user_id: adminData.user_id,
      email: adminData.email,
      userRole: adminData.userRole
    });
    
    const insertResult = await collection.insertOne(adminData);
    const newAdmin = await collection.findOne({ _id: insertResult.insertedId });
    
    await client.close();
    
    return NextResponse.json({
      success: true,
      message: 'สร้าง Admin User สำเร็จ',
      admin: {
        _id: newAdmin._id,
        user_id: newAdmin.user_id,
        email: newAdmin.email,
        password: 'admin123', // แสดงเพื่อทดสอบ
        userRole: newAdmin.userRole,
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName
      },
      login_info: {
        email: 'admin@company.com',
        password: 'admin123',
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
