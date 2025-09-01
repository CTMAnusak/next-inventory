import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function POST() {
  try {
    await dbConnect();
    
    console.log('=== FIX EXISTING ADMIN ===');
    
    // หา admin ที่ไม่มี user_id
    const adminWithoutUserId = await User.findOne({ 
      email: 'ampanusak@gmail.com',
      $or: [
        { user_id: { $exists: false } },
        { user_id: null },
        { user_id: '' }
      ]
    });
    
    if (!adminWithoutUserId) {
      return NextResponse.json({
        success: false,
        message: 'ไม่เจอ admin ที่ต้องแก้ไข หรือมี user_id แล้ว'
      });
    }
    
    console.log('Found admin without user_id:', adminWithoutUserId.email);
    
    // สร้าง user_id ใหม่
    const new_user_id = 'ADMIN' + Date.now() + Math.floor(Math.random() * 1000);
    console.log('Generated new user_id:', new_user_id);
    
    // อัปเดต admin
    const updatedAdmin = await User.findByIdAndUpdate(
      adminWithoutUserId._id,
      { 
        user_id: new_user_id,
        $unset: { __v: 1 } // ลบ version key ถ้ามี
      },
      { 
        new: true, // ส่งค่าใหม่กลับมา
        runValidators: true // ตรวจสอบ validation
      }
    );
    
    console.log('Updated admin:', {
      _id: updatedAdmin._id,
      user_id: updatedAdmin.user_id,
      email: updatedAdmin.email
    });
    
    // ตรวจสอบว่าอัปเดตจริงๆ
    const verifyAdmin = await User.findById(updatedAdmin._id);
    
    return NextResponse.json({
      success: true,
      message: 'แก้ไข Admin สำเร็จ',
      admin: {
        _id: verifyAdmin._id,
        user_id: verifyAdmin.user_id,
        email: verifyAdmin.email,
        userRole: verifyAdmin.userRole,
        isMainAdmin: verifyAdmin.isMainAdmin
      },
      verification: {
        user_id_in_db: verifyAdmin.user_id,
        user_id_exists: !!verifyAdmin.user_id
      }
    });
    
  } catch (error) {
    console.error('Fix existing admin error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        stack: error.stack 
      },
      { status: 500 }
    );
  }
}
