import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { sendNewUserRegistrationNotification } from '@/lib/email';

const DEFAULT_OFFICE_ID = 'UNSPECIFIED_OFFICE';
const DEFAULT_OFFICE_NAME = 'ไม่ระบุสาขา';

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
  officeId?: string;
  officeName?: string;
  office?: string;
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
          { error: 'บัญชีของคุณรอการอนุมัติจากทีม IT Support' },
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
    const trimmedOfficeId = profileData.officeId?.trim();
    const trimmedLegacyOffice = profileData.office?.trim();

    if (profileData.userType === 'individual') {
      if (!profileData.firstName || !profileData.lastName || !profileData.nickname || 
          !profileData.department || (!trimmedOfficeId && !trimmedLegacyOffice) || !profileData.phone) {
        return NextResponse.json(
          { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
          { status: 400 }
        );
      }
    } else {
      if ((!trimmedOfficeId && !trimmedLegacyOffice) || !profileData.phone) {
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

    // Generate unique random user_id for Google users (Format: G + timestamp + random number)
    let user_id;
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      // สร้าง user_id แบบสุ่ม: G + timestamp + random 3 digits
      user_id = 'G' + Date.now() + Math.floor(Math.random() * 1000);
      
      // ตรวจสอบว่าไม่ซ้ำกับที่มีอยู่
      const existingUser = await User.findOne({ user_id });
      if (!existingUser) {
        isUnique = true;
      }
      attempts++;
      
      // หน่วงเวลานิดหน่อยเพื่อให้ได้ timestamp ที่ต่างกัน
      if (!isUnique) await new Promise(resolve => setTimeout(resolve, 1));
    }

    if (!isUnique) {
      return NextResponse.json(
        { error: 'ไม่สามารถสร้าง user ID ที่ไม่ซ้ำได้ กรุณาลองใหม่อีกครั้ง' },
        { status: 500 }
      );
    }

    // Resolve office information
    let finalOfficeId = trimmedOfficeId || DEFAULT_OFFICE_ID;
    let finalOfficeName = profileData.officeName?.trim() || '';

    if (trimmedOfficeId) {
      try {
        const { getOfficeNameById } = await import('@/lib/office-helpers');
        finalOfficeName = await getOfficeNameById(trimmedOfficeId);
      } catch (error) {
        console.error('Failed to resolve office name from officeId:', error);
      }
    }

    if (!finalOfficeName) {
      finalOfficeName = trimmedLegacyOffice || DEFAULT_OFFICE_NAME;
    }

    if (!finalOfficeName) {
      finalOfficeName = DEFAULT_OFFICE_NAME;
      finalOfficeId = DEFAULT_OFFICE_ID;
    }

    // Create new user
    const newUser = new User({
      user_id: user_id,
      firstName: profileData.userType === 'individual' ? profileData.firstName : undefined,
      lastName: profileData.userType === 'individual' ? profileData.lastName : undefined,
      nickname: profileData.userType === 'individual' ? profileData.nickname : undefined,
      department: profileData.userType === 'individual' ? profileData.department : undefined,
      officeId: finalOfficeId,
      officeName: finalOfficeName,
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
        office: finalOfficeName,
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
      message: 'สมัครสมาชิกเรียบร้อยแล้ว รอการอนุมัติจากทีม IT Support',
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
