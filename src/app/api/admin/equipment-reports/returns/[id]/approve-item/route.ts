import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import { InventoryItem } from '@/models/InventoryItemNew';
import { changeItemStatus, transferInventoryItem } from '@/lib/inventory-helpers';
import { verifyToken } from '@/lib/auth';

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
    
    if (returnLog.status !== 'pending') {
      return NextResponse.json(
        { error: 'การคืนนี้ได้รับการอนุมัติแล้ว' },
        { status: 400 }
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
    if (item.statusOnReturn === 'approved') {
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
      const newStatusId = 'status_available'; // Default: มี
      const newConditionId = item.conditionOnReturn || 'cond_working'; // Default: ใช้งานได้
      
      // Change item status and condition
      await changeItemStatus(
        item.itemId,
        newStatusId,
        newConditionId,
        payload.userId,
        `คืนจาก ${returnLog.firstName} ${returnLog.lastName}`
      );
      
      // Transfer back to admin stock if condition is working
      if (newConditionId === 'cond_working') {
        await transferInventoryItem({
          itemId: item.itemId,
          fromOwnerType: 'user_owned',
          fromUserId: returnLog.userId.toString(),
          toOwnerType: 'admin_stock',
          transferType: 'return_completed',
          processedBy: payload.userId,
          returnId: id
        });
      }
      
      // Update the specific item status
      returnLog.items[itemIndex].statusOnReturn = 'approved';
      returnLog.items[itemIndex].approvedAt = new Date();
      returnLog.items[itemIndex].approvedBy = payload.userId;
      
      // Check if all items are approved
      const allItemsApproved = returnLog.items.every((item: any) => item.statusOnReturn === 'approved');
      
      if (allItemsApproved) {
        // Update return log status to approved
        returnLog.status = 'approved';
        returnLog.approvedAt = new Date();
        returnLog.approvedBy = payload.userId;
      }
      
      await returnLog.save();
      
      return NextResponse.json({
        message: `อนุมัติการคืน ${item.itemName} เรียบร้อยแล้ว`,
        itemId: item.itemId,
        itemName: item.itemName,
        serialNumber: item.serialNumber,
        allItemsApproved: allItemsApproved,
        returnStatus: returnLog.status
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
