import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import { createInventoryItem } from '@/lib/inventory-helpers';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import { clearAllCaches } from '@/app/api/user/holdings/route';
import TransferLog from '@/models/TransferLog';
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
    const { itemName, category, quantity, totalQuantity, serialNumber, status } = body;
    
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

    // Check for duplicate serial number if provided
    if (serialNumber) {
      const existingItem = await InventoryItem.findOne({ serialNumber: serialNumber });
      if (existingItem) {
        return NextResponse.json(
          { error: 'Serial Number นี้มีอยู่ในระบบแล้ว' },
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
    
    if (serialNumber) {
      // Create single item with serial number
      itemsToCreate.push({
        itemName,
        category,
        serialNumber,
        addedBy: 'admin' as const,
        initialOwnerType: 'admin_stock' as const,
        notes: 'Added by admin via inventory management'
      });
    } else {
      // Create multiple items without serial numbers
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

    // Delete all related data
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
