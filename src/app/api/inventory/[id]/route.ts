import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import { verifyTokenFromRequest } from '@/lib/auth';
import { isSIMCard } from '@/lib/sim-card-helpers';
import { updateInventoryMaster } from '@/lib/inventory-helpers';

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
      notes,
      // ✅ เพิ่มรองรับข้อมูลผู้ใช้สาขา
      firstName,
      lastName,
      nickname,
      department,
      phone
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
  
  // ✅ แก้ไข: ตรวจสอบว่าเป็นซิมการ์ดก่อนอัพเดต numberPhone
  // numberPhone ใน InventoryItem คือเบอร์ของอุปกรณ์ (เช่น ซิมการ์ด) ไม่ใช่เบอร์ของผู้ใช้
  const isSimCard = await isSIMCard(item.categoryId);
  
  if (numberPhone !== undefined) {
    if (isSimCard) {
      // สำหรับซิมการ์ดเท่านั้นที่สามารถมี numberPhone ได้
      updateFields.numberPhone = numberPhone;
    } else {
      // สำหรับอุปกรณ์ทั่วไป ถ้ามีการส่ง numberPhone มา (ซึ่งไม่ควรเกิดขึ้น) ให้ล้างออก
      // เพราะ numberPhone ควรเป็นค่าว่างสำหรับอุปกรณ์ทั่วไป
      if (numberPhone && numberPhone.trim() !== '') {
        console.warn(`⚠️ Attempted to set numberPhone for non-SIM card item: ${item.itemName} (${item.categoryId}). Clearing numberPhone.`);
        updateFields.numberPhone = '';
      }
    }
  } else if (!isSimCard && item.numberPhone && item.numberPhone.trim() !== '') {
    // ✅ แก้ไข: ล้าง numberPhone สำหรับอุปกรณ์ทั่วไปที่ไม่ได้เป็นซิมการ์ด (ถ้ามีค่าอยู่แล้ว)
    // กรณีนี้จะเกิดขึ้นเมื่อมีข้อมูลเก่าที่ผิดพลาด
    console.warn(`⚠️ Found existing numberPhone for non-SIM card item: ${item.itemName} (${item.categoryId}). Clearing numberPhone.`);
    updateFields.numberPhone = '';
  }
  
  if (statusId !== undefined) updateFields.statusId = statusId;
  if (conditionId !== undefined) updateFields.conditionId = conditionId;
  if (notes !== undefined) {
    if (!item.sourceInfo) item.sourceInfo = {} as any;
    item.sourceInfo.notes = notes;
    updateFields.sourceInfo = item.sourceInfo;
  }

  // ✅ อัพเดทข้อมูลผู้ใช้สาขา (ถ้ามี)
  // หมายเหตุ: phone ใน requesterInfo คือเบอร์ของผู้ใช้ ไม่ใช่เบอร์ของอุปกรณ์
  if (firstName !== undefined || lastName !== undefined || nickname !== undefined || 
      department !== undefined || phone !== undefined) {
    if (!item.requesterInfo) item.requesterInfo = {} as any;
    
    if (firstName !== undefined) item.requesterInfo!.firstName = firstName;
    if (lastName !== undefined) item.requesterInfo!.lastName = lastName;
    if (nickname !== undefined) item.requesterInfo!.nickname = nickname;
    if (department !== undefined) item.requesterInfo!.department = department;
    if (phone !== undefined) item.requesterInfo!.phone = phone;
      
      updateFields.requesterInfo = item.requesterInfo;
    }

  const updatedItem = await InventoryItem.findByIdAndUpdate(
    id,
    updateFields,
    { new: true }
  );

  if (!updatedItem) {
    return NextResponse.json({ error: 'ไม่พบรายการอุปกรณ์' }, { status: 404 });
  }

  // ✅ อัพเดท InventoryMaster หลังจากแก้ไข item
  try {
    await updateInventoryMaster(updatedItem.itemName, updatedItem.categoryId);
  } catch (masterError) {
    console.error('❌ Failed to update InventoryMaster after item update:', masterError);
    // ไม่ throw error เพราะ item ถูกอัพเดตแล้ว
  }

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