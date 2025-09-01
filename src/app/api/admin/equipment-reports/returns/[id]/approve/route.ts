import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import TransferLog from '@/models/TransferLog';
import { verifyTokenFromRequest } from '@/lib/auth';
import { transferInventoryItem } from '@/lib/inventory-helpers';

// Simple in-memory lock to prevent concurrent processing
const processingLocks = new Set<string>();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = await params; // Move id declaration to outer scope
  
  try {
    // Check if this return is already being processed
    if (processingLocks.has(id)) {
      return NextResponse.json(
        { error: 'คำขอคืนนี้กำลังดำเนินการอยู่ กรุณารอสักครู่' },
        { status: 429 }
      );
    }
    
    // Acquire lock
    processingLocks.add(id);
    
    try {
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

    console.log(`🔄 Processing return approval for return log ${id}`);

    // Find the return log
    const returnLog = await ReturnLog.findById(id);
    console.log(`🔍 Found return log:`, returnLog ? `${returnLog.firstName} ${returnLog.lastName}` : 'NOT FOUND');
    if (!returnLog) {
      return NextResponse.json(
        { error: 'ไม่พบคำขอคืนอุปกรณ์' },
        { status: 404 }
      );
    }

    if (returnLog.status === 'completed') {
      return NextResponse.json(
        { 
          message: 'คำขอคืนนี้ได้รับการอนุมัติแล้ว',
          returnId: id,
          alreadyApproved: true
        },
        { status: 200 }
      );
    }

    // Process each returned item
    const { transferInventoryItem } = await import('@/lib/inventory-helpers');
    const transferResults: any[] = [];
    
    // Get user ID for finding owned items
    const userIdToFind = returnLog.userId || `${returnLog.firstName}-${returnLog.lastName}`;
    
    for (const item of returnLog.items) {
      console.log(`🔍 Processing return item:`, JSON.stringify(item, null, 2));
      
      // If item has specific serial number, transfer that specific item
      if (item.serialNumber) {
        console.log(`🔍 Looking for InventoryItem with SN: ${item.serialNumber}`);
        console.log(`🔍 Query params: _id=${item.itemId}, serialNumber=${item.serialNumber}, ownerType=user_owned, userId=${userIdToFind}`);
        
        // Find the specific inventory item by _id (itemId in ReturnLog = InventoryItem._id)
        let inventoryItem = await InventoryItem.findOne({
          _id: item.itemId,
          serialNumber: item.serialNumber,
          'currentOwnership.ownerType': 'user_owned',
          'currentOwnership.userId': userIdToFind
        });

        // If not found in user_owned, check if it's already in admin_stock
        if (!inventoryItem) {
          const adminStockItem = await InventoryItem.findOne({
            _id: item.itemId,
            serialNumber: item.serialNumber,
            'currentOwnership.ownerType': 'admin_stock'
          });

          if (adminStockItem) {
            console.log(`ℹ️ Item ${item.serialNumber} is already in admin_stock - marking as already returned`);
            transferResults.push({
              itemId: adminStockItem._id.toString(),
              itemName: item.itemName || 'Unknown Item',
              serialNumber: item.serialNumber,
              transferType: 'already_returned',
              success: true,
              message: 'Item was already in admin stock'
            });
            continue;
          }

          // Try to find the item without strict matching to see what's wrong
          const debugItem = await InventoryItem.findById(item.itemId);
          console.warn(`⚠️ Serial number ${item.serialNumber} not found for user ${userIdToFind}`);
          console.warn(`🔍 Debug - Item exists:`, debugItem ? {
            _id: debugItem._id,
            serialNumber: debugItem.serialNumber,
            ownerType: debugItem.currentOwnership.ownerType,
            userId: debugItem.currentOwnership.userId
          } : 'NOT_FOUND');
          continue;
        }

        console.log(`✅ Found InventoryItem for SN ${item.serialNumber}:`, {
          _id: inventoryItem._id,
          ownerType: inventoryItem.currentOwnership.ownerType,
          userId: inventoryItem.currentOwnership.userId
        });

        // Transfer back to admin stock
        const transferredItem = await transferInventoryItem({
          itemId: inventoryItem._id.toString(),
          fromOwnerType: 'user_owned',
          fromUserId: userIdToFind,
          toOwnerType: 'admin_stock',
          transferType: 'return_completed',
          processedBy: adminId,
          returnId: id,
          reason: `Equipment returned by ${returnLog.firstName} ${returnLog.lastName} via return log ${id}`
        });

        transferResults.push({
          itemId: transferredItem._id.toString(),
          itemName: transferredItem.itemName,
          serialNumber: transferredItem.serialNumber,
          transferType: 'return_completed',
          success: true,
          message: `Returned ${transferredItem.itemName} (${transferredItem.serialNumber || 'No SN'}) to admin stock`
        });
        console.log(`✅ Returned item SN: ${item.serialNumber} back to admin stock`);
      } else {
        console.log(`🔍 Looking for InventoryItem without SN`);
        console.log(`🔍 Query params: _id=${item.itemId}, ownerType=user_owned, userId=${userIdToFind}`);
        
        // For items without serial numbers, find by _id
        let inventoryItem = await InventoryItem.findOne({
          _id: item.itemId,
          $or: [
            { serialNumber: { $exists: false } },
            { serialNumber: '' },
            { serialNumber: null }
          ],
          'currentOwnership.ownerType': 'user_owned',
          'currentOwnership.userId': userIdToFind
        });

        // If not found in user_owned, check if it's already in admin_stock
        if (!inventoryItem) {
          const adminStockItem = await InventoryItem.findOne({
            _id: item.itemId,
            $or: [
              { serialNumber: { $exists: false } },
              { serialNumber: '' },
              { serialNumber: null }
            ],
            'currentOwnership.ownerType': 'admin_stock'
          });

          if (adminStockItem) {
            console.log(`ℹ️ Item (no SN) is already in admin_stock - marking as already returned`);
            transferResults.push({
              itemId: adminStockItem._id.toString(),
              itemName: item.itemName || 'Unknown Item',
              serialNumber: null,
              transferType: 'already_returned',
              success: true,
              message: 'Item was already in admin stock'
            });
            continue;
          }
        }

        if (inventoryItem) {
          console.log(`✅ Found InventoryItem without SN:`, {
            _id: inventoryItem._id,
            ownerType: inventoryItem.currentOwnership.ownerType,
            userId: inventoryItem.currentOwnership.userId
          });
          
          const userOwnedItems = [inventoryItem]; // Convert to array for existing loop

          for (const inventoryItem of userOwnedItems) {
            const transferredItem = await transferInventoryItem({
              itemId: inventoryItem._id.toString(),
              fromOwnerType: 'user_owned',
              fromUserId: userIdToFind,
              toOwnerType: 'admin_stock',
              transferType: 'return_completed',
              processedBy: adminId,
              returnId: id,
              reason: `Equipment returned by ${returnLog.firstName} ${returnLog.lastName} via return log ${id}`
            });

            transferResults.push({
              itemId: transferredItem._id.toString(),
              itemName: transferredItem.itemName,
              serialNumber: transferredItem.serialNumber || null,
              transferType: 'return_completed',
              success: true,
              message: `Returned ${transferredItem.itemName} (${transferredItem.serialNumber || 'No SN'}) to admin stock`
            });
            console.log(`✅ Returned 1x ${item.itemName} (no SN) back to admin stock`);
          }
        } else {
          // Try to find the item without strict matching to see what's wrong
          const debugItem = await InventoryItem.findById(item.itemId);
          console.warn(`⚠️ InventoryItem without SN not found for user ${userIdToFind}`);
          console.warn(`🔍 Debug - Item exists:`, debugItem ? {
            _id: debugItem._id,
            serialNumber: debugItem.serialNumber,
            ownerType: debugItem.currentOwnership.ownerType,
            userId: debugItem.currentOwnership.userId
          } : 'NOT_FOUND');
        }
      }
    }

    // Mark return log as completed
    returnLog.status = 'completed';
    await returnLog.save();

    // Verify that items were actually transferred
    if (transferResults.length === 0) {
      console.error(`❌ No items were transferred for return request ${id}`);
      return NextResponse.json(
        { error: 'ไม่พบอุปกรณ์ที่ต้องการคืน หรืออุปกรณ์ไม่ได้อยู่กับผู้ใช้งานนี้' },
        { status: 400 }
      );
    }

    // Update InventoryMaster aggregation after transfer
    const { updateInventoryMaster } = await import('@/lib/inventory-helpers');
    const masterUpdateResults = [];
    
    for (const item of returnLog.items) {
      try {
        const masterResult = await updateInventoryMaster(item.itemName, item.category);
        masterUpdateResults.push({
          itemName: item.itemName,
          category: item.category,
          success: true,
          result: masterResult
        });
        console.log(`📊 Updated InventoryMaster for ${item.itemName}`);
      } catch (error) {
        console.error(`❌ Failed to update InventoryMaster for ${item.itemName}:`, error);
        masterUpdateResults.push({
          itemName: item.itemName,
          category: item.category,
          success: false,
          error: error.message
        });
      }
    }

    // Verify InventoryMaster updates
    const failedUpdates = masterUpdateResults.filter(result => !result.success);
    if (failedUpdates.length > 0) {
      console.error(`❌ Some InventoryMaster updates failed:`, failedUpdates);
      // Don't fail the entire operation, but log the issue
    }

    // Final verification: Check that items are actually back in admin_stock
    const verificationResults = [];
    for (const result of transferResults) {
      try {
        const verifyItem = await InventoryItem.findById(result.itemId);
        
        // For already_returned items, they should already be in admin_stock
        const isCorrectState = verifyItem && verifyItem.currentOwnership.ownerType === 'admin_stock';
        
        verificationResults.push({
          itemId: result.itemId,
          verified: isCorrectState,
          ownerType: verifyItem?.currentOwnership.ownerType || 'NOT_FOUND',
          transferType: result.transferType,
          alreadyReturned: result.transferType === 'already_returned'
        });
      } catch (error) {
        verificationResults.push({
          itemId: result.itemId,
          verified: false,
          error: error.message,
          transferType: result.transferType
        });
      }
    }

    const unverifiedItems = verificationResults.filter(v => !v.verified);
    if (unverifiedItems.length > 0) {
      console.error(`❌ Some items were not properly transferred:`, unverifiedItems);
      return NextResponse.json(
        { 
          error: 'การคืนอุปกรณ์ไม่สมบูรณ์ กรุณาลองใหม่อีกครั้ง',
          details: { unverifiedItems, transferResults }
        },
        { status: 500 }
      );
    }

    const actualTransfers = transferResults.filter(r => r.transferType !== 'already_returned').length;
    const alreadyReturnedCount = transferResults.filter(r => r.transferType === 'already_returned').length;
    
    console.log(`✅ Return request ${id} approved successfully. ${actualTransfers} items transferred, ${alreadyReturnedCount} already returned`);
    console.log(`✅ All verifications passed:`, { transferResults: transferResults.length, masterUpdates: masterUpdateResults.length, verifications: verificationResults.length });

    let message = 'ยืนยันการคืนอุปกรณ์เรียบร้อยแล้ว';
    if (alreadyReturnedCount > 0) {
      message += ` (${alreadyReturnedCount} รายการอยู่ในคลังแล้ว)`;
    }

    return NextResponse.json({
      message,
      returnId: id,
      transferredItems: actualTransfers,
      alreadyReturnedItems: alreadyReturnedCount,
      totalItems: transferResults.length,
      transferResults: transferResults.map(result => ({
        itemName: result.itemName,
        serialNumber: result.serialNumber,
        transferType: result.transferType,
        message: result.message
      })),
      masterUpdates: masterUpdateResults,
      verifications: verificationResults
    });

    } finally {
      // Release lock
      processingLocks.delete(id);
    }
  } catch (error) {
    console.error('Return approval error:', error);
    // Make sure to release lock even if there's an outer error
    processingLocks.delete(id);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
