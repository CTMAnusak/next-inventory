import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import TransferLog from '@/models/TransferLog';
import { verifyTokenFromRequest } from '@/lib/auth';
import { transferInventoryItem } from '@/lib/inventory-helpers';

interface ItemSelection {
  masterId?: string;
  itemName: string;
  category: string; // categoryId preferred
  requestedQuantity: number;
  selectedItems: Array<{
    itemId: string;
    serialNumber?: string;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();

    // Verify admin authentication
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const adminId = payload.userId;
    const body = await request.json();
    const { selections }: { selections: ItemSelection[] } = body;


    // Find the request
    const requestLog = await RequestLog.findById(id);
    if (!requestLog) {
      return NextResponse.json(
        { error: 'ไม่พบคำขอ' },
        { status: 404 }
      );
    }

    // อนุญาตให้อนุมัติทีละรายการ แม้คำขอยังไม่ครบ (ห้ามอนุมัติซ้ำรายการเดิม)

    // Validate selections
    if (!selections || selections.length === 0) {
      return NextResponse.json(
        { error: 'กรุณาเลือกอุปกรณ์ที่จะมอบหมาย' },
        { status: 400 }
      );
    }

    // Validate that selections match request items (prefer masterId)
    for (const selection of selections) {
      const requestItem = requestLog.items.find((item: any) => {
        if (selection.masterId && item.masterId) {
          return item.masterId === selection.masterId;
        }
        return item.itemName === selection.itemName && ((item.categoryId || item.category || 'ไม่ระบุ') === selection.category);
      });
      
      if (!requestItem) {
        return NextResponse.json(
          { error: `ไม่พบรายการ ${selection.itemName} ในคำขอ` },
          { status: 400 }
        );
      }

      // ✅ Enhanced validation: Handle insufficient stock cases
      if (selection.selectedItems.length !== selection.requestedQuantity) {
        if (selection.selectedItems.length === 0) {
          // Case: No items available to select (insufficient stock)
          return NextResponse.json(
            { error: `ไม่สามารถอนุมัติได้: ไม่มี ${selection.itemName} เพียงพอในคลัง (ขอ ${selection.requestedQuantity} ชิ้น แต่ไม่มีให้เลือก)` },
            { status: 400 }
          );
        } else {
          // Case: Partial selection (admin didn't select enough items)
          return NextResponse.json(
            { error: `จำนวนที่เลือกสำหรับ ${selection.itemName} ไม่ตรงกับจำนวนที่ขอ (เลือก ${selection.selectedItems.length} จาก ${selection.requestedQuantity} ที่ต้องการ)` },
            { status: 400 }
          );
        }
      }
    }

    // Process the approval with selected items using new inventory system
    const assignedItems = [];
    const transferResults = [];

    try {
      // Process each selection
      for (const selection of selections) {
        const requestItem = requestLog.items.find((item: any) => {
          if (selection.masterId && item.masterId) {
            return item.masterId === selection.masterId;
          }
          return item.itemName === selection.itemName && ((item.categoryId || item.category || 'ไม่ระบุ') === selection.category);
        });

        if (!requestItem) {
          throw new Error(`Request item not found: ${selection.itemName}`);
        }

        // Track serial numbers and quantities for this selection
        const assignedSerialNumbers = [];
        let totalAssigned = 0;

        for (const selectedItem of selection.selectedItems) {
          // Find the inventory item
          const inventoryItem = await InventoryItem.findById(selectedItem.itemId);
          if (!inventoryItem) {
            throw new Error(`InventoryItem not found: ${selectedItem.itemId}`);
          }

          // Check if item is available
          if (inventoryItem.currentOwnership.ownerType !== 'admin_stock') {
            throw new Error(`${inventoryItem.itemName} ไม่พร้อมใช้งาน`);
          }

          // Transfer ownership using helper function
          const transferResult = await transferInventoryItem({
            itemId: inventoryItem._id.toString(),
            fromOwnerType: 'admin_stock',
            toOwnerType: 'user_owned',
            toUserId: requestLog.userId || 'unknown',
            transferType: 'request_approved',
            processedBy: adminId,
            requestId: id,
            reason: `Equipment request approved and assigned. Request: ${requestLog.reason}`
          });

          transferResults.push(transferResult);

          // Track assigned serial numbers
          if (inventoryItem.serialNumber) {
            assignedSerialNumbers.push(inventoryItem.serialNumber);
          } else {
          }

          totalAssigned += 1;
        }

        // Track assigned items for updating RequestLog
        assignedItems.push({
          itemName: selection.itemName,
          category: selection.category,
          assignedSerialNumbers: assignedSerialNumbers,
          assignedQuantity: totalAssigned,
          masterId: selection.masterId
        });
      }

      // Update RequestLog with assigned items and status/condition
      for (const assignedItem of assignedItems) {
        const requestItemIndex = requestLog.items.findIndex((item: any) => {
          if (assignedItem.masterId && item.masterId) {
            return item.masterId === assignedItem.masterId;
          }
          return item.itemName === assignedItem.itemName && ((item.categoryId || item.category || 'ไม่ระบุ') === assignedItem.category);
        });

        if (requestItemIndex !== -1) {
          if (!requestLog.items[requestItemIndex].assignedSerialNumbers) {
            requestLog.items[requestItemIndex].assignedSerialNumbers = [];
          }

          // Add assigned serial numbers
          if (assignedItem.assignedSerialNumbers && assignedItem.assignedSerialNumbers.length > 0) {
            requestLog.items[requestItemIndex].assignedSerialNumbers!.push(...assignedItem.assignedSerialNumbers);
          }

          // Set default status and condition IDs when approved
          requestLog.items[requestItemIndex].statusOnRequest = 'status_available'; // มี
          requestLog.items[requestItemIndex].conditionOnRequest = 'cond_working'; // ใช้งานได้
          // ถ้าจำนวนที่ assign ครบตามที่ขอ ถือว่าอนุมัติรายการนี้แล้ว
          if ((requestLog.items[requestItemIndex] as any).assignedQuantity == null) {
            (requestLog.items[requestItemIndex] as any).assignedQuantity = 0;
          }
          (requestLog.items[requestItemIndex] as any).assignedQuantity += assignedItem.assignedQuantity;
        }
      }

      // หากทุก item ในคำขอมี assignedQuantity >= quantity ให้ปิดงานทั้งคำขอ
      const allDone = requestLog.items.every((it: any) => (it.assignedQuantity || 0) >= it.quantity);
      if (allDone) {
        requestLog.status = 'completed';
      }
      await requestLog.save();


      return NextResponse.json({
        message: 'อนุมัติและมอบหมายอุปกรณ์เรียบร้อยแล้ว',
        requestId: id,
        requestCompleted: requestLog.status === 'completed',
        transferredItems: transferResults.length,
        assignedItems: assignedItems.map(item => ({
          itemName: item.itemName,
          assignedQuantity: item.assignedQuantity,
          serialNumbers: item.assignedSerialNumbers.length > 0 ? item.assignedSerialNumbers : ['ไม่มี SN']
        }))
      });

    } catch (approvalError) {
      console.error('Error during approval process:', approvalError);
      
      return NextResponse.json(
        { error: `เกิดข้อผิดพลาดในการอนุมัติ: ${approvalError}` },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error approving request with selection:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
