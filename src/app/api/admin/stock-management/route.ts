import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';
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

    // Debug: Check if item exists in database
    console.log(`🔍 Debug: Checking if item exists in database...`);
    const debugItem = await InventoryMaster.findOne({ itemName, categoryId: category });
    console.log(`🔍 Debug: Found item:`, debugItem ? 'YES' : 'NO');
    if (debugItem) {
      console.log(`🔍 Debug: Item details:`, {
        itemName: debugItem.itemName,
        categoryId: debugItem.categoryId,
        totalQuantity: debugItem.totalQuantity
      });
    }

    // Use getAdminStockInfo which includes auto-detection logic
    console.log('📊 Calling getAdminStockInfo with auto-detection...');
    try {
      const stockData = await getAdminStockInfo(itemName, category);
      
      // ดึงข้อมูล breakdown จริงจาก breakdown API
      console.log('📊 Fetching real breakdown data...');
      const breakdownResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/inventory/breakdown?itemName=${encodeURIComponent(itemName)}&categoryId=${encodeURIComponent(category)}`, {
        method: 'GET',
        headers: {
          'Cookie': request.headers.get('cookie') || ''
        }
      });
      
      let realBreakdown = {
        statusBreakdown: {},
        conditionBreakdown: {},
        typeBreakdown: { withoutSN: 0, withSN: 0, withPhone: 0 }
      };
      
      if (breakdownResponse.ok) {
        realBreakdown = await breakdownResponse.json();
        console.log('✅ Real breakdown data fetched:', realBreakdown);
      } else {
        console.log('⚠️ Failed to fetch breakdown data, using defaults');
      }
      
      // ใช้ข้อมูลจาก realBreakdown โดยตรง (ไม่ต้องแปลง)
      const statusBreakdown = realBreakdown.statusBreakdown || {};
      const conditionBreakdown = realBreakdown.conditionBreakdown || {};
      
      
      // เพิ่มข้อมูล breakdown ที่ครบถ้วน - ใช้ข้อมูลที่แปลงแล้ว
      const enhancedStockData = {
        ...stockData,
        statusBreakdown: statusBreakdown,
        conditionBreakdown: conditionBreakdown,
        typeBreakdown: realBreakdown.typeBreakdown || {
          withoutSN: 0,
          withSN: 0,
          withPhone: 0
        }
      };
      
      console.log('📋 Enhanced stock data retrieved:', {
        itemName: enhancedStockData.itemName,
        category: enhancedStockData.category,
        adminDefinedStock: enhancedStockData.stockManagement?.adminDefinedStock,
        userContributedCount: enhancedStockData.stockManagement?.userContributedCount,
        currentlyAllocated: enhancedStockData.stockManagement?.currentlyAllocated,
        realAvailable: enhancedStockData.stockManagement?.realAvailable,
        totalQuantity: enhancedStockData.currentStats?.totalQuantity,
        hasOperations: enhancedStockData.adminStockOperations?.length > 0,
        hasStatusBreakdown: !!enhancedStockData.statusBreakdown,
        hasConditionBreakdown: !!enhancedStockData.conditionBreakdown,
        hasTypeBreakdown: !!enhancedStockData.typeBreakdown
      });
      
      return NextResponse.json(enhancedStockData);
      
    } catch (stockError) {
      console.error('❌ Error in getAdminStockInfo:', stockError);
      
      // Fallback: try to get basic data from InventoryMaster
      console.log('🔄 Fallback: trying basic InventoryMaster lookup...');
      const item = await InventoryMaster.findOne({ itemName, categoryId: category });
      
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
        category: item.categoryId,
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
    const { itemId, itemName, category, operationType, value, reason, newStatusId, newConditionId } = body;

    console.log(`📝 Stock Management API POST - Received data:`, {
      itemName,
      category,
      operationType,
      value,
      reason,
      newStatusId,
      newConditionId,
      adminId: currentUser.user_id,
      adminName: `${currentUser.firstName} ${currentUser.lastName}`
    });

    // Validate required fields
    if (!itemName || !category || !operationType || !reason) {
      console.error('❌ Missing required fields:', { itemName, category, operationType, reason });
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }
    
    // For adjust_stock operation, value is required and cannot be 0
    if (operationType === 'adjust_stock') {
      if (value === undefined) {
        console.error('❌ Missing value for adjust_stock operation');
        return NextResponse.json(
          { error: 'กรุณาระบุจำนวนที่ต้องการปรับ' },
          { status: 400 }
        );
      }
      if (value === 0) {
        console.error('❌ Cannot adjust stock to 0');
        return NextResponse.json(
          { error: 'ไม่สามารถปรับจำนวนเป็น 0 ได้ (ใช้สำหรับการปรับจำนวน ไม่ใช่การลบ)' },
          { status: 400 }
        );
      }
    }
    
    // For change_status_condition operation, at least one change field is required
    // ตรวจสอบว่า newStatusId, newConditionId ไม่เป็น undefined หรือ empty string
    const hasValidStatusChange = newStatusId && newStatusId.trim() !== '';
    const hasValidConditionChange = newConditionId && newConditionId.trim() !== '';
    
    if (operationType === 'change_status_condition' && !hasValidStatusChange && !hasValidConditionChange) {
      console.error('❌ No valid changes specified for change_status_condition operation');
      return NextResponse.json(
        { error: 'กรุณาเลือกอย่างน้อยหนึ่งรายการที่ต้องการเปลี่ยน' },
        { status: 400 }
      );
    }

    if (!['set_stock', 'adjust_stock', 'change_status_condition'].includes(operationType)) {
      return NextResponse.json(
        { error: 'operationType ต้องเป็น set_stock, adjust_stock หรือ change_status_condition' },
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
        const currentItem = await InventoryMaster.findOne({ itemName, categoryId: category });
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
      } else if (operationType === 'change_status_condition') {
        // For change_status_condition, we ONLY change status/condition, NOT quantity
        console.log(`🔄 Executing change_status_condition: ${itemName} - updating status/condition only`);
        console.log(`🔧 Change options:`, { 
          newStatusId: hasValidStatusChange ? newStatusId : 'no change', 
          newConditionId: hasValidConditionChange ? newConditionId : 'no change'
        });
        
        // Find the item first using itemName and categoryId
        const currentItem = await InventoryMaster.findOne({ itemName, categoryId: category });
        if (!currentItem) {
          console.error(`❌ Item not found: ${itemName} in category ${category}`);
          return NextResponse.json(
            { error: `ไม่พบรายการ ${itemName} ในหมวดหมู่ ${category}` },
            { status: 404 }
          );
        }
        
        // For status/condition change, keep the current quantity - NO adjustment
        console.log(`📊 Status/condition change: keeping current admin stock (${currentItem.stockManagement?.adminDefinedStock || 0})`);
        updatedItem = currentItem;
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
        if (operationType === 'change_status_condition') {
          // For change_status_condition, don't change quantity, just update status/condition
          // Use current admin stock count instead of newAdminStock to avoid deletion
          const currentAdminItems = await InventoryItem.find({
            itemName: updatedItem.itemName,
            categoryId: updatedItem.categoryId,
            'currentOwnership.ownerType': 'admin_stock',
            deletedAt: { $exists: false }
          });
          const currentAdminStockCount = currentAdminItems.length;
          
          console.log(`📊 Status/condition change: using current admin stock count (${currentAdminStockCount}) instead of newAdminStock (${newAdminStock})`);
          
          await syncAdminStockItems(
            updatedItem.itemName, 
            updatedItem.categoryId, 
            currentAdminStockCount, // Use current count to avoid deletion
            reason, 
            adminId, 
            undefined, // ไม่มีการเปลี่ยนหมวดหมู่ 
            hasValidStatusChange ? newStatusId : undefined, 
            hasValidConditionChange ? newConditionId : undefined
          );
        } else {
          // For other operations, sync normally
          await syncAdminStockItems(
            updatedItem.itemName, 
            updatedItem.categoryId, 
            newAdminStock, 
            reason, 
            adminId, 
            undefined, // ไม่มีการเปลี่ยนหมวดหมู่ 
            hasValidStatusChange ? newStatusId : undefined, 
            hasValidConditionChange ? newConditionId : undefined
          );
        }
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
      const finalCategoryId = updatedItem.categoryId; // ไม่มีการเปลี่ยนหมวดหมู่
      
      try {
        await updateInventoryMaster(updatedItem.itemName, finalCategoryId);
        console.log(`✅ InventoryMaster updated successfully for ${updatedItem.itemName} in category ${finalCategoryId}`);
      } catch (updateError) {
        console.error('❌ Error updating InventoryMaster:', updateError);
        
        // หากเกิด duplicate key error ให้จัดการอย่างระมัดระวัง
        if (updateError instanceof Error && updateError.message.includes('E11000')) {
          console.log('🔄 Duplicate key error detected, cleaning up duplicates...');
          
          // หา InventoryMaster ที่ซ้ำกัน
          const duplicateMasters = await InventoryMaster.find({ 
            itemName: updatedItem.itemName, 
            categoryId: finalCategoryId 
          });
          
          console.log(`🔍 Found ${duplicateMasters.length} duplicate masters`);
          
          if (duplicateMasters.length > 1) {
            // ลบ master เก่าทั้งหมดยกเว้นตัวล่าสุด
            const mastersToDelete = duplicateMasters.slice(0, -1);
            for (const master of mastersToDelete) {
              console.log(`🗑️ Deleting duplicate master: ${master._id}`);
              await InventoryMaster.findByIdAndDelete(master._id);
            }
          }
          
          // ลบ master ที่เหลือทั้งหมดและสร้างใหม่
          await InventoryMaster.deleteMany({ 
            itemName: updatedItem.itemName, 
            categoryId: finalCategoryId 
          });
          
          console.log('🔄 Recreating InventoryMaster...');
          await updateInventoryMaster(updatedItem.itemName, finalCategoryId);
        } else {
          throw updateError;
        }
      }
      
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
