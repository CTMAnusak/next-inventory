import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';

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
    const { recycleBinId } = body;

    if (!recycleBinId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ recycleBinId' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Permanent delete requested by ${currentUser.firstName} ${currentUser.lastName} for item: ${recycleBinId}`);

    // Use direct MongoDB to permanently delete from RecycleBin
    const { MongoClient, ObjectId } = require('mongodb');
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    await client.connect();
    const db = client.db();
    const recycleBin = db.collection('recyclebins');

    // Find the item first to get details for logging
    const itemToDelete = await recycleBin.findOne({ 
      _id: new ObjectId(recycleBinId)
    });

    if (!itemToDelete) {
      await client.close();
      return NextResponse.json(
        { error: 'ไม่พบรายการในถังขยะหรือรายการถูกกู้คืนแล้ว' },
        { status: 404 }
      );
    }

    let result;
    let deletedCount = 0;

    // Check if this is a category bulk delete
    if (itemToDelete.deleteType === 'category_bulk') {
      // Delete all items in this category that were deleted together
      result = await recycleBin.deleteMany({
        itemName: itemToDelete.itemName,
        category: itemToDelete.category,
        deleteType: 'category_bulk'
      });
      deletedCount = result.deletedCount;
      
      console.log(`🗑️ Deleting entire category: ${itemToDelete.itemName} (${itemToDelete.category}) - ${deletedCount} items`);
    } else {
      // Delete single item
      result = await recycleBin.deleteOne({ 
        _id: new ObjectId(recycleBinId)
      });
      deletedCount = result.deletedCount;
      
      console.log(`🗑️ Deleting single item: ${itemToDelete.itemName} (SN: ${itemToDelete.serialNumber})`);
    }

    await client.close();

    if (deletedCount === 0) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบรายการได้' },
        { status: 400 }
      );
    }

    console.log(`✅ Permanently deleted from recycle bin:`, {
      type: itemToDelete.deleteType,
      itemName: itemToDelete.itemName,
      category: itemToDelete.category,
      serialNumber: itemToDelete.serialNumber,
      deletedCount: deletedCount,
      deletedBy: `${currentUser.firstName} ${currentUser.lastName}`,
      originalDeleteDate: itemToDelete.deletedAt
    });

    const message = itemToDelete.deleteType === 'category_bulk' 
      ? `ลบ ${itemToDelete.itemName} (${deletedCount} รายการ) ถาวรจากถังขยะเรียบร้อย`
      : 'ลบรายการถาวรจากถังขยะเรียบร้อย';

    return NextResponse.json({
      success: true,
      message: message,
      deletedItem: {
        id: recycleBinId,
        itemName: itemToDelete.itemName,
        category: itemToDelete.category,
        serialNumber: itemToDelete.serialNumber,
        deleteType: itemToDelete.deleteType,
        deletedCount: deletedCount
      }
    });

  } catch (error) {
    console.error('❌ Permanent delete API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบถาวร'
    }, { status: 500 });
  }
}
