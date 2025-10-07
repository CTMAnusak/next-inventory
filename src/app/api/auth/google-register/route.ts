import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { sendNewUserRegistrationNotification } from '@/lib/email';

interface GoogleProfile {
  id: string;
  email: string;
  name: string;
}

interface ProfileData {
  firstName: string;
  lastName: string;
  nickname: string;
  department: string;
  office: string;
  phone: string;
  userType: 'individual' | 'branch';
  requestMessage?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { googleProfile, profileData }: { googleProfile: GoogleProfile; profileData: ProfileData } = await request.json();

    // Validate required data
    if (!googleProfile || !googleProfile.email || !profileData) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    await dbConnect();

    // ✅ Check for duplicate data - collect all errors first
    const duplicateErrors = [];
    let isExistingGoogleUser = false;
    let existingGoogleUserStatus = null;

    // Check email
    const existingUserByEmail = await User.findOne({ email: googleProfile.email });
    if (existingUserByEmail) {
      if (existingUserByEmail.registrationMethod === 'google') {
        isExistingGoogleUser = true;
        existingGoogleUserStatus = existingUserByEmail.isApproved ? 'approved' : 'pending';
        duplicateErrors.push('อีเมลนี้ถูกใช้งานแล้วในระบบ (Google Account)');
      } else {
        duplicateErrors.push('อีเมลนี้ถูกใช้งานแล้วในระบบ');
      }
    }

    // Check phone number
    if (profileData.phone) {
      const existingUserByPhone = await User.findOne({ phone: profileData.phone });
      if (existingUserByPhone) {
        duplicateErrors.push('เบอร์โทรศัพท์นี้มีผู้ใช้งานในระบบแล้ว');
      }
    }

    // Check full name for individual users
    if (profileData.userType === 'individual' && profileData.firstName && profileData.lastName) {
      const existingUserByName = await User.findOne({ 
        firstName: profileData.firstName,
        lastName: profileData.lastName 
      });
      if (existingUserByName) {
        duplicateErrors.push(`ชื่อ-นามสกุล "${profileData.firstName} ${profileData.lastName}" มีผู้ใช้งานในระบบแล้ว`);
      }
    }

    // Handle existing Google user cases
    if (isExistingGoogleUser && duplicateErrors.length === 1) {
      // Only email duplicate (existing Google user)
      if (existingGoogleUserStatus === 'pending') {
        return NextResponse.json(
          { error: 'บัญชีของคุณรอการอนุมัติจากผู้ดูแลระบบ' },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: 'บัญชีนี้มีอยู่แล้ว กรุณาเข้าสู่ระบบ' },
          { status: 400 }
        );
      }
    }

    // If any duplicates found, return combined error message
    if (duplicateErrors.length > 0) {
      const errorMessage = duplicateErrors.length === 1 
        ? duplicateErrors[0]
        : `ไม่สามารถสมัครสมาชิกได้ เนื่องจาก: ${duplicateErrors.join(', ')}`;
      
      return NextResponse.json(
        { 
          error: errorMessage,
          duplicateFields: duplicateErrors,
          detailedError: 'ไม่สามารถสมัครสมาชิกได้ เนื่องจาก:\n• ' + duplicateErrors.join('\n• ')
        },
        { status: 400 }
      );
    }

    // Validate form data based on user type
    if (profileData.userType === 'individual') {
      if (!profileData.firstName || !profileData.lastName || !profileData.nickname || 
          !profileData.department || !profileData.office || !profileData.phone) {
        return NextResponse.json(
          { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
          { status: 400 }
        );
      }
    } else {
      if (!profileData.office || !profileData.phone) {
        return NextResponse.json(
          { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
          { status: 400 }
        );
      }
    }

    // Validate phone number
    if (profileData.phone && (profileData.phone.length !== 10 || !/^\d{10}$/.test(profileData.phone))) {
      return NextResponse.json(
        { error: 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก' },
        { status: 400 }
      );
    }

    // Generate user_id
    const lastUser = await User.findOne().sort({ user_id: -1 });
    let nextUserId = 'U001';
    if (lastUser && lastUser.user_id) {
      const lastId = parseInt(lastUser.user_id.substring(1));
      nextUserId = `U${String(lastId + 1).padStart(3, '0')}`;
    }

    // Create new user
    const newUser = new User({
      user_id: nextUserId,
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      nickname: profileData.nickname,
      department: profileData.department,
      office: profileData.office,
      phone: profileData.phone,
      email: googleProfile.email,
      userType: profileData.userType,
      userRole: 'user', // Default role
      
      // Google OAuth specific fields
      registrationMethod: 'google',
      googleId: googleProfile.id,
      isApproved: false, // Needs admin approval
      profileCompleted: true
    });

    await newUser.save();

    // Send notification email to admins
    try {
      await sendNewUserRegistrationNotification({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        nickname: profileData.nickname,
        email: googleProfile.email,
        office: profileData.office,
        phone: profileData.phone,
        department: profileData.department,
        requestMessage: profileData.requestMessage,
        registrationMethod: 'google'
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Continue even if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'สมัครสมาชิกเรียบร้อยแล้ว รอการอนุมัติจากผู้ดูแลระบบ',
      userId: newUser.user_id
    });

  } catch (error) {
    console.error('Google registration error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' },
      { status: 500 }
    );
  }
}
