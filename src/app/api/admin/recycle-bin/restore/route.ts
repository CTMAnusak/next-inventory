import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import { restoreFromRecycleBin } from '@/lib/recycle-bin-helpers';

// POST - Restore item from recycle bin
export async function POST(request: NextRequest) {
  try {
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

    // Check if user is admin or it_admin
    const currentUser = await User.findOne({ user_id: payload.userId });
    if (!currentUser || !['admin', 'it_admin'].includes(currentUser.userRole)) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์กู้คืนรายการ' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { recycleBinId } = body;

    if (!recycleBinId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ ID ของรายการที่ต้องการกู้คืน' },
        { status: 400 }
      );
    }

    console.log(`♻️ Restoring item from recycle bin: ${recycleBinId}`);
    console.log(`👤 Restored by: ${currentUser.firstName} ${currentUser.lastName} (${currentUser.user_id})`);

    const result = await restoreFromRecycleBin({
      recycleBinId: recycleBinId,
      restoredBy: currentUser.user_id,
      restoredByName: `${currentUser.firstName || 'Unknown'} ${currentUser.lastName || 'User'}`
    });

    if (result.type === 'individual') {
      return NextResponse.json({
        success: true,
        message: 'กู้คืนรายการเรียบร้อยแล้ว',
        type: 'individual',
        item: {
          _id: result.item._id,
          itemName: result.item.itemName,
          category: result.item.category,
          serialNumber: result.item.serialNumber,
          numberPhone: result.item.numberPhone, // เพิ่มเบอร์โทรศัพท์
          status: result.item.status
        }
      });
    } else if (result.type === 'category') {
      return NextResponse.json({
        success: true,
        message: `กู้คืนหมวดหมู่เรียบร้อยแล้ว (${result.items.length} รายการ)`,
        type: 'category',
        restoredCount: result.items.length,
        items: result.items.map(item => ({
          _id: item._id,
          itemName: item.itemName,
          category: item.category,
          serialNumber: item.serialNumber,
          numberPhone: item.numberPhone, // เพิ่มเบอร์โทรศัพท์
          status: item.status
        }))
      });
    }

    return NextResponse.json(
      { error: 'ไม่สามารถกู้คืนรายการได้' },
      { status: 500 }
    );

  } catch (error) {
    console.error('❌ Restore API - Error restoring item:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการกู้คืนรายการ' },
      { status: 500 }
    );
  }
}
