import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryConfig from '@/models/InventoryConfig';
import { authenticateUser } from '@/lib/auth-helpers';

// GET - ดึงอุปกรณ์ที่ User เป็นเจ้าของ
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // 🆕 ตรวจสอบ authentication และ user ใน database
    const { error, user } = await authenticateUser(request);
    if (error) return error;
    
    const userId = user!.user_id;
    
    // ✅ เพิ่ม query parameter สำหรับควบคุมการกรองอุปกรณ์ที่มี pending return
    const url = new URL(request.url);
    const excludePendingReturns = url.searchParams.get('excludePendingReturns') === 'true';
    
    // Get user's owned items
    const ownedItems = await InventoryItem.find({
      'currentOwnership.ownerType': 'user_owned',
      'currentOwnership.userId': userId,
      deletedAt: { $exists: false }
    }).sort({ 'currentOwnership.ownedSince': -1 });
    
    console.log(`\n📦 Found ${ownedItems.length} owned items for user ${userId}`);
    ownedItems.forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${(item as any).itemName} (${item._id})`);
      console.log(`      SN: ${item.serialNumber || 'ไม่มี'}`);
      console.log(`      ownedSince: ${item.currentOwnership?.ownedSince}`);
    });

    // Get all return logs (approved and pending)
    const ReturnLog = (await import('@/models/ReturnLog')).default;
    const allReturns = await ReturnLog.find({
      userId: userId
    });

    // Create a map of approved returned items with their approval timestamps
    // Key: itemKey, Value: approvedAt timestamp
    const returnedItemsMap = new Map();
    // Create a set of pending return items to mark
    const pendingReturnItems = new Set();
    
    allReturns.forEach(returnLog => {
      returnLog.items.forEach((item: any) => {
        const itemKey = item.serialNumber 
          ? `${item.itemId}-${item.serialNumber}` 
          : item.itemId;
        
        // If approved, store the approval timestamp
        if (item.approvalStatus === 'approved' && item.approvedAt) {
          // ✅ เก็บเฉพาะ Return Log ที่ใหม่ที่สุดสำหรับแต่ละ item
          const existingApprovedAt = returnedItemsMap.get(itemKey);
          const currentApprovedAt = new Date(item.approvedAt);
          
          if (!existingApprovedAt || currentApprovedAt > existingApprovedAt) {
            returnedItemsMap.set(itemKey, currentApprovedAt);
          }
        }
        // If pending, add to pending items (to mark with badge)
        else if (item.approvalStatus === 'pending' || !item.approvalStatus) {
          pendingReturnItems.add(itemKey);
        }
      });
    });

    // ✅ Filter out items that have been approved for return AFTER they were owned
    // (i.e., only filter if return was approved AFTER the current ownership started)
    // ✅ Also filter out items with pending returns (เฉพาะเมื่อ excludePendingReturns = true)
    const availableItems = ownedItems.filter(item => {
      const itemKey = item.serialNumber ? `${String(item._id)}-${item.serialNumber}` : String(item._id);
      
      // ❌ Filter out items with pending returns เฉพาะเมื่อ excludePendingReturns = true
      // (สำหรับหน้า equipment-return เท่านั้น, หน้า dashboard ยังแสดงได้)
      if (excludePendingReturns && pendingReturnItems.has(itemKey)) {
        return false;
      }
      
      // Check if this item has a return log
      const returnApprovedAt = returnedItemsMap.get(itemKey);
      
      if (!returnApprovedAt) {
        // No return log → show item
        return true;
      }
      
      // Compare timestamps: only filter if return was approved AFTER current ownership
      const ownedSince = new Date(item.currentOwnership?.ownedSince || 0);
      
      // ✅ If return was approved BEFORE current ownership → don't filter (old return log)
      // ❌ If return was approved AFTER current ownership → filter (current return)
      return returnApprovedAt < ownedSince;
    });
    
    // Get request logs to fetch delivery location
    const RequestLog = (await import('@/models/RequestLog')).default;
    
    const approvedRequests = await RequestLog.find({
      userId: userId,
      status: 'approved',
      requestType: 'request'
    }).lean();
    
    // Build maps of itemId -> deliveryLocation and find most recent requester info for branch users
    const itemToDeliveryLocationMap = new Map();
    
    // For branch users, get the most recent personal info from any approved request
    let mostRecentRequesterInfo: {
      firstName?: string;
      lastName?: string;
      nickname?: string;
      department?: string;
      phone?: string;
      office?: string;
    } | null = null;
    
    approvedRequests.forEach((req) => {
      console.log(`\n📋 Processing RequestLog ID: ${req._id}`);
      console.log(`   Status: ${req.status}, DeliveryLocation: ${req.deliveryLocation}`);
      
      // Extract requester info from this request (for branch users)
      if ((req as any).requesterFirstName || (req as any).requesterLastName) {
        mostRecentRequesterInfo = {
          firstName: (req as any).requesterFirstName,
          lastName: (req as any).requesterLastName,
          nickname: (req as any).requesterNickname,
          department: (req as any).requesterDepartment,
          phone: (req as any).requesterPhone,
          office: (req as any).requesterOffice,
        };
      }
      
      req.items?.forEach((item: any, idx: number) => {
        console.log(`   📦 Item ${idx}: ${item.itemName || 'unknown'}`);
        console.log(`      assignedItemIds: ${item.assignedItemIds ? `[${item.assignedItemIds.join(', ')}]` : 'undefined/empty'}`);
        console.log(`      assignedQuantity: ${item.assignedQuantity || 0}, itemApproved: ${item.itemApproved || false}`);
        
        item.assignedItemIds?.forEach((itemId: string) => {
          // Map delivery location
          itemToDeliveryLocationMap.set(itemId, req.deliveryLocation || '');
          console.log(`      ✅ Mapped itemId ${itemId} -> deliveryLocation: "${req.deliveryLocation}"`);
        });
      });
    });
    
    // Get configurations for display
    const config = await InventoryConfig.findOne({});
    const statusConfigs = config?.statusConfigs || [];
    const conditionConfigs = config?.conditionConfigs || [];
    const categoryConfigs = config?.categoryConfigs || [];
    
    // ประกอบข้อมูลด้วยฟิลด์จาก InventoryItem โดยตรง + mapping จาก InventoryConfig
    const populatedItems = availableItems.map((item) => {
      const statusConfig = statusConfigs.find((s: any) => s.id === item.statusId);
      const conditionConfig = conditionConfigs.find((c: any) => c.id === item.conditionId);
      const categoryConfig = categoryConfigs.find((c: any) => c.id === (item as any).categoryId);

      // Check if this item has pending return
      const itemKey = item.serialNumber ? `${String(item._id)}-${item.serialNumber}` : String(item._id);
      const hasPendingReturn = pendingReturnItems.has(itemKey);
      
      // Get delivery location from request log (if item came from request)
      const itemIdStr = String(item._id);
      const deliveryLocation = itemToDeliveryLocationMap.get(itemIdStr) || '';

      // ✅ ดึงข้อมูลจาก item.requesterInfo (สำหรับอุปกรณ์ที่เพิ่มเอง)
      const itemRequesterInfo = (item as any).requesterInfo;
      
      // ลำดับความสำคัญ: item.requesterInfo > mostRecentRequesterInfo
      const finalFirstName = itemRequesterInfo?.firstName || mostRecentRequesterInfo?.firstName || undefined;
      const finalLastName = itemRequesterInfo?.lastName || mostRecentRequesterInfo?.lastName || undefined;
      const finalNickname = itemRequesterInfo?.nickname || mostRecentRequesterInfo?.nickname || undefined;
      const finalDepartment = itemRequesterInfo?.department || mostRecentRequesterInfo?.department || undefined;
      const finalPhone = itemRequesterInfo?.phone || mostRecentRequesterInfo?.phone || undefined;
      
      // ⚠️ สำหรับผู้ใช้สาขา: office ต้องใช้จาก User Collection เสมอ (ไม่ใช้ snapshot เก่า)
      // เพื่อให้แสดงชื่อสาขาล่าสุดที่แอดมินแก้ไข
      const finalOffice = user?.userType === 'branch' 
        ? user?.office 
        : (itemRequesterInfo?.office || mostRecentRequesterInfo?.office || undefined);
      
      // ✅ กำหนด source ตามการได้มาของอุปกรณ์
      // - self_reported = เพิ่มเองผ่าน "เพิ่มอุปกรณ์ที่มี" → แสดงปุ่มแก้ไข
      // - transferred / admin_purchased = ได้จากการเบิก → ไม่แสดงปุ่มแก้ไข
      const acquisitionMethod = item.sourceInfo?.acquisitionMethod;
      // ✅ ถ้าเป็น self_reported → source: 'user-owned', นอกนั้น → source: 'request'
      const source = acquisitionMethod === 'self_reported' ? 'user-owned' : 'request';
      
      // ✅ ตรวจสอบว่าเป็นซิมการ์ดหรือไม่
      const isSIMCard = (item as any).categoryId === 'cat_sim_card';
      
      return {
        _id: item._id,
        itemMasterId: (item as any).itemMasterId,
        itemName: (item as any).itemName || 'ไม่ระบุ',
        categoryId: (item as any).categoryId || 'ไม่ระบุ',
        category: categoryConfig?.name || 'ไม่ระบุ',
        serialNumber: item.serialNumber,
        // ✅ ใช้ numberPhone เฉพาะซิมการ์ดเท่านั้น
        numberPhone: isSIMCard ? item.numberPhone : undefined,
        statusId: item.statusId,
        statusName: statusConfig?.name || 'ไม่ระบุ',
        conditionId: item.conditionId,
        conditionName: conditionConfig?.name || 'ไม่ระบุ',
        currentOwnership: item.currentOwnership,
        sourceInfo: item.sourceInfo,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        deliveryLocation: deliveryLocation, // ✅ เพิ่มสถานที่จัดส่ง
        hasPendingReturn, // ✅ เพิ่ม flag นี้
        source: source, // ✅ กำหนด source ตามวิธีการได้มา
        // ✅ ใส่ข้อมูลส่วนตัว (ดึงจาก item.requesterInfo หรือ RequestLog)
        firstName: finalFirstName,
        lastName: finalLastName,
        nickname: finalNickname,
        department: finalDepartment,
        phone: finalPhone,
        office: finalOffice
      };
    });
    
    return NextResponse.json({
      items: populatedItems,
      totalCount: populatedItems.length
    });
    
  } catch (error) {
    console.error('Error fetching owned equipment:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์' },
      { status: 500 }
    );
  }
}

// POST - เพิ่มอุปกรณ์ที่มี (User)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // 🆕 ตรวจสอบ authentication และ user ใน database
    const { error, user } = await authenticateUser(request);
    if (error) return error;
    
    const equipmentData = await request.json();
    const {
      itemName,
      categoryId,
      serialNumber,
      numberPhone,
      statusId = 'status_available',
      conditionId = 'cond_working',
      quantity = 1,
      notes,
      // ✅ รับข้อมูลผู้ใช้สาขา
      firstName,
      lastName,
      nickname,
      department,
      phone
    } = equipmentData;
    
    // Validate required fields
    if (!itemName || !categoryId) {
      return NextResponse.json(
        { error: 'กรุณาระบุชื่ออุปกรณ์และหมวดหมู่' },
        { status: 400 }
      );
    }
    
    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'กรุณาระบุจำนวนที่ถูกต้อง' },
        { status: 400 }
      );
    }
    
    // Use the new inventory helper
    const { createInventoryItem } = await import('@/lib/inventory-helpers');
    
    const createdItems = [];
    
    // Use authenticated user info
    const currentUser = user;
    
    // Create multiple items if quantity > 1
    for (let i = 0; i < quantity; i++) {
      const itemData = {
        itemName,
        categoryId,
        serialNumber: i === 0 ? serialNumber : undefined, // Only first item gets serial number
        numberPhone: i === 0 ? numberPhone : undefined,   // Only first item gets phone number
        statusId,
        conditionId,
        addedBy: 'user' as const,
        addedByUserId: user!.user_id,
        initialOwnerType: 'user_owned' as const,
        userId: user!.user_id,
        notes: notes || undefined,
        // ✅ เพิ่มข้อมูลผู้ใช้สาขา (สำหรับผู้ใช้ประเภทสาขาเท่านั้น)
        requesterInfo: (firstName || lastName || department) ? {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          nickname: nickname || undefined,
          department: department || undefined,
          phone: phone || undefined,
          office: currentUser?.office || undefined
        } : undefined
      };
      
      const newItem = await createInventoryItem(itemData);
      createdItems.push(newItem);
    }
    
    return NextResponse.json({
      message: `เพิ่มอุปกรณ์เรียบร้อยแล้ว ${quantity} ชิ้น`,
      createdItems: createdItems.length,
      itemIds: createdItems.map(item => String(item._id))
    });
    
  } catch (error) {
    console.error('Add owned equipment error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Serial Number')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      if (error.message.includes('Phone Number')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: 'เกิดข้อผิดพลาดในการเพิ่มอุปกรณ์', 
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined 
      },
      { status: 500 }
    );
  }
}