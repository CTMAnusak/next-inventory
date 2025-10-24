import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // หาผู้ใช้ที่ email = ampanusak@gmail.com
    const user = await usersCollection.findOne({ email: 'ampanusak@gmail.com' });
    
    if (!user) {
      return NextResponse.json({ 
        error: 'ไม่พบผู้ใช้ที่อีเมล: ampanusak@gmail.com' 
      });
    }
    
    // ตรวจสอบสถานะที่อาจทำให้เด้งออก
    const authIssues = [];
    
    if (user.isDeleted) {
      authIssues.push('ผู้ใช้ถูกลบจากระบบ (isDeleted = true)');
    }
    
    if (user.deletedAt) {
      authIssues.push(`ผู้ใช้ถูกลบเมื่อ: ${user.deletedAt}`);
    }
    
    if (user.pendingDeletion) {
      authIssues.push('ผู้ใช้อยู่ในสถานะรอลบ (pendingDeletion = true)');
    }
    
    if (user.jwtInvalidatedAt) {
      authIssues.push(`JWT Token ถูกลบความถูกต้องเมื่อ: ${user.jwtInvalidatedAt}`);
    }
    
    const response = {
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        user_id: user.user_id,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isDeleted: user.isDeleted || false,
        deletedAt: user.deletedAt || null,
        pendingDeletion: user.pendingDeletion || false,
        pendingDeletionReason: user.pendingDeletionReason || null,
        jwtInvalidatedAt: user.jwtInvalidatedAt || null,
      },
      authIssues: authIssues,
      hasIssues: authIssues.length > 0,
      recommendations: authIssues.length > 0 ? [
        'ตรวจสอบว่าผู้ใช้ถูกลบหรือไม่',
        'ตรวจสอบสถานะ pendingDeletion',
        'ตรวจสอบ jwtInvalidatedAt',
        'ถ้าผู้ใช้ถูกลบโดยไม่ตั้งใจ ให้กู้คืนข้อมูล',
        'ถ้า pendingDeletion = true ให้ยกเลิกการลบ'
      ] : [
        'ผู้ใช้ดูปกติ ไม่มีปัญหาที่ชัดเจน',
        'ปัญหาอาจเกิดจาก token ที่หมดอายุหรือเสียหาย',
        'ลองลบ cookie และ login ใหม่'
      ]
    };
    
    await client.close();
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error checking auth status:', error);
    return NextResponse.json({ 
      error: 'เกิดข้อผิดพลาดในการตรวจสอบสถานะ' 
    }, { status: 500 });
  }
}
