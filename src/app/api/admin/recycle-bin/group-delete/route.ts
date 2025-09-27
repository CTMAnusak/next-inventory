import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';

// POST - Permanently delete entire group from recycle bin
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // Verify authentication
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    const currentUser = await User.findOne({ user_id: payload.userId });

    if (!currentUser || !['admin', 'it_admin'].includes(currentUser.userRole)) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์ลบถาวรจากถังขยะ' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { inventoryMasterId } = body;

    if (!inventoryMasterId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ inventoryMasterId ของกลุ่มที่ต้องการลบถาวร' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Permanent group delete requested by ${currentUser.firstName} ${currentUser.lastName} for group: ${inventoryMasterId}`);

    // Use direct MongoDB to permanently delete from RecycleBin
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    await client.connect();
    const db = client.db();
    const recycleBin = db.collection('recyclebins');

    // Find all items in the group first to get details for logging
    const groupItems = await recycleBin.find({ 
      inventoryMasterId: inventoryMasterId,
      isRestored: { $ne: true }
    }).toArray();

    if (groupItems.length === 0) {
      await client.close();
      return NextResponse.json(
        { error: 'ไม่พบรายการที่ต้องการลบหรือถูกกู้คืนแล้ว' },
        { status: 404 }
      );
    }

    // Log details before deletion
    const firstItem = groupItems[0];
    console.log(`🗑️ Permanently deleting group: ${firstItem.itemName} (${groupItems.length} items)`);
    console.log(`📋 Group details:`, {
      inventoryMasterId,
      itemName: firstItem.itemName,
      category: firstItem.category,
      totalItems: groupItems.length,
      itemTypes: {
        withSerialNumber: groupItems.filter(item => item.serialNumber).length,
        withPhoneNumber: groupItems.filter(item => item.numberPhone).length,
        other: groupItems.filter(item => !item.serialNumber && !item.numberPhone).length
      }
    });

    // Delete all items in the group
    const deleteResult = await recycleBin.deleteMany({ 
      inventoryMasterId: inventoryMasterId,
      isRestored: { $ne: true }
    });

    await client.close();

    console.log(`✅ Permanently deleted ${deleteResult.deletedCount} items from recycle bin`);

    return NextResponse.json({
      success: true,
      message: `ลบรายการถาวรเรียบร้อยแล้ว ${deleteResult.deletedCount} รายการ`,
      deletedCount: deleteResult.deletedCount,
      itemName: firstItem.itemName,
      category: firstItem.category,
      inventoryMasterId
    });

  } catch (error) {
    console.error('❌ Group Permanent Delete API - Error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบรายการ' },
      { status: 500 }
    );
  }
}
