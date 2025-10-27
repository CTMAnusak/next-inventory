import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import { InventoryItem } from '@/models/InventoryItemNew';
import { changeItemStatus, transferInventoryItem } from '@/lib/inventory-helpers';
import { getItemNameAndCategory } from '@/lib/item-name-resolver';
import { verifyToken } from '@/lib/auth';

// 🆕 Function to check if item becomes deletable after return
async function checkAndNotifyItemBecomesDeletable(itemName: string, categoryId: string, approvedBy: string) {
  try {
    const InventoryMaster = (await import('@/models/InventoryMaster')).default;
    
    const inventoryMaster = await InventoryMaster.findOne({ itemName, categoryId });
    if (!inventoryMaster) return;
    
    // Check if item now has admin stock (becomes deletable)
    if (inventoryMaster.availableQuantity > 0) {
      console.log(`✅ Item "${itemName}" becomes deletable - Admin Stock: ${inventoryMaster.availableQuantity}, User Owned: ${inventoryMaster.userOwnedQuantity}`);
      
      // Here you could add notification logic for admins
      // For now, just log the change
      const notification = {
        type: 'item_becomes_deletable',
        itemName,
        categoryId,
        adminStock: inventoryMaster.availableQuantity,
        userOwned: inventoryMaster.userOwnedQuantity,
        approvedBy,
        timestamp: new Date()
      };
      
      console.log('📢 Notification:', notification);
    }
  } catch (error) {
    console.warn('Failed to check deletable status:', error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    
    const { id } = await params;
    const { itemIndex } = await request.json();
    
    if (typeof itemIndex !== 'number') {
      return NextResponse.json(
        { error: 'กรุณาระบุ index ของรายการที่ต้องการอนุมัติ' },
        { status: 400 }
      );
    }
    
    // Find the return log
    const returnLog = await ReturnLog.findById(id);
    if (!returnLog) {
      return NextResponse.json(
        { error: 'ไม่พบการคืนอุปกรณ์' },
        { status: 404 }
      );
    }
    
    // Check if item index is valid
    if (itemIndex < 0 || itemIndex >= returnLog.items.length) {
      return NextResponse.json(
        { error: 'index ของรายการไม่ถูกต้อง' },
        { status: 400 }
      );
    }
    
    const item = returnLog.items[itemIndex];
    
    // Check if item is already approved
    if (item.approvalStatus === 'approved') {
      return NextResponse.json({
        message: 'รายการนี้ได้รับการอนุมัติแล้ว',
        alreadyApproved: true
      });
    }
    
    try {
      // Find the inventory item
      const inventoryItem = await InventoryItem.findById(item.itemId);
      if (!inventoryItem) {
        console.warn(`Inventory item not found: ${item.itemId}`);
        return NextResponse.json(
          { error: 'ไม่พบข้อมูลอุปกรณ์ในระบบ' },
          { status: 404 }
        );
      }
      
      // Determine new status and condition
      const newStatusId = item.statusOnReturn || 'status_available'; // Use user's reported status first
      const newConditionId = item.conditionOnReturn || 'cond_working'; // Use user's reported condition first
      
      // Change item status and condition
      await changeItemStatus(
        item.itemId,
        newStatusId,
        newConditionId,
        payload.userId,
        `คืนจาก ${(returnLog as any).requesterName || 'ผู้ใช้'}`
      );
      
      // Transfer back to admin stock regardless of condition (both working and damaged items go back to admin stock)
      await transferInventoryItem({
        itemId: item.itemId,
        fromOwnerType: 'user_owned',
        fromUserId: returnLog.userId.toString(),
        toOwnerType: 'admin_stock',
        transferType: 'return_completed',
        processedBy: payload.userId,
        returnId: id,
        reason: `Equipment returned with status: ${newStatusId}, condition: ${newConditionId}`
      });
      
      // Update the specific item approval status
      returnLog.items[itemIndex].approvalStatus = 'approved';
      returnLog.items[itemIndex].approvedAt = new Date();
      returnLog.items[itemIndex].approvedBy = payload.userId;

      // Ensure Mongoose registers nested array mutation
      (returnLog as any).markModified?.('items');

      await returnLog.save();

      // 🆕 Update InventoryMaster after return and check if item becomes deletable
      try {
        const { updateInventoryMaster } = await import('@/lib/inventory-helpers');
        const { getItemNameAndCategory } = await import('@/lib/item-name-resolver');
        
        // Get item info for InventoryMaster update
        const itemInfo = await getItemNameAndCategory((item as any).masterItemId, item.itemId);
        if (itemInfo) {
          await updateInventoryMaster(itemInfo.itemName, itemInfo.categoryId);
          
          // 🔔 Check if item becomes deletable and notify
          await checkAndNotifyItemBecomesDeletable(itemInfo.itemName, itemInfo.categoryId, payload.userId);
        }
      } catch (updateError) {
        console.warn('Failed to update InventoryMaster after return approval:', updateError);
        // Don't fail the main operation if this fails
      }

      // Resolve item name for response message
      const resolvedInfo = await getItemNameAndCategory((item as any).masterItemId, item.itemId);
      const resolvedItemName = resolvedInfo?.itemName || (item as any).itemName || 'อุปกรณ์';
      
      return NextResponse.json({
        message: `อนุมัติการคืน ${resolvedItemName} เรียบร้อยแล้ว`,
        itemId: item.itemId,
        itemName: resolvedItemName,
        serialNumber: item.serialNumber,
        approvalStatus: 'approved'
      });
      
    } catch (itemError) {
      console.error('Error processing item:', itemError);
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการประมวลผลรายการ' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Approve return item error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอนุมัติการคืน' },
      { status: 500 }
    );
  }
}
