import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryConfig from '@/models/InventoryConfig';
import { verifyToken } from '@/lib/auth';

/**
 * GET /api/user/available-from-stock
 * 
 * ดึงรายการอุปกรณ์ทั้งหมดในหมวดหมู่สำหรับเพิ่มอุปกรณ์ที่มี (Dashboard)
 * 
 * NOTE: API นี้แสดงอุปกรณ์ทั้งหมดที่มีในระบบ (จาก InventoryMaster)
 * ไม่ว่าจะเหลือในคลังหรือไม่ก็ตาม เพราะผู้ใช้กำลังบันทึกอุปกรณ์ที่ตัวเองมีอยู่แล้ว
 * ไม่ใช่การเบิกจากคลัง
 * 
 * สำหรับอุปกรณ์ที่มีในคลัง (admin_stock) จะแนบข้อมูลตัวอย่าง (sampleItem)
 * ที่มีสถานะ "มี" และสภาพ "ใช้งานได้" เพื่อให้ผู้ใช้สามารถเลือกได้สะดวก
 * 
 * Query Parameters:
 * - categoryId: หมวดหมู่อุปกรณ์ (required)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    await dbConnect();
    
    // Verify user authentication
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    
    if (!categoryId) {
      return NextResponse.json(
        { error: 'กรุณาระบุหมวดหมู่' },
        { status: 400 }
      );
    }
    
    // Check cache first
    const { getCachedData, setCachedData } = await import('@/lib/cache-utils');
    const cacheKey = `available_from_stock_${categoryId}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Available From Stock API - Cache hit (${Date.now() - startTime}ms)`);
      }
      return NextResponse.json(cached);
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
    
    // ✅ Get ALL InventoryMasters in this category (ไม่กรอง availableQuantity)
    // เพราะผู้ใช้กำลังบันทึกอุปกรณ์ที่ตัวเองมี ไม่ใช่การเบิกจากคลัง
    const inventoryMasters = await InventoryMaster.find({
      categoryId: categoryId
    })
    .select('itemName categoryId')
    .sort({ itemName: 1 })
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
    
    // Group items by itemName+categoryId
    const itemsByMaster = new Map<string, typeof allMatchingItems>();
    allMatchingItems.forEach(item => {
      const key = `${item.itemName}||${item.categoryId}`;
      if (!itemsByMaster.has(key)) {
        itemsByMaster.set(key, []);
      }
      itemsByMaster.get(key)!.push(item);
    });
    
    // For each InventoryMaster, try to get sample item from admin_stock (if available)
    const availableItems: {
      itemName: string;
      availableCount: number;
      sampleItem: {
        itemId: string;
        statusId: string;
        statusName: string;
        conditionId: string;
        conditionName: string;
        serialNumber?: string;
        numberPhone?: string;
      } | null;
    }[] = [];
    
    for (const inventoryMaster of inventoryMasters) {
      const key = `${inventoryMaster.itemName}||${inventoryMaster.categoryId}`;
      const matchingItems = itemsByMaster.get(key) || [];
      const count = matchingItems.length;
      const sampleItem = matchingItems[0] || null;
      
      // ✅ แสดงอุปกรณ์ทั้งหมด ไม่ว่าจะมี sampleItem หรือไม่
      availableItems.push({
        itemName: inventoryMaster.itemName,
        availableCount: count,
        sampleItem: sampleItem ? {
          itemId: String(sampleItem._id),
          statusId: sampleItem.statusId || availableStatusId,
          statusName: availableStatus?.name || 'มี',
          conditionId: sampleItem.conditionId || workingConditionId,
          conditionName: workingCondition?.name || 'ใช้งานได้',
          serialNumber: sampleItem.serialNumber,
          numberPhone: sampleItem.numberPhone
        } : null
      });
    }
    
    const result = {
      categoryId,
      availableItems,
      filters: {
        statusId: availableStatusId,
        statusName: availableStatus?.name || 'มี',
        conditionId: workingConditionId,
        conditionName: workingCondition?.name || 'ใช้งานได้'
      }
    };
    
    // Cache the result
    setCachedData(cacheKey, result);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Available From Stock API - Found ${availableItems.length} items (${Date.now() - startTime}ms)`);
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error fetching available stock items:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}

