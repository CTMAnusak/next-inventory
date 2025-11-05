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
    
    
    let superAdmin = null;
    
    // Auto-create Super Admin if enabled and no admins exist
    if (existingAdmins.length === 0 && process.env.ENABLE_AUTO_SUPER_ADMIN_CREATION === 'true') {
      
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
      const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
      const superAdminPhone = process.env.SUPER_ADMIN_PHONE || '000-000-0000';
      const superAdminFirstName = process.env.SUPER_ADMIN_FIRST_NAME || 'Super';
      const superAdminLastName = process.env.SUPER_ADMIN_LAST_NAME || 'Administrator';
      
      if (superAdminEmail && superAdminPassword) {
        // ✅ Check if super admin data already exists
        const existingSuperAdmin = await User.findOne({
          $or: [
            { email: superAdminEmail },
            { phone: superAdminPhone },
            { firstName: superAdminFirstName, lastName: superAdminLastName }
          ]
        });
        
        if (existingSuperAdmin) {
          console.log('Super admin data already exists, skipping creation');
          superAdmin = existingSuperAdmin;
        } else {
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
        
        // 🆕 ดึง officeId และ officeName จาก environment variable
        const superAdminOfficeId = process.env.SUPER_ADMIN_OFFICE || 'UNSPECIFIED_OFFICE';
        const { getOfficeNameById } = await import('@/lib/office-helpers');
        const superAdminOfficeName = await getOfficeNameById(superAdminOfficeId);
        
        superAdmin = new User({
          user_id: admin_user_id,
          firstName: process.env.SUPER_ADMIN_FIRST_NAME || 'Super',
          lastName: process.env.SUPER_ADMIN_LAST_NAME || 'Administrator',
          nickname: process.env.SUPER_ADMIN_NICKNAME || 'SuperAdmin',
          department: process.env.SUPER_ADMIN_DEPARTMENT || 'System Administration',
          officeId: superAdminOfficeId,
          officeName: superAdminOfficeName,
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
        }
      } else {
      }
    } else if (existingAdmins.length === 0) {
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
        }] : [])
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
