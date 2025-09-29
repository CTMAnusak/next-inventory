import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '';
    const firstName = searchParams.get('firstName') || '';
    const lastName = searchParams.get('lastName') || '';
    const office = searchParams.get('office') || '';

    if (!userId && (!firstName || !lastName || !office)) {
      return NextResponse.json(
        { error: 'กรุณาระบุ userId หรือ firstName, lastName และ office' },
        { status: 400 }
      );
    }

    await dbConnect();

    // ตรวจสอบว่า user อยู่ในสถานะ pendingDeletion หรือไม่
    if (userId) {
      const { default: User } = await import('@/models/User');
      const user = await User.findOne({ user_id: userId });
      if (user && user.pendingDeletion) {
        return NextResponse.json(
          { error: 'บัญชีของคุณอยู่ในสถานะรอลบ ไม่สามารถเข้าถึงข้อมูลได้' },
          { status: 403 }
        );
      }
    }

    // Get all inventory items owned by this user using new system
    const userOwnedItems = await InventoryItem.find({
      'currentOwnership.ownerType': 'user_owned',
      'currentOwnership.userId': userId
    });

    // Process items to group by itemName and category
    const itemGroups = new Map();
    
    for (const item of userOwnedItems) {
      const key = `${item.itemName}-${item.categoryId}`;
      
      if (!itemGroups.has(key)) {
        itemGroups.set(key, {
          _id: item._id,
          itemName: item.itemName,
          categoryId: item.categoryId,
          quantity: 0,
          serialNumbers: [],
          status: item.status,
          dateAdded: item.createdAt
        });
      }
      
      const group = itemGroups.get(key);
      group.quantity += 1;
      
      if (item.serialNumber) {
        group.serialNumbers.push(item.serialNumber);
      }
    }

    const userItems = Array.from(itemGroups.values());


    return NextResponse.json({
      items: userItems,
      total: userItems.length,
      query: { userId, firstName, lastName, office }
    });

  } catch (error) {
    console.error('Error fetching user owned quantities:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}