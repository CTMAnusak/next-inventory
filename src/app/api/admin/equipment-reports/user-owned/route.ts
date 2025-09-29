import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import User from '@/models/User';
import DeletedUsers from '@/models/DeletedUser';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // Fetch user-owned equipment logs
    const userOwnedLogs = await RequestLog.find({ requestType: 'user-owned' })
      .sort({ createdAt: -1 })
      .limit(1000);


    // Get all unique userIds from logs efficiently
    const userIds = [...new Set(userOwnedLogs.filter(log => log.userId).map(log => log.userId))];
    
    // Batch fetch active user profiles
    const userProfiles = await User.find({ 
      user_id: { $in: userIds } 
    }).select('user_id firstName lastName nickname department office phone');

    // Build map from active users
    const userProfileMap = new Map<string, any>();
    userProfiles.forEach(profile => {
      userProfileMap.set(profile.user_id, profile);
    });

    // Resolve snapshots for missing users
    const missingUserIds = userIds.filter(id => !userProfileMap.has(id));
    if (missingUserIds.length > 0) {
      const snapshots = await DeletedUsers.find({ user_id: { $in: missingUserIds } })
        .select('user_id firstName lastName nickname department office phone');
      snapshots.forEach(snap => {
        userProfileMap.set(snap.user_id as string, {
          user_id: snap.user_id,
          firstName: snap.firstName,
          lastName: snap.lastName,
          nickname: snap.nickname,
          department: snap.department,
          office: snap.office,
          phone: snap.phone
        });
      });
    }


    // Enhance logs with user profile data (no async operations in map)
    const enhancedLogs = userOwnedLogs.map(log => {
      const enhancedLog = log.toObject();
      
      if (log.userId && userProfileMap.has(log.userId as any)) {
        const userProfile = userProfileMap.get(log.userId as any);
        // Use user profile data if available, fallback to log data
        enhancedLog.nickname = userProfile.nickname || log.nickname || '';
        enhancedLog.department = userProfile.department || log.department || '';
        enhancedLog.phone = userProfile.phone || log.phone || '';
        enhancedLog.firstName = userProfile.firstName || log.firstName || '';
        enhancedLog.lastName = userProfile.lastName || log.lastName || '';
        enhancedLog.office = userProfile.office || log.office || '';
      }

      return enhancedLog;
    });


    return NextResponse.json(enhancedLogs);
  } catch (error) {
    console.error('Fetch user-owned equipment error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
