import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import { verifyToken } from '@/lib/auth';
import User from '@/models/User';
import { updateInventoryMaster } from '@/lib/inventory-helpers';

/**
 * POST /api/admin/inventory/update-combination
 * อัปเดตสถานะและ/หรือสภาพของ status+condition combination
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // Verify admin access
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const currentUser = await User.findOne({ user_id: payload.userId });
    if (!currentUser || !['admin', 'it_admin', 'super_admin'].includes(currentUser.userRole)) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { 
      itemName, 
      categoryId, 
      currentStatusId, 
      currentConditionId,
      newStatusId, 
      newConditionId,
      quantity 
    } = body;

    // Validate required fields
    if (!itemName || !categoryId || !currentStatusId || !currentConditionId || !quantity) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    if (quantity < 1) {
      return NextResponse.json(
        { error: 'จำนวนต้องมากกว่า 0' },
        { status: 400 }
      );
    }

    // Find items matching the current status+condition combination
    const itemsToUpdate = await InventoryItem.find({
      itemName,
      categoryId,
      statusId: currentStatusId,
      conditionId: currentConditionId,
      serialNumber: { $in: [null, ''] },
      numberPhone: { $in: [null, ''] },
      'currentOwnership.ownerType': 'admin_stock',
      deletedAt: { $exists: false }
    }).limit(quantity);

    if (itemsToUpdate.length < quantity) {
      return NextResponse.json(
        { error: `พบเพียง ${itemsToUpdate.length} ชิ้น แต่ต้องการอัปเดต ${quantity} ชิ้น` },
        { status: 400 }
      );
    }

    // Update items
    const updatePromises = itemsToUpdate.map(item => {
      // Only update fields that changed
      if (newStatusId && newStatusId !== currentStatusId) {
        item.statusId = newStatusId;
      }
      if (newConditionId && newConditionId !== currentConditionId) {
        item.conditionId = newConditionId;
      }
      return item.save();
    });

    await Promise.all(updatePromises);

    // Update InventoryMaster to reflect changes
    await updateInventoryMaster(itemName, categoryId);

    return NextResponse.json({ 
      message: `อัปเดตสำเร็จ ${quantity} ชิ้น`,
      updated: itemsToUpdate.length 
    });

  } catch (error) {
    console.error('Error updating combination:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปเดต' },
      { status: 500 }
    );
  }
}

