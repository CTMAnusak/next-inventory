import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function POST() {
  try {
    await dbConnect();
    
    console.log('=== FORCE UPDATE ADMIN ===');
    
    // หา admin ปัจจุบัน
    const currentAdmin = await User.findOne({ email: 'ampanusak@gmail.com' });
    
    if (!currentAdmin) {
      return NextResponse.json({
        success: false,
        message: 'ไม่เจอ admin'
      });
    }
    
    console.log('Current admin found:', currentAdmin._id);
    
    // ใช้ MongoDB Native updateOne แทน Mongoose
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management';
    const client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db();
    const collection = db.collection('users');
    
    const new_user_id = 'ADMIN' + Date.now() + Math.floor(Math.random() * 1000);
    console.log('Generated user_id:', new_user_id);
    
    // Force update ด้วย MongoDB Native
    const updateResult = await collection.updateOne(
      { email: 'ampanusak@gmail.com' },
      { 
        $set: { 
          user_id: new_user_id,
          updatedAt: new Date()
        }
      }
    );
    
    console.log('Update result:', updateResult);
    
    // ตรวจสอบผลลัพธ์
    const verifyAdmin = await collection.findOne({ email: 'ampanusak@gmail.com' });
    
    await client.close();
    
    return NextResponse.json({
      success: true,
      message: 'Force update สำเร็จ',
      updateResult: {
        matched: updateResult.matchedCount,
        modified: updateResult.modifiedCount
      },
      admin: {
        _id: verifyAdmin._id,
        user_id: verifyAdmin.user_id,
        email: verifyAdmin.email,
        userRole: verifyAdmin.userRole
      },
      verification: {
        user_id_in_db: verifyAdmin.user_id,
        user_id_exists: !!verifyAdmin.user_id,
        user_id_type: typeof verifyAdmin.user_id
      }
    });
    
  } catch (error) {
    console.error('Force update error:', error);
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
