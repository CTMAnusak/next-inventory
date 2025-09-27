import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import { verifyTokenFromRequest } from '@/lib/auth';

// Force Node.js runtime for database operations
export const runtime = 'nodejs';

// GET - ดึงรายการอุปกรณ์ที่ว่างสำหรับการเลือก
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Available Items API called');
    console.log('📋 Request URL:', request.url);
    console.log('🍪 Request cookies:', request.headers.get('cookie'));
    
    await dbConnect();

    // Verify admin authentication
    const payload = verifyTokenFromRequest(request);
    console.log('👤 Auth payload:', payload ? 'Valid' : 'Invalid');
    
    if (!payload) {
      console.log('❌ Authentication failed - no valid token');
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    
    console.log('✅ Authentication successful:', payload.userId, payload.userRole);

    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get('itemName');
    const category = searchParams.get('category');

    console.log('📝 Request params:', { itemName, category });

    if (!itemName || !category) {
      console.log('❌ Missing required params');
      return NextResponse.json(
        { error: 'กรุณาระบุ itemName และ category' },
        { status: 400 }
      );
    }

    console.log(`🔍 Finding available items for: ${itemName} (${category})`);

    // ✅ First check InventoryMaster to get consistent count (same as main inventory)
    // Try exact match first, then fuzzy match for category
    let inventoryMaster = await InventoryMaster.findOne({
      itemName: itemName,
      categoryId: category
    });

    // If not found and category is "ไม่ระบุ", try to find by itemName only
    if (!inventoryMaster && category === 'ไม่ระบุ') {
      console.log(`🔍 Exact match failed, trying to find by itemName only: ${itemName}`);
      inventoryMaster = await InventoryMaster.findOne({
        itemName: itemName
      });
      
      if (inventoryMaster) {
        console.log(`✅ Found InventoryMaster with different categoryId: ${inventoryMaster.categoryId}`);
      }
    }

    if (!inventoryMaster) {
      // Debug: Let's see what InventoryMaster records exist for this itemName
      const allItemRecords = await InventoryMaster.find({ itemName: itemName });
      console.log(`🔍 Debug: All InventoryMaster records for ${itemName}:`, 
        allItemRecords.map(r => ({ categoryId: r.categoryId, _id: r._id })));
      
      return NextResponse.json(
        { error: `ไม่พบข้อมูลอุปกรณ์ ${itemName} ในหมวดหมู่ ${category}` },
        { status: 404 }
      );
    }

    console.log(`📊 InventoryMaster data:`, {
      totalQuantity: inventoryMaster.totalQuantity,
      availableQuantity: inventoryMaster.availableQuantity,
      userOwnedQuantity: inventoryMaster.userOwnedQuantity
    });

    // หาอุปกรณ์ที่ว่างทั้งหมดสำหรับ itemName + categoryId นี้ (ยกเว้นที่ถูกลบ)
    // Use the actual categoryId from InventoryMaster that was found
    const actualCategoryId = inventoryMaster.categoryId;
    console.log(`🔍 Using actual categoryId from InventoryMaster: ${actualCategoryId}`);
    console.log(`🔍 Searching for items with:`, {
      itemName: itemName,
      categoryId: actualCategoryId,
      ownerType: 'admin_stock',
      statusId: ['status_available', 'status_maintenance', 'status_damaged']
    });
    
    const availableItems = await InventoryItem.find({
      itemName: itemName,
      categoryId: actualCategoryId, // Use the actual categoryId from InventoryMaster
      'currentOwnership.ownerType': 'admin_stock',
      statusId: { $in: ['status_available', 'status_maintenance', 'status_damaged'] }, // ใช้ statusId แทน status
      deletedAt: { $exists: false } // ยกเว้นรายการที่ถูกลบ
    }).sort({ 
      serialNumber: 1,  // เรียงตาม SN ก่อน
      createdAt: 1      // แล้วเรียงตามวันที่สร้าง
    });

    console.log(`🔍 Debug: Raw availableItems from DB:`, availableItems.map(item => ({
      _id: item._id,
      itemName: item.itemName,
      serialNumber: item.serialNumber,
      numberPhone: item.numberPhone,
      status: item.status,
      currentOwnership: item.currentOwnership
    })));

    console.log(`📦 Found ${availableItems.length} available InventoryItem records (excluding retired/deleted)`);

    // 🔍 Debug: Check ALL admin_stock items (regardless of status)
    const allAdminStockItems = await InventoryItem.find({
      itemName: itemName,
      categoryId: actualCategoryId,
      'currentOwnership.ownerType': 'admin_stock',
      status: { $ne: 'deleted' } // ✅ Exclude soft-deleted items for accurate debugging
    });
    console.log(`🔍 Debug: Total admin_stock items (all status): ${allAdminStockItems.length}`);
    allAdminStockItems.forEach((item, index) => {
      console.log(`  ${index + 1}. Status: ${item.status}, SN: ${item.serialNumber || 'No SN'}, ID: ${item._id}`);
    });

    console.log(`⚠️  Data mismatch check: InventoryMaster.availableQuantity=${inventoryMaster.availableQuantity} vs InventoryItem.count=${availableItems.length}`);

    // 🔧 FIX: ถ้าข้อมูลไม่ตรงกัน ให้ sync InventoryMaster ก่อน
    if (inventoryMaster.availableQuantity !== availableItems.length) {
      console.log(`🔄 Syncing InventoryMaster data due to mismatch...`);
      try {
        const { updateInventoryMaster } = require('@/lib/inventory-helpers');
        await updateInventoryMaster(itemName, actualCategoryId);
        
        // Refresh InventoryMaster data after sync
        inventoryMaster = await InventoryMaster.findOne({
          itemName: itemName,
          categoryId: actualCategoryId
        });
        console.log(`✅ InventoryMaster synced. New availableQuantity: ${inventoryMaster?.availableQuantity}`);
      } catch (syncError) {
        console.error(`❌ Failed to sync InventoryMaster:`, syncError);
      }
    }

    // ✅ Use actual InventoryItem count as the source of truth (more accurate)
    const totalAvailable = availableItems.length;

    if (totalAvailable === 0) {
      return NextResponse.json({
        itemName,
        category,
        totalAvailable: 0,
        withSerialNumber: [],
        withoutSerialNumber: {
          count: 0,
          items: [],
          hasMore: false
        }
      });
    }

    // จัดกลุ่มเป็น มี SN, ไม่มี SN, และมี Phone Number (will be updated after virtual items are added)
    console.log(`🔍 Debug: All availableItems:`, availableItems.map(item => ({
      _id: item._id,
      serialNumber: item.serialNumber,
      numberPhone: item.numberPhone,
      statusId: item.statusId
    })));
    
    let itemsWithSN = availableItems.filter(item => item.serialNumber && item.serialNumber.trim() !== '');
    console.log(`🔍 Debug: itemsWithSN after filter:`, itemsWithSN.map(item => ({
      _id: item._id,
      serialNumber: item.serialNumber,
      statusId: item.statusId
    })));
    
    let itemsWithoutSN = availableItems.filter(item => (!item.serialNumber || item.serialNumber.trim() === '') && !item.numberPhone);
    let itemsWithPhoneNumber = availableItems.filter(item => item.numberPhone);

    // ✅ No need for virtual items - use actual data from database
    const actualAvailableItems = [...availableItems];

    console.log(`📊 Final response data:`, {
      totalAvailable: totalAvailable,
      withSerialNumberCount: itemsWithSN.length,
      withoutSerialNumberCount: itemsWithoutSN.length,
      withPhoneNumberCount: itemsWithPhoneNumber.length,
      totalItems: itemsWithSN.length + itemsWithoutSN.length + itemsWithPhoneNumber.length
    });

    const response = {
      itemName,
      category,
      totalAvailable: totalAvailable,  // ✅ Use InventoryMaster as source of truth
      withSerialNumber: itemsWithSN.map(item => ({
        itemId: item._id,
        serialNumber: item.serialNumber,
        statusId: item.statusId,
        conditionId: item.conditionId,
        dateAdded: item.sourceInfo?.dateAdded || new Date(),
        addedBy: item.sourceInfo?.addedBy || 'system'
      })),
      withPhoneNumber: itemsWithPhoneNumber.map(item => ({
        itemId: item._id,
        numberPhone: item.numberPhone,
        statusId: item.statusId,
        conditionId: item.conditionId,
        dateAdded: item.sourceInfo?.dateAdded || new Date(),
        addedBy: item.sourceInfo?.addedBy || 'system'
      })),
      withoutSerialNumber: {
        count: itemsWithoutSN.length, // ✅ Use actual count of items without SN
        items: itemsWithoutSN.map(item => ({ // ✅ Show actual items only
          itemId: item._id,
          statusId: item.statusId,
          conditionId: item.conditionId,
          dateAdded: item.sourceInfo?.dateAdded || new Date(),
          addedBy: item.sourceInfo?.addedBy || 'system'
        })),
        hasMore: false // ✅ No pagination needed since we show all items
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching available items:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
