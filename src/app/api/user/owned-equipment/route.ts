import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryConfig from '@/models/InventoryConfig';
import { authenticateUser } from '@/lib/auth-helpers';

// GET - ดึงอุปกรณ์ที่ User เป็นเจ้าของ
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    await dbConnect();
    
    // 🆕 ตรวจสอบ authentication และ user ใน database
    const { error, user } = await authenticateUser(request);
    if (error) return error;
    
    const userId = user!.user_id;
    
    // ✅ เพิ่ม query parameter สำหรับควบคุมการกรองอุปกรณ์ที่มี pending return
    const url = new URL(request.url);
    const excludePendingReturns = url.searchParams.get('excludePendingReturns') === 'true';
    
    // Check cache first
    const { getCachedData, setCachedData } = await import('@/lib/cache-utils');
    const cacheKey = `owned_equipment_${userId}_${excludePendingReturns ? 'exclude' : 'include'}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Owned Equipment API - Cache hit (${Date.now() - startTime}ms)`);
      }
      return NextResponse.json(cached);
    }
    
    // Get user's owned items with lean() and select only needed fields
    const ownedItems = await InventoryItem.find({
      'currentOwnership.ownerType': 'user_owned',
      'currentOwnership.userId': userId,
      deletedAt: { $exists: false }
    })
    .select('_id itemMasterId itemName categoryId serialNumber numberPhone statusId conditionId currentOwnership sourceInfo createdAt updatedAt requesterInfo')
    .sort({ 'currentOwnership.ownedSince': -1 })
    .lean();

    // ✅ Optimize: Only fetch return logs if we need to filter pending returns
    // For dashboard, we don't need to filter, so skip this expensive query
    const ReturnLog = (await import('@/models/ReturnLog')).default;
    const allReturns = excludePendingReturns 
      ? await ReturnLog.find({ userId: userId })
        .select('items userId status')
        .lean()
      : [];

    // ✅ Optimize: Only process return logs if we fetched them
    const returnedItemsMap = new Map();
    const pendingReturnItems = new Set();
    
    if (allReturns.length > 0) {
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
    }

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
    
    // ✅ Optimize: Only fetch request logs if we need delivery location
    // For most cases, we can skip this expensive query
    const RequestLog = (await import('@/models/RequestLog')).default;
    
    // Only fetch if we have items that might need delivery location
    const approvedRequests = availableItems.length > 0
      ? await RequestLog.find({
          userId: userId,
          status: 'approved',
          requestType: 'request'
        })
        .select('items deliveryLocation requesterFirstName requesterLastName requesterNickname requesterDepartment requesterPhone requesterOffice')
        .limit(100) // ✅ Limit to recent requests only
        .lean()
      : [];
    
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
      
      req.items?.forEach((item: any) => {
        item.assignedItemIds?.forEach((itemId: string) => {
          // Map delivery location
          itemToDeliveryLocationMap.set(itemId, req.deliveryLocation || '');
        });
      });
    });
    
    // Get configurations for display (with cache)
    const { getCachedData: getConfigCache, setCachedData: setConfigCache } = await import('@/lib/cache-utils');
    const configCacheKey = 'inventory_config_all';
    let config = getConfigCache(configCacheKey);
    
    if (!config) {
      config = await InventoryConfig.findOne({})
        .select('statusConfigs conditionConfigs categoryConfigs')
        .lean();
      if (config) {
        setConfigCache(configCacheKey, config);
      }
    }
    
    const statusConfigs = config?.statusConfigs || [];
    const conditionConfigs = config?.conditionConfigs || [];
    const categoryConfigs = config?.categoryConfigs || [];
    
    // 🆕 Load Office collection for real-time office name lookup (with cache)
    const { getOfficeMap } = await import('@/lib/office-helpers');
    const officeIds = new Set<string>();
    ownedItems.forEach((item: any) => {
      if (item.requesterInfo?.officeId) officeIds.add(item.requesterInfo.officeId);
      if (user?.officeId) officeIds.add(user.officeId);
    });
    const officeMap = await getOfficeMap(Array.from(officeIds));
    
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
      
      // 🔧 Office Name Logic: ใช้ snapshot ก่อน แล้วค่อย lookup จาก Office collection
      // 🆕 ลำดับความสำคัญ: snapshot (officeName/office) → User Collection → Office collection lookup
      let finalOffice: string | undefined = undefined;
      
      // ✅ Priority 1: ใช้ snapshot จาก requesterInfo ก่อน (ข้อมูลที่ snapshot ไว้เมื่อลบสาขา)
      finalOffice = itemRequesterInfo?.officeName || itemRequesterInfo?.office || '';
      
      // ✅ Priority 2: ถ้าไม่มี snapshot ให้ใช้จาก mostRecentRequesterInfo (จาก RequestLog)
      if (!finalOffice) {
        finalOffice = mostRecentRequesterInfo?.office || '';
      }
      
      // ✅ Priority 3: ถ้าไม่มี snapshot เลย ให้ใช้จาก User Collection (สำหรับกรณีที่ยังไม่ snapshot)
      if (!finalOffice && user?.userType === 'branch') {
        finalOffice = user?.officeName || user?.office || '';
      }
      
      // ✅ Priority 4: ถ้ายังไม่มี ให้ lookup จาก Office collection (real-time)
      // แต่เฉพาะกรณีที่ officeId ไม่ใช่ UNSPECIFIED_OFFICE (เพื่อป้องกันการ lookup สาขาที่ถูกลบแล้ว)
      if (!finalOffice) {
        const itemOfficeId = itemRequesterInfo?.officeId;
        const userOfficeId = user?.officeId;
        const officeIdToLookup = itemOfficeId || userOfficeId;
        
        // ⚠️ สำคัญ: ไม่ lookup ถ้า officeId เป็น UNSPECIFIED_OFFICE (เพราะอาจเป็นสาขาที่ถูกลบแล้ว)
        if (officeIdToLookup && officeIdToLookup !== 'UNSPECIFIED_OFFICE' && officeMap.has(officeIdToLookup)) {
          finalOffice = officeMap.get(officeIdToLookup);
        }
      }
      
      // ✅ Priority 5: Fallback สุดท้าย
      if (!finalOffice) {
        finalOffice = 'ไม่ระบุสาขา';
      }
      
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
    
    const result = {
      items: populatedItems,
      totalCount: populatedItems.length
    };
    
    // Cache the result
    setCachedData(cacheKey, result);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Owned Equipment API - Fetched ${populatedItems.length} items (${Date.now() - startTime}ms)`);
    }
    
    return NextResponse.json(result);
    
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
        // ✅ เพิ่มข้อมูลผู้ใช้และสาขา
        // 🔧 เก็บ officeId แทน office string เพื่อให้เปลี่ยนชื่อสาขาได้
        // 🆕 บันทึก requesterInfo เสมอเพื่อเก็บ officeId (แม้ไม่กรอกข้อมูลส่วนตัว)
        requesterInfo: {
          // เก็บข้อมูลส่วนตัวเฉพาะเมื่อมีการกรอก
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(nickname && { nickname }),
          ...(department && { department }),
          ...(phone && { phone }),
          // ✅ เก็บ officeId และ officeName เสมอ (เพื่อ real-time lookup)
          ...(currentUser?.officeId && { officeId: currentUser.officeId }),
          ...(currentUser?.officeName && { officeName: currentUser.officeName })
        }
      };
      
      // 🔍 Debug: Log requesterInfo before saving
      console.log('\n🔍 ========== POST /api/user/owned-equipment ==========');
      console.log('🔍 Step 1: Current User Data:');
      console.log('   user_id:', currentUser?.user_id);
      console.log('   userType:', currentUser?.userType);
      console.log('   officeId:', currentUser?.officeId);
      console.log('   officeName:', currentUser?.officeName);
      console.log('   office:', currentUser?.office);
      console.log('   has officeId?', !!currentUser?.officeId);
      console.log('   has officeName?', !!currentUser?.officeName);
      
      console.log('\n🔍 Step 2: Form Data:');
      console.log('   firstName:', firstName);
      console.log('   lastName:', lastName);
      console.log('   department:', department);
      
      console.log('\n🔍 Step 3: requesterInfo Object Created:');
      console.log('   requesterInfo:', JSON.stringify(itemData.requesterInfo, null, 2));
      console.log('   requesterInfo.officeId:', itemData.requesterInfo?.officeId);
      console.log('   requesterInfo.officeName:', itemData.requesterInfo?.officeName);
      console.log('🔍 ====================================================\n');
      
      const newItem = await createInventoryItem(itemData);
      createdItems.push(newItem);
    }
    
    // Clear owned equipment cache for this user
    const { clearAllCaches } = await import('@/lib/cache-utils');
    clearAllCaches(); // Clear all caches since user's owned equipment changed
    
    return NextResponse.json({
      message: `เพิ่มอุปกรณ์เรียบร้อยแล้ว ${quantity} ชิ้น`,
      createdItems: createdItems.length,
      itemIds: createdItems.map(item => String(item._id))
    });
    
  } catch (error) {
    console.error('Error adding owned equipment:', error);
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