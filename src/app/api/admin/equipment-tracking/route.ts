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
      status: 'approved', // ✅ ใช้ approved เท่านั้น (อนุมัติทีละรายการ)
      requestType: 'request'
    }).lean();
    
    // Build a map of itemId -> requestLog + snapshot for quick lookup
    const itemToRequestMap = new Map();
    
    approvedRequests.forEach(req => {
      req.items?.forEach((item: any) => {
        // 🆕 ใช้ assignedItemSnapshots ถ้ามี
        if (item.assignedItemSnapshots && item.assignedItemSnapshots.length > 0) {
          item.assignedItemSnapshots.forEach((snapshot: any) => {
            itemToRequestMap.set(snapshot.itemId, {
              requestDate: req.requestDate,
              userId: req.userId,
              deliveryLocation: req.deliveryLocation || '',
              snapshot: snapshot // 🆕 เก็บ snapshot ไว้
            });
          });
        } 
        // Fallback: ใช้ assignedItemIds ถ้าไม่มี snapshot (backward compatibility)
        else if (item.assignedItemIds) {
          item.assignedItemIds.forEach((itemId: string) => {
            itemToRequestMap.set(itemId, {
              requestDate: req.requestDate,
              userId: req.userId,
              deliveryLocation: req.deliveryLocation || '',
              snapshot: null
            });
          });
        }
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
        
        // ✅ ดึงข้อมูลจาก User collection เป็นหลัก
        let firstName = user?.firstName || '';
        let lastName = user?.lastName || '';
        let nickname = user?.nickname || '';
        let userDepartment = user?.department || '';
        let userPhone = user?.phone || '';
        let userOffice = user?.office || '';
        
        // 🔍 Debug: Log item data
        console.log(`\n📦 Processing item: ${item.itemName} (${item._id})`);
        console.log(`   User Type: ${user?.userType}`);
        console.log(`   User data:`, { firstName, lastName, nickname, userDepartment });
        console.log(`   Item requesterInfo:`, (item as any).requesterInfo);
        
        // ✅ สำหรับอุปกรณ์ที่เพิ่มเอง: ดึงข้อมูลจาก requesterInfo ใน InventoryItem
        // (ใช้สำหรับผู้ใช้สาขาที่กรอกข้อมูลเพิ่มเติมตอนเพิ่มอุปกรณ์)
        const itemRequesterInfo = (item as any).requesterInfo;
        if (itemRequesterInfo && (itemRequesterInfo.firstName || itemRequesterInfo.lastName)) {
          console.log(`   ✅ Using requesterInfo from item`);
          firstName = itemRequesterInfo.firstName || firstName;
          lastName = itemRequesterInfo.lastName || lastName;
          nickname = itemRequesterInfo.nickname || nickname;
          userDepartment = itemRequesterInfo.department || userDepartment;
          userPhone = itemRequesterInfo.phone || userPhone;
          userOffice = itemRequesterInfo.office || userOffice;
        }
        
        console.log(`   Final data:`, { firstName, lastName, nickname, userDepartment });
        
        // Determine source: 'request' (เบิก) or 'user-owned' (เพิ่มเอง)
        let source = 'user-owned';
        let dateAdded = item.sourceInfo?.dateAdded || item.currentOwnership?.ownedSince || item.createdAt;
        let deliveryLocationValue = userOffice || ''; // Default to office
      
        // Check if this item came from a request
        const requestInfo = itemToRequestMap.get(String(item._id));
        let itemSnapshot = null;
        
        if (requestInfo || item.transferInfo?.requestId) {
          source = 'request';
          if (requestInfo) {
            dateAdded = requestInfo.requestDate;
            deliveryLocationValue = requestInfo.deliveryLocation || userOffice || '';
            itemSnapshot = requestInfo.snapshot; // 🆕 เก็บ snapshot
          } else if (item.transferInfo?.transferDate) {
            dateAdded = item.transferInfo.transferDate;
          }
        }
        
        // Apply department and office filters if specified
        if (department && userDepartment !== department) continue;
        if (office && userOffice !== office) continue;
        
        // 🆕 ใช้ snapshot ถ้ามี (จากการเบิก) ไม่เช่นนั้นใช้ real-time data
        // ลำดับความสำคัญ: snapshot (ถ้าเบิกมา) > real-time InventoryItem > config lookup
        const finalItemName = itemSnapshot?.itemName || item.itemName || 'ไม่ระบุ';
        const finalCategoryId = itemSnapshot?.categoryId || item.categoryId || 'ไม่ระบุ';
        const finalSerialNumber = itemSnapshot?.serialNumber || item.serialNumber || '';
        const finalNumberPhone = itemSnapshot?.numberPhone || item.numberPhone || '';
        
        // Get category name: snapshot > config lookup
        const categoryConfig = categoryConfigs.find((c: any) => c.id === finalCategoryId);
        const finalCategoryName = itemSnapshot?.categoryName || categoryConfig?.name || finalCategoryId || 'ไม่ระบุ';
        
        // Get status name: snapshot > real-time > config lookup
        const statusConfig = statusConfigs.find((s: any) => s.id === item.statusId);
        const finalStatusId = itemSnapshot?.statusId || item.statusId || '';
        const finalStatusName = itemSnapshot?.statusName || statusConfig?.name || item.statusId || 'ไม่ระบุ';
        
        // Get condition name: snapshot > real-time > config lookup
        const conditionConfig = conditionConfigs.find((c: any) => c.id === item.conditionId);
        const finalConditionId = itemSnapshot?.conditionId || item.conditionId || '';
        const finalConditionName = itemSnapshot?.conditionName || conditionConfig?.name || item.conditionId || 'ไม่ระบุ';
        
        trackingRecords.push({
          _id: String(item._id),
          userId: userId || '',
          firstName: firstName, // จาก User collection
          lastName: lastName,   // จาก User collection
          nickname: nickname,   // จาก User collection
          department: userDepartment, // จาก User collection
          office: userOffice,   // จาก User collection
          phone: userPhone,     // จาก User collection
          pendingDeletion: user?.pendingDeletion || false,
          itemId: String(item._id),
          itemName: finalItemName, // 🆕 ใช้ snapshot หรือ real-time
          currentItemName: finalItemName, // 🆕 ใช้ snapshot หรือ real-time
          quantity: 1, // Each InventoryItem represents 1 physical item
          serialNumber: finalSerialNumber, // 🆕 ใช้ snapshot หรือ real-time
          numberPhone: finalNumberPhone, // 🆕 ใช้ snapshot หรือ real-time
          category: finalCategoryId,
          categoryId: finalCategoryId, // 🆕 ใช้ snapshot หรือ real-time
          categoryName: finalCategoryName, // 🆕 ใช้ snapshot หรือ real-time
          status: finalStatusId,
          statusName: finalStatusName, // 🆕 ใช้ snapshot หรือ real-time
          condition: finalConditionId,
          conditionName: finalConditionName, // 🆕 ใช้ snapshot หรือ real-time
          source: source,
          dateAdded: dateAdded,
          submittedAt: dateAdded,
          requestDate: dateAdded,
          urgency: 'normal',
          deliveryLocation: deliveryLocationValue,
          reason: source === 'request' ? 'การเบิกอุปกรณ์' : 'อุปกรณ์ที่มีอยู่เดิม',
          hasSnapshot: !!itemSnapshot // 🆕 บอกว่ามี snapshot หรือไม่
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