import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // Check if users already exist
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      return NextResponse.json(
        { error: 'ระบบมีผู้ใช้อยู่แล้ว' },
        { status: 400 }
      );
    }

    // ✅ Additional validation: Check for duplicate data before creating
    const existingAdminData = await User.findOne({
      $or: [
        { email: 'admin@vsqclinic.com' },
        { phone: '090-272-8102' },
        { firstName: 'Admin', lastName: 'System' }
      ]
    });
    
    if (existingAdminData) {
      return NextResponse.json(
        { error: 'ข้อมูล Admin มีอยู่ในระบบแล้ว' },
        { status: 400 }
      );
    }

    const existingDemoData = await User.findOne({
      $or: [
        { email: 'demo@vsqclinic.com' },
        { phone: '099-999-9999' },
        { firstName: 'Demo', lastName: 'User' }
      ]
    });
    
    if (existingDemoData) {
      return NextResponse.json(
        { error: 'ข้อมูล Demo User มีอยู่ในระบบแล้ว' },
        { status: 400 }
      );
    }

    // Create default admin user
    const hashedPassword = await hashPassword('admin123');
    
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'System',
      nickname: 'Admin',
      department: 'IT',
      office: 'สำนักงานใหญ่',
      phone: '090-272-8102',
      email: 'admin@vsqclinic.com',
      password: hashedPassword,
      userType: 'individual'
    });

    await adminUser.save();

    // Create demo user
    const demoHashedPassword = await hashPassword('demo123');
    
    const demoUser = new User({
      firstName: 'Demo',
      lastName: 'User',
      nickname: 'Demo',
      department: 'การเงิน',
      office: 'สำนักงานใหญ่',
      phone: '099-999-9999',
      email: 'demo@vsqclinic.com',
      password: demoHashedPassword,
      userType: 'individual'
    });

    await demoUser.save();

    return NextResponse.json({
      message: 'สร้างผู้ใช้เริ่มต้นเรียบร้อยแล้ว',
      users: [
        {
          email: 'admin@vsqclinic.com',
          password: 'admin123',
          role: 'Admin'
        },
        {
          email: 'demo@vsqclinic.com',
          password: 'demo123',
          role: 'User'
        }
      ]
    });

  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' },
      { status: 500 }
    );
  }
}
