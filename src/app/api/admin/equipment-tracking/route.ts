import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import User from '@/models/User';
import DeletedUsers from '@/models/DeletedUser';
import InventoryConfig from '@/models/InventoryConfig';

// GET - ดึงข้อมูลการติดตามอุปกรณ์ทั้งหมด (รวมอุปกรณ์ที่เบิกและอุปกรณ์ที่ user มี)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get query parameters for filtering and pagination
    const { searchParams } = new URL(request.url);
    const userIdFilter = searchParams.get('userId');
    const itemIdFilter = searchParams.get('itemId');
    const department = searchParams.get('department');
    const office = searchParams.get('office');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
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
    
    // 🆕 Fetch deleted users for users not found in active User collection
    const foundUserIds = users.map((u: any) => u.user_id);
    const missingUserIds = userIds.filter(id => !foundUserIds.includes(id));
    
    if (missingUserIds.length > 0) {
      console.log(`🔍 Looking for ${missingUserIds.length} deleted users...`);
      const deletedUsers = await DeletedUsers.find({ user_id: { $in: missingUserIds } }).lean();
      deletedUsers.forEach((deletedUser: any) => {
        userMap.set(deletedUser.user_id, {
          ...deletedUser,
          _isDeleted: true // Mark as deleted for special handling
        });
      });
      console.log(`📸 Found ${deletedUsers.length} deleted users in DeletedUsers collection`);
    }
    
    // 🆕 ดึง InventoryMaster ทั้งหมดมาก่อน เพื่อหาชื่ออุปกรณ์ล่าสุด
    const uniqueItems = [...new Set(ownedItems.map(item => `${item.itemName}||${item.categoryId}`))];
    const masterRecords = await InventoryMaster.find({}).lean();
    const masterMap = new Map(masterRecords.map((master: any) => [
      `${master.itemName}||${master.categoryId}`,
      master
    ]));
    
    // Fetch approved request logs to determine which items came from requests
    const approvedRequests = await RequestLog.find({
      status: 'approved', // ✅ ใช้ approved เท่านั้น (อนุมัติทีละรายการ)
      requestType: 'request'
    }).lean();
    
    // Build a map of itemId -> requestLog for quick lookup
    const itemToRequestMap = new Map();
    
    approvedRequests.forEach(req => {
      req.items?.forEach((item: any) => {
        // ใช้ assignedItemSnapshots ถ้ามี
        if (item.assignedItemSnapshots && item.assignedItemSnapshots.length > 0) {
          item.assignedItemSnapshots.forEach((snapshot: any) => {
            itemToRequestMap.set(snapshot.itemId, {
              requestDate: req.requestDate,
              userId: req.userId,
              deliveryLocation: req.deliveryLocation || ''
            });
          });
        } 
        // Fallback: ใช้ assignedItemIds ถ้าไม่มี snapshot (backward compatibility)
        else if (item.assignedItemIds) {
          item.assignedItemIds.forEach((itemId: string) => {
            itemToRequestMap.set(itemId, {
              requestDate: req.requestDate,
              userId: req.userId,
              deliveryLocation: req.deliveryLocation || ''
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
          console.warn(`⚠️ User ${userId} not found for item ${item._id} (not in User or DeletedUsers)`);
        }
        
        // ✅ ดึงข้อมูลจาก User collection หรือ DeletedUsers
        let firstName = user?.firstName || '';
        let lastName = user?.lastName || '';
        let nickname = user?.nickname || '';
        let userDepartment = user?.department || '';
        let userPhone = user?.phone || '';
        let userOffice = user?.office || '';
        const isDeletedUser = (user as any)?._isDeleted || false;
        
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
          
          // ✅ สำหรับผู้ใช้สาขา: ข้อมูลส่วนตัวจาก requesterInfo, office จาก User Collection
          if (user?.userType === 'branch') {
            firstName = itemRequesterInfo.firstName || firstName;
            lastName = itemRequesterInfo.lastName || lastName;
            nickname = itemRequesterInfo.nickname || nickname;
            userDepartment = itemRequesterInfo.department || userDepartment;
            userPhone = itemRequesterInfo.phone || userPhone;
            // ⚠️ office ต้องใช้จาก User Collection เสมอ (เพื่อให้อัปเดตตามที่แอดมินแก้ไข)
            userOffice = user?.office || userOffice;
          } else {
            // ผู้ใช้ individual: ใช้ข้อมูลจาก requesterInfo ทั้งหมด
            firstName = itemRequesterInfo.firstName || firstName;
            lastName = itemRequesterInfo.lastName || lastName;
            nickname = itemRequesterInfo.nickname || nickname;
            userDepartment = itemRequesterInfo.department || userDepartment;
            userPhone = itemRequesterInfo.phone || userPhone;
            userOffice = itemRequesterInfo.office || userOffice;
          }
        } else if (isDeletedUser && user?.userType === 'branch') {
          // 🆕 สำหรับผู้ใช้สาขาที่ถูกลบ แต่ไม่มี requesterInfo:
          // ใช้ข้อมูลจาก DeletedUsers เฉพาะ office
          userOffice = user.office || userOffice;
        }
        
        console.log(`   Final data:`, { firstName, lastName, nickname, userDepartment });
        
        // Determine source: 'request' (เบิก) or 'user-owned' (เพิ่มเอง)
        let source = 'user-owned';
        let dateAdded = item.sourceInfo?.dateAdded || item.currentOwnership?.ownedSince || item.createdAt;
        let deliveryLocationValue = userOffice || ''; // Default to office
      
        // Check if this item came from a request
        const requestInfo = itemToRequestMap.get(String(item._id));
        
        if (requestInfo || item.transferInfo?.requestId) {
          source = 'request';
          if (requestInfo) {
            dateAdded = requestInfo.requestDate;
            deliveryLocationValue = requestInfo.deliveryLocation || userOffice || '';
          } else if (item.transferInfo?.transferDate) {
            dateAdded = item.transferInfo.transferDate;
          }
        }
        
        // Apply department and office filters if specified
        if (department && userDepartment !== department) continue;
        if (office && userOffice !== office) continue;
        
        // 🆕 ดึงข้อมูลล่าสุดจาก InventoryMaster และ Config (ไม่ใช้ snapshot)
        // เพื่อให้แสดงข้อมูลที่อัพเดตล่าสุดเมื่อแอดมินแก้ไข
        
        // 1. ค้นหาชื่ออุปกรณ์และหมวดหมู่ล่าสุดจาก InventoryMaster Map
        const masterKey = `${item.itemName}||${item.categoryId}`;
        const inventoryMaster = masterMap.get(masterKey);
        
        const finalItemName = inventoryMaster?.itemName || item.itemName || 'ไม่ระบุ';
        const finalCategoryId = inventoryMaster?.categoryId || item.categoryId || 'ไม่ระบุ';
        
        // 2. ดึง Serial Number และ Phone Number จาก item โดยตรง (ข้อมูลเฉพาะชิ้น)
        const finalSerialNumber = item.serialNumber || '';
        const finalNumberPhone = item.numberPhone || '';
        
        // 3. ดึงชื่อหมวดหมู่ล่าสุดจาก Config
        const categoryConfig = categoryConfigs.find((c: any) => c.id === finalCategoryId);
        const finalCategoryName = categoryConfig?.name || finalCategoryId || 'ไม่ระบุ';
        
        // 4. ดึงสถานะล่าสุดจาก Config
        const statusConfig = statusConfigs.find((s: any) => s.id === item.statusId);
        const finalStatusId = item.statusId || '';
        const finalStatusName = statusConfig?.name || item.statusId || 'ไม่ระบุ';
        
        // 5. ดึงสภาพล่าสุดจาก Config
        const conditionConfig = conditionConfigs.find((c: any) => c.id === item.conditionId);
        const finalConditionId = item.conditionId || '';
        const finalConditionName = conditionConfig?.name || item.conditionId || 'ไม่ระบุ';
        
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
    
    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedRecords = trackingRecords.slice(skip, skip + limit);
    
    const result = {
      data: paginatedRecords,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(trackingRecords.length / limit),
        totalItems: trackingRecords.length,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(trackingRecords.length / limit),
        hasPrevPage: page > 1
      }
    };
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Error fetching equipment tracking data:', error);
    console.error('Error details:', error.message, error.stack);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการติดตามอุปกรณ์', details: error.message },
      { status: 500 }
    );
  }
}