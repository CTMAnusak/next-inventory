import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import { verifyTokenFromRequest } from '@/lib/auth';

// GET - ดึงข้อมูลอุปกรณ์รายการเดียว
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'กรุณาระบุ ID อุปกรณ์' },
        { status: 400 }
      );
    }

    await dbConnect();
    
    const item = await InventoryItem.findById(id);
    
    if (!item) {
      return NextResponse.json(
        { error: 'ไม่พบอุปกรณ์ที่ระบุ' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      _id: item._id,
      itemName: item.itemName,
      categoryId: item.categoryId,
      serialNumber: item.serialNumber,
      numberPhone: item.numberPhone,
      statusId: item.statusId,
      conditionId: item.conditionId,
      quantity: 1, // Individual item always has quantity 1
      notes: item.sourceInfo?.notes || '',
      currentOwnership: item.currentOwnership,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    });

  } catch (error) {
    console.error('Error fetching inventory item:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์' },
      { status: 500 }
    );
  }
}

// PUT - แก้ไขข้อมูลอุปกรณ์
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'กรุณาระบุ ID อุปกรณ์' },
        { status: 400 }
      );
    }

    // Verify user token
    const payload: any = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    await dbConnect();
    
    const updateData = await request.json();
    const {
      serialNumber,
      numberPhone,
      statusId,
      conditionId,
      notes
    } = updateData;

    // Find the item
    const item = await InventoryItem.findById(id);
    if (!item) {
      return NextResponse.json(
        { error: 'ไม่พบอุปกรณ์ที่ระบุ' },
        { status: 404 }
      );
    }

    // Check if user owns this item
    if (item.currentOwnership.ownerType !== 'user_owned' || 
        item.currentOwnership.userId !== payload.userId) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์แก้ไขอุปกรณ์นี้' },
        { status: 403 }
      );
    }

    // Update the item
    const updateFields: any = {
      updatedAt: new Date()
    };

    if (serialNumber !== undefined) updateFields.serialNumber = serialNumber;
    if (numberPhone !== undefined) updateFields.numberPhone = numberPhone;
    if (statusId !== undefined) updateFields.statusId = statusId;
    if (conditionId !== undefined) updateFields.conditionId = conditionId;
    if (notes !== undefined) {
      if (!item.sourceInfo) item.sourceInfo = {};
      item.sourceInfo.notes = notes;
      updateFields.sourceInfo = item.sourceInfo;
    }

    const updatedItem = await InventoryItem.findByIdAndUpdate(
      id,
      updateFields,
      { new: true }
    );

    return NextResponse.json({
      message: 'แก้ไขข้อมูลอุปกรณ์เรียบร้อย',
      item: {
        _id: updatedItem._id,
        itemName: updatedItem.itemName,
        categoryId: updatedItem.categoryId,
        serialNumber: updatedItem.serialNumber,
        numberPhone: updatedItem.numberPhone,
        statusId: updatedItem.statusId,
        conditionId: updatedItem.conditionId,
        notes: updatedItem.sourceInfo?.notes || '',
        updatedAt: updatedItem.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating inventory item:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลอุปกรณ์' },
      { status: 500 }
    );
  }
}