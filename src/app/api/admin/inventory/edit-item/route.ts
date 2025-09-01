import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const { 
      itemId, 
      itemName, 
      category, 
      operation, 
      newSerialNumber, 
      reason, 
      oldSerialNumber 
    } = await request.json();

    console.log('🔧 Edit Item Request:', {
      itemId,
      itemName,
      category,
      operation,
      newSerialNumber,
      oldSerialNumber,
      reason
    });

    // Validate required fields
    if (!itemId || !itemName || !category || !operation) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // Find the item
    const existingItem = await InventoryItem.findById(itemId);
    if (!existingItem) {
      return NextResponse.json(
        { error: 'ไม่พบรายการอุปกรณ์' },
        { status: 404 }
      );
    }

    if (operation === 'edit') {
      // Edit operation - update serial number
      if (!newSerialNumber || !newSerialNumber.trim()) {
        return NextResponse.json(
          { error: 'กรุณาระบุ Serial Number ใหม่' },
          { status: 400 }
        );
      }

      // Check if new serial number already exists for this item type
      const duplicateCheck = await InventoryItem.findOne({
        itemName,
        category,
        serialNumber: newSerialNumber.trim(),
        status: { $ne: 'deleted' }, // ยกเว้นรายการที่ถูกลบแล้ว
        _id: { $ne: itemId } // Exclude current item
      });

      if (duplicateCheck) {
        return NextResponse.json({
          success: false,
          message: `Serial Number "${newSerialNumber}" มีอยู่แล้วสำหรับ ${itemName}`,
          isDuplicate: true
        });
      }

      // Update the serial number
      existingItem.serialNumber = newSerialNumber.trim();
      existingItem.updatedAt = new Date();
      
      await existingItem.save();

      console.log('✅ Item updated successfully:', {
        itemId,
        oldSN: oldSerialNumber,
        newSN: newSerialNumber
      });

      return NextResponse.json({
        success: true,
        message: 'แก้ไข Serial Number สำเร็จ',
        item: {
          itemId: existingItem._id,
          serialNumber: existingItem.serialNumber,
          itemName: existingItem.itemName,
          category: existingItem.category
        }
      });

    } else if (operation === 'delete') {
      // Delete operation
      if (!reason || !reason.trim()) {
        return NextResponse.json(
          { error: 'กรุณาระบุเหตุผลในการลบรายการ' },
          { status: 400 }
        );
      }

      // Soft delete - mark as deleted instead of removing from database
      existingItem.status = 'deleted';
      existingItem.deletedAt = new Date();
      existingItem.deleteReason = reason.trim();
      existingItem.updatedAt = new Date();
      
      await existingItem.save();

      console.log('🗑️ Item soft deleted successfully:', {
        itemId,
        serialNumber: existingItem.serialNumber,
        reason: reason.trim()
      });

      return NextResponse.json({
        success: true,
        message: 'ลบรายการสำเร็จ',
        item: {
          itemId: existingItem._id,
          serialNumber: existingItem.serialNumber,
          itemName: existingItem.itemName,
          category: existingItem.category,
          status: existingItem.status
        }
      });

    } else {
      return NextResponse.json(
        { error: 'ประเภทการดำเนินการไม่ถูกต้อง' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('❌ Error in edit item API:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' },
      { status: 500 }
    );
  }
}
