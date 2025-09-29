import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import { getRecycleBinItems, permanentDeleteExpiredItems } from '@/lib/recycle-bin-helpers';
import { getCategoryNameById } from '@/lib/category-helpers';

// GET - Fetch recycle bin items
export async function GET(request: NextRequest) {
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
        { error: 'คุณไม่มีสิทธิ์เข้าถึงถังขยะ' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const grouped = searchParams.get('grouped') === 'true'; // 🆕 ใหม่: ใช้ grouped แทน type
    const type = searchParams.get('type') as 'individual' | 'category' || 'individual'; // เก็บไว้ backward compatibility
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');


    let result;
    if (grouped) {
      // 🆕 ใช้ grouped data จาก RecycleBin model
      const RecycleBin = (await import('@/models/RecycleBin')).default;
      const groupedItems = await RecycleBin.findGroupedDeletedItems(page, limit);
      
      // แปลงชื่อหมวดหมู่สำหรับทุกรายการ
      const enrichedItems = await Promise.all(
        groupedItems.map(async (item) => {
          try {
            const categoryName = await getCategoryNameById(item.categoryId);
            return {
              ...item,
              categoryName: categoryName
            };
          } catch (error) {
            console.warn(`Failed to get category name for ${item.categoryId}:`, error);
            return {
              ...item,
              categoryName: item.category // fallback to original category
            };
          }
        })
      );
      
      // คำนวณ total สำหรับ pagination
      const totalGroups = await RecycleBin.aggregate([
        { $match: { isRestored: { $ne: true } } },
        { $group: { _id: '$inventoryMasterId' } },
        { $count: 'total' }
      ]);
      
      result = {
        items: enrichedItems,
        page,
        limit,
        total: totalGroups[0]?.total || 0
      };
    } else {
      // เก็บ logic เดิมไว้ backward compatibility
      result = await getRecycleBinItems(type, page, limit);
    }

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit)
      }
    });

  } catch (error) {
    console.error('❌ Recycle Bin API - Error fetching items:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลถังขยะ' },
      { status: 500 }
    );
  }
}

// POST - Manual cleanup expired items (for testing/admin purposes)
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
        { error: 'คุณไม่มีสิทธิ์ทำการ cleanup ถังขยะ' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'cleanup') {
      console.log('🧹 Manual cleanup requested by admin');
      const result = await permanentDeleteExpiredItems();
      
      return NextResponse.json({
        success: true,
        message: `ลบรายการหมดอายุแล้ว ${result.deletedCount} รายการ`,
        deletedCount: result.deletedCount,
        deletedItems: result.items
      });
    }

    return NextResponse.json(
      { error: 'Action ไม่ถูกต้อง' },
      { status: 400 }
    );

  } catch (error) {
    console.error('❌ Recycle Bin API - Error in POST action:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดำเนินการ' },
      { status: 500 }
    );
  }
}
