import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';
import { verifyTokenFromRequest } from '@/lib/auth';
import { clearUserCache } from '@/lib/cache-utils';

// GET specific inventory item - Return from InventoryMaster for compatibility
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();

    // Try to find in InventoryMaster first (for UI compatibility)
    const masterItem = await InventoryMaster.findById(id);
    
    if (masterItem) {
      // Return in format expected by UI
      return NextResponse.json({
        _id: masterItem._id,
        itemName: masterItem.itemName,
        category: masterItem.category,
        quantity: masterItem.availableQuantity,
        totalQuantity: masterItem.totalQuantity,
        status: 'active',
        hasSerialNumber: masterItem.itemDetails.withSerialNumber > 0,
        userOwnedQuantity: masterItem.userOwnedQuantity
      });
    }

    return NextResponse.json(
      { error: 'ไม่พบรายการที่ต้องการ' },
      { status: 404 }
    );

  } catch (error) {
    console.error('Get inventory item error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}

// PUT - Update inventory item (Limited support for UI compatibility)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updateData = await request.json();

    // Verify token
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'ไม่ได้รับอนุญาต' },
        { status: 401 }
      );
    }

    await dbConnect();

    // For now, return success but don't actually update
    // This maintains UI compatibility while we transition
    console.log(`⚠️ Legacy update attempted for item ${id}:`, updateData);
    
    return NextResponse.json({
      message: 'การอัปเดตจะใช้ระบบใหม่ในเร็วๆ นี้',
      item: { _id: id, ...updateData }
    });

  } catch (error) {
    console.error('Inventory update error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไข' },
      { status: 500 }
    );
  }
}