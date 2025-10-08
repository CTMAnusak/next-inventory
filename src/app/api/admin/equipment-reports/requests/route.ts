import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import User from '@/models/User';
import { getItemNameAndCategory, getStatusNameById, getConditionNameById } from '@/lib/item-name-resolver';
import DeletedUsers from '@/models/DeletedUser';

// GET - Fetch all equipment request logs
export async function GET() {
  try {
    await dbConnect();

    // Use requestDate (fallback to createdAt) for newest-first ordering
    const requests = await RequestLog.find({ requestType: 'request' })
      .sort({ requestDate: -1, createdAt: -1 });
    
    console.log('🔍 Raw requests from DB:', requests.length);
    console.log('🔍 First request userId populate:', (requests[0] as any)?.userId);

    // Enrich request items with current itemName/category using masterId
    const enrichedRequests = await Promise.all(
      requests.map(async (req) => {
        const enrichedItems = await Promise.all(
          req.items.map(async (item: any) => {
            console.log('🔍 Processing item with masterId:', item.masterId);
            const info = await getItemNameAndCategory(item.masterId, undefined);
            console.log('🔍 Item info resolved:', info);
            
            // Resolve status and condition names from IDs (if available)
            const statusName = item.statusOnRequest ? await getStatusNameById(item.statusOnRequest) : null;
            const conditionName = item.conditionOnRequest ? await getConditionNameById(item.conditionOnRequest) : null;
            
            const itemObj = typeof item.toObject === 'function' ? item.toObject() : item;
            
            // Debug logging for assignedQuantity
            console.log(`🔍 Item ${itemObj.itemName || 'Unknown'}: assignedQuantity from DB = ${itemObj.assignedQuantity}, itemApproved = ${itemObj.itemApproved}`);
            
            return {
              ...itemObj,
              masterId: itemObj.masterId, // ✅ ส่ง masterId ออกมาด้วย
              itemName: info?.itemName || 'Unknown Item',
              category: info?.category || 'Unknown Category',
              categoryId: info?.categoryId || '',
              statusOnRequest: statusName || item.statusOnRequest || '-',
              conditionOnRequest: conditionName || item.conditionOnRequest || '-',
              assignedQuantity: itemObj.assignedQuantity || 0, // ✅ ส่ง assignedQuantity ออกมาด้วย
              itemApproved: itemObj.itemApproved || false // ✅ ส่ง itemApproved ออกมาด้วย
            };
          })
        );

        // Extract user data from populated userId (or fallback to DeletedUsers snapshot)
        let resolvedUser: any = null;
        try {
          // Find active user by business user_id
          resolvedUser = await User.findOne({ user_id: (req as any).userId })
            .select('firstName lastName nickname department office phone');
          if (!resolvedUser) {
            // Fallback to snapshot by user_id
            const snapshot = await DeletedUsers.findOne({ user_id: (req as any).userId });
            if (snapshot) {
              resolvedUser = {
                firstName: snapshot.firstName,
                lastName: snapshot.lastName,
                nickname: snapshot.nickname,
                department: snapshot.department,
                office: snapshot.office,
                phone: snapshot.phone
              } as any;
            }
          }
        } catch (e) {
          console.error('Error resolving user (active/snapshot):', e);
        }
        console.log('🔍 User data resolved:', resolvedUser);
        const requestData = typeof (req as any).toObject === 'function' ? (req as any).toObject() : req;

        return {
          ...requestData,
          // Add user data directly to request object for easier access in UI
          // Priority: stored requester info (for branch users) > resolved user > fallback
          firstName: (req as any).requesterFirstName || resolvedUser?.firstName || 'Unknown User',
          lastName: (req as any).requesterLastName || resolvedUser?.lastName || '',
          nickname: (req as any).requesterNickname || resolvedUser?.nickname || '',
          department: (req as any).requesterDepartment || resolvedUser?.department || '',
          office: (req as any).requesterOffice || resolvedUser?.office || '',
          phone: (req as any).requesterPhone || resolvedUser?.phone || '',
          items: enrichedItems
        };
      })
    );

    console.log('📋 API returning enriched requests:', enrichedRequests.length, 'items');
    console.log('📋 First request sample:', enrichedRequests[0]);
    return NextResponse.json(enrichedRequests);
  } catch (error) {
    console.error('Error fetching request logs:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
