import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import User from '@/models/User';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // Fetch user-owned equipment logs
    const userOwnedLogs = await RequestLog.find({ requestType: 'user-owned' })
      .sort({ createdAt: -1 })
      .limit(1000);

    console.log('🔍 User-owned logs found:', userOwnedLogs.length);

    // Get all unique userIds from logs efficiently
    const userIds = [...new Set(userOwnedLogs.filter(log => log.userId).map(log => log.userId))];
    
    // Batch fetch all user profiles in one query
    const userProfiles = await User.find({ 
      user_id: { $in: userIds } 
    }).select('user_id firstName lastName nickname department office phone');
    
    // Create a lookup map for quick access
    const userProfileMap = new Map();
    userProfiles.forEach(profile => {
      userProfileMap.set(profile.user_id, profile);
    });

    console.log(`🔍 Fetched ${userProfiles.length} user profiles for ${userIds.length} unique userIds`);

    // Enhance logs with user profile data (no async operations in map)
    const enhancedLogs = userOwnedLogs.map(log => {
      const enhancedLog = log.toObject();
      
      if (log.userId && userProfileMap.has(log.userId)) {
        const userProfile = userProfileMap.get(log.userId);
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

    console.log('🔍 Enhanced logs ready to return:', enhancedLogs.length);

    return NextResponse.json(enhancedLogs);
  } catch (error) {
    console.error('Fetch user-owned equipment error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
