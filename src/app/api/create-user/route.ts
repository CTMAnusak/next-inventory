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

    console.log('Checking for any admin users...');
    // Check if any admin users exist in the system
    const existingAdmins = await User.find({ 
      $or: [
        { userRole: 'admin' },
        { userRole: 'it_admin' },
        { isMainAdmin: true }
      ]
    });
    
    console.log(`Found ${existingAdmins.length} admin users in system`);
    
    let superAdmin = null;
    
    // Auto-create Super Admin if enabled and no admins exist
    if (existingAdmins.length === 0 && process.env.ENABLE_AUTO_SUPER_ADMIN_CREATION === 'true') {
      console.log('🚀 Creating Super Admin from environment variables...');
      
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
      const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
      
      if (superAdminEmail && superAdminPassword) {
        const { hashPassword } = await import('@/lib/auth');
        const hashedPassword = await hashPassword(superAdminPassword);
        
        // Generate unique user_id for super admin
        let admin_user_id;
        let attempts = 0;
        let isUnique = false;
        
        while (!isUnique && attempts < 10) {
          admin_user_id = 'SUPER' + Date.now() + Math.floor(Math.random() * 1000);
          const existingUser = await User.findOne({ user_id: admin_user_id });
          if (!existingUser) {
            isUnique = true;
          }
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        
        console.log('Generated super admin user_id:', admin_user_id);
        
        superAdmin = new User({
          user_id: admin_user_id,
          firstName: process.env.SUPER_ADMIN_FIRST_NAME || 'Super',
          lastName: process.env.SUPER_ADMIN_LAST_NAME || 'Administrator',
          nickname: process.env.SUPER_ADMIN_NICKNAME || 'SuperAdmin',
          department: process.env.SUPER_ADMIN_DEPARTMENT || 'System Administration',
          office: process.env.SUPER_ADMIN_OFFICE || 'สำนักงานใหญ่',
          phone: process.env.SUPER_ADMIN_PHONE || '000-000-0000',
          email: superAdminEmail,
          password: hashedPassword,
          userType: 'individual',
          isMainAdmin: true, // Super Admin is always Main Admin
          userRole: 'it_admin', // IT Admin role for notifications
          registrationMethod: 'manual',
          isApproved: true,
          profileCompleted: true
        });

        await superAdmin.save();
        console.log('✅ Super Admin created successfully');
      } else {
        console.log('⚠️  WARNING: Super Admin environment variables not found');
        console.log('⚠️  Required: SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD');
      }
    } else if (existingAdmins.length === 0) {
      console.log('⚠️  WARNING: No admin users found in system');
      console.log('⚠️  Auto Super Admin creation is disabled');
      console.log('⚠️  System will require manual admin creation through database or admin API');
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

    const totalAdmins = existingAdmins.length + (superAdmin ? 1 : 0);
    
    return NextResponse.json({
      success: true,
      message: superAdmin ? 
        'ระบบเริ่มต้นเรียบร้อยแล้ว - Super Admin ถูกสร้างขึ้น' : 
        'ตรวจสอบระบบเรียบร้อยแล้ว',
      adminCount: totalAdmins,
      superAdminCreated: !!superAdmin,
      users: [
        ...(superAdmin ? [{
          email: superAdmin.email,
          password: process.env.SUPER_ADMIN_PASSWORD,
          role: 'Super Admin (Main Admin + IT Admin)',
          user_id: superAdmin.user_id,
          status: 'created',
          note: 'ควรเปลี่ยนรหัสผ่านหลังจาก login ครั้งแรก'
        }] : []),
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
