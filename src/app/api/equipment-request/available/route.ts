import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
// ItemMaster removed - using InventoryMaster directly
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';
import InventoryConfig from '@/models/InventoryConfig';
import RequestLog from '@/models/RequestLog';
import { authenticateUser } from '@/lib/auth-helpers';

// GET - ดึงรายการอุปกรณ์ที่สามารถเบิกได้
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const userId = searchParams.get('userId'); // ✅ เพิ่ม userId parameter
    
    // ✅ ตรวจสอบ authentication และ user (ถ้ามี userId)
    let currentUserId: string | null = null;
    if (userId) {
      const { error, user } = await authenticateUser(request);
      if (error) {
        // ถ้า authentication ล้มเหลว แต่ยังส่ง userId มา ให้ใช้ userId ที่ส่งมา (backward compatibility)
        currentUserId = userId;
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Authentication failed, using provided userId:', userId);
        }
      } else if (user) {
        currentUserId = user.user_id;
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Authenticated user:', { providedUserId: userId, actualUserId: user.user_id });
        }
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('ℹ️ No userId provided, skipping pending requests check');
      }
    }
    
    // Check cache first (เพิ่ม userId ใน cache key)
    // ✅ ตรวจสอบ cache-busting parameter เพื่อ bypass cache
    const cacheBuster = searchParams.get('_t');
    const forceRefresh = cacheBuster !== null; // ถ้ามี _t parameter ให้ bypass cache
    
    const { getCachedData, setCachedData } = await import('@/lib/cache-utils');
    const cacheKey = `equipment_available_${categoryId || 'all'}_${search || ''}_${page}_${limit}_${currentUserId || 'anonymous'}`;
    
    // ✅ Bypass cache ถ้ามี cache-busting parameter
    if (!forceRefresh) {
      const cached = getCachedData(cacheKey);
      if (cached) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Equipment Available API - Cache hit (${Date.now() - startTime}ms)`);
        }
        return NextResponse.json(cached);
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Equipment Available API - Force refresh (cache-busting parameter: ${cacheBuster})`);
      }
    }
    
    // Load configs to get "มี" (available) status and "ใช้งานได้" (working) condition (with cache)
    const { getCachedData: getConfigCache, setCachedData: setConfigCache } = await import('@/lib/cache-utils');
    const configCacheKey = 'inventory_config_all';
    let inventoryConfig = getConfigCache(configCacheKey);
    
    if (!inventoryConfig) {
      inventoryConfig = await InventoryConfig.findOne({})
        .select('statusConfigs conditionConfigs')
        .lean();
      if (inventoryConfig) {
        setConfigCache(configCacheKey, inventoryConfig);
      }
    }
    
    if (!inventoryConfig) {
      return NextResponse.json(
        { error: 'ไม่พบการตั้งค่าระบบ' },
        { status: 500 }
      );
    }

  // Find the "มี" status config (should be status_available)
  const availableStatus = inventoryConfig.statusConfigs?.find((s: any) => s.name === 'มี');
  const availableStatusId = availableStatus?.id || 'status_available';

  // Find the "ใช้งานได้" condition config (should be cond_working)
  const workingCondition = inventoryConfig.conditionConfigs?.find((c: any) => c.name === 'ใช้งานได้');
  const workingConditionId = workingCondition?.id || 'cond_working';
    
    // Build query for InventoryMaster (direct query - no ItemMaster needed)
    const query: any = {};
    
    if (categoryId) {
      query.categoryId = categoryId;
    }
    
    if (search) {
      query.itemName = { $regex: search, $options: 'i' };
    }
    
    // ✅ แก้ไข: ดึงอุปกรณ์ทั้งหมดในหมวดหมู่นี้ (รวมที่ availableQuantity = 0)
    // ไม่กรอง availableQuantity > 0 เพื่อให้แสดงอุปกรณ์ที่ไม่พร้อมเบิกด้วย
    
    // Get InventoryMasters directly with lean()
    const inventoryMasters = await InventoryMaster.find(query)
      .select('_id itemName categoryId totalQuantity itemDetails')
      .sort({ itemName: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    // ✅ Optimize: Batch query all items at once instead of N+1 queries
    const itemNames = inventoryMasters.map(m => m.itemName);
    const categoryIds = [...new Set(inventoryMasters.map(m => m.categoryId))];
    
    // Get all matching items in one query
    const allMatchingItems = await InventoryItem.find({
      itemName: { $in: itemNames },
      categoryId: { $in: categoryIds },
      'currentOwnership.ownerType': 'admin_stock',
      statusId: availableStatusId,
      conditionId: workingConditionId,
      deletedAt: { $exists: false }
    })
    .select('_id itemName categoryId serialNumber numberPhone statusId conditionId')
    .lean();
    
    // Group items by itemName+categoryId and count
    const itemsByMaster = new Map<string, { count: number; samples: typeof allMatchingItems }>();
    allMatchingItems.forEach(item => {
      const key = `${item.itemName}||${item.categoryId}`;
      if (!itemsByMaster.has(key)) {
        itemsByMaster.set(key, { count: 0, samples: [] });
      }
      const group = itemsByMaster.get(key)!;
      group.count++;
      if (group.samples.length < 3) {
        group.samples.push(item);
      }
    });
    
    // Build available items list
    const availableItems = [];
    
    for (const inventoryMaster of inventoryMasters) {
      const key = `${inventoryMaster.itemName}||${inventoryMaster.categoryId}`;
      const itemGroup = itemsByMaster.get(key) || { count: 0, samples: [] };
      const actualAvailableCount = itemGroup.count;
      const sampleItems = itemGroup.samples;
      
    availableItems.push({
      itemMasterId: String(inventoryMaster._id), // Legacy compatibility
      itemName: inventoryMaster.itemName,
      categoryId: inventoryMaster.categoryId,
      hasSerialNumber: (inventoryMaster.itemDetails.withSerialNumber as any)?.count > 0 || false,
        availableQuantity: actualAvailableCount, // ✅ ใช้จำนวนที่นับจากอุปกรณ์ที่กรองแล้ว (อาจเป็น 0)
        totalQuantity: inventoryMaster.totalQuantity,
        statusBreakdown: inventoryMaster.statusBreakdown,
        itemDetails: inventoryMaster.itemDetails,
        isAvailable: actualAvailableCount > 0, // ✅ เพิ่ม flag เพื่อบอกว่าพร้อมเบิกหรือไม่
        // Include some sample items for display
        sampleItems: sampleItems.map(item => ({
          id: item._id,
          serialNumber: item.serialNumber,
          numberPhone: item.numberPhone,
          statusId: item.statusId,
          conditionId: item.conditionId
        }))
      });
    }
    
    // ✅ ดึง pending requests ของทุกคน (ไม่ใช่แค่ผู้ใช้คนนี้)
    // เพื่อคำนวณจำนวนที่พร้อมเบิกจริงๆ (หัก pending ของทุกคนออก)
    const pendingRequestsMap = new Map<string, { quantity: number; userPendingQuantity: number; requestId: string }>();
    
    // ดึง pending requests ของทุกคน
    const allPendingRequests = await RequestLog.find({
      status: 'pending'
    })
    .select('items.masterId items.quantity userId _id')
    .lean();
    
    // สร้าง map ของ masterId -> pending quantity (รวมทุกคน)
    allPendingRequests.forEach((req: any) => {
      req.items?.forEach((item: any) => {
        // ✅ แปลง masterId เป็น string และ normalize (เอา whitespace ออก)
        const masterId = String(item.masterId || '').trim();
        if (!masterId) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Found item without masterId in pending request:', item);
          }
          return;
        }
        
        const existing = pendingRequestsMap.get(masterId);
        const itemQuantity = item.quantity || 0;
        const isCurrentUser = currentUserId && String(req.userId) === String(currentUserId);
        
        if (existing) {
          existing.quantity += itemQuantity;
          // ✅ เก็บจำนวนที่ผู้ใช้คนนี้เบิกไปด้วย (สำหรับแสดงข้อความ)
          if (isCurrentUser) {
            existing.userPendingQuantity += itemQuantity;
          }
        } else {
          pendingRequestsMap.set(masterId, {
            quantity: itemQuantity, // จำนวนรวมของทุกคน
            userPendingQuantity: isCurrentUser ? itemQuantity : 0, // จำนวนที่ผู้ใช้คนนี้เบิก
            requestId: String(req._id)
          });
        }
      });
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Found ${allPendingRequests.length} pending requests (all users)`);
      if (currentUserId) {
        const userPendingCount = allPendingRequests.filter((req: any) => String(req.userId) === String(currentUserId)).length;
        console.log(`🔍 User ${currentUserId} has ${userPendingCount} pending requests`);
      }
      console.log(`🔍 Pending requests map:`, Array.from(pendingRequestsMap.entries()).map(([k, v]) => ({ masterId: k, ...v })));
    }
    
    // ✅ เพิ่ม pending status ใน availableItems
    const availableItemsWithPending = availableItems.map((item: any) => {
      // ✅ แปลง itemMasterId เป็น string และ normalize (เอา whitespace ออก)
      const masterId = String(item.itemMasterId || '').trim();
      const pendingInfo = pendingRequestsMap.get(masterId);
      
      // ✅ คำนวณจำนวนที่พร้อมเบิกจริงๆ (หัก pending ของทุกคนออก)
      const totalPendingQuantity = pendingInfo?.quantity || 0; // จำนวนรวมที่ทุกคนเบิกไป (pending)
      const userPendingQuantity = pendingInfo?.userPendingQuantity || 0; // จำนวนที่ผู้ใช้คนนี้เบิกไป (pending)
      const availableAfterPending = Math.max(0, item.availableQuantity - totalPendingQuantity); // จำนวนที่พร้อมเบิกจริงๆ
      const hasUserPendingRequest = userPendingQuantity > 0; // ผู้ใช้คนนี้มี pending request หรือไม่
      
      if (process.env.NODE_ENV === 'development') {
        if (pendingInfo) {
          console.log(`✅ Matched pending request for ${item.itemName}:`, {
            masterId,
            totalPendingQuantity,
            userPendingQuantity,
            availableQuantity: item.availableQuantity,
            availableAfterPending
          });
        } else {
          // Debug: ตรวจสอบว่าทำไมไม่ match
          const allMasterIds = Array.from(pendingRequestsMap.keys());
          if (allMasterIds.length > 0) {
            console.log(`🔍 No match for ${item.itemName}:`, {
              itemMasterId: masterId,
              itemMasterIdType: typeof item.itemMasterId,
              allPendingMasterIds: allMasterIds,
              itemMasterIdInMap: pendingRequestsMap.has(masterId)
            });
          }
        }
      }
      
      return {
        ...item,
        hasPendingRequest: hasUserPendingRequest, // ✅ ใช้เฉพาะ pending ของผู้ใช้คนนี้ (สำหรับ disable การคลิก)
        pendingQuantity: userPendingQuantity, // ✅ จำนวนที่ผู้ใช้คนนี้เบิกไป (สำหรับแสดงข้อความ)
        totalPendingQuantity, // ✅ จำนวนรวมที่ทุกคนเบิกไป (สำหรับคำนวณพร้อมเบิก)
        availableAfterPending, // ✅ จำนวนที่พร้อมเบิกจริงๆ (หัก pending ของทุกคนออก)
        pendingRequestId: pendingInfo?.requestId || null
      };
    });
    
    // Get total count for pagination
    const totalCount = await InventoryMaster.countDocuments(query);
    
    const result = {
      availableItems: availableItemsWithPending,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
    
    // Cache the result
    setCachedData(cacheKey, result);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Equipment Available API - Fetched ${availableItems.length} items (${Date.now() - startTime}ms)`);
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error fetching available equipment:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์' },
      { status: 500 }
    );
  }
}
