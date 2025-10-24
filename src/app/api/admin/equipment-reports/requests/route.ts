import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import { populateRequestLogCompleteBatchOptimized } from '@/lib/optimized-populate-helpers';

// GET - Fetch all equipment request logs
export async function GET() {
  try {
    await dbConnect();

    // Use optimized query with lean() and select only needed fields
    const requests = await RequestLog.find({ requestType: 'request' })
      .select('_id userId requestDate createdAt status items approvedBy') // Only select needed fields
      .sort({ requestDate: -1, createdAt: -1 })
      .lean(); // Use lean() for better performance
    
    console.log('🔍 Raw requests from DB:', requests.length);

    // ใช้ optimized populate function เพื่อแก้ปัญหา N+1 query
    let populatedRequests;
    try {
      populatedRequests = await populateRequestLogCompleteBatchOptimized(requests);
    } catch (populateError) {
      console.error('Error in optimized populate, using fallback:', populateError);
      // Fallback: return raw data without population
      populatedRequests = requests.map(request => ({
        ...request,
        userInfo: {
          firstName: 'Unknown',
          lastName: 'User',
          nickname: 'Unknown',
          department: 'Unknown',
          phone: 'Unknown',
          office: 'Unknown',
          email: 'Unknown',
          isActive: false
        }
      }));
    }

    console.log('📋 API returning populated requests:', populatedRequests.length, 'items');
    return NextResponse.json(populatedRequests);
  } catch (error) {
    console.error('Error fetching request logs:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
