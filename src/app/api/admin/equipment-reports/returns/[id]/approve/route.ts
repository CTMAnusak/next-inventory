import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import TransferLog from '@/models/TransferLog';
import User from '@/models/User';
import { verifyTokenFromRequest } from '@/lib/auth';
import { transferInventoryItem } from '@/lib/inventory-helpers';
import { sendEquipmentReturnApprovalNotification } from '@/lib/email';

// Simple in-memory lock to prevent concurrent processing
const processingLocks = new Set<string>();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const adminUserInfo = await User.findById(adminId).select('firstName lastName email');
    const adminName = adminUserInfo
      ? [adminUserInfo.firstName, adminUserInfo.lastName].filter(Boolean).join(' ').trim() || adminUserInfo.email || 'Admin'
      : 'Admin';


    // Find the return log
    const returnLog = await ReturnLog.findById(id);
    if (!returnLog) {
      return NextResponse.json(
        { error: 'ไม่พบคำขอคืนอุปกรณ์' },
        { status: 404 }
      );
    }

    if ((returnLog as any).status === 'completed') {
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
    const userIdToFind = returnLog.userId || `${(returnLog as any).firstName}-${(returnLog as any).lastName}`;
    
    for (const item of returnLog.items) {
      
      // If item has specific serial number, transfer that specific item
      if (item.serialNumber) {
        
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
            transferResults.push({
              itemId: (adminStockItem._id as any).toString(),
              itemName: (item as any).itemName || 'Unknown Item',
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

        // Transfer back to admin stock
        const transferredItem = await transferInventoryItem({
          itemId: (inventoryItem._id as any).toString(),
          fromOwnerType: 'user_owned',
          fromUserId: userIdToFind,
          toOwnerType: 'admin_stock',
          transferType: 'return_completed',
          processedBy: adminId,
          returnId: id,
          reason: `Equipment returned by ${(returnLog as any).firstName} ${(returnLog as any).lastName} via return log ${id}`
        });

        transferResults.push({
          itemId: (transferredItem._id as any).toString(),
          itemName: transferredItem.itemName,
          serialNumber: transferredItem.serialNumber,
          transferType: 'return_completed',
          success: true,
          message: `Returned ${transferredItem.itemName} (${transferredItem.serialNumber || 'No SN'}) to admin stock`
        });
      } else {
        
        // For items without serial numbers, find all items with the same name owned by user
        // ใช้ itemId เป็นหลัก และใช้ masterItemId เป็น fallback
        let userOwnedItems = await InventoryItem.find({
          $and: [
            {
              $or: [
                { _id: item.itemId }, // ใช้ itemId เป็นหลัก
                ...((item as any).masterItemId ? [{ masterItemId: (item as any).masterItemId }] : []) // fallback ใช้ masterItemId
              ]
            },
            {
              $or: [
                { serialNumber: { $exists: false } },
                { serialNumber: '' },
                { serialNumber: null }
              ]
            },
            {
              'currentOwnership.ownerType': 'user_owned',
              'currentOwnership.userId': userIdToFind
            }
          ]
        }).limit(item.quantity); // จำกัดจำนวนตามที่ต้องการคืน


        if (userOwnedItems.length === 0) {
          console.warn(`⚠️ No items without SN found for user ${userIdToFind} - item: ${(item as any).itemName}`);
          
          // Check if items are already in admin_stock
          const adminStockItems = await InventoryItem.find({
            itemName: (item as any).itemName,
            $or: [
              { serialNumber: { $exists: false } },
              { serialNumber: '' },
              { serialNumber: null }
            ],
            'currentOwnership.ownerType': 'admin_stock'
          }).limit(item.quantity);

          if (adminStockItems.length > 0) {
            for (const adminStockItem of adminStockItems) {
              transferResults.push({
                itemId: (adminStockItem._id as any).toString(),
                itemName: (item as any).itemName || 'Unknown Item',
                serialNumber: null,
                transferType: 'already_returned',
                success: true,
                message: 'Item was already in admin stock'
              });
            }
            continue;
          }

          // Try to find the item without strict matching to see what's wrong
          const debugItems = await InventoryItem.find({
            itemName: (item as any).itemName,
            $or: [
              { serialNumber: { $exists: false } },
              { serialNumber: '' },
              { serialNumber: null }
            ]
          });
          console.warn(`🔍 Debug - Items with name "${(item as any).itemName}" exist:`, debugItems.map(i => ({
            _id: i._id,
            serialNumber: i.serialNumber,
            ownerType: i.currentOwnership.ownerType,
            userId: i.currentOwnership.userId
          })));
          continue;
        }

        // Check if we have enough items to return
        if (userOwnedItems.length < item.quantity) {
          console.warn(`⚠️ Not enough items to return: requested ${item.quantity}, found ${userOwnedItems.length}`);
          return NextResponse.json(
            { error: `ไม่พบอุปกรณ์เพียงพอสำหรับคืน: ต้องการ ${item.quantity} ชิ้น แต่พบเพียง ${userOwnedItems.length} ชิ้น` },
            { status: 400 }
          );
        }

        // Transfer the specified quantity of items
        for (let i = 0; i < item.quantity; i++) {
          const inventoryItem = userOwnedItems[i];
          
          const transferredItem = await transferInventoryItem({
            itemId: (inventoryItem._id as any).toString(),
            fromOwnerType: 'user_owned',
            fromUserId: userIdToFind,
            toOwnerType: 'admin_stock',
            transferType: 'return_completed',
            processedBy: adminId,
            returnId: id,
            reason: `Equipment returned by ${(returnLog as any).firstName} ${(returnLog as any).lastName} via return log ${id} (${i + 1}/${item.quantity})`
          });

          transferResults.push({
            itemId: (transferredItem._id as any).toString(),
            itemName: transferredItem.itemName,
            serialNumber: transferredItem.serialNumber || null,
            transferType: 'return_completed',
            success: true,
            message: `Returned ${transferredItem.itemName} (${transferredItem.serialNumber || 'No SN'}) to admin stock (${i + 1}/${item.quantity})`
          });
        }
      }
    }

    // Mark return log as completed
    (returnLog as any).status = 'completed';
    (returnLog as any).approvedAt = new Date();
    (returnLog as any).approvedBy = adminId;
    (returnLog as any).approvedByName = adminName;
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
        const masterResult = await updateInventoryMaster((item as any).itemName, (item as any).categoryId);
        masterUpdateResults.push({
          itemName: (item as any).itemName,
          categoryId: (item as any).categoryId,
          success: true,
          result: masterResult
        });
      } catch (error) {
        console.error(`❌ Failed to update InventoryMaster for ${(item as any).itemName}:`, error);
        masterUpdateResults.push({
          itemName: (item as any).itemName,
          category: (item as any).category,
          success: false,
          error: (error as any).message
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
          error: (error as any).message,
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
    

    // ตรวจสอบว่าเป็น auto return หรือไม่ และลบ user อัตโนมัติหากไม่มีอุปกรณ์เหลือ
    let userDeletionMessage = '';
    if (returnLog.isAutoReturn) {
      
      try {
        // หา user ที่เกี่ยวข้อง
        const userToCheck = await User.findOne({ user_id: userIdToFind });
        if (userToCheck && userToCheck.pendingDeletion) {
          
          // ตรวจสอบว่ายังมีอุปกรณ์เหลืออยู่หรือไม่
          const remainingEquipment = await InventoryItem.find({
            'currentOwnership.ownerType': 'user_owned',
            'currentOwnership.userId': userIdToFind
          });
          
          
          if (remainingEquipment.length === 0) {
            // ไม่มีอุปกรณ์เหลือ - Snapshot และลบ user
            
            // 🆕 1. Snapshot ข้อมูลใน IssueLog และ Equipment Logs ก่อนลบ
            try {
              const { snapshotUserBeforeDelete } = await import('@/lib/snapshot-helpers');
              const snapshotResult = await snapshotUserBeforeDelete(userToCheck.user_id);
              console.log('📸 Snapshot user data before final deletion:', snapshotResult);
            } catch (e) {
              console.error('Failed to snapshot user data before final deletion:', e);
            }
            
            // 🆕 2. Snapshot User record ใน DeletedUsers
            try {
              const DeletedUsers = (await import('@/models/DeletedUser')).default;
              await DeletedUsers.findOneAndUpdate(
                { userMongoId: userToCheck._id.toString() },
                {
                  userMongoId: userToCheck._id.toString(),
                  user_id: userToCheck.user_id,
                  firstName: userToCheck.firstName,
                  lastName: userToCheck.lastName,
                  nickname: userToCheck.nickname,
                  department: userToCheck.department,
                  office: userToCheck.office,
                  phone: userToCheck.phone,
                  email: userToCheck.email,
                  deletedAt: new Date()
                },
                { upsert: true, new: true }
              );
            } catch (e) {
              console.error('Failed to snapshot user record:', e);
            }
            
            // 3. ลบ user
            await User.findByIdAndDelete(userToCheck._id);
            userDeletionMessage = ` และลบบัญชีผู้ใช้ ${userToCheck.firstName} ${userToCheck.lastName} เรียบร้อยแล้ว`;
            
            // ส่งสัญญาณให้ client ที่ user นี้ logout (ถ้ามี session อยู่)
            try {
              await fetch(new URL('/api/admin/force-logout-user', request.url).toString(), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Cookie': request.headers.get('Cookie') || ''
                },
                body: JSON.stringify({ userId: userToCheck.user_id })
              });
            } catch (logoutError) {
              console.error('Error sending logout signal:', logoutError);
              // ไม่ให้ error นี้ส่งผลต่อการ approve return
            }
          } else {
            console.log(`⏳ User ${userToCheck.user_id} still has ${remainingEquipment.length} equipment items, keeping account`);
          }
        }
      } catch (error) {
        console.error('Error checking user deletion:', error);
        // ไม่ให้ error นี้ส่งผลต่อการ approve return
      }
    }

    let message = 'ยืนยันการคืนอุปกรณ์เรียบร้อยแล้ว' + userDeletionMessage;
    if (alreadyReturnedCount > 0) {
      message += ` (${alreadyReturnedCount} รายการอยู่ในคลังแล้ว)`;
    }

    // ✅ Clear cache to ensure dashboard shows updated data after approval
    const { clearAllCaches } = await import('@/lib/cache-utils');
    clearAllCaches();

    try {
      const emailPayload = {
        ...returnLog.toObject(),
        firstName: (returnLog as any).firstName || returnLog.returnerFirstName,
        lastName: (returnLog as any).lastName || returnLog.returnerLastName,
        nickname: (returnLog as any).nickname || returnLog.returnerNickname,
        department: (returnLog as any).department || returnLog.returnerDepartment,
        office:
          (returnLog as any).office ||
          returnLog.returnerOfficeName ||
          returnLog.returnerOffice,
        phone: (returnLog as any).phone || returnLog.returnerPhone,
        email: (returnLog as any).email || returnLog.returnerEmail,
        approvedByName: adminName
      };
      await sendEquipmentReturnApprovalNotification(emailPayload);
    } catch (emailError) {
      console.error('Equipment return approval email notification error:', emailError);
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
