import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import InventoryItem from '@/models/InventoryItem';
import { InventoryMaster } from '@/models/InventoryMasterNew';
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
      const { quantity, selectedItemIds } = selectedItem;
      
      if (!quantity || !selectedItemIds || !Array.isArray(selectedItemIds)) {
        return NextResponse.json(
          { error: 'ข้อมูลอุปกรณ์ไม่ครบถ้วน' },
          { status: 400 }
        );
      }
      
      if (selectedItemIds.length !== quantity) {
        return NextResponse.json(
          { error: 'จำนวนรายการที่เลือกไม่ตรงกับจำนวนที่ร้องขอ' },
          { status: 400 }
        );
      }
      
      // Verify that the selected items are actually available
      const availableItems = await InventoryItem.find({
        _id: { $in: selectedItemIds },
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
            itemId: String(item._id),
            fromOwnerType: 'admin_stock',
            toOwnerType: 'user_owned',
            toUserId: requestLog.userId.toString(),
            transferType: 'request_approved',
            processedBy: payload.userId,
            requestId: requestId,
            // ✅ คัดลอกข้อมูลผู้ใช้สาขาจาก RequestLog
            requesterInfo: {
              firstName: requestLog.requesterFirstName,
              lastName: requestLog.requesterLastName,
              nickname: requestLog.requesterNickname,
              department: requestLog.requesterDepartment,
              phone: requestLog.requesterPhone,
              office: requestLog.requesterOffice
            }
          });
          
          transferredItems.push({
            itemId: String(item._id),
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
    
    // ✅ Clear cache to ensure dashboard shows updated data after approval
    const { clearAllCaches } = await import('@/lib/cache-utils');
    clearAllCaches();
    
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
