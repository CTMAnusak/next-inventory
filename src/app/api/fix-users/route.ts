import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    
    // Find users without user_id
    const usersWithoutId = await User.find({
      $or: [
        { user_id: { $exists: false } },
        { user_id: null },
        { user_id: '' }
      ]
    });
    
    
    let updated = 0;
    
    for (const user of usersWithoutId) {
      try {
        // Generate unique user_id based on user type
        let user_id;
        let attempts = 0;
        let isUnique = false;
        
        // ใช้คำนำหน้า "BRANCH" สำหรับประเภทสาขา และ "USER" สำหรับประเภทบุคคล
        const prefix = user.userType === 'branch' ? 'BRANCH' : 'USER';
        
        while (!isUnique && attempts < 10) {
          user_id = prefix + Date.now() + Math.floor(Math.random() * 1000);
          const existing = await User.findOne({ user_id });
          if (!existing) {
            isUnique = true;
          }
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        
        if (isUnique && user_id) {
          await User.updateOne(
            { _id: user._id },
            { $set: { user_id: user_id } }
          );
          updated++;
        }
      } catch (error) {
        console.error(`Error updating user ${user.email}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Updated ${updated} users with user_id`,
      total: usersWithoutId.length,
      updated: updated
    });
    
  } catch (error) {
    console.error('Fix users error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Fix Users API',
    usage: 'POST /api/fix-users to add user_id to existing users'
  });
}
