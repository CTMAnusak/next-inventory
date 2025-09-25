import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import { InventoryItem } from '@/models/InventoryItemNew';
import { InventoryMaster } from '@/models/InventoryMasterNew';
import ItemMaster from '@/models/ItemMaster';
import { transferInventoryItem, updateInventoryMaster } from '@/lib/inventory-helpers';
import { verifyToken } from '@/lib/auth';

// POST - อนุมัติการเบิกอุปกรณ์
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
    
    const { requestId, selectedItems } = await request.json();
    
    if (!requestId || !selectedItems || !Array.isArray(selectedItems)) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }
    
    // Find the request
    const requestLog = await RequestLog.findById(requestId);
    if (!requestLog) {
      return NextResponse.json(
        { error: 'ไม่พบคำขอเบิกอุปกรณ์' },
        { status: 404 }
      );
    }
    
    if (requestLog.status !== 'pending') {
      return NextResponse.json(
        { error: 'คำขอนี้ได้รับการประมวลผลแล้ว' },
        { status: 400 }
      );
    }
    
    // Validate selected items
    const transferredItems = [];
    
    for (const selectedItem of selectedItems) {
      const { itemMasterId, quantity, selectedItemIds } = selectedItem;
      
      if (!itemMasterId || !quantity || !selectedItemIds || !Array.isArray(selectedItemIds)) {
        return NextResponse.json(
          { error: 'ข้อมูลอุปกรณ์ไม่ครบถ้วน' },
          { status: 400 }
        );
      }
      
      // Verify that the selected items are actually available
      const availableItems = await InventoryItem.find({
        _id: { $in: selectedItemIds },
        itemMasterId,
        'currentOwnership.ownerType': 'admin_stock',
        statusId: 'status_available',
        conditionId: 'cond_working',
        deletedAt: { $exists: false }
      });
      
      if (availableItems.length !== selectedItemIds.length) {
        return NextResponse.json(
          { error: 'อุปกรณ์ที่เลือกไม่พร้อมใช้งาน' },
          { status: 400 }
        );
      }
      
      // Transfer each item to user
      for (const item of availableItems) {
        try {
          await transferInventoryItem({
            itemId: item._id.toString(),
            fromOwnerType: 'admin_stock',
            toOwnerType: 'user_owned',
            toUserId: requestLog.userId.toString(),
            transferType: 'request_approved',
            processedBy: payload.userId,
            requestId: requestId
          });
          
          transferredItems.push({
            itemId: item._id.toString(),
            serialNumber: item.serialNumber,
            numberPhone: item.numberPhone
          });
          
        } catch (transferError) {
          console.error('Error transferring item:', transferError);
          return NextResponse.json(
            { error: `เกิดข้อผิดพลาดในการโอนย้ายอุปกรณ์: ${transferError}` },
            { status: 500 }
          );
        }
      }
    }
    
    // Update request status
    requestLog.status = 'approved';
    requestLog.approvedAt = new Date();
    requestLog.approvedBy = payload.userId;
    requestLog.transferredItems = transferredItems;
    await requestLog.save();
    
    return NextResponse.json({
      message: 'อนุมัติการเบิกอุปกรณ์เรียบร้อยแล้ว',
      requestId,
      transferredItems: transferredItems.length,
      items: transferredItems
    });
    
  } catch (error) {
    console.error('Approve equipment request error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอนุมัติคำขอ' },
      { status: 500 }
    );
  }
}

// PUT - ปฏิเสธการเบิกอุปกรณ์
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
    
    const { requestId, reason } = await request.json();
    
    if (!requestId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ ID คำขอ' },
        { status: 400 }
      );
    }
    
    // Find the request
    const requestLog = await RequestLog.findById(requestId);
    if (!requestLog) {
      return NextResponse.json(
        { error: 'ไม่พบคำขอเบิกอุปกรณ์' },
        { status: 404 }
      );
    }
    
    if (requestLog.status !== 'pending') {
      return NextResponse.json(
        { error: 'คำขอนี้ได้รับการประมวลผลแล้ว' },
        { status: 400 }
      );
    }
    
    // Update request status
    requestLog.status = 'rejected';
    requestLog.rejectedAt = new Date();
    requestLog.rejectedBy = payload.userId;
    requestLog.rejectionReason = reason || 'ไม่ระบุเหตุผล';
    await requestLog.save();
    
    return NextResponse.json({
      message: 'ปฏิเสธการเบิกอุปกรณ์เรียบร้อยแล้ว',
      requestId
    });
    
  } catch (error) {
    console.error('Reject equipment request error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการปฏิเสธคำขอ' },
      { status: 500 }
    );
  }
}
