import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import User from '@/models/User';
import jwt from 'jsonwebtoken';
import { moveToRecycleBin } from '@/lib/recycle-bin-helpers';

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

    // Find the item with enhanced debugging
    console.log(`🔍 Searching for item with ID: ${itemId}`);
    const existingItem = await InventoryItem.findById(itemId);
    
    if (!existingItem) {
      console.error(`❌ Item not found with ID: ${itemId}`);
      
      // Try to find if item exists with different criteria
      const itemsByName = await InventoryItem.find({ 
        itemName, 
        category,
        status: { $ne: 'deleted' }
      }).limit(5);
      
      console.log(`🔍 Found ${itemsByName.length} items with name "${itemName}" in category "${category}":`, 
        itemsByName.map(item => ({
          id: item._id.toString(),
          serialNumber: item.serialNumber,
          status: item.status
        }))
      );
      
      return NextResponse.json(
        { 
          error: 'ไม่พบรายการอุปกรณ์',
          debug: {
            searchedId: itemId,
            itemName,
            category,
            availableItems: itemsByName.length
          }
        },
        { status: 404 }
      );
    }
    
    console.log(`✅ Found item:`, {
      id: existingItem._id.toString(),
      itemName: existingItem.itemName,
      category: existingItem.category,
      serialNumber: existingItem.serialNumber,
      status: existingItem.status
    });

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

      // Update InventoryMaster if serial number status changed
      const inventoryMaster = await InventoryMaster.findOne({
        itemName: itemName,
        category: category
      });

      if (inventoryMaster) {
        const hadOldSN = oldSerialNumber && oldSerialNumber.trim();
        const hasNewSN = newSerialNumber && newSerialNumber.trim();
        
        // If status changed from no SN to has SN, or vice versa
        if (!!hadOldSN !== !!hasNewSN) {
          console.log('📊 Serial number status changed, updating InventoryMaster:', {
            hadOldSN: !!hadOldSN,
            hasNewSN: !!hasNewSN
          });
          // Note: availableQuantity remains the same, just the breakdown changes
          inventoryMaster.updatedAt = new Date();
          await inventoryMaster.save();
        }
      }

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

      // Move to recycle bin instead of soft delete
      // Get current user info for recycle bin record
      const token = request.cookies.get('auth-token')?.value;
      const payload: any = token ? jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') : null;
      const currentUser = await User.findOne({ user_id: payload?.userId });
      
      // Try to move to recycle bin using direct MongoDB, but continue if it fails
      try {
        console.log(`🗑️ Moving individual item to recycle bin: ${existingItem.itemName} (SN: ${existingItem.serialNumber})`);
        
        const { MongoClient } = require('mongodb');
        const uri = process.env.MONGODB_URI;
        const client = new MongoClient(uri);
        
        await client.connect();
        const db = client.db();
        const recycleBin = db.collection('recyclebins');
        
        const recycleBinData = {
          itemName: existingItem.itemName,
          category: existingItem.category,
          serialNumber: existingItem.serialNumber,
          deleteType: 'individual_item',
          deleteReason: reason.trim(),
          deletedBy: currentUser?.user_id || 'unknown',
          deletedByName: `${currentUser?.firstName || 'Unknown'} ${currentUser?.lastName || 'User'}`,
          deletedAt: new Date(),
          permanentDeleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          originalData: existingItem.toObject()
        };
        
        const result = await recycleBin.insertOne(recycleBinData);
        await client.close();
        
        console.log(`✅ Individual item moved to recycle bin: ${result.insertedId}`);
      } catch (recycleBinError) {
        console.error('❌ Failed to move item to recycle bin, but continuing with deletion:', recycleBinError);
      }
      
      // Now delete from InventoryItem collection
      await InventoryItem.findByIdAndDelete(existingItem._id);

      // Update InventoryMaster to reflect the deletion
      const inventoryMaster = await InventoryMaster.findOne({
        itemName: itemName,
        category: category
      });

      if (inventoryMaster) {
        // Decrease available quantity by 1
        inventoryMaster.availableQuantity = Math.max(0, inventoryMaster.availableQuantity - 1);
        inventoryMaster.updatedAt = new Date();
        await inventoryMaster.save();

        console.log('📊 Updated InventoryMaster after deletion:', {
          itemName,
          category,
          newAvailableQuantity: inventoryMaster.availableQuantity
        });
      }

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
