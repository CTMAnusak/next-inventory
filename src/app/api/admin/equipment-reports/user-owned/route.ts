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

    // Enhance logs with user profile data
    const enhancedLogs = await Promise.all(
      userOwnedLogs.map(async (log) => {
        console.log('🔍 Processing log:', {
          _id: log._id,
          userId: log.userId,
          firstName: log.firstName,
          lastName: log.lastName,
          nickname: log.nickname,
          department: log.department,
          phone: log.phone
        });

        // Try to find user profile to get complete information
        let userProfile = null;
        if (log.userId) {
          try {
            userProfile = await User.findOne({ user_id: log.userId });
            console.log('🔍 User profile found for userId:', log.userId, userProfile ? 'Yes' : 'No');
            if (userProfile) {
              console.log('🔍 User profile data:', {
                nickname: userProfile.nickname,
                department: userProfile.department,
                phone: userProfile.phone
              });
            }
          } catch (error) {
            console.log('Could not fetch user profile for userId:', log.userId, error);
          }
        } else {
          console.log('🔍 No userId found in log');
        }

        // Enhance log data with user profile information
        const enhancedLog = log.toObject();
        if (userProfile) {
          // Use user profile data if available, fallback to log data
          enhancedLog.nickname = userProfile.nickname || log.nickname || '';
          enhancedLog.department = userProfile.department || log.department || '';
          enhancedLog.phone = userProfile.phone || log.phone || '';
          enhancedLog.firstName = userProfile.firstName || log.firstName || '';
          enhancedLog.lastName = userProfile.lastName || log.lastName || '';
          enhancedLog.office = userProfile.office || log.office || '';
          
          console.log('🔍 Enhanced log data:', {
            nickname: enhancedLog.nickname,
            department: enhancedLog.department,
            phone: enhancedLog.phone
          });
        } else {
          console.log('🔍 Using original log data (no user profile found)');
        }

        return enhancedLog;
      })
    );

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
