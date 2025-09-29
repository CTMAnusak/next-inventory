import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import { verifyTokenFromRequest } from '@/lib/auth';

// Force Node.js runtime for database operations
export const runtime = 'nodejs';

// GET - ดึงรายการอุปกรณ์ทั้งหมดสำหรับการแก้ไข/ลบ (ทุกสถานะ ทุกสภาพ)
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get('itemName');
    const category = searchParams.get('category');

    if (!itemName || !category) {
      return NextResponse.json(
        { error: 'กรุณาระบุ itemName และ category' },
        { status: 400 }
      );
    }


    // ดึงรายการอุปกรณ์ทั้งหมดที่เป็น admin_stock (ทุกสถานะ ทุกสภาพ)
    const allItems = await InventoryItem.find({
      itemName: itemName,
      categoryId: category,
      'currentOwnership.ownerType': 'admin_stock',
      deletedAt: { $exists: false } // ยกเว้นรายการที่ถูกลบแล้ว
    }).sort({ 
      serialNumber: 1,  // เรียงตาม SN ก่อน
      createdAt: 1      // แล้วเรียงตามวันที่สร้าง
    });


    // แยกประเภทอุปกรณ์
    const itemsWithSN = allItems.filter(item => 
      item.serialNumber && item.serialNumber.trim() !== ''
    );
    
    const itemsWithPhoneNumber = allItems.filter(item => 
      item.numberPhone && item.numberPhone.trim() !== ''
    );
    
    const itemsWithoutSN = allItems.filter(item => 
      (!item.serialNumber || item.serialNumber.trim() === '') && 
      (!item.numberPhone || item.numberPhone.trim() === '')
    );


    const response = {
      itemName,
      category,
      totalItems: allItems.length,
      withSerialNumber: itemsWithSN.map(item => ({
        itemId: item._id,
        serialNumber: item.serialNumber,
        statusId: item.statusId,
        conditionId: item.conditionId,
        dateAdded: item.sourceInfo?.dateAdded || new Date(),
        addedBy: item.sourceInfo?.addedBy || 'system'
      })),
      withPhoneNumber: itemsWithPhoneNumber.map(item => ({
        itemId: item._id,
        numberPhone: item.numberPhone,
        statusId: item.statusId,
        conditionId: item.conditionId,
        dateAdded: item.sourceInfo?.dateAdded || new Date(),
        addedBy: item.sourceInfo?.addedBy || 'system'
      })),
      withoutSerialNumber: {
        count: itemsWithoutSN.length,
        items: itemsWithoutSN.map(item => ({
          itemId: item._id,
          statusId: item.statusId,
          conditionId: item.conditionId,
          dateAdded: item.sourceInfo?.dateAdded || new Date(),
          addedBy: item.sourceInfo?.addedBy || 'system'
        }))
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching all items for editing:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' },
      { status: 500 }
    );
  }
}
