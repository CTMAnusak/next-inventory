import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import { verifyToken } from '@/lib/auth';
import { clearAllCaches } from '@/lib/cache-utils';

// POST - Restore entire group from recycle bin
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get user info from token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check if user is admin or it_admin
    const currentUser = await User.findOne({ user_id: payload.userId });
    if (!currentUser || !['admin', 'it_admin'].includes(currentUser.userRole)) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์กู้คืนรายการ' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { inventoryMasterId } = body;

    if (!inventoryMasterId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ inventoryMasterId ของกลุ่มที่ต้องการกู้คืน' },
        { status: 400 }
      );
    }


    // Use direct MongoDB to handle recycle bin operations
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    await client.connect();
    const db = client.db();
    const recycleBin = db.collection('recyclebins');

    // Find all items in the group
    const groupItems = await recycleBin.find({ 
      inventoryMasterId: inventoryMasterId,
      isRestored: { $ne: true }
    }).toArray();

    if (groupItems.length === 0) {
      await client.close();
      return NextResponse.json(
        { error: 'ไม่พบรายการที่ต้องการกู้คืนหรือถูกกู้คืนแล้ว' },
        { status: 404 }
      );
    }

    const restoredItems = [];
    const errors = [];

    // Restore each item
    for (const recycleBinItem of groupItems) {
      try {
        // Restore the original InventoryItem
        const originalData = recycleBinItem.originalData;
        
        // Remove MongoDB-specific fields that shouldn't be restored
        delete originalData._id;
        delete originalData.__v;
        delete originalData.createdAt;
        delete originalData.updatedAt;

        // Create new InventoryItem
        const newItem = new InventoryItem(originalData);
        const savedItem = await newItem.save();

        // Mark as restored in recycle bin
        await recycleBin.updateOne(
          { _id: recycleBinItem._id },
          { 
            $set: { 
              isRestored: true, 
              restoredAt: new Date(),
              restoredBy: currentUser.user_id,
              restoredByName: `${currentUser.firstName || 'Unknown'} ${currentUser.lastName || 'User'}`
            } 
          }
        );

        restoredItems.push({
          recycleBinId: recycleBinItem._id,
          itemName: recycleBinItem.itemName,
          serialNumber: recycleBinItem.serialNumber,
          numberPhone: recycleBinItem.numberPhone,
          newInventoryItemId: savedItem._id
        });

      } catch (error) {
        console.error(`❌ Error restoring item ${recycleBinItem._id}:`, error);
        errors.push({
          recycleBinId: recycleBinItem._id,
          itemName: recycleBinItem.itemName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    await client.close();

    // Update InventoryMaster
    if (restoredItems.length > 0) {
      const firstItem = groupItems[0];
      try {
        const InventoryMasterModel = (await import('@/models/InventoryMaster')).default;
        await InventoryMasterModel.updateSummary(firstItem.itemName, firstItem.categoryId);
      } catch (error) {
        console.error('❌ Error updating InventoryMaster:', error);
      }
    }

    // Clear caches
    clearAllCaches();

    const response = {
      success: true,
      message: `กู้คืนรายการเรียบร้อยแล้ว ${restoredItems.length} รายการ`,
      restoredItems,
      totalRestored: restoredItems.length,
      totalRequested: groupItems.length
    };

    if (errors.length > 0) {
      response.errors = errors;
      response.message += ` (มีข้อผิดพลาด ${errors.length} รายการ)`;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Group Restore API - Error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการกู้คืนรายการ' },
      { status: 500 }
    );
  }
}
