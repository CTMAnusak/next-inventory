import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryConfig from '@/models/InventoryConfig';
import { verifyTokenFromRequest } from '@/lib/auth';

// Force Node.js runtime for database operations
export const runtime = 'nodejs';

// GET - ดึงรายการอุปกรณ์ที่ว่างสำหรับการเลือก
export async function GET(request: NextRequest) {
  try {
    
    await dbConnect();

    // Verify admin authentication
    const payload = verifyTokenFromRequest(request);
    
    if (!payload) {
      console.log('❌ Authentication failed - no valid token');
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    

    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get('itemName');
    const category = searchParams.get('category');


    if (!itemName || !category) {
      console.log('❌ Missing required params');
      return NextResponse.json(
        { error: 'กรุณาระบุ itemName และ category' },
        { status: 400 }
      );
    }


    // ✅ First load configs to get valid statusIds and conditionIds
    const inventoryConfig = await InventoryConfig.findOne({});
    if (!inventoryConfig) {
      return NextResponse.json(
        { error: 'ไม่พบการตั้งค่าระบบ' },
        { status: 500 }
      );
    }

    // ✅ หาสถานะ "มี" และสภาพ "ใช้งานได้" จาก config
    const availableStatus = inventoryConfig.statusConfigs?.find(s => s.name === 'มี');
    const availableStatusId = availableStatus?.id || 'status_available';
    
    const workingCondition = inventoryConfig.conditionConfigs?.find(c => c.name === 'ใช้งานได้');
    const workingConditionId = workingCondition?.id || 'cond_working';

    console.log('✅ Equipment Reports Filter:', {
      availableStatusId,
      workingConditionId,
      availableStatusName: availableStatus?.name,
      workingConditionName: workingCondition?.name
    });

    // ✅ Convert category NAME to category ID
    // category parameter can be either ID (cat_xxx) or NAME (Monitor, Notebook, etc.)
    let categoryId = category;
    
    // Check if category is a name (not an ID)
    if (!category.startsWith('cat_')) {
      // Find category ID from name
      const categoryConfig = inventoryConfig.categoryConfigs?.find(c => c.name === category);
      if (categoryConfig) {
        categoryId = categoryConfig.id;
        console.log(`✅ Converted category name "${category}" to ID "${categoryId}"`);
      } else {
        console.log(`⚠️ Category name "${category}" not found in config, using as-is`);
      }
    }

    // ✅ Second check InventoryMaster to get consistent count (same as main inventory)
    // Try exact match first, then fuzzy match for category
    let inventoryMaster = await InventoryMaster.findOne({
      itemName: itemName,
      categoryId: categoryId
    });

    // If not found and category is "ไม่ระบุ", try to find by itemName only
    if (!inventoryMaster && (category === 'ไม่ระบุ' || categoryId === 'ไม่ระบุ')) {
      inventoryMaster = await InventoryMaster.findOne({
        itemName: itemName
      });
      
      if (inventoryMaster) {
        console.log(`✅ Found inventoryMaster by itemName only (category was "ไม่ระบุ")`);
      }
    }

    if (!inventoryMaster) {
      // Debug: Let's see what InventoryMaster records exist for this itemName
      const allItemRecords = await InventoryMaster.find({ itemName: itemName });
      console.log(`❌ No InventoryMaster found for itemName="${itemName}" categoryId="${categoryId}"`);
      console.log(`📋 Available InventoryMaster records for this itemName:`, allItemRecords.map(r => ({
        itemName: r.itemName,
        categoryId: r.categoryId,
        category: inventoryConfig.categoryConfigs?.find(c => c.id === r.categoryId)?.name
      })));
      
      return NextResponse.json(
        { error: `ไม่พบข้อมูลอุปกรณ์ ${itemName} ในหมวดหมู่ ${category}` },
        { status: 404 }
      );
    }

    // หาอุปกรณ์ที่ว่างทั้งหมดสำหรับ itemName + categoryId นี้ (ยกเว้นที่ถูกลบ)
    // Use the actual categoryId from InventoryMaster that was found
    const actualCategoryId = inventoryMaster.categoryId;
    console.log('🔍 Searching for available items:', {
      itemName: itemName,
      categoryId: actualCategoryId,
      ownerType: 'admin_stock',
      statusId: availableStatusId,
      conditionId: workingConditionId
    });
    
    // ✅ กรองเฉพาะสถานะ "มี" และสภาพ "ใช้งานได้" เท่านั้น
    const availableItems = await InventoryItem.find({
      itemName: itemName,
      categoryId: actualCategoryId, // Use the actual categoryId from InventoryMaster
      'currentOwnership.ownerType': 'admin_stock',
      statusId: availableStatusId, // ✅ เฉพาะสถานะ "มี"
      conditionId: workingConditionId, // ✅ เฉพาะสภาพ "ใช้งานได้"
      deletedAt: { $exists: false } // ยกเว้นรายการที่ถูกลบ
    }).sort({ 
      serialNumber: 1,  // เรียงตาม SN ก่อน
      createdAt: 1      // แล้วเรียงตามวันที่สร้าง
    });

    console.log('📋 Available items found:', availableItems.map(item => ({
      _id: item._id,
      itemName: item.itemName,
      serialNumber: item.serialNumber,
      numberPhone: item.numberPhone,
      status: item.status,
      statusId: item.statusId,
      conditionId: item.conditionId,
      hasConditionId: !!item.conditionId,
      hasStatusId: !!item.statusId,
      currentOwnership: item.currentOwnership
    })));
    
    // 🔍 Debug specific fields for first item with SN
    const firstSNItem = availableItems.find(item => item.serialNumber);
    if (firstSNItem) {
      console.log('🔍 First item with SN details:', {
        serialNumber: firstSNItem.serialNumber,
        statusId: firstSNItem.statusId,
        conditionId: firstSNItem.conditionId,
        rawStatusId: JSON.stringify(firstSNItem.statusId),
        rawConditionId: JSON.stringify(firstSNItem.conditionId)
      });
    }


    // 🔍 Debug: Check ALL admin_stock items (regardless of status)
    const allAdminStockItems = await InventoryItem.find({
      itemName: itemName,
      categoryId: actualCategoryId,
      'currentOwnership.ownerType': 'admin_stock',
      status: { $ne: 'deleted' } // ✅ Exclude soft-deleted items for accurate debugging
    });
    allAdminStockItems.forEach((item, index) => {
      console.log(`  ${index + 1}. Status: ${item.status}, StatusId: ${item.statusId}, ConditionId: ${item.conditionId}, SN: ${item.serialNumber || 'No SN'}, ID: ${item._id}`);
    });
    
    // Debug: Check if conditionId is missing from available items
    availableItems.forEach((item, index) => {
      if (!item.conditionId) {
      }
    });


    // 🔧 FIX: ถ้าข้อมูลไม่ตรงกัน ให้ sync InventoryMaster ก่อน
    if (inventoryMaster.availableQuantity !== availableItems.length) {
      try {
        const { updateInventoryMaster } = require('@/lib/inventory-helpers');
        await updateInventoryMaster(itemName, actualCategoryId);
        
        // Refresh InventoryMaster data after sync
        inventoryMaster = await InventoryMaster.findOne({
          itemName: itemName,
          categoryId: actualCategoryId
        });
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

    // จัดกลุ่มเป็น มี SN, ไม่มี SN, และมี Phone Number
    const itemsWithSN = availableItems.filter(item => 
      (item.serialNumber && item.serialNumber.trim() !== '') || (item.numberPhone && item.numberPhone.trim() !== '')
    );
    
    const itemsWithoutSN = availableItems.filter(item => 
      (!item.serialNumber || item.serialNumber.trim() === '') && 
      (!item.numberPhone || item.numberPhone.trim() === '')
    );

    console.log('📊 Available items summary:', {
      totalAvailable: availableItems.length,
      withSerialNumberCount: itemsWithSN.length,
      withoutSerialNumberCount: itemsWithoutSN.length,
      withPhoneNumberCount: availableItems.filter(item => item.numberPhone && item.numberPhone.trim() !== '').length,
      totalItems: availableItems.length
    });

    // ✅ Get default values from first config entries (fallback)
    const defaultStatusId = inventoryConfig.statusConfigs?.[0]?.id || 'status_available';
    const defaultConditionId = inventoryConfig.conditionConfigs?.[0]?.id || 'cond_working';

    const response = {
      itemName,
      category,
      totalAvailable: availableItems.length,
      // ✅ Include configs in response for client-side ID to name mapping
      configs: {
        statusConfigs: inventoryConfig.statusConfigs?.map(s => ({
          id: s.id,
          name: s.name,
          order: s.order
        })) || [],
        conditionConfigs: inventoryConfig.conditionConfigs?.map(c => ({
          id: c.id,
          name: c.name,
          order: c.order
        })) || [],
        categoryConfigs: inventoryConfig.categoryConfigs?.map(cat => ({
          id: cat.id,
          name: cat.name,
          order: cat.order
        })) || []
      },
      withSerialNumber: itemsWithSN.map(item => ({
        itemId: item._id,
        serialNumber: item.serialNumber,
        numberPhone: item.numberPhone,
        statusId: item.statusId || defaultStatusId,
        conditionId: item.conditionId || defaultConditionId,
        dateAdded: item.sourceInfo?.dateAdded || new Date(),
        addedBy: item.sourceInfo?.addedBy || 'system'
      })),
      withoutSerialNumber: {
        count: itemsWithoutSN.length,
        items: itemsWithoutSN.map(item => ({
          itemId: item._id,
          statusId: item.statusId || defaultStatusId,
          conditionId: item.conditionId || defaultConditionId,
          dateAdded: item.sourceInfo?.dateAdded || new Date(),
          addedBy: item.sourceInfo?.addedBy || 'system'
        })),
        hasMore: false
      },
      withPhoneNumber: availableItems.filter(item => item.numberPhone && item.numberPhone.trim() !== '').map(item => ({
        itemId: item._id,
        numberPhone: item.numberPhone,
        statusId: item.statusId || defaultStatusId,
        conditionId: item.conditionId || defaultConditionId,
        dateAdded: item.sourceInfo?.dateAdded || new Date(),
        addedBy: item.sourceInfo?.addedBy || 'system'
      }))
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