import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode, getUserProfile } from '@/lib/google-auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const { code, action } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Missing authorization code' },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);
    
    if (!tokens.access_token) {
      return NextResponse.json(
        { error: 'Failed to get access token' },
        { status: 400 }
      );
    }

    // Get user profile from Google
    const googleProfile = await getUserProfile(tokens.access_token);
    
    if (!googleProfile || !googleProfile.email) {
      return NextResponse.json(
        { error: 'Failed to get user profile' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check if user exists
    const existingUser = await User.findOne({ email: googleProfile.email });

    if (action === 'register') {
      // Registration flow
      if (existingUser) {
        if (existingUser.registrationMethod === 'google' && !existingUser.isApproved) {
          return NextResponse.json(
            { 
              error: '⏳ บัญชีของคุณรอการอนุมัติจากทีม IT Support',
              errorType: 'pending_approval',
              details: 'กรุณารอการอนุมัติจากทีม IT Support หรือติดต่อทีม IT Support เพื่อเร่งการอนุมัติ'
            },
            { status: 400 }
          );
        } else if (existingUser.registrationMethod === 'google') {
          return NextResponse.json(
            { 
              error: '✅ บัญชีนี้มีอยู่แล้ว กรุณาเข้าสู่ระบบ',
              errorType: 'already_exists',
              details: 'บัญชี Google นี้ได้ลงทะเบียนในระบบแล้ว กรุณาใช้ปุ่ม "เข้าสู่ระบบด้วย Google" แทน'
            },
            { status: 400 }
          );
        } else {
          return NextResponse.json(
            { 
              error: '📧 อีเมลนี้ถูกใช้งานแล้วในระบบ',
              errorType: 'email_taken',
              details: `อีเมล ${googleProfile.email} ได้ลงทะเบียนด้วยวิธีอื่นแล้ว กรุณาใช้วิธีเข้าสู่ระบบปกติ หรือใช้อีเมล Google อื่น`
            },
            { status: 400 }
          );
        }
      }

      // Redirect to profile completion page
      const profileParam = encodeURIComponent(JSON.stringify(googleProfile));
      return NextResponse.json({
        redirect: `/auth/google-register?profile=${profileParam}`
      });
    } else {
      // Login flow
      if (!existingUser) {
        return NextResponse.json(
          { 
            error: '❌ ไม่พบบัญชีผู้ใช้',
            errorType: 'no_account',
            details: 'กรุณาสมัครสมาชิกด้วย Google หรือติดต่อทีม IT Support'
          },
          { status: 400 }
        );
      }

      if (existingUser.registrationMethod !== 'google') {
        return NextResponse.json(
          { error: 'บัญชีนี้ไม่ได้สมัครผ่าน Google กรุณาใช้อีเมลและรหัสผ่าน' },
          { status: 400 }
        );
      }

      if (!existingUser.isApproved) {
        return NextResponse.json(
          { error: 'บัญชีของคุณรอการอนุมัติจากทีม IT Support' },
          { status: 400 }
        );
      }

      // Create JWT token
      const token = jwt.sign(
        {
          userId: existingUser.user_id, // ใช้ user_id แทน _id เพื่อให้ตรงกับ auth check
          email: existingUser.email,
          userRole: existingUser.userRole,
          isMainAdmin: existingUser.isMainAdmin,
          pendingDeletion: existingUser.pendingDeletion || false // เพิ่ม pendingDeletion status
        },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '7d' }
      );

      // Set HTTP-only cookie
      const response = NextResponse.json({
        success: true,
        user: {
          id: existingUser.user_id,
          user_id: existingUser.user_id,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          nickname: existingUser.nickname,
          department: existingUser.department,
          phone: existingUser.phone,
          email: existingUser.email,
          userType: existingUser.userType,
          office: existingUser.office,
          userRole: existingUser.userRole,
          isMainAdmin: existingUser.isMainAdmin
        }
      });

      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 // 7 days
      });

      return response;
    }

  } catch (error) {
    console.error('Google auth error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google' },
      { status: 500 }
    );
  }
}
