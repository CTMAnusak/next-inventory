import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { sendNewUserRegistrationNotification } from '@/lib/email';

interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
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

    // Check if user already exists
    const existingUser = await User.findOne({ email: googleProfile.email });
    if (existingUser) {
      if (existingUser.registrationMethod === 'google') {
        if (!existingUser.isApproved) {
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
      } else {
        return NextResponse.json(
          { error: 'อีเมลนี้ถูกใช้งานแล้วในระบบ' },
          { status: 400 }
        );
      }
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
      profilePicture: googleProfile.picture,
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
        profilePicture: googleProfile.picture,
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
