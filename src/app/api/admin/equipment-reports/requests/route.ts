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
      .select('_id userId requestDate createdAt status items approvedBy firstName lastName nickname department office phone email requesterFirstName requesterLastName requesterNickname requesterDepartment requesterOffice requesterOfficeId requesterOfficeName requesterPhone requesterEmail deliveryLocation urgency notes') // ✅ เพิ่มข้อมูลผู้ใช้ที่จำเป็นและ deliveryLocation, urgency, notes, requesterOfficeId, requesterOfficeName
      .sort({ requestDate: -1, createdAt: -1 })
      .lean(); // Use lean() for better performance
    
    console.log('🔍 Raw requests from DB:', requests.length);
    
    // 🔍 Debug: Log first request data
    if (requests.length > 0) {
      console.log('🔍 First request raw data:', {
        _id: requests[0]._id,
        userId: requests[0].userId,
        firstName: requests[0].firstName,
        lastName: requests[0].lastName,
        requesterFirstName: requests[0].requesterFirstName,
        requesterLastName: requests[0].requesterLastName
      });
    }

    // ใช้ optimized populate function เพื่อแก้ปัญหา N+1 query
    let populatedRequests;
    try {
      populatedRequests = await populateRequestLogCompleteBatchOptimized(requests);
      
      // 🔍 Debug: Log first populated request
      if (populatedRequests.length > 0) {
        console.log('🔍 First request after populate:', {
          _id: populatedRequests[0]._id,
          userId: populatedRequests[0].userId,
          firstName: populatedRequests[0].firstName,
          lastName: populatedRequests[0].lastName,
          userInfo: populatedRequests[0].userInfo
        });
      }
    } catch (populateError) {
      console.error('Error in optimized populate, using fallback:', populateError);
      // Fallback: return raw data without population
      populatedRequests = requests.map(request => ({
        ...request,
        firstName: request.firstName || request.requesterFirstName || 'Unknown',
        lastName: request.lastName || request.requesterLastName || 'User',
        nickname: request.nickname || request.requesterNickname || '',
        department: request.department || request.requesterDepartment || '',
        phone: request.phone || request.requesterPhone || '',
        office: request.office || request.requesterOffice || '',
        email: request.email || request.requesterEmail || '',
        deliveryLocation: request.deliveryLocation || '',
        urgency: request.urgency || 'normal',
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
