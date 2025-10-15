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


    if (!itemName || !category) {
      console.error('❌ Missing itemName or category parameters');
      return NextResponse.json(
        { error: 'กรุณาระบุ itemName และ category' },
        { status: 400 }
      );
    }

    // Debug: Check if item exists in database
    const debugItem = await InventoryMaster.findOne({ itemName, categoryId: category });
    if (debugItem) {
      console.log('🔍 Found item in InventoryMaster:', {
        itemName: debugItem.itemName,
        categoryId: debugItem.categoryId,
        totalQuantity: debugItem.totalQuantity
      });
    }

    // Use getAdminStockInfo which includes auto-detection logic
    try {
      const stockData = await getAdminStockInfo(itemName, category);
      
      // ดึงข้อมูล breakdown จริงจาก breakdown API
      const breakdownResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/inventory/breakdown?itemName=${encodeURIComponent(itemName)}&categoryId=${encodeURIComponent(category)}`, {
        method: 'GET',
        headers: {
          'Cookie': request.headers.get('cookie') || ''
        }
      });
      
      let realBreakdown = {
        statusBreakdown: {},
        conditionBreakdown: {},
        typeBreakdown: { withoutSN: 0, withSN: 0, withPhone: 0 },
        adminStatusBreakdown: {},
        userStatusBreakdown: {},
        adminConditionBreakdown: {},
        userConditionBreakdown: {},
        adminTypeBreakdown: { withoutSN: 0, withSN: 0, withPhone: 0 },
        userTypeBreakdown: { withoutSN: 0, withSN: 0, withPhone: 0 }
      } as any;
      
      if (breakdownResponse.ok) {
        realBreakdown = await breakdownResponse.json();
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
        },
        // pass through owner-specific breakdowns
        adminStatusBreakdown: (realBreakdown as any).adminStatusBreakdown || {},
        userStatusBreakdown: (realBreakdown as any).userStatusBreakdown || {},
        adminConditionBreakdown: (realBreakdown as any).adminConditionBreakdown || {},
        userConditionBreakdown: (realBreakdown as any).userConditionBreakdown || {},
        adminTypeBreakdown: (realBreakdown as any).adminTypeBreakdown || { withoutSN: 0, withSN: 0, withPhone: 0 },
        userTypeBreakdown: (realBreakdown as any).userTypeBreakdown || { withoutSN: 0, withSN: 0, withPhone: 0 },
        // เพิ่มข้อมูล breakdown เฉพาะอุปกรณ์ที่ไม่มี SN
        nonSNStatusBreakdown: realBreakdown.nonSNStatusBreakdown || {},
        nonSNConditionBreakdown: realBreakdown.nonSNConditionBreakdown || {},
        // 🆕 FIXED: เพิ่มจำนวนรวมทั้งหมดจากข้อมูลจริง
        totalQuantity: realBreakdown.totalQuantity
      };
      
      console.log('📊 Enhanced stock data prepared:', {
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
      const item = await InventoryMaster.findOne({ itemName, categoryId: category });
      
      if (!item) {
        console.error('❌ Item not found in InventoryMaster');
        return NextResponse.json(
          { error: 'ไม่พบรายการดังกล่าว' },
          { status: 404 }
        );
      }

      console.log('📦 Using fallback stock data:', {
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
  clearAllCaches(); // 🆕 FIXED: เคลียร์แคชตั้งแต่เริ่มต้นเพื่อให้แน่ใจว่าข้อมูลเริ่มต้นสดใหม่

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
    const { itemId, itemName, category, operationType, value, reason, newStatusId, newConditionId, changeQuantity, statusChangeQuantity, conditionChangeQuantity, currentStatusId, currentConditionId } = body;

    console.log('🔧 Stock operation request:', {
      itemName,
      category,
      operationType,
      value,
      reason,
      newStatusId,
      newConditionId,
      changeQuantity,
      statusChangeQuantity,
      conditionChangeQuantity,
      currentStatusId,
      currentConditionId,
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
        updatedItem = await InventoryMaster.setAdminStock(itemName, category, value, reason, adminId, adminName);
      } else if (operationType === 'adjust_stock') {
        // 🆕 FIXED: For UI "adjust_stock", the value is actually the NEW ABSOLUTE VALUE, not adjustment
        // We need to calculate the actual adjustment amount
        
        // ดึงข้อมูล breakdown ล่าสุดเพื่อหา adjustableCount
        const breakdownResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/admin/inventory/breakdown?itemName=${encodeURIComponent(itemName)}&categoryId=${encodeURIComponent(category)}`, {
          method: 'GET',
          headers: {
            'Cookie': request.headers.get('cookie') || ''
          }
        });
        
        let realBreakdown = { adjustableCount: 0 };
        if (breakdownResponse.ok) {
          realBreakdown = await breakdownResponse.json();
        }
        
        const currentAdjustableCount = realBreakdown.adjustableCount || 0;

        // ตรวจสอบว่า value ที่ส่งมาเป็นจำนวนเต็มบวก และไม่เกินจำนวนที่ปรับได้ปัจจุบันหากเป็นการลด
        if (value < 0) {
          return NextResponse.json(
            { error: 'จำนวนที่ต้องการปรับต้องไม่ติดลบ' },
            { status: 400 }
          );
        }

        // คำนวณ actualAdjustment โดยใช้ adjustableCount
        const actualAdjustment = value - currentAdjustableCount;
        
        // ตรวจสอบว่าพยายามลดจำนวนเกินกว่าที่มี
        if (actualAdjustment < 0 && Math.abs(actualAdjustment) > currentAdjustableCount) {
          return NextResponse.json(
            { error: `ไม่สามารถลดจำนวนได้ มีอุปกรณ์ที่สถานะ \"มี\" และสภาพ \"ใช้งานได้\" เพียง ${currentAdjustableCount} ชิ้น แต่ต้องการลด ${Math.abs(actualAdjustment)} ชิ้น` },
            { status: 400 }
          );
        }

        // Update InventoryMaster.adminDefinedStock (ซึ่งเป็น total stock)
        // เราต้องคำนวณ targetAdminStock ที่รวม SN ด้วย
        const currentItem = await InventoryMaster.findOne({ itemName, categoryId: category });
        const currentTotalAdminStock = currentItem?.stockManagement?.adminDefinedStock || 0;
        const currentSNCount = (await InventoryItem.countDocuments({
          itemName, 
          categoryId: category, 
          'currentOwnership.ownerType': 'admin_stock',
          deletedAt: { $exists: false },
          $or: [
            { serialNumber: { $exists: true, $ne: '' } },
            { numberPhone: { $exists: true, $ne: '' } }
          ]
        })) || 0;
        
        // 🆕 CRITICAL: ต้องคำนวณอุปกรณ์ที่ไม่ควรถูกแตะต้องด้วย!
        const currentNonAdjustableNonSNCount = (await InventoryItem.countDocuments({
          itemName, 
          categoryId: category, 
          'currentOwnership.ownerType': 'admin_stock',
          deletedAt: { $exists: false },
          $and: [
            { $or: [{ serialNumber: { $exists: false } }, { serialNumber: '' }] },
            { $or: [{ numberPhone: { $exists: false } }, { numberPhone: '' }] }
          ],
          $or: [
            { statusId: { $ne: 'status_available' } }, // ไม่ใช่สถานะ "มี"
            { conditionId: { $ne: 'cond_working' } }   // หรือไม่ใช่สภาพ "ใช้งานได้"
          ]
        })) || 0;
        
        console.log(`  - Current SN count: ${currentSNCount}`);
        console.log(`  - Current adjustable count (non-SN available+working): ${currentAdjustableCount}`);
        console.log(`  - Current non-adjustable non-SN count (missing/damaged): ${currentNonAdjustableNonSNCount}`);
        console.log(`  - Target non-SN available+working: ${value}`);
        
        // 🆕 CRITICAL: รวมอุปกรณ์ที่ไม่ควรถูกแตะต้องด้วย!
        const targetNonSNCount = value; // value คือจำนวน non-SN ที่มี+ใช้งานได้ ที่ต้องการ
        const targetAdminStock = targetNonSNCount + currentSNCount + currentNonAdjustableNonSNCount; // รวมทุกอย่างที่ควรมี

        console.log(`  Debug: targetNonSNCount = ${targetNonSNCount}, currentSNCount = ${currentSNCount}, currentNonAdjustableNonSNCount = ${currentNonAdjustableNonSNCount}`);
        updatedItem = await InventoryMaster.adjustAdminStock(itemName, category, targetAdminStock - currentTotalAdminStock, reason, adminId, adminName);
        
        // 🆕 CRITICAL: Sync InventoryItems after adjusting InventoryMaster
        await syncAdminStockItems(
          itemName,
          category,
          targetAdminStock, // 🆕 FIXED: ส่ง targetAdminStock ทั้งหมดไปให้ syncAdminStockItems
          reason,
          adminId,
          undefined, // ไม่เปลี่ยนหมวดหมู่
          undefined, // 🔧 CRITICAL FIX: ไม่เปลี่ยนสถานะของอุปกรณ์ที่มีอยู่ (เฉพาะสร้างใหม่เท่านั้น)
          undefined  // 🔧 CRITICAL FIX: ไม่เปลี่ยนสภาพของอุปกรณ์ที่มีอยู่ (เฉพาะสร้างใหม่เท่านั้น)
        );
        clearAllCaches(); // 🆕 FIXED: เคลียร์แคชหลังจากอัปเดต inventory item เรียบร้อยแล้ว

      } else if (operationType === 'change_status_condition') {
        // For change_status_condition, we ONLY change status/condition, NOT quantity
        console.log('🔁 Status/Condition change:', {
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
        updatedItem = currentItem;
      }
      
      console.log('📦 Updated admin stock summary:', {
        itemName: updatedItem.itemName,
        operationType,
        newAdminStock: updatedItem.stockManagement?.adminDefinedStock,
        lastOperation: updatedItem.adminStockOperations[updatedItem.adminStockOperations.length - 1]
      });

      // 🆕 CRITICAL: Sync actual InventoryItem records to match new admin stock
      const newAdminStock = updatedItem.stockManagement.adminDefinedStock;
      
      try {
        if (operationType === 'change_status_condition') {
          // For change_status_condition, update status/condition of specific non-SN items
          
          let updatedItemsCount = 0;
          
          // Handle status change with priority linking
          if (hasValidStatusChange && statusChangeQuantity > 0 && currentStatusId) {
            
            try {
              const { changeNonSNItemStatusWithPriority } = await import('@/lib/inventory-helpers');
              const result = await changeNonSNItemStatusWithPriority(
                updatedItem.itemName,
                updatedItem.categoryId,
                newStatusId,        // เปลี่ยนสถานะ
                undefined,          // ไม่เปลี่ยนสภาพ
                currentStatusId,    // สถานะปัจจุบัน
                undefined,          // ไม่ระบุสภาพปัจจุบัน
                statusChangeQuantity,
                payload.userId,
                reason
              );
              updatedItemsCount += result.updatedCount;
            } catch (error) {
              console.error(`❌ Status change with priority failed:`, error);
              throw error;
            }
          }
          
          // Handle condition change with priority linking
          if (hasValidConditionChange && conditionChangeQuantity > 0 && currentConditionId) {
            
            try {
              const { changeNonSNItemStatusWithPriority } = await import('@/lib/inventory-helpers');
              const result = await changeNonSNItemStatusWithPriority(
                updatedItem.itemName,
                updatedItem.categoryId,
                undefined,          // ไม่เปลี่ยนสถานะ
                newConditionId,     // เปลี่ยนสภาพ
                undefined,          // ไม่ระบุสถานะปัจจุบัน
                currentConditionId, // สภาพปัจจุบัน
                conditionChangeQuantity,
                payload.userId,
                reason
              );
              updatedItemsCount += result.updatedCount;
            } catch (error) {
              console.error(`❌ Condition change with priority failed:`, error);
              throw error;
            }
          }
          
          if (updatedItemsCount === 0) {
            return NextResponse.json(
              { error: 'ไม่พบอุปกรณ์ที่ตรงตามเงื่อนไขที่ระบุ' },
              { status: 400 }
            );
          }
          
 
            // 🆕 CRITICAL: Update InventoryMaster and clear caches immediately after changing status/condition
            await updateInventoryMaster(itemName, category); // ใช้ itemName, category ที่ได้รับจาก request
            clearAllCaches();
            
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
      const finalCategoryId = updatedItem.categoryId; // ไม่มีการเปลี่ยนหมวดหมู่
      
      try {
        await updateInventoryMaster(updatedItem.itemName, finalCategoryId);
      } catch (updateError) {
        console.error('❌ Error updating InventoryMaster:', updateError);
        
        // หากเกิด duplicate key error ให้จัดการอย่างระมัดระวัง
        if (updateError instanceof Error && updateError.message.includes('E11000')) {
          
          // หา InventoryMaster ที่ซ้ำกัน
          const duplicateMasters = await InventoryMaster.find({ 
            itemName: updatedItem.itemName, 
            categoryId: finalCategoryId 
          });
          
          
          if (duplicateMasters.length > 1) {
            // ลบ master เก่าทั้งหมดยกเว้นตัวล่าสุด
            const mastersToDelete = duplicateMasters.slice(0, -1);
            for (const master of mastersToDelete) {
              // 🆕 Snapshot ก่อนลบ duplicate InventoryMaster
              try {
                const { snapshotItemNameBeforeDelete } = await import('@/lib/equipment-snapshot-helpers');
                await snapshotItemNameBeforeDelete(master._id.toString());
              } catch (error) {
                console.warn('Failed to snapshot before deleting duplicate InventoryMaster:', error);
              }
              
              await InventoryMaster.findByIdAndDelete(master._id);
            }
          }
          
          // ลบ master ที่เหลือทั้งหมดและสร้างใหม่
          // 🆕 Snapshot ก่อนลบ masters ทั้งหมด
          const mastersToDeleteAll = await InventoryMaster.find({ 
            itemName: updatedItem.itemName, 
            categoryId: finalCategoryId 
          });
          
          for (const master of mastersToDeleteAll) {
            try {
              const { snapshotItemNameBeforeDelete } = await import('@/lib/equipment-snapshot-helpers');
              await snapshotItemNameBeforeDelete(master._id.toString());
            } catch (error) {
              console.warn('Failed to snapshot before deleting InventoryMaster:', error);
            }
          }
          
          await InventoryMaster.deleteMany({ 
            itemName: updatedItem.itemName, 
            categoryId: finalCategoryId 
          });
          
          await updateInventoryMaster(updatedItem.itemName, finalCategoryId);
        } else {
          throw updateError;
        }
      }
      
      // Clear all caches to ensure fresh data in UI
      clearAllCaches();

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
