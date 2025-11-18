import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import { verifyToken } from '@/lib/auth';
import { sendEquipmentReturnCancellationNotification } from '@/lib/email';

// POST - ยกเลิกการคืน (สำหรับรายการที่ pending เท่านั้น)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Verify user token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    
    const { returnLogId, itemId } = await request.json();
    
    if (!returnLogId || !itemId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ Return Log ID และ Item ID' },
        { status: 400 }
      );
    }
    
    // ✅ Normalize itemId to string (ensure consistent comparison)
    const normalizedItemId = String(itemId);
    
    console.log('🔍 [Cancel Return] Looking for item:', {
      returnLogId,
      itemId: normalizedItemId,
      itemIdType: typeof normalizedItemId
    });
    
    // Find the return log
    const returnLog = await ReturnLog.findById(returnLogId);
    
    if (!returnLog) {
      return NextResponse.json(
        { error: 'ไม่พบรายการคืนอุปกรณ์' },
        { status: 404 }
      );
    }
    
    // Verify ownership
    if (returnLog.userId !== payload.userId) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์ยกเลิกรายการคืนนี้' },
        { status: 403 }
      );
    }
    
    // ✅ Log all items in return log for debugging
    console.log('🔍 [Cancel Return] Return log items:', returnLog.items.map((item: any, idx: number) => ({
      index: idx,
      itemId: String(item.itemId),
      itemIdType: typeof item.itemId,
      itemName: item.itemName,
      approvalStatus: item.approvalStatus,
      matches: String(item.itemId) === normalizedItemId
    })));
    
    // Find the item in the return log (normalize both sides for comparison)
    const itemIndex = returnLog.items.findIndex((item: any) => String(item.itemId) === normalizedItemId);
    
    if (itemIndex === -1) {
      console.error('❌ [Cancel Return] Item not found:', {
        requestedItemId: normalizedItemId,
        availableItemIds: returnLog.items.map((item: any) => String(item.itemId))
      });
      return NextResponse.json(
        { error: 'ไม่พบรายการอุปกรณ์ที่ต้องการยกเลิก' },
        { status: 404 }
      );
    }
    
    console.log('✅ [Cancel Return] Found item at index:', itemIndex);
    
    const item = returnLog.items[itemIndex];
    
    // ✅ สร้าง deep copy ของ original log เพื่อใช้ส่งอีเมล
    const originalLog = JSON.parse(JSON.stringify(returnLog.toObject()));

    // Check if item is still pending
    if (item.approvalStatus !== 'pending') {
      return NextResponse.json(
        { error: 'ไม่สามารถยกเลิกรายการที่อนุมัติแล้ว' },
        { status: 400 }
      );
    }
    
    console.log('🔍 [Cancel Return] Item approval status:', item.approvalStatus);

    // ✅ เก็บข้อมูลรายการที่ถูกลบไว้ก่อนลบ (สำหรับส่งอีเมล)
    let cancelledItem: any = { ...item };
    
    // ✅ ตรวจสอบและเก็บ quantity ไว้ (ต้องมีค่าเสมอ)
    cancelledItem.quantity = item.quantity || cancelledItem.quantity || 1;
    
    // ✅ เก็บ assetNumber และ itemNotes จาก item (ถ้ามี)
    cancelledItem.assetNumber = item.assetNumber || cancelledItem.assetNumber || undefined;
    cancelledItem.itemNotes = item.itemNotes || cancelledItem.itemNotes || undefined;
    
    console.log('🔍 Original item data:', {
      itemId: item.itemId,
      itemName: item.itemName,
      category: item.category,
      categoryId: item.categoryId,
      quantity: item.quantity,
      serialNumber: item.serialNumber,
      numberPhone: item.numberPhone
    });

    // ✅ Populate ข้อมูลอุปกรณ์จาก InventoryItem ก่อนส่งอีเมล
    try {
      const InventoryItem = (await import('@/models/InventoryItem')).default;
      
      if (!item.itemId) {
        console.warn('⚠️ No itemId found in item:', item);
      } else {
        const inventoryItem = await InventoryItem.findById(item.itemId).select(
          'itemName categoryId serialNumber numberPhone'
        );
        
        if (inventoryItem) {
          console.log('✅ Found inventory item:', {
            itemId: item.itemId,
            itemName: inventoryItem.itemName,
            categoryId: inventoryItem.categoryId,
            serialNumber: inventoryItem.serialNumber,
            numberPhone: inventoryItem.numberPhone
          });
          
          // อัพเดตข้อมูลอุปกรณ์จาก InventoryItem (ใช้ค่าจาก InventoryItem เป็นหลัก)
          cancelledItem.itemName = inventoryItem.itemName || cancelledItem.itemName || item.itemName;
          cancelledItem.categoryId = inventoryItem.categoryId || cancelledItem.categoryId || item.categoryId;
          cancelledItem.serialNumber = inventoryItem.serialNumber || cancelledItem.serialNumber || item.serialNumber;
          cancelledItem.numberPhone = inventoryItem.numberPhone || cancelledItem.numberPhone || item.numberPhone;
          
          // Populate category name
          if (inventoryItem.categoryId) {
            const { getCategoryNameById } = await import('@/lib/item-name-resolver');
            const categoryName = await getCategoryNameById(inventoryItem.categoryId);
            if (categoryName) {
              cancelledItem.category = categoryName;
              console.log('✅ Category name resolved:', categoryName);
            }
          }
        } else {
          console.warn('⚠️ Inventory item not found for itemId:', item.itemId);
          // ใช้ข้อมูลจาก snapshot ถ้าไม่เจอ InventoryItem
          // ตรวจสอบว่ามีข้อมูลจาก snapshot หรือไม่
          if (!cancelledItem.itemName && item.itemName) {
            cancelledItem.itemName = item.itemName;
          }
          if (!cancelledItem.category && item.category) {
            cancelledItem.category = item.category;
          }
        }
      }
    } catch (itemPopulateError) {
      console.error('❌ Failed to populate item info for email:', itemPopulateError);
      // ใช้ข้อมูลจาก snapshot ถ้า populate ไม่สำเร็จ
      if (!cancelledItem.itemName && item.itemName) {
        cancelledItem.itemName = item.itemName;
      }
      if (!cancelledItem.category && item.category) {
        cancelledItem.category = item.category;
      }
    }
    
    // ✅ ตรวจสอบว่ามีข้อมูลครบถ้วนหรือไม่
    if (!cancelledItem.itemName) {
      console.error('❌ Missing itemName in cancelledItem:', cancelledItem);
      cancelledItem.itemName = item.itemName || 'Unknown Item';
    }
    if (!cancelledItem.category) {
      console.warn('⚠️ Missing category, trying to resolve from categoryId:', cancelledItem.categoryId);
      if (cancelledItem.categoryId) {
        try {
          const { getCategoryNameById } = await import('@/lib/item-name-resolver');
          const categoryName = await getCategoryNameById(cancelledItem.categoryId);
          if (categoryName) {
            cancelledItem.category = categoryName;
          } else {
            cancelledItem.category = item.category || 'ไม่ระบุ';
          }
        } catch (error) {
          cancelledItem.category = item.category || 'ไม่ระบุ';
        }
      } else {
        cancelledItem.category = item.category || 'ไม่ระบุ';
      }
    }
    
    // ✅ Log ข้อมูลที่เตรียมส่งอีเมล
    console.log('📧 Email data prepared:', {
      itemName: cancelledItem.itemName,
      category: cancelledItem.category,
      categoryId: cancelledItem.categoryId,
      quantity: cancelledItem.quantity,
      serialNumber: cancelledItem.serialNumber,
      numberPhone: cancelledItem.numberPhone,
      assetNumber: cancelledItem.assetNumber,
      itemNotes: cancelledItem.itemNotes
    });

    // ✅ Populate ข้อมูลผู้ใช้จาก userId ก่อนส่งอีเมล
    let emailData: any = {
      ...originalLog,
      // ส่งเฉพาะรายการที่ถูกลบออกไป (พร้อมข้อมูลที่ populate แล้ว)
      items: [cancelledItem],
      cancellationReason: 'ผู้ใช้ยกเลิกรายการคืนด้วยตนเอง',
      cancelledAt: new Date()
    };

    // Populate ข้อมูลผู้ใช้จาก User collection
    try {
      const User = (await import('@/models/User')).default;
      const user = await User.findOne({ user_id: returnLog.userId }).select(
        'firstName lastName nickname department office officeId officeName phone email userType'
      );
      
      if (user) {
        // เพิ่มข้อมูลผู้ใช้จาก User collection
        emailData.firstName = user.firstName || emailData.returnerFirstName;
        emailData.lastName = user.lastName || emailData.returnerLastName;
        emailData.nickname = user.nickname || emailData.returnerNickname;
        emailData.department = user.department || emailData.returnerDepartment;
        emailData.phone = user.phone || emailData.returnerPhone;
        emailData.email = user.email || emailData.returnerEmail;
        
        // สำหรับ office ใช้ officeName จาก User หรือ returnerOfficeName
        if (user.officeId && user.officeId !== 'UNSPECIFIED_OFFICE') {
          const { getOfficeNameById } = await import('@/lib/office-helpers');
          try {
            emailData.office = await getOfficeNameById(user.officeId) || user.officeName || emailData.returnerOfficeName || emailData.returnerOffice;
          } catch (error) {
            emailData.office = user.officeName || user.office || emailData.returnerOfficeName || emailData.returnerOffice;
          }
        } else {
          emailData.office = user.officeName || user.office || emailData.returnerOfficeName || emailData.returnerOffice;
        }
      }
    } catch (populateError) {
      console.warn('Failed to populate user info for email:', populateError);
      // ใช้ข้อมูลจาก snapshot ถ้า populate ไม่สำเร็จ
    }

    // ✅ ส่งอีเมลแจ้งเตือนให้เสร็จก่อนถึงค่อยลบ/อัพเดต ReturnLog
    try {
      console.log('📧 [API] About to send return cancellation email');
      await sendEquipmentReturnCancellationNotification(emailData);
      console.log('✅ [API] Return cancellation email sent successfully');
    } catch (emailError) {
      console.error('Return cancellation email notification error:', emailError);
      // ไม่ให้ email error ทำให้การยกเลิกล้มเหลว แต่ log error ไว้
    }

    // ✅ หลังจากส่งอีเมลเสร็จแล้ว ถึงค่อยลบ/อัพเดต ReturnLog
    console.log('🗑️ [Cancel Return] Starting database update process');
    console.log('🗑️ [Cancel Return] Items before removal:', returnLog.items.length);
    console.log('🗑️ [Cancel Return] Item to remove - index:', itemIndex, 'itemId:', normalizedItemId);
    
    // ✅ ถ้าเหลือแค่ 1 item ให้ลบ document ทั้งอัน
    if (returnLog.items.length === 1) {
      console.log('🗑️ [Cancel Return] Only 1 item left, deleting entire return log document');
      
      // ใช้ findByIdAndDelete แทน delete() เพื่อความแน่นอน
      const deleteResult = await ReturnLog.findByIdAndDelete(returnLogId);
      
      if (!deleteResult) {
        console.error('❌ [Cancel Return] Failed to delete return log!');
        return NextResponse.json(
          { error: 'ไม่สามารถลบรายการคืนได้' },
          { status: 500 }
        );
      }
      
      console.log('✅ [Cancel Return] Return log document deleted successfully');
      
      // ตรวจสอบว่าลบจริงๆ
      const verifyDeleted = await ReturnLog.findById(returnLogId);
      if (verifyDeleted) {
        console.error('❌ [Cancel Return] Document still exists after delete!');
        // ลองลบอีกครั้ง
        await ReturnLog.deleteOne({ _id: returnLogId });
      } else {
        console.log('✅ [Cancel Return] Verified: Document deleted from database');
      }
      
      // Clear cache
      try {
        const { clearAllCaches } = await import('@/lib/cache-utils');
        clearAllCaches();
        console.log('✅ [Cancel Return] Cache cleared (entire log deleted)');
      } catch (cacheError) {
        console.error('❌ [Cancel Return] Could not clear caches:', cacheError);
      }
      
      return NextResponse.json({
        message: 'ยกเลิกการคืนเรียบร้อยแล้ว (ลบรายการคืนทั้งหมด)',
        deletedEntireLog: true
      });
    }

    // ✅ ถ้ามีหลาย items ให้ใช้ MongoDB $pull operator เพื่อลบ item ที่ต้องการ
    console.log('💾 [Cancel Return] Multiple items exist, using $pull to remove specific item');
    
    // ใช้ updateOne กับ $pull แทนการ splice และ save
    const updateResult = await ReturnLog.updateOne(
      { _id: returnLogId },
      { 
        $pull: { 
          items: { 
            itemId: normalizedItemId 
          } 
        } 
      }
    );
    
    console.log('✅ [Cancel Return] Update result:', {
      acknowledged: updateResult.acknowledged,
      modifiedCount: updateResult.modifiedCount,
      matchedCount: updateResult.matchedCount
    });
    
    if (updateResult.modifiedCount === 0) {
      console.error('❌ [Cancel Return] No documents were modified!');
      return NextResponse.json(
        { error: 'ไม่สามารถอัพเดตรายการคืนได้' },
        { status: 500 }
      );
    }
    
    // ✅ Verify that the item was actually removed
    const verifyReturnLog = await ReturnLog.findById(returnLogId);
    if (!verifyReturnLog) {
      console.error('❌ [Cancel Return] Return log not found after update!');
      return NextResponse.json(
        { error: 'ไม่พบรายการคืนหลังอัพเดต' },
        { status: 500 }
      );
    }
    
    const stillHasItem = verifyReturnLog.items.some((item: any) => String(item.itemId) === normalizedItemId);
    
    if (stillHasItem) {
      console.error('❌ [Cancel Return] Item still exists after $pull operation!');
      console.error('❌ [Cancel Return] Current items:', verifyReturnLog.items.map((item: any) => ({
        itemId: String(item.itemId),
        itemName: item.itemName
      })));
      
      // ลองลบอีกครั้งด้วย deleteOne ถ้า $pull ไม่ทำงาน
      await ReturnLog.updateOne(
        { _id: returnLogId },
        { 
          $pull: { 
            items: { 
              _id: item._id  // ลองใช้ _id แทน
            } 
          } 
        }
      );
      
      return NextResponse.json(
        { error: 'พบปัญหาในการลบรายการ กรุณาลองใหม่อีกครั้ง' },
        { status: 500 }
      );
    }
    
    console.log('✅ [Cancel Return] Verified: Item successfully removed');
    console.log('✅ [Cancel Return] Remaining items count:', verifyReturnLog.items.length);
    console.log('✅ [Cancel Return] Remaining items:', verifyReturnLog.items.map((item: any) => ({
      itemId: String(item.itemId),
      itemName: item.itemName,
      approvalStatus: item.approvalStatus
    })));
    
    // Clear cache
    try {
      const { clearAllCaches } = await import('@/lib/cache-utils');
      clearAllCaches();
      console.log('✅ [Cancel Return] Cache cleared (log updated)');
    } catch (cacheError) {
      console.error('❌ [Cancel Return] Could not clear caches:', cacheError);
    }

    return NextResponse.json({
      message: 'ยกเลิกการคืนเรียบร้อยแล้ว',
      deletedEntireLog: false,
      remainingItems: verifyReturnLog.items.length
    });
    
  } catch (error) {
    console.error('Error canceling return:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการยกเลิกการคืน' },
      { status: 500 }
    );
  }
}

