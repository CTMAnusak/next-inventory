import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { updateInventoryMaster } from '@/lib/inventory-helpers';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { itemName, categoryId } = await request.json();
    
    if (!itemName || !categoryId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ itemName และ categoryId' },
        { status: 400 }
      );
    }
    
    console.log(`🔧 Force updating InventoryMaster for: ${itemName} (${categoryId})`);
    
    const result = await updateInventoryMaster(itemName, categoryId);
    
    return NextResponse.json({
      message: 'อัปเดต InventoryMaster เรียบร้อยแล้ว',
      itemName,
      categoryId,
      result: {
        _id: result?._id,
        totalQuantity: result?.totalQuantity,
        availableQuantity: result?.availableQuantity,
        userOwnedQuantity: result?.userOwnedQuantity,
        statusBreakdown: result?.statusBreakdown,
        conditionBreakdown: result?.conditionBreakdown
      }
    });
  } catch (error) {
    console.error('Fix inventory master error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด', details: String(error) },
      { status: 500 }
    );
  }
}

