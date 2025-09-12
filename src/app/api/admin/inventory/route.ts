import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import { createInventoryItem } from '@/lib/inventory-helpers';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import { clearAllCaches } from '@/lib/cache-utils';
import TransferLog from '@/models/TransferLog';
import { moveToRecycleBin } from '@/lib/recycle-bin-helpers';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';

// GET - Fetch aggregated inventory items (grouped by itemName)
export async function GET() {
  try {
    await dbConnect();
    
    // Get all InventoryMaster items for summary view
    const allItems = await InventoryMaster.find({});
    
    // Debug: Log raw InventoryMaster data
    console.log('🔍 Raw InventoryMaster data:');
    allItems.forEach(item => {
      console.log(`📦 ${item.itemName}: Total=${item.totalQuantity}, Available=${item.availableQuantity}, UserOwned=${item.userOwnedQuantity}, HasSN=${item.hasSerialNumber}`);
    });
    
    // Convert InventoryMaster to expected format
    const aggregatedItems = allItems.map(item => ({
      _id: item._id,
      itemName: item.itemName,
      category: item.category,
      totalQuantity: item.totalQuantity,
      quantity: item.availableQuantity, // จำนวนที่เหลือให้เบิก
      serialNumbers: [], // จะต้องดึงจาก InventoryItem ถ้าต้องการ
      dateAdded: item.lastUpdated,
      status: 'active', // Default status
      hasSerialNumber: item.hasSerialNumber,
      userOwnedQuantity: item.userOwnedQuantity
    }));
    
    // Sort by date added (newest first)
    aggregatedItems.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
    
    // Debug: Log aggregation results
    console.log('🔍 Admin Inventory Aggregation Results:');
    aggregatedItems.forEach(item => {
      console.log(`📦 ${item.itemName}: Total=${item.totalQuantity}, Available=${item.quantity}, SerialNumbers=${JSON.stringify(item.serialNumbers)}`);
    });
    
    // Add cache-busting header
    const response = NextResponse.json(aggregatedItems);
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
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
    const { itemName, category, quantity, totalQuantity, serialNumber, numberPhone, status } = body;
    
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
    if (!itemName || !category || quantity <= 0) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    // Check for duplicate serial number or phone number if provided
    // 🔧 CRITICAL FIX: Exclude soft-deleted items from duplicate check
    if (serialNumber) {
      const existingItem = await InventoryItem.findOne({ 
        serialNumber: serialNumber,
        status: { $ne: 'deleted' } // ✅ Exclude soft-deleted items
      });
      if (existingItem) {
        return NextResponse.json(
          { error: 'Serial Number นี้มีอยู่ในระบบแล้ว' },
          { status: 400 }
        );
      }
    }
    
    // Check for duplicate phone number for SIM cards
    if (numberPhone && category === 'ซิมการ์ด') {
      const existingItem = await InventoryItem.findOne({ 
        numberPhone: numberPhone,
        category: 'ซิมการ์ด',
        status: { $ne: 'deleted' } // ✅ Exclude soft-deleted items
      });
      if (existingItem) {
        return NextResponse.json(
          { error: 'เบอร์โทรศัพท์นี้มีอยู่ในระบบแล้ว' },
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
        category,
        serialNumber: serialNumber || undefined,
        numberPhone: numberPhone || undefined,
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
          category,
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
    
    // Clear all caches to ensure fresh data
    clearAllCaches();
    console.log(`🗑️ Admin Inventory API - Cache cleared after creating ${createdItems.length} items`);
    
    return NextResponse.json({
      message: `เพิ่ม ${createdItems.length} รายการเรียบร้อยแล้ว`,
      items: createdItems,
      summary: {
        itemName,
        category,
        quantity: createdItems.length,
        withSerialNumber: createdItems.filter(item => item.serialNumber).length,
        withoutSerialNumber: createdItems.filter(item => !item.serialNumber).length
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    
    // Handle enhanced Serial Number and Phone Number validation errors
    if (error instanceof Error) {
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
    const itemsToDelete = await InventoryItem.find({ itemName, category });
    
    if (itemsToDelete.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบรายการที่ต้องการลบ' },
        { status: 404 }
      );
    }

    // Check if any items are currently owned by users
    const userOwnedItems = itemsToDelete.filter(item => 
      item.currentOwnership.ownerType === 'user_owned'
    );

    if (userOwnedItems.length > 0 && !deleteAll) {
      return NextResponse.json(
        { 
          error: `มีอุปกรณ์ ${userOwnedItems.length} ชิ้นที่ถูกเบิกไปอยู่ ไม่สามารถลบได้`,
          userOwnedItems: userOwnedItems.map(item => ({
            serialNumber: item.serialNumber,
            ownerId: item.currentOwnership.ownerId,
            ownerName: item.currentOwnership.ownerName
          }))
        },
        { status: 400 }
      );
    }

    // Start deletion process
    const deletionSummary = {
      totalItems: itemsToDelete.length,
      adminStockItems: itemsToDelete.filter(item => item.currentOwnership.ownerType === 'admin_stock').length,
      userOwnedItems: userOwnedItems.length,
      withSerialNumber: itemsToDelete.filter(item => item.serialNumber).length,
      withoutSerialNumber: itemsToDelete.filter(item => !item.serialNumber).length
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
      console.log(`🗑️ Attempting to move ${itemsToDelete.length} items to recycle bin...`);
      
      // Create simple backup records in a separate collection for now
      const backupData = itemsToDelete.map(item => ({
        itemName: item.itemName,
        category: item.category,
        serialNumber: item.serialNumber,
        deletedAt: new Date(),
        deleteReason: reason,
        deletedBy: currentUser.user_id,
        deletedByName: `${currentUser.firstName || 'Unknown'} ${currentUser.lastName || 'User'}`,
        originalData: JSON.stringify(item.toObject())
      }));
      
      // Try to save to RecycleBin using direct MongoDB, but don't fail if it doesn't work
      try {
        console.log(`🗑️ About to save ${backupData.length} items to RecycleBin using direct MongoDB...`);
        
        const { MongoClient } = require('mongodb');
        const uri = process.env.MONGODB_URI;
        const client = new MongoClient(uri);
        
        await client.connect();
        const db = client.db();
        const recycleBin = db.collection('recyclebins');
        
        const recycleBinItems = backupData.map(backup => ({
          itemName: backup.itemName,
          category: backup.category,
          serialNumber: backup.serialNumber,
          deleteType: 'category_bulk',
          deleteReason: backup.deleteReason,
          deletedBy: backup.deletedBy,
          deletedByName: backup.deletedByName,
          deletedAt: backup.deletedAt,
          permanentDeleteAt: new Date(backup.deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
          originalData: JSON.parse(backup.originalData)
        }));
        
        const result = await recycleBin.insertMany(recycleBinItems);
        await client.close();
        
        console.log(`✅ Successfully moved ${itemsToDelete.length} items to recycle bin. Inserted IDs:`, result.insertedIds);
      } catch (recycleBinSaveError) {
        console.error('❌ RecycleBin save failed, but continuing with deletion:', recycleBinSaveError);
        console.error('❌ RecycleBin error details:', {
          name: recycleBinSaveError.name,
          message: recycleBinSaveError.message,
          stack: recycleBinSaveError.stack
        });
      }
      
    } catch (recycleBinError) {
      console.error('❌ Error with recycle bin process:', recycleBinError);
      console.log('⚠️ Continuing with deletion despite recycle bin error');
    }
    
    // Now delete all related data
    // 1. Delete all InventoryItems
    await InventoryItem.deleteMany({ itemName, category });
    
    // 2. Delete InventoryMaster
    await InventoryMaster.deleteOne({ itemName, category });
    
    // 3. Delete related logs (optional - for cleanup)
    // Note: We keep TransferLog and other logs for audit trail
    // await TransferLog.deleteMany({ itemName, category });
    // await RequestLog.deleteMany({ 'items.itemName': itemName, 'items.category': category });
    // await ReturnLog.deleteMany({ 'items.itemName': itemName, 'items.category': category });
    
    // Clear all caches
    clearAllCaches();
    console.log(`🗑️ Admin Inventory API - Deleted ${deletionSummary.totalItems} items for ${itemName} (${category})`);
    
    return NextResponse.json({
      message: `ลบรายการ "${itemName}" ทั้งหมดเรียบร้อยแล้ว`,
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
