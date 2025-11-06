import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import User from '@/models/User';
import DeletedUsers from '@/models/DeletedUser';
import InventoryConfig from '@/models/InventoryConfig';
import { getOfficeNameById } from '@/lib/office-helpers'; // 🆕 Import helper function

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
    
    if (ownedItems.length === 0) {
      return NextResponse.json([]);
    }
    
    // Get unique user IDs from owned items
    const userIds = [...new Set(ownedItems.map(item => item.currentOwnership?.userId).filter(Boolean))];
    
    // Fetch all users at once (using user_id field, not _id)
    const users = await User.find({ user_id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((user: any) => [user.user_id, user]));
    
    // 🆕 Fetch deleted users for users not found in active User collection
    const foundUserIds = users.map((u: any) => u.user_id);
    const missingUserIds = userIds.filter(id => !foundUserIds.includes(id));
    
    if (missingUserIds.length > 0) {
      const deletedUsers = await DeletedUsers.find({ user_id: { $in: missingUserIds } }).lean();
      deletedUsers.forEach((deletedUser: any) => {
        userMap.set(deletedUser.user_id, {
          ...deletedUser,
          _isDeleted: true // Mark as deleted for special handling
        });
      });
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
          continue;
        }
        
        const user = userMap.get(userId);
        
        // ✅ ดึงข้อมูลจาก User collection หรือ DeletedUsers
        let firstName = user?.firstName || '';
        let lastName = user?.lastName || '';
        let nickname = user?.nickname || '';
        let userDepartment = user?.department || '';
        let userPhone = user?.phone || '';
        // 🆕 ใช้ officeName แทน office (office field ถูกลบออกแล้ว)
        let userOffice = user?.officeName || user?.office || '';
        const isDeletedUser = (user as any)?._isDeleted || false;
        
        // 🆕 ถ้าไม่มี officeName แต่มี officeId ให้ populate จาก Office collection
        if (!userOffice && user?.officeId) {
          try {
            userOffice = await getOfficeNameById(user.officeId);
          } catch (error) {
            console.error('Error fetching office name:', error);
          }
        }
        
        // ✅ สำหรับอุปกรณ์ที่เพิ่มเอง: ดึงข้อมูลจาก requesterInfo ใน InventoryItem
        // (ใช้สำหรับผู้ใช้สาขาที่กรอกข้อมูลเพิ่มเติมตอนเพิ่มอุปกรณ์)
        const itemRequesterInfo = (item as any).requesterInfo;
        if (itemRequesterInfo && (itemRequesterInfo.firstName || itemRequesterInfo.lastName)) {
          // ✅ สำหรับผู้ใช้สาขา: ข้อมูลส่วนตัวจาก requesterInfo, office จาก User Collection
          if (user?.userType === 'branch') {
            firstName = itemRequesterInfo.firstName || firstName;
            lastName = itemRequesterInfo.lastName || lastName;
            nickname = itemRequesterInfo.nickname || nickname;
            userDepartment = itemRequesterInfo.department || userDepartment;
            userPhone = itemRequesterInfo.phone || userPhone;
            // ⚠️ office ต้องใช้จาก User Collection เสมอ (เพื่อให้อัปเดตตามที่แอดมินแก้ไข)
            // 🆕 ใช้ officeName แทน office
            userOffice = user?.officeName || user?.office || userOffice;
          } else {
            // ผู้ใช้ individual: ใช้ข้อมูลจาก requesterInfo ทั้งหมด
            firstName = itemRequesterInfo.firstName || firstName;
            lastName = itemRequesterInfo.lastName || lastName;
            nickname = itemRequesterInfo.nickname || nickname;
            userDepartment = itemRequesterInfo.department || userDepartment;
            userPhone = itemRequesterInfo.phone || userPhone;
            
            // 🔧 Populate officeName จาก officeId (real-time lookup)
            if (itemRequesterInfo.officeId) {
              try {
                userOffice = await getOfficeNameById(itemRequesterInfo.officeId);
              } catch (error) {
                console.error('Error fetching office name from officeId:', error);
                // Fallback to stored officeName or office
                userOffice = itemRequesterInfo.officeName || itemRequesterInfo.office || userOffice;
              }
            } else {
              // ใช้ officeName หรือ office เดิม (backward compatible)
              userOffice = itemRequesterInfo.officeName || itemRequesterInfo.office || userOffice;
            }
          }
        } else if (isDeletedUser && user?.userType === 'branch') {
          // 🆕 สำหรับผู้ใช้สาขาที่ถูกลบ แต่ไม่มี requesterInfo:
          // ใช้ข้อมูลจาก DeletedUsers เฉพาะ office
          // 🆕 ใช้ officeName แทน office
          userOffice = user.officeName || user.office || userOffice;
        }
        
        // 🆕 ถ้ายังไม่มี officeName และมี officeId ให้ populate อีกครั้ง (กรณีที่ requesterInfo ไม่มี officeName)
        if (!userOffice && user?.officeId) {
          try {
            userOffice = await getOfficeNameById(user.officeId);
          } catch (error) {
            console.error('Error fetching office name (second attempt):', error);
          }
        }
        
        // 🆕 Fallback: ถ้ายังไม่มี office ให้ใช้ default
        if (!userOffice) {
          userOffice = 'ไม่ระบุสาขา';
        }
        
        // Determine source: 'request' (เบิก) or 'user-owned' (เพิ่มเอง)
        let source = 'user-owned';
        let dateAdded = item.sourceInfo?.dateAdded || item.currentOwnership?.ownedSince || item.createdAt;
        let deliveryLocationValue = userOffice || '-'; // 🆕 Default to "-" if no office
        
        // Check if this item came from a request
        const requestInfo = itemToRequestMap.get(String(item._id));
        
        if (requestInfo || item.transferInfo?.requestId) {
          source = 'request';
          if (requestInfo) {
            dateAdded = requestInfo.requestDate;
            // 🆕 ใช้ "-" ถ้าไม่มีข้อมูลสถานที่จัดส่ง
            deliveryLocationValue = requestInfo.deliveryLocation || '-';
          } else if (item.transferInfo?.transferDate) {
            dateAdded = item.transferInfo.transferDate;
          }
        }
        
        // 🆕 ถ้าไม่มีข้อมูลสถานที่จัดส่งเลย ให้ใช้ "-"
        if (!deliveryLocationValue || deliveryLocationValue.trim() === '') {
          deliveryLocationValue = '-';
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
        console.error(`Error processing item ${item._id}:`, itemError);
        // Continue with next item on error
      }
    }
    
    // Sort by date added (newest first)
    trackingRecords.sort((a, b) => {
      const dateA = new Date(a.dateAdded).getTime();
      const dateB = new Date(b.dateAdded).getTime();
      return dateB - dateA;
    });
    
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
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการติดตามอุปกรณ์', details: error.message },
      { status: 500 }
    );
  }
}