import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import { createInventoryItem } from '@/lib/inventory-helpers';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import { clearAllCaches } from '@/lib/cache-utils';
import { getCachedData, setCachedData } from '@/lib/cache-utils';
import TransferLog from '@/models/TransferLog';
import { moveToRecycleBin } from '@/lib/recycle-bin-helpers';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';

// GET - Fetch aggregated inventory items (grouped by itemName)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const forceRefresh = searchParams.get('forceRefresh') === 'true';
    
    // Cache key based on query params
    const cacheKey = `inventory_${page}_${limit}_${search}_${category}`;
    
    // Only clear cache if forceRefresh is requested
    if (forceRefresh) {
      clearAllCaches();
    }
    
    // Check cache first
    const cached = getCachedData(cacheKey);
    if (cached && !forceRefresh) {
      return NextResponse.json(cached);
    }
    
    // Build query filter
    // 🔧 CRITICAL FIX: แสดงทุกรายการที่มี relatedItemIds (ไม่กรองออกแม้จะมีจำนวน 0)
    // เพื่อป้องกันการหายของอุปกรณ์เมื่อ totalQuantity = 0
    const queryFilter: any = {
      relatedItemIds: { $exists: true, $ne: [] }
    };
    
    // Add search filter
    if (search) {
      queryFilter.itemName = { $regex: search, $options: 'i' };
    }
    
    // Add category filter
    if (category) {
      queryFilter.categoryId = category;
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const totalCount = await InventoryMaster.countDocuments(queryFilter);
    
    // Get paginated InventoryMaster items with optimized query
    const allItems = await InventoryMaster.find(queryFilter)
      .select('_id itemName categoryId totalQuantity availableQuantity userOwnedQuantity lastUpdated itemDetails') // Only select needed fields
      .sort({ lastUpdated: -1 }) // Sort by newest first
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean() for better performance
    
    // Convert InventoryMaster to expected format
    const aggregatedItems = allItems.map(item => ({
      _id: item._id,
      itemName: item.itemName,
      categoryId: item.categoryId,
      totalQuantity: item.totalQuantity,
      quantity: item.totalQuantity, // 🔧 CRITICAL FIX: แสดงจำนวนทั้งหมด ไม่ใช่เฉพาะที่เบิกได้
      availableQuantity: item.availableQuantity, // จำนวนที่พร้อมเบิก (available + working)
      serialNumbers: [], // จะต้องดึงจาก InventoryItem ถ้าต้องการ
      dateAdded: item.lastUpdated,
      status: 'active', // Default status
      hasSerialNumber: (item.itemDetails.withSerialNumber as any)?.count > 0 || false,
      userOwnedQuantity: item.userOwnedQuantity
    }));
    
    const result = {
      items: aggregatedItems,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1
      }
    };
    
    // Cache the result for 30 seconds
    setCachedData(cacheKey, result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}

