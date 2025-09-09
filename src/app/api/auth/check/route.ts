import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenFromRequest } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // ตรวจสอบผู้ใช้ใน database ด้วย MongoDB Native Driver
    await dbConnect();
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db();
    const usersCollection = db.collection('users');
    
    const user = await usersCollection.findOne({ user_id: payload.userId });
    await client.close();
    
    if (!user) {
      console.log(`🚪 User ${payload.userId} not found in database - user may have been deleted`);
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // ตรวจสอบว่า JWT token ถูก invalidate หรือไม่
    if (user.jwtInvalidatedAt) {
      const tokenCreatedAt = new Date(payload.iat * 1000); // JWT iat (issued at) เป็น seconds
      if (tokenCreatedAt < user.jwtInvalidatedAt) {
        console.log(`🚫 User ${payload.userId} JWT token invalidated, forcing logout`);
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }
    }
    
    console.log(`✅ User ${payload.userId} authenticated successfully`);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.user_id, // ใช้ user_id แทน _id
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        nickname: user.nickname,
        department: user.department,
        phone: user.phone,
        userType: user.userType,
        office: user.office,
        isMainAdmin: user.isMainAdmin || false,
        userRole: user.userRole || 'user',
        pendingDeletion: user.pendingDeletion || false // เพิ่ม pendingDeletion status
      }
    });

  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
