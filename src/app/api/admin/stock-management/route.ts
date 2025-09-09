import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryMaster from '@/models/InventoryMaster';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import { getAdminStockInfo, updateInventoryMaster, syncAdminStockItems } from '@/lib/inventory-helpers';
import { clearAllCaches } from '@/lib/cache-utils';

// GET - ดูประวัติการจัดการ stock ของรายการนั้นๆ
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get user info from token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const currentUser = await User.findOne({ user_id: payload.userId });
    if (!currentUser || !['admin', 'it_admin'].includes(currentUser.userRole)) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get('itemName');
    const category = searchParams.get('category');

    console.log(`🔍 Stock Management API GET - Fetching data for: ${itemName} (${category})`);

    if (!itemName || !category) {
      console.error('❌ Missing itemName or category parameters');
      return NextResponse.json(
        { error: 'กรุณาระบุ itemName และ category' },
        { status: 400 }
      );
    }

    // Use getAdminStockInfo which includes auto-detection logic
    console.log('📊 Calling getAdminStockInfo with auto-detection...');
    try {
      const stockData = await getAdminStockInfo(itemName, category);
      
      console.log('📋 Stock data retrieved:', {
        itemName: stockData.itemName,
        category: stockData.category,
        adminDefinedStock: stockData.stockManagement?.adminDefinedStock,
        userContributedCount: stockData.stockManagement?.userContributedCount,
        currentlyAllocated: stockData.stockManagement?.currentlyAllocated,
        realAvailable: stockData.stockManagement?.realAvailable,
        totalQuantity: stockData.currentStats?.totalQuantity,
        hasOperations: stockData.adminStockOperations?.length > 0
      });
      
      return NextResponse.json(stockData);
      
    } catch (stockError) {
      console.error('❌ Error in getAdminStockInfo:', stockError);
      
      // Fallback: try to get basic data from InventoryMaster
      console.log('🔄 Fallback: trying basic InventoryMaster lookup...');
      const item = await InventoryMaster.findOne({ itemName, category });
      
      if (!item) {
        console.error('❌ Item not found in InventoryMaster');
        return NextResponse.json(
          { error: 'ไม่พบรายการดังกล่าว' },
          { status: 404 }
        );
      }

      console.log('📋 Fallback data retrieved:', {
        itemName: item.itemName,
        totalQuantity: item.totalQuantity,
        stockManagement: item.stockManagement
      });

      return NextResponse.json({
        itemName: item.itemName,
        category: item.category,
        stockManagement: item.stockManagement || {
          adminDefinedStock: 0,
          userContributedCount: 0,
          currentlyAllocated: 0,
          realAvailable: 0
        },
        adminStockOperations: item.adminStockOperations || [],
        currentStats: {
          totalQuantity: item.totalQuantity,
          availableQuantity: item.availableQuantity,
          userOwnedQuantity: item.userOwnedQuantity
        }
      });
    }

  } catch (error) {
    console.error('Error fetching stock management data:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}

// POST - ตั้งค่าหรือปรับจำนวน admin stock
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get user info from token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const currentUser = await User.findOne({ user_id: payload.userId });
    if (!currentUser || !['admin', 'it_admin'].includes(currentUser.userRole)) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { itemName, category, operationType, value, reason } = body;

    console.log(`📝 Stock Management API POST - Received data:`, {
      itemName,
      category,
      operationType,
      value,
      reason,
      adminId: currentUser.user_id,
      adminName: `${currentUser.firstName} ${currentUser.lastName}`
    });

    // Validate required fields
    if (!itemName || !category || !operationType || value === undefined || !reason) {
      console.error('❌ Missing required fields:', { itemName, category, operationType, value, reason });
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    if (!['set_stock', 'adjust_stock'].includes(operationType)) {
      return NextResponse.json(
        { error: 'operationType ต้องเป็น set_stock หรือ adjust_stock' },
        { status: 400 }
      );
    }

    const adminId = currentUser.user_id;
    const adminName = `${currentUser.firstName} ${currentUser.lastName}`;

    let updatedItem;

    try {
      if (operationType === 'set_stock') {
        if (value < 0) {
          console.error('❌ Invalid value for set_stock:', value);
          return NextResponse.json(
            { error: 'จำนวน stock ต้องเป็นจำนวนบวก' },
            { status: 400 }
          );
        }
        console.log(`📊 Executing setAdminStock: ${itemName} = ${value}`);
        updatedItem = await InventoryMaster.setAdminStock(itemName, category, value, reason, adminId, adminName);
      } else if (operationType === 'adjust_stock') {
        // 🆕 FIXED: For UI "adjust_stock", the value is actually the NEW ABSOLUTE VALUE, not adjustment
        // We need to calculate the actual adjustment amount
        const currentItem = await InventoryMaster.findOne({ itemName, category });
        if (!currentItem) {
          return NextResponse.json(
            { error: `ไม่พบรายการ ${itemName} ในหมวดหมู่ ${category}` },
            { status: 404 }
          );
        }
        
        const currentAdminStock = currentItem.stockManagement?.adminDefinedStock || 0;
        const actualAdjustment = value - currentAdminStock;
        
        console.log(`📊 Executing adjustAdminStock: ${itemName} from ${currentAdminStock} to ${value} (adjustment = ${actualAdjustment})`);
        updatedItem = await InventoryMaster.adjustAdminStock(itemName, category, actualAdjustment, reason, adminId, adminName);
      }

      console.log(`✅ Stock operation completed:`, {
        itemName: updatedItem.itemName,
        operationType,
        newAdminStock: updatedItem.stockManagement?.adminDefinedStock,
        lastOperation: updatedItem.adminStockOperations[updatedItem.adminStockOperations.length - 1]
      });

      // 🆕 CRITICAL: Sync actual InventoryItem records to match new admin stock
      const newAdminStock = updatedItem.stockManagement.adminDefinedStock;
      console.log(`🔄 Syncing InventoryItem records to match adminDefinedStock: ${newAdminStock}`);
      
      try {
        await syncAdminStockItems(itemName, category, newAdminStock, reason, adminId);
      } catch (syncError) {
        console.error('❌ Stock sync failed:', syncError);
        
        // 🆕 ENHANCED: Check if it's our specific validation error
        if (syncError instanceof Error && syncError.message.includes('ไม่สามารถลดจำนวนได้')) {
          return NextResponse.json(
            { 
              error: syncError.message,
              errorType: 'CANNOT_REDUCE_WITH_SERIAL_NUMBERS',
              suggestion: 'กรุณาใช้ฟังก์ชั่น "แก้ไขรายการ" เพื่อลบรายการที่มี Serial Number แบบ Manual'
            },
            { status: 400 }
          );
        }
        
        // Re-throw other errors
        throw syncError;
      }
      
      // Update InventoryMaster to reflect the synced items
      console.log(`🔄 Updating InventoryMaster after item sync...`);
      await updateInventoryMaster(itemName, category);
      
      // Clear all caches to ensure fresh data in UI
      clearAllCaches();
      console.log(`🗑️ Cleared all caches after stock update`);

      return NextResponse.json({
        message: `${operationType === 'set_stock' ? 'ตั้งค่า' : 'ปรับ'}จำนวน stock เรียบร้อยแล้ว`,
        item: {
          itemName: updatedItem.itemName,
          category: updatedItem.category,
          stockManagement: updatedItem.stockManagement,
          lastOperation: updatedItem.adminStockOperations[updatedItem.adminStockOperations.length - 1]
        }
      });
    } catch (stockError) {
      console.error('❌ Error in stock operation:', stockError);
      return NextResponse.json(
        { error: stockError instanceof Error ? stockError.message : 'เกิดข้อผิดพลาดในการจัดการ stock' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error managing admin stock:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการจัดการ stock' },
      { status: 500 }
    );
  }
}
