import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import { InventoryItem } from '@/models/InventoryItemNew';
import { changeItemStatus, updateInventoryMaster } from '@/lib/inventory-helpers';
import { verifyToken } from '@/lib/auth';
import { getItemNameAndCategory } from '@/lib/item-name-resolver';

// POST - อนุมัติการคืนอุปกรณ์
export async function POST(request: NextRequest) {
  try {
    // Verify admin token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    
    await dbConnect();
    
    const { returnId, itemUpdates } = await request.json();
    
    if (!returnId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ ID การคืน' },
        { status: 400 }
      );
    }
    
    // Find the return log
    const returnLog = await ReturnLog.findById(returnId);
    if (!returnLog) {
      return NextResponse.json(
        { error: 'ไม่พบการคืนอุปกรณ์' },
        { status: 404 }
      );
    }
    
    if (returnLog.status !== 'pending') {
      return NextResponse.json(
        { error: 'การคืนนี้ได้รับการประมวลผลแล้ว' },
        { status: 400 }
      );
    }
    
    // Process each returned item
    const processedItems = [];
    
    for (const item of returnLog.items) {
      try {
        // Find the inventory item
        const inventoryItem = await InventoryItem.findById(item.itemId);
        if (!inventoryItem) {
          console.warn(`Inventory item not found: ${item.itemId}`);
          continue;
        }
        
        // Get update data for this item
        const itemUpdate = itemUpdates?.find((update: any) => update.itemId === item.itemId);
        
        // Determine new status and condition
        const newStatusId = itemUpdate?.statusId || item.statusOnReturn || 'status_available'; // Use user's reported status first
        const newConditionId = itemUpdate?.conditionId || item.conditionOnReturn || 'cond_working'; // Use user's reported condition first
        
        // Change item status and condition
        await changeItemStatus(
          item.itemId,
          newStatusId,
          newConditionId,
          payload.userId,
          `คืนจาก ${returnLog.returnerFirstName} ${returnLog.returnerLastName}`
        );
        
        // Transfer back to admin stock regardless of condition (both working and damaged items go back to admin stock)
        const { transferInventoryItem } = await import('@/lib/inventory-helpers');
        
        await transferInventoryItem({
          itemId: item.itemId,
          fromOwnerType: 'user_owned',
          fromUserId: returnLog.userId.toString(),
          toOwnerType: 'admin_stock',
          transferType: 'return_completed',
          processedBy: payload.userId,
          returnId: returnId,
          reason: `Equipment returned with status: ${newStatusId}, condition: ${newConditionId}`
        });
        
        processedItems.push({
          itemId: item.itemId,
          serialNumber: item.serialNumber,
          newStatusId,
          newConditionId,
          transferredToAdmin: true // Always transfer back to admin stock when returning equipment
        });
        
      } catch (itemError) {
        console.error(`Error processing item ${item.itemId}:`, itemError);
        // Continue processing other items
      }
    }
    
    // Update InventoryMaster for all affected items
    const updatedItems = new Set<string>();
    for (const item of processedItems) {
      const inventoryItem = await InventoryItem.findById(item.itemId);
      if (inventoryItem) {
        // Get item name and category using the resolver
        const itemInfo = await getItemNameAndCategory(inventoryItem.itemMasterId, item.itemId);
        if (itemInfo) {
          const itemKey = `${itemInfo.itemName}_${itemInfo.categoryId}`;
          if (!updatedItems.has(itemKey)) {
            try {
              await updateInventoryMaster(itemInfo.itemName, itemInfo.categoryId);
              updatedItems.add(itemKey);
              console.log(`✅ Updated InventoryMaster for ${itemInfo.itemName}`);
            } catch (updateError) {
              console.error(`❌ Failed to update InventoryMaster for ${itemInfo.itemName}:`, updateError);
            }
          }
        }
      }
    }

    // Update return log status
    returnLog.status = 'approved';
    returnLog.approvedAt = new Date();
    returnLog.approvedBy = payload.userId;
    returnLog.processedItems = processedItems;
    await returnLog.save();
    
    return NextResponse.json({
      message: 'อนุมัติการคืนอุปกรณ์เรียบร้อยแล้ว',
      returnId,
      processedItems: processedItems.length,
      items: processedItems
    });
    
  } catch (error) {
    console.error('Approve equipment return error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอนุมัติการคืน' },
      { status: 500 }
    );
  }
}

// PUT - ปฏิเสธการคืนอุปกรณ์
export async function PUT(request: NextRequest) {
  try {
    // Verify admin token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    
    await dbConnect();
    
    const { returnId, reason } = await request.json();
    
    if (!returnId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ ID การคืน' },
        { status: 400 }
      );
    }
    
    // Find the return log
    const returnLog = await ReturnLog.findById(returnId);
    if (!returnLog) {
      return NextResponse.json(
        { error: 'ไม่พบการคืนอุปกรณ์' },
        { status: 404 }
      );
    }
    
    if (returnLog.status !== 'pending') {
      return NextResponse.json(
        { error: 'การคืนนี้ได้รับการประมวลผลแล้ว' },
        { status: 400 }
      );
    }
    
    // Update return log status
    returnLog.status = 'rejected';
    returnLog.rejectedAt = new Date();
    returnLog.rejectedBy = payload.userId;
    returnLog.rejectionReason = reason || 'ไม่ระบุเหตุผล';
    await returnLog.save();
    
    return NextResponse.json({
      message: 'ปฏิเสธการคืนอุปกรณ์เรียบร้อยแล้ว',
      returnId
    });
    
  } catch (error) {
    console.error('Reject equipment return error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการปฏิเสธการคืน' },
      { status: 500 }
    );
  }
}
