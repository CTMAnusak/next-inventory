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
      category: category
    });

    // If not found and category is "ไม่ระบุ", try to find by itemName only
    if (!inventoryMaster && category === 'ไม่ระบุ') {
      console.log(`🔍 Exact match failed, trying to find by itemName only: ${itemName}`);
      inventoryMaster = await InventoryMaster.findOne({
        itemName: itemName
      });
      
      if (inventoryMaster) {
        console.log(`✅ Found InventoryMaster with different category: ${inventoryMaster.category}`);
      }
    }

    if (!inventoryMaster) {
      // Debug: Let's see what InventoryMaster records exist for this itemName
      const allItemRecords = await InventoryMaster.find({ itemName: itemName });
      console.log(`🔍 Debug: All InventoryMaster records for ${itemName}:`, 
        allItemRecords.map(r => ({ category: r.category, _id: r._id })));
      
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

    // หาอุปกรณ์ที่ว่างทั้งหมดสำหรับ itemName + category นี้ (ยกเว้นที่ถูกลบ)
    // Use the actual category from InventoryMaster that was found
    const actualCategory = inventoryMaster.category;
    console.log(`🔍 Using actual category from InventoryMaster: ${actualCategory}`);
    
    const availableItems = await InventoryItem.find({
      itemName: itemName,
      category: actualCategory, // Use the actual category from InventoryMaster
      'currentOwnership.ownerType': 'admin_stock',
      status: { $in: ['active', 'maintenance', 'damaged'] } // ยกเว้น 'retired' และ 'deleted'
    }).sort({ 
      serialNumber: 1,  // เรียงตาม SN ก่อน
      createdAt: 1      // แล้วเรียงตามวันที่สร้าง
    });

    console.log(`📦 Found ${availableItems.length} available InventoryItem records (excluding retired/deleted)`);

    // 🔍 Debug: Check ALL admin_stock items (regardless of status)
    const allAdminStockItems = await InventoryItem.find({
      itemName: itemName,
      category: actualCategory,
      'currentOwnership.ownerType': 'admin_stock',
      status: { $ne: 'deleted' } // ✅ Exclude soft-deleted items for accurate debugging
    });
    console.log(`🔍 Debug: Total admin_stock items (all status): ${allAdminStockItems.length}`);
    allAdminStockItems.forEach((item, index) => {
      console.log(`  ${index + 1}. Status: ${item.status}, SN: ${item.serialNumber || 'No SN'}, ID: ${item._id}`);
    });

    console.log(`⚠️  Data mismatch check: InventoryMaster.availableQuantity=${inventoryMaster.availableQuantity} vs InventoryItem.count=${availableItems.length}`);

    // ✅ Use InventoryMaster.availableQuantity as the source of truth (same as main inventory)
    const totalAvailable = inventoryMaster.availableQuantity;

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

    // จัดกลุ่มเป็น มี SN และ ไม่มี SN (will be updated after virtual items are added)
    let itemsWithSN = availableItems.filter(item => item.serialNumber);
    let itemsWithoutSN = availableItems.filter(item => !item.serialNumber);

    // ✅ Handle data mismatch case - Create virtual items if needed
    let actualAvailableItems = [...availableItems];
    if (availableItems.length !== totalAvailable) {
      console.log(`⚠️  WARNING: Data inconsistency detected!`);
      console.log(`📊 InventoryMaster.availableQuantity: ${totalAvailable}`);
      console.log(`📦 Actual InventoryItem count: ${availableItems.length}`);
      
      if (availableItems.length < totalAvailable) {
        const missingCount = totalAvailable - availableItems.length;
        console.log(`🔧 Creating ${missingCount} virtual items to match InventoryMaster count`);
        
        // Create virtual items to fill the gap
        for (let i = 0; i < missingCount; i++) {
          const virtualItem = {
            _id: `virtual_${itemName}_${category}_${i + 1}`,
            itemName: itemName,
            category: category,
            serialNumber: null,
            status: 'active',
            currentOwnership: {
              ownerType: 'admin_stock',
              ownedSince: new Date()
            },
            sourceInfo: {
              addedBy: 'system',
              dateAdded: new Date(),
              acquisitionMethod: 'virtual_placeholder'
            },
            isVirtual: true // Flag to identify virtual items
          };
          actualAvailableItems.push(virtualItem as any);
        }
        console.log(`✅ Total items after adding virtual: ${actualAvailableItems.length}`);
        
        // Re-group items after adding virtual items
        itemsWithSN = actualAvailableItems.filter(item => item.serialNumber);
        itemsWithoutSN = actualAvailableItems.filter(item => !item.serialNumber);
      }
    }

    console.log(`📊 Final response data:`, {
      totalAvailable: totalAvailable,
      withSerialNumberCount: itemsWithSN.length,
      withoutSerialNumberCount: itemsWithoutSN.length,
      totalItems: itemsWithSN.length + itemsWithoutSN.length
    });

    const response = {
      itemName,
      category,
      totalAvailable: totalAvailable,  // ✅ Use InventoryMaster as source of truth
      withSerialNumber: itemsWithSN.map(item => ({
        itemId: item._id,
        serialNumber: item.serialNumber,
        status: item.status,
        dateAdded: item.sourceInfo?.dateAdded || new Date(),
        addedBy: item.sourceInfo?.addedBy || 'system',
        isVirtual: item.isVirtual || false // ✅ Mark virtual items
      })),
      withoutSerialNumber: {
        count: Math.max(0, totalAvailable - itemsWithSN.length), // ✅ Calculate from InventoryMaster
        items: itemsWithoutSN.map(item => ({ // ✅ Show ALL items (including virtual)
          itemId: item._id,
          status: item.status,
          dateAdded: item.sourceInfo?.dateAdded || new Date(),
          addedBy: item.sourceInfo?.addedBy || 'system',
          isVirtual: item.isVirtual || false // ✅ Mark virtual items
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
