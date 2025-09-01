import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { hashPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    console.log('Connecting to MongoDB...');
    await dbConnect();
    console.log('Connected to MongoDB successfully');

    // Check if users already exist
    const existingUsers = await User.countDocuments();
    console.log('Existing users count:', existingUsers);
    
    if (existingUsers > 0) {
      return NextResponse.json({
        message: 'ระบบมีผู้ใช้อยู่แล้ว',
        count: existingUsers
      });
    }

    console.log('Checking for main admin user...');
    // Check if main admin user already exists
    const existingAdmin = await User.findOne({ email: 'ampanusak@gmail.com' });
    
    let adminUser;
    if (!existingAdmin) {
      console.log('Creating main admin user...');
      // Create main admin user (ampanusak@gmail.com)
      const hashedPassword = await hashPassword('1234');
      
      // Generate unique user_id for admin
      let admin_user_id;
      let attempts = 0;
      let isUnique = false;
      
      while (!isUnique && attempts < 10) {
        admin_user_id = 'ADMIN' + Date.now() + Math.floor(Math.random() * 1000);
        const existingUser = await User.findOne({ user_id: admin_user_id });
        if (!existingUser) {
          isUnique = true;
        }
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      
      console.log('Generated admin user_id:', admin_user_id);
      
      adminUser = new User({
        user_id: admin_user_id, // เพิ่ม user_id สำหรับ admin
        firstName: 'Admin',
        lastName: 'หลัก',
        nickname: 'Admin',
        department: 'IT',
        office: 'สำนักงานใหญ่',
        phone: '090-272-8102',
        email: 'ampanusak@gmail.com',
        password: hashedPassword,
        userType: 'individual',
        isMainAdmin: true, // Admin หลักของระบบ
        userRole: 'it_admin' // Admin ทีม IT (รับเมลล์ได้)
      });

      await adminUser.save();
      console.log('Admin user created');
    } else {
      console.log('Main admin user already exists');
      adminUser = existingAdmin;
    }

    console.log('Checking for demo user...');
    // Check if demo user already exists
    const existingDemo = await User.findOne({ email: 'demo@vsqclinic.com' });
    
    let demoUser;
    if (!existingDemo) {
      console.log('Creating demo user...');
      // Create demo user
      const demoHashedPassword = await hashPassword('demo123');
      
      // Generate unique user_id for demo
      let demo_user_id;
      let demoAttempts = 0;
      let demoIsUnique = false;
      
      while (!demoIsUnique && demoAttempts < 10) {
        demo_user_id = 'USER' + Date.now() + Math.floor(Math.random() * 1000);
        const existingUser = await User.findOne({ user_id: demo_user_id });
        if (!existingUser) {
          demoIsUnique = true;
        }
        demoAttempts++;
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      
      console.log('Generated demo user_id:', demo_user_id);
      
      demoUser = new User({
        user_id: demo_user_id, // เพิ่ม user_id สำหรับ demo
        firstName: 'Demo',
        lastName: 'User',
        nickname: 'Demo',
        department: 'การเงิน',
        office: 'สำนักงานใหญ่',
        phone: '099-999-9999',
        email: 'demo@vsqclinic.com',
        password: demoHashedPassword,
        userType: 'individual',
        userRole: 'user' // ผู้ใช้ทั่วไป
      });

      await demoUser.save();
      console.log('Demo user created');
    } else {
      console.log('Demo user already exists');
      demoUser = existingDemo;
    }

    return NextResponse.json({
      success: true,
      message: 'ตรวจสอบและสร้างผู้ใช้เริ่มต้นเรียบร้อยแล้ว',
      users: [
        {
          email: 'ampanusak@gmail.com',
          password: '1234',
          role: 'Main Admin',
          user_id: adminUser?.user_id || 'ไม่มี',
          status: existingAdmin ? 'already exists' : 'created'
        },
        {
          email: 'demo@vsqclinic.com',
          password: 'demo123',
          role: 'User',
          user_id: demoUser?.user_id || 'ไม่มี',
          status: existingDemo ? 'already exists' : 'created'
        }
      ]
    });

  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
