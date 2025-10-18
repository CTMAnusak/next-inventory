/**
 * Auth Helper Functions for API Routes
 * ฟังก์ชันช่วยตรวจสอบ authentication ใน API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth';
import dbConnect from './mongodb';

/**
 * ตรวจสอบ authentication และดึงข้อมูล user จาก database
 * @param request - NextRequest object
 * @returns ข้อมูล user หรือ error response
 */
export async function authenticateUser(request: NextRequest) {
  try {
    // 1. ตรวจสอบ JWT token
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return {
        error: NextResponse.json(
          { error: 'กรุณาเข้าสู่ระบบ' },
          { status: 401 }
        ),
        user: null
      };
    }

    // 2. Verify token
    const payload: any = verifyToken(token);
    
    if (!payload || !payload.userId) {
      return {
        error: NextResponse.json(
          { error: 'Token ไม่ถูกต้อง' },
          { status: 401 }
        ),
        user: null
      };
    }

    // 3. ตรวจสอบว่า user ยังมีอยู่ใน database
    await dbConnect();
    const User = (await import('@/models/User')).default;
    
    const user = await User.findOne({ user_id: payload.userId });
    
    if (!user) {
      return {
        error: NextResponse.json(
          { error: 'บัญชีของคุณไม่พบในระบบ กรุณาเข้าสู่ระบบใหม่' },
          { status: 401 }
        ),
        user: null
      };
    }

    // 4. ส่งคืนข้อมูล user
    return {
      error: null,
      user: {
        _id: user._id,
        user_id: user.user_id,
        firstName: user.firstName,
        lastName: user.lastName,
        nickname: user.nickname,
        email: user.email,
        phone: user.phone,
        department: user.department,
        office: user.office,
        userType: user.userType,
        userRole: user.userRole,
        isMainAdmin: user.isMainAdmin || false
      }
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      error: NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' },
        { status: 500 }
      ),
      user: null
    };
  }
}

/**
 * ตรวจสอบว่าเป็น admin หรือไม่
 * @param user - ข้อมูล user จาก authenticateUser
 * @returns boolean
 */
export function isAdmin(user: any): boolean {
  return user?.isMainAdmin || user?.userRole === 'admin' || user?.userRole === 'it_admin';
}

/**
 * ตรวจสอบว่าเป็น IT admin หรือไม่
 * @param user - ข้อมูล user จาก authenticateUser
 * @returns boolean
 */
export function isITAdmin(user: any): boolean {
  return user?.isMainAdmin || user?.userRole === 'it_admin';
}