// POST - Create new inventory item using new system
export async function POST(request: NextRequest) {
  
  try {
    await dbConnect();
    
    const body = await request.json();
    
    const { itemName, category, categoryId, quantity, totalQuantity, serialNumber, numberPhone, status, condition, statusId, conditionId } = body;
    
    // Get user info from token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!itemName || (!category && !categoryId) || quantity <= 0) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }
    
    // ใช้ categoryId เป็นหลัก แต่ถ้าไม่มีให้ใช้ category name
    const finalCategoryId = categoryId || category;

    // Check for duplicate serial number or phone number if provided
    // ✅ FIX: Allow duplicate serial numbers across different item names
    // ตรวจสอบ SN ซ้ำเฉพาะในอุปกรณ์ชื่อเดียวกัน + หมวดหมู่เดียวกัน
    if (serialNumber) {
      const existingItem = await InventoryItem.findOne({ 
        serialNumber: serialNumber,
        itemName: itemName,          // ✅ ต้องเป็นชื่ออุปกรณ์เดียวกัน
        categoryId: finalCategoryId, // ✅ และหมวดหมู่เดียวกัน
        deletedAt: { $exists: false } // ✅ Exclude soft-deleted items
      });
      if (existingItem) {
        return NextResponse.json(
          { error: `Serial Number นี้มีอยู่แล้วสำหรับอุปกรณ์ "${itemName}"` },
          { status: 400 }
        );
      }
    }
    
    // Check for duplicate phone number for all categories that use phone numbers
    // ✅ FIX: เบอร์โทรศัพท์ต้องไม่ซ้ำในทุกหมวดหมู่ (ไม่ว่าจะเป็นซิมการ์ดชื่ออะไร)
    if (numberPhone) {
      // Check if phone number already exists in ALL inventory items
      const existingItem = await InventoryItem.findOne({ 
        numberPhone: numberPhone,
        deletedAt: { $exists: false } // ✅ Exclude soft-deleted items
      });
      if (existingItem) {
        return NextResponse.json(
          { error: `เบอร์โทรศัพท์นี้มีอยู่ในระบบแล้ว (อุปกรณ์: ${existingItem.itemName})` },
          { status: 400 }
        );
      }

      // ✅ Cross-validation: Check if phone number exists in User collection
      const existingUser = await User.findOne({ 
        phone: numberPhone,
        $or: [
          { deletedAt: { $exists: false } }, // Users without deletedAt field
          { deletedAt: null } // Users with deletedAt: null
        ]
      });
      if (existingUser) {
        return NextResponse.json(
          { error: `เบอร์โทรศัพท์นี้ถูกใช้โดยผู้ใช้: ${existingUser.firstName || ''} ${existingUser.lastName || ''} (${existingUser.office || ''})` },
          { status: 400 }
        );
      }
    }

    // Get user info from database
    const currentUser = await User.findOne({ user_id: payload.userId });
    if (!currentUser) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลผู้ใช้' },
        { status: 401 }
      );
    }

    // Create items using new inventory system
    const itemsToCreate = [];
    
    if (serialNumber || numberPhone) {
      // Create single item with serial number or phone number
      itemsToCreate.push({
        itemName,
        categoryId: finalCategoryId, // ใช้ categoryId แทน category
        serialNumber: serialNumber || undefined,
        numberPhone: numberPhone || undefined,
        statusId: statusId || status || 'status_available',
        conditionId: conditionId || condition,
        addedBy: 'admin' as const,
        initialOwnerType: 'admin_stock' as const,
        notes: `Added by admin via inventory management${numberPhone ? ' (SIM card)' : ''}`
      });
    } else {
      // Create multiple items without serial numbers or phone numbers
      const actualQuantity = quantity || 1;
      for (let i = 0; i < actualQuantity; i++) {
        itemsToCreate.push({
          itemName,
          categoryId: finalCategoryId, // ใช้ categoryId แทน category
          statusId: statusId || status || 'status_available',
          conditionId: conditionId || condition,
          addedBy: 'admin' as const,
          initialOwnerType: 'admin_stock' as const,
          notes: `Added by admin via inventory management (${i + 1}/${actualQuantity})`
        });
      }
    }
    

    // Create all items
    const createdItems = [];
    for (const itemToCreate of itemsToCreate) {
      const newItem = await createInventoryItem(itemToCreate);
      createdItems.push(newItem);
    }
    
    // Force sync InventoryMaster to ensure data consistency
    if (createdItems.length > 0) {
      try {
        const { updateInventoryMaster } = await import('@/lib/inventory-helpers');
        await updateInventoryMaster(itemName, finalCategoryId);
      } catch (syncError) {
        console.error('❌ InventoryMaster force sync failed:', syncError);
      }
    }
    
    // Clear all caches to ensure fresh data
    clearAllCaches();
    
    return NextResponse.json({
      message: `เพิ่ม ${createdItems.length} รายการเรียบร้อยแล้ว`,
      items: createdItems,
      summary: {
        itemName,
        categoryId: finalCategoryId, // ส่ง categoryId แทน category
        quantity: createdItems.length,
        withSerialNumber: createdItems.filter(item => item.serialNumber).length,
        withoutSerialNumber: createdItems.filter(item => !item.serialNumber).length
      }
    }, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating inventory item:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    
    // Handle enhanced validation errors
    if (error instanceof Error) {
      // Handle Item Name validation errors (recycle bin)
      if (error.message.includes('เพิ่มรายการไม่ได้เพราะชื่อซ้ำกับในถังขยะ')) {
        return NextResponse.json(
          { 
            error: error.message,
            errorType: 'RECYCLE_BIN_ITEM_NAME_EXISTS',
            showRecycleBinLink: true
          },
          { status: 400 }
        );
      }
      
      if (error.message.startsWith('ACTIVE_SN_EXISTS:')) {
        const message = error.message.replace('ACTIVE_SN_EXISTS:', '');
        return NextResponse.json(
          { error: message },
          { status: 400 }
        );
      }
      
      if (error.message.startsWith('RECYCLE_SN_EXISTS:')) {
        const message = error.message.replace('RECYCLE_SN_EXISTS:', '');
        return NextResponse.json(
          { 
            error: `${message} - รายการนี้อยู่ในถังขยะ กรุณากู้คืนจากถังขยะก่อนใช้งาน`,
            errorType: 'RECYCLE_BIN_EXISTS',
            showRecycleBinLink: true
          },
          { status: 400 }
        );
      }
      
      if (error.message.startsWith('ACTIVE_PHONE_EXISTS:')) {
        const message = error.message.replace('ACTIVE_PHONE_EXISTS:', '');
        return NextResponse.json(
          { error: message },
          { status: 400 }
        );
      }
      
      if (error.message.startsWith('RECYCLE_PHONE_EXISTS:')) {
        const message = error.message.replace('RECYCLE_PHONE_EXISTS:', '');
        return NextResponse.json(
          { 
            error: `${message} - รายการนี้อยู่ในถังขยะ กรุณากู้คืนจากถังขยะก่อนใช้งาน`,
            errorType: 'RECYCLE_BIN_EXISTS',
            showRecycleBinLink: true
          },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้างรายการ' },
      { status: 500 }
    );
  }
}

// DELETE - Delete entire item category with all related data
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { itemName, category, deleteAll, reason } = body;
    
    // Get user info from token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Get user info and check admin permissions
    const currentUser = await User.findOne({ user_id: payload.userId });
    if (!currentUser || !['admin', 'it_admin'].includes(currentUser.userRole)) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์ในการลบรายการ' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!itemName || !category || !reason) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    // Find all items to delete
    const itemsToDelete = await InventoryItem.find({ itemName, categoryId: category });
    
    if (itemsToDelete.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบรายการที่ต้องการลบ' },
        { status: 404 }
      );
    }

    // 🆕 Find InventoryMaster for the group
    const inventoryMaster = await InventoryMaster.findOne({ itemName, categoryId: category });
    const inventoryMasterId = inventoryMaster?._id?.toString() || `${itemName}_${category}_${Date.now()}`;

    // 🆕 Get category name from CategoryConfig
    let categoryName = category; // fallback to categoryId
    try {
      const { getCategoryNameById } = await import('@/lib/category-helpers');
      categoryName = await getCategoryNameById(category);
    } catch (error) {
      console.warn('Failed to get category name, using categoryId as fallback:', error);
    }

    // 🔧 แยกประเภทอุปกรณ์
    const adminStockItems = itemsToDelete.filter(item => 
      item.currentOwnership.ownerType === 'admin_stock'
    );
    
    const userOwnedItems = itemsToDelete.filter(item => 
      item.currentOwnership.ownerType === 'user_owned'
    );

    // ✅ กรณีที่ 1: มีเฉพาะ Admin Stock → ลบได้หมด
    if (adminStockItems.length > 0 && userOwnedItems.length === 0) {
      console.log(`🗑️ Deleting all items for "${itemName}" - Admin Stock only: ${adminStockItems.length} items`);
    }
    // ✅ กรณีที่ 2: มี Admin Stock + User Owned → ลบเฉพาะ Admin Stock
    else if (adminStockItems.length > 0 && userOwnedItems.length > 0) {
      console.log(`🗑️ Partial deletion for "${itemName}" - Admin Stock: ${adminStockItems.length}, User Owned: ${userOwnedItems.length}`);
    }
    // ❌ กรณีที่ 3: มีเฉพาะ User Owned → ลบไม่ได้เลย
    else if (adminStockItems.length === 0 && userOwnedItems.length > 0) {
      return NextResponse.json({
        error: `❌ ไม่สามารถลบ "${itemName}" ได้`,
        reason: `มีผู้ใช้ครอบครองอุปกรณ์อยู่ ${userOwnedItems.length} ชิ้น`,
        message: "รายการนี้จะหายจากตารางเมื่อผู้ใช้คืนอุปกรณ์ครบทุกชิ้น",
        nextSteps: [
          "1. ติดต่อผู้ใช้ให้คืนอุปกรณ์",
          "2. รอให้ผู้ใช้ส่งคำขอคืนอุปกรณ์", 
          "3. อนุมัติการคืนอุปกรณ์",
          "4. จึงจะสามารถลบรายการได้"
        ],
        adminStock: adminStockItems.length,
        userOwned: userOwnedItems.length,
        userOwnedItems: userOwnedItems.map(item => ({
          serialNumber: item.serialNumber,
          numberPhone: item.numberPhone,
          ownerId: item.currentOwnership.userId,
          ownedSince: item.currentOwnership.ownedSince
        }))
      }, { status: 400 });
    }

    // Start deletion process - ลบเฉพาะ Admin Stock
    const itemsToActuallyDelete = adminStockItems; // ลบเฉพาะ Admin Stock
    const willDeleteAll = userOwnedItems.length === 0; // จะลบทั้งหมดหรือไม่
    
    const deletionSummary = {
      totalItems: itemsToDelete.length,
      adminStockItems: adminStockItems.length,
      userOwnedItems: userOwnedItems.length,
      itemsToDelete: itemsToActuallyDelete.length,
      willDeleteAll,
      withSerialNumber: itemsToActuallyDelete.filter(item => item.serialNumber).length,
      withoutSerialNumber: itemsToActuallyDelete.filter(item => !item.serialNumber).length
    };

    // Create deletion log entry
    const deletionLog = new TransferLog({
      itemId: 'bulk_delete_' + Date.now(), // Special ID for bulk deletion
      itemName: itemName,
      category: category,
      serialNumber: 'BULK_DELETE',
      transferType: 'ownership_change',  // ✅ Valid enum value
      fromOwnership: { ownerType: 'admin_stock' },  // ✅ Valid enum value
      toOwnership: { ownerType: 'admin_stock' },    // ✅ Valid enum value (indicating removal)
      transferDate: new Date(),
      processedBy: payload.userId,
      reason: `Bulk deletion: ${reason}. Items deleted: ${deletionSummary.totalItems} (Admin: ${deletionSummary.adminStockItems}, User Owned: ${deletionSummary.userOwnedItems})`,
      notes: `Complete item deletion via admin management - ${currentUser.firstName || currentUser.user_id}`
    });
    await deletionLog.save();

    // Move all items to recycle bin before deleting
    try {
      
      // Create simple backup records - เฉพาะที่จะลบจริง
      const backupData = itemsToActuallyDelete.map(item => ({
        itemName: item.itemName,
        categoryId: item.categoryId,
        serialNumber: item.serialNumber,
        deletedAt: new Date(),
        deleteReason: reason,
        deletedBy: currentUser.user_id,
        deletedByName: `${currentUser.firstName || 'Unknown'} ${currentUser.lastName || 'User'}`,
        originalData: JSON.stringify(item.toObject())
      }));
      
      // Try to save to RecycleBin using direct MongoDB, but don't fail if it doesn't work
      try {
        
        const { MongoClient } = require('mongodb');
        const uri = process.env.MONGODB_URI;
        const client = new MongoClient(uri);
        
        await client.connect();
        const db = client.db();
        const recycleBin = db.collection('recyclebins');
        
        const recycleBinItems = backupData.map(backup => ({
          itemName: backup.itemName,
          category: categoryName, // 🔧 Use resolved category name instead of categoryId
          categoryId: backup.categoryId,
          inventoryMasterId: inventoryMasterId, // 🆕 เพิ่ม inventoryMasterId
          serialNumber: backup.serialNumber,
          numberPhone: JSON.parse(backup.originalData).numberPhone, // 🔧 Add numberPhone from original data
          deleteType: 'bulk_delete', // เปลี่ยนชื่อ
          deleteReason: backup.deleteReason,
          deletedBy: backup.deletedBy,
          deletedByName: backup.deletedByName,
          deletedAt: backup.deletedAt,
          permanentDeleteAt: new Date(backup.deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
          originalData: JSON.parse(backup.originalData)
        }));
        
        const result = await recycleBin.insertMany(recycleBinItems);
        await client.close();
        
      } catch (recycleBinSaveError) {
        console.error('❌ RecycleBin save failed, but continuing with deletion:', recycleBinSaveError);
        console.error('❌ RecycleBin error details:', {
          name: recycleBinSaveError instanceof Error ? recycleBinSaveError.name : 'Unknown',
          message: recycleBinSaveError instanceof Error ? recycleBinSaveError.message : 'Unknown error',
          stack: recycleBinSaveError instanceof Error ? recycleBinSaveError.stack : 'No stack trace'
        });
      }
      
    } catch (recycleBinError) {
      console.error('❌ Error with recycle bin process:', recycleBinError);
    }
    
    // 🆕 Update snapshots ก่อนลบแต่ละ item
    console.log('📸 Updating snapshots before bulk deletion...');
    for (const item of itemsToActuallyDelete) {
      try {
        const { updateSnapshotsBeforeDelete } = await import('@/lib/snapshot-helpers');
        const snapshotResult = await updateSnapshotsBeforeDelete(String(item._id));
        if (snapshotResult.success) {
          console.log(`   ✅ Updated ${snapshotResult.updatedRequestLogs} snapshot(s) for ${item.itemName} ${item.serialNumber ? `(SN: ${item.serialNumber})` : ''}`);
        }
      } catch (snapshotError) {
        console.error(`   ❌ Failed to update snapshot for item ${item._id}:`, snapshotError);
        // ไม่หยุดการทำงาน แค่ log error
      }
    }
    
    // Now delete items - เฉพาะ Admin Stock
    // 1. Delete only Admin Stock InventoryItems
    await InventoryItem.deleteMany({ 
      _id: { $in: itemsToActuallyDelete.map(item => item._id) }
    });
    
    // 2. Update or Delete InventoryMaster
    if (willDeleteAll) {
      // 🆕 Snapshot itemName ก่อนลบ InventoryMaster
      if (inventoryMaster) {
        const { snapshotItemNameBeforeDelete } = await import('@/lib/equipment-snapshot-helpers');
        const snapshotResult = await snapshotItemNameBeforeDelete(inventoryMasterId);
        console.log('📸 Snapshot result before deleting InventoryMaster:', snapshotResult);
      }
      
      // ลบ InventoryMaster ถ้าไม่มีอุปกรณ์เหลือ
      await InventoryMaster.deleteOne({ itemName, categoryId: category });
      console.log(`✅ Deleted InventoryMaster for "${itemName}" - no items remaining`);
    } else {
      // อัปเดต InventoryMaster ถ้ายังมี User Owned
      await InventoryMaster.updateOne(
        { itemName, categoryId: category },
        {
          availableQuantity: 0, // Admin Stock หมดแล้ว
          totalQuantity: userOwnedItems.length,
          userOwnedQuantity: userOwnedItems.length,
          lastUpdated: new Date()
        }
      );
      console.log(`✅ Updated InventoryMaster for "${itemName}" - ${userOwnedItems.length} user owned items remaining`);
    }
    
    // 3. Delete related logs (optional - for cleanup)
    // Note: We keep TransferLog and other logs for audit trail
    // await TransferLog.deleteMany({ itemName, category });
    // await RequestLog.deleteMany({ 'items.itemName': itemName, 'items.category': category });
    // await ReturnLog.deleteMany({ 'items.itemName': itemName, 'items.category': category });
    
    // Clear all caches
    clearAllCaches();
    
    // Return appropriate message based on deletion type
    const message = willDeleteAll 
      ? `ลบรายการ "${itemName}" ทั้งหมดเรียบร้อยแล้ว (${deletionSummary.itemsToDelete} ชิ้น)`
      : `ลบ Admin Stock "${itemName}" เรียบร้อยแล้ว (${deletionSummary.itemsToDelete} ชิ้น)`;
    
    const warning = !willDeleteAll 
      ? `⚠️ รายการยังคงอยู่ในตารางเพราะมีผู้ใช้ครอบครอง ${deletionSummary.userOwnedItems} ชิ้น`
      : null;

    return NextResponse.json({
      message,
      warning,
      deletionType: willDeleteAll ? 'complete' : 'partial',
      deletionSummary: deletionSummary,
      reason: reason,
      deletedBy: currentUser.firstName || currentUser.user_id,
      deletedAt: new Date()
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error deleting inventory items:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบรายการ' },
      { status: 500 }
    );
  }
}
