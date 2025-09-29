import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import { verifyToken } from '@/lib/auth';
import User from '@/models/User';

// PATCH - แก้ไข InventoryItem
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check if user is admin
    const currentUser = await User.findOne({ user_id: payload.userId });
    if (!currentUser || !['admin', 'it_admin'].includes(currentUser.userRole)) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }

    const updateData = await request.json();

    // Find the item
    const item = await InventoryItem.findById(id);
    if (!item) {
      return NextResponse.json(
        { error: 'ไม่พบรายการที่ต้องการแก้ไข' },
        { status: 404 }
      );
    }

    // Validate Serial Number uniqueness (if changing)
    if (updateData.serialNumber !== undefined && updateData.serialNumber !== item.serialNumber) {
      if (updateData.serialNumber && updateData.serialNumber.trim() !== '') {
        const existingItem = await InventoryItem.findOne({
          serialNumber: updateData.serialNumber.trim(),
          deletedAt: { $exists: false },
          _id: { $ne: id } // Exclude current item
        });
        
        if (existingItem) {
          return NextResponse.json(
            { error: `Serial Number "${updateData.serialNumber.trim()}" มีอยู่แล้ว` },
            { status: 400 }
          );
        }
      }
    }

    // Validate Phone Number uniqueness (if changing)
    if (updateData.numberPhone !== undefined && updateData.numberPhone !== item.numberPhone) {
      if (updateData.numberPhone && updateData.numberPhone.trim() !== '') {
        const existingPhoneItem = await InventoryItem.findOne({
          numberPhone: updateData.numberPhone.trim(),
          categoryId: item.categoryId,
          deletedAt: { $exists: false },
          _id: { $ne: id }
        });
        
        if (existingPhoneItem) {
          return NextResponse.json(
            { error: `Phone Number "${updateData.numberPhone.trim()}" มีอยู่แล้วในหมวดหมู่นี้` },
            { status: 400 }
          );
        }
      }
    }

    // Update allowed fields
    const allowedFields = ['serialNumber', 'numberPhone', 'statusId', 'conditionId', 'notes'];
    const updateObj: any = {};
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'serialNumber' || field === 'numberPhone') {
          // Clean string fields
          updateObj[field] = updateData[field] && updateData[field].trim() !== '' 
            ? updateData[field].trim() 
            : undefined;
        } else {
          updateObj[field] = updateData[field];
        }
      }
    }

    // Update the item
    const updatedItem = await InventoryItem.findByIdAndUpdate(
      id,
      updateObj,
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      return NextResponse.json(
        { error: 'ไม่สามารถแก้ไขข้อมูลได้' },
        { status: 500 }
      );
    }

    // Note: InventoryMaster จะ auto-sync ผ่าน post-save hook

    return NextResponse.json({
      success: true,
      message: 'แก้ไขข้อมูลสำเร็จ',
      item: {
        _id: updatedItem._id,
        itemName: updatedItem.itemName,
        categoryId: updatedItem.categoryId,
        serialNumber: updatedItem.serialNumber,
        numberPhone: updatedItem.numberPhone,
        statusId: updatedItem.statusId,
        conditionId: updatedItem.conditionId,
        notes: updatedItem.notes
      }
    });

  } catch (error) {
    console.error('Update InventoryItem error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไข' },
      { status: 500 }
    );
  }
}

// GET - ดูรายละเอียด InventoryItem
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();

    const item = await InventoryItem.findById(id);
    if (!item) {
      return NextResponse.json(
        { error: 'ไม่พบรายการที่ต้องการ' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item: {
        _id: item._id,
        itemName: item.itemName,
        categoryId: item.categoryId,
        serialNumber: item.serialNumber,
        numberPhone: item.numberPhone,
        statusId: item.statusId,
        conditionId: item.conditionId,
        notes: item.notes,
        currentOwnership: item.currentOwnership,
        sourceInfo: item.sourceInfo,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }
    });

  } catch (error) {
    console.error('Get InventoryItem error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}