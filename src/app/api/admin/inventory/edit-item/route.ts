import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import User from '@/models/User';
import jwt from 'jsonwebtoken';
import { moveToRecycleBin } from '@/lib/recycle-bin-helpers';
import { isSIMCardSync } from '@/lib/sim-card-helpers';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const { 
      itemId, 
      itemName, 
      category, 
      operation, 
      newSerialNumber, 
      newPhoneNumber,
      reason, 
      oldSerialNumber,
      oldPhoneNumber,
      // New fields for status and condition changes
      newStatusId,
      currentStatusId,
      newConditionId,
      currentConditionId
    } = await request.json();


    const hasSerialNumberChange = newSerialNumber && newSerialNumber.trim() && newSerialNumber.trim() !== oldSerialNumber;
    const hasPhoneNumberChange = newPhoneNumber && newPhoneNumber.trim() && newPhoneNumber.trim() !== oldPhoneNumber;
    const hasStatusChange = newStatusId && newStatusId !== currentStatusId;
    const hasConditionChange = newConditionId && newConditionId !== currentConditionId;

    // Validate required fields
    if (!itemId || !itemName || !category || !operation) {
      console.log('❌ Missing required fields:', { itemId: !!itemId, itemName: !!itemName, category: !!category, operation: !!operation });
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // Check if there are any changes to make (values computed above)

    if (operation === 'edit' && !hasSerialNumberChange && !hasPhoneNumberChange && !hasStatusChange && !hasConditionChange) {
      return NextResponse.json(
        { error: 'ไม่มีการเปลี่ยนแปลงใดๆ' },
        { status: 400 }
      );
    }

    // Find the item with enhanced debugging
    const existingItem = await InventoryItem.findById(itemId);
    
    if (!existingItem) {
      console.error(`❌ Item not found with ID: ${itemId}`);
      
      // Try to find if item exists with different criteria
      const itemsByName = await InventoryItem.find({ 
        itemName, 
        categoryId: category,
        status: { $ne: 'deleted' }
      }).limit(5);
      
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
    

    if (operation === 'edit') {
      // Edit operation - update serial number or phone number
      const isSimCard = isSIMCardSync(category);
      
      if (isSimCard) {
        // For SIM cards, update phone number (only if provided)
        if (newPhoneNumber && newPhoneNumber.trim()) {

        // Check if new phone number already exists for SIM cards
        const duplicateCheck = await InventoryItem.findOne({
          itemName,
          categoryId: category,
          numberPhone: newPhoneNumber.trim(),
          deletedAt: { $exists: false }, // Use deletedAt instead of status
          _id: { $ne: itemId }
        });

          if (duplicateCheck) {
            return NextResponse.json({
              success: false,
              message: `เบอร์โทรศัพท์ "${newPhoneNumber}" มีอยู่แล้วสำหรับ ${itemName}`,
              isDuplicate: true
            });
          }

          // ✅ Cross-validation: Check if phone number exists in User collection
          const existingUser = await User.findOne({ 
            phone: newPhoneNumber.trim(),
            $or: [
              { deletedAt: { $exists: false } }, // Users without deletedAt field
              { deletedAt: null } // Users with deletedAt: null
            ]
          });
          if (existingUser) {
            return NextResponse.json({
              success: false,
              message: `เบอร์โทรศัพท์ "${newPhoneNumber}" ถูกใช้โดยผู้ใช้: ${existingUser.firstName || ''} ${existingUser.lastName || ''} (${existingUser.office || ''})`,
              isDuplicate: true
            });
          }

          // Update the phone number
          existingItem.numberPhone = newPhoneNumber.trim();
          existingItem.updatedAt = new Date();
          
        }
      } else {
        // For other items, update serial number (only if provided)
        if (newSerialNumber && newSerialNumber.trim()) {

        // Check if new serial number already exists for this item type
        const duplicateCheck = await InventoryItem.findOne({
          itemName,
          categoryId: category,
          serialNumber: newSerialNumber.trim(),
          deletedAt: { $exists: false }, // Use deletedAt instead of status
          _id: { $ne: itemId }
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
          
        }
      }

      // Handle status and condition changes
      let statusChanged = false;
      let conditionChanged = false;
      
      if (newStatusId && newStatusId !== currentStatusId) {
        existingItem.statusId = newStatusId;
        statusChanged = true;
      }
      
      if (newConditionId && newConditionId !== currentConditionId) {
        existingItem.conditionId = newConditionId;
        conditionChanged = true;
      }
      
      await existingItem.save();

      // Update InventoryMaster if serial number status changed
      const inventoryMaster = await InventoryMaster.findOne({
        itemName: itemName,
        categoryId: category
      });

      if (inventoryMaster) {
        const hadOldSN = oldSerialNumber && oldSerialNumber.trim();
        const hasNewSN = newSerialNumber && newSerialNumber.trim();
        
        // If status changed from no SN to has SN, or vice versa
        if (!!hadOldSN !== !!hasNewSN) {
          // Note: availableQuantity remains the same, just the breakdown changes
          inventoryMaster.updatedAt = new Date();
          await inventoryMaster.save();
        }
      }

      // Build success message based on changes made
      const changes = [];
      if (isSimCard && newPhoneNumber) {
        changes.push('เบอร์โทรศัพท์');
      } else if (!isSimCard && newSerialNumber) {
        changes.push('Serial Number');
      }
      if (statusChanged) {
        changes.push('สถานะ');
      }
      if (conditionChanged) {
        changes.push('สภาพ');
      }
      
      const changeText = changes.length > 0 ? changes.join(', ') : 'ข้อมูล';
      const successMessage = `แก้ไข${changeText}สำเร็จ`;

      return NextResponse.json({
        success: true,
        message: successMessage,
        item: {
          itemId: existingItem._id,
          serialNumber: existingItem.serialNumber,
          numberPhone: existingItem.numberPhone,
          itemName: existingItem.itemName,
          category: (existingItem as any).categoryId || (existingItem as any).category,
          statusId: existingItem.statusId,
          conditionId: existingItem.conditionId
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
      
      // 🆕 Find InventoryMaster for the group
      const inventoryMaster = await InventoryMaster.findOne({ itemName, categoryId: category });
      const inventoryMasterId = inventoryMaster?._id?.toString() || `${itemName}_${category}_${Date.now()}`;

      // 🆕 Get category name from CategoryConfig
      let categoryName = category; // fallback to categoryId
      try {
        const { getCategoryNameById } = await import('@/lib/category-helpers');
        categoryName = await getCategoryNameById(category);
      } catch (error) {
        console.warn('Failed to get category name, using categoryId as fallback:', error);
      }

      // Try to move to recycle bin using direct MongoDB, but continue if it fails
      try {
        
        const { MongoClient } = require('mongodb');
        const uri = process.env.MONGODB_URI;
        const client = new MongoClient(uri);
        
        await client.connect();
        const db = client.db();
        const recycleBin = db.collection('recyclebins');
        
        const recycleBinData = {
          itemName: existingItem.itemName,
          category: categoryName, // 🔧 Use resolved category name instead of existingItem.category
          categoryId: category, // 🆕 เพิ่ม categoryId
          inventoryMasterId: inventoryMasterId, // 🆕 เพิ่ม inventoryMasterId
          serialNumber: existingItem.serialNumber,
          numberPhone: existingItem.numberPhone, // เพิ่มเบอร์โทรศัพท์
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
        
      } catch (recycleBinError) {
        console.error('❌ Failed to move item to recycle bin, but continuing with deletion:', recycleBinError);
      }
      
      // 🆕 Update snapshot ก่อนลบ
      try {
        const { updateSnapshotsBeforeDelete } = await import('@/lib/snapshot-helpers');
        const snapshotResult = await updateSnapshotsBeforeDelete(String(existingItem._id));
        console.log('📸 Snapshot update result:', snapshotResult);
      } catch (snapshotError) {
        console.error('❌ Failed to update snapshots before delete:', snapshotError);
        // ไม่หยุดการทำงาน แค่ log error
      }
      
      // Now delete from InventoryItem collection
      await InventoryItem.findByIdAndDelete(existingItem._id);

      // Update InventoryMaster to reflect the deletion
      const inventoryMasterForDeletion = await InventoryMaster.findOne({
        itemName: itemName,
        categoryId: category
      });

      if (inventoryMasterForDeletion) {
        // Decrease available quantity by 1
        inventoryMasterForDeletion.availableQuantity = Math.max(0, inventoryMasterForDeletion.availableQuantity - 1);
        inventoryMasterForDeletion.updatedAt = new Date();
        await inventoryMasterForDeletion.save();
      }

      return NextResponse.json({
        success: true,
        message: 'ลบรายการสำเร็จ',
        item: {
          itemId: existingItem._id,
          serialNumber: existingItem.serialNumber,
          itemName: existingItem.itemName,
          category: existingItem.categoryId,
          status: existingItem.statusId
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
