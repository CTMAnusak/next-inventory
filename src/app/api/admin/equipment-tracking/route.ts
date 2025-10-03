import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import User from '@/models/User';
import InventoryConfig from '@/models/InventoryConfig';

// GET - ดึงข้อมูลการติดตามอุปกรณ์ทั้งหมด (รวมอุปกรณ์ที่เบิกและอุปกรณ์ที่ user มี)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const userIdFilter = searchParams.get('userId');
    const itemIdFilter = searchParams.get('itemId');
    const department = searchParams.get('department');
    const office = searchParams.get('office');
    
    // Get configurations for display
    const config = await InventoryConfig.findOne({});
    const categoryConfigs = config?.categoryConfigs || [];
    const statusConfigs = config?.statusConfigs || [];
    const conditionConfigs = config?.conditionConfigs || [];
    
    // Build filter for user-owned items
    const itemFilter: any = { 
      'currentOwnership.ownerType': 'user_owned',
      deletedAt: { $exists: false }
    };
    
    if (userIdFilter) {
      itemFilter['currentOwnership.userId'] = userIdFilter;
    }
    
    if (itemIdFilter) {
      itemFilter._id = itemIdFilter;
    }
    
    // Fetch all user-owned inventory items
    const ownedItems = await InventoryItem.find(itemFilter).lean();
    
    console.log(`Found ${ownedItems.length} user-owned items`);
    
    if (ownedItems.length === 0) {
      console.log('⚠️ No user-owned items found');
      return NextResponse.json([]);
    }
    
    // Get unique user IDs from owned items
    const userIds = [...new Set(ownedItems.map(item => item.currentOwnership?.userId).filter(Boolean))];
    
    console.log(`Unique user IDs: ${userIds.length}`);
    
    // Fetch all users at once (using user_id field, not _id)
    const users = await User.find({ user_id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((user: any) => [user.user_id, user]));
    
    // Fetch approved request logs to determine which items came from requests
    const approvedRequests = await RequestLog.find({
      status: 'approved',
      requestType: 'request'
    }).lean();
    
    // Build a map of itemId -> requestLog for quick lookup
    const itemToRequestMap = new Map();
    approvedRequests.forEach(req => {
      req.items?.forEach((item: any) => {
        item.assignedItemIds?.forEach((itemId: string) => {
          itemToRequestMap.set(itemId, {
            requestDate: req.requestDate,
            userId: req.userId
          });
        });
      });
    });
    
    // Process owned items and flatten to match frontend structure
    const trackingRecords = [];
    
    for (const item of ownedItems) {
      try {
        const userId = item.currentOwnership?.userId;
        
        // Skip items without userId (shouldn't happen for user_owned, but safety check)
        if (!userId) {
          console.warn(`⚠️ Item ${item._id} has no userId in currentOwnership`);
          continue;
        }
        
        const user = userMap.get(userId);
        
        if (!user) {
          console.warn(`⚠️ User ${userId} not found for item ${item._id}`);
        }
        
        // Apply department and office filters if specified
        if (department && user?.department !== department) continue;
        if (office && user?.office !== office) continue;
        
        // Determine source: 'request' (เบิก) or 'user-owned' (เพิ่มเอง)
        let source = 'user-owned';
        let dateAdded = item.sourceInfo?.dateAdded || item.currentOwnership?.ownedSince || item.createdAt;
      
      // Check if this item came from a request
      const requestInfo = itemToRequestMap.get(String(item._id));
      if (requestInfo || item.transferInfo?.requestId) {
        source = 'request';
        if (requestInfo) {
          dateAdded = requestInfo.requestDate;
        } else if (item.transferInfo?.transferDate) {
          dateAdded = item.transferInfo.transferDate;
        }
      }
      
      // Get category name
      const categoryConfig = categoryConfigs.find((c: any) => c.id === item.categoryId);
      
      // Get status name
      const statusConfig = statusConfigs.find((s: any) => s.id === item.statusId);
      
      // Get condition name
      const conditionConfig = conditionConfigs.find((c: any) => c.id === item.conditionId);
      
        trackingRecords.push({
          _id: String(item._id),
          userId: userId || '',
          firstName: user?.firstName || '',
          lastName: user?.lastName || '',
          nickname: user?.nickname || '',
          department: user?.department || '',
          office: user?.office || '',
          phone: user?.phone || '',
          pendingDeletion: user?.pendingDeletion || false,
          itemId: String(item._id),
          itemName: item.itemName || 'ไม่ระบุ',
          currentItemName: item.itemName || 'ไม่ระบุ',
          quantity: 1, // Each InventoryItem represents 1 physical item
          serialNumber: item.serialNumber || '',
          category: item.categoryId || 'ไม่ระบุ',
          categoryName: categoryConfig?.name || item.categoryId || 'ไม่ระบุ',
          status: item.statusId || '',
          statusName: statusConfig?.name || item.statusId || 'ไม่ระบุ',
          condition: item.conditionId || '',
          conditionName: conditionConfig?.name || item.conditionId || 'ไม่ระบุ',
          source: source,
          dateAdded: dateAdded,
          submittedAt: dateAdded,
          requestDate: dateAdded,
          urgency: 'normal',
          deliveryLocation: user?.office || '',
          reason: source === 'request' ? 'การเบิกอุปกรณ์' : 'อุปกรณ์ที่มีอยู่เดิม'
        });
      } catch (itemError: any) {
        console.error(`❌ Error processing item ${item._id}:`, itemError.message);
        // Continue with next item
      }
    }
    
    // Sort by date added (newest first)
    trackingRecords.sort((a, b) => {
      const dateA = new Date(a.dateAdded).getTime();
      const dateB = new Date(b.dateAdded).getTime();
      return dateB - dateA;
    });
    
    console.log(`Returning ${trackingRecords.length} tracking records`);
    
    return NextResponse.json(trackingRecords);
    
  } catch (error: any) {
    console.error('Error fetching equipment tracking data:', error);
    console.error('Error details:', error.message, error.stack);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการติดตามอุปกรณ์', details: error.message },
      { status: 500 }
    );
  }
}