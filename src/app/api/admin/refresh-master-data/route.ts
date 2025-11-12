import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { refreshAllMasterSummaries, updateInventoryMaster } from '@/lib/inventory-helpers';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import { clearAllCaches } from '@/lib/cache-utils';

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

    // Check if user is admin
    const currentUser = await User.findOne({ user_id: payload.userId });
    if (!currentUser || !['admin', 'it_admin', 'super_admin'].includes(currentUser.userRole)) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { itemName, category, refreshAll } = body;

    console.log('🔄 Refresh master data request:', {
      itemName,
      category,
      refreshAll,
      adminId: currentUser.user_id
    });

    if (refreshAll) {
      // Refresh all InventoryMaster records
      const results = await refreshAllMasterSummaries();
      
      
      // Clear all caches
      clearAllCaches();
      
      return NextResponse.json({
        success: true,
        message: `รีเฟรชข้อมูล InventoryMaster ทั้งหมดเรียบร้อยแล้ว (${results.length} รายการ)`,
        refreshedItems: results.length
      });
    } else if (itemName && category) {
      // Refresh specific item
      const result = await updateInventoryMaster(itemName, category); // category is actually categoryId here
      // Debug summary
      try {
        const hasSN = (result as any)?.itemDetails?.withSerialNumber
          ? (((result as any).itemDetails.withSerialNumber.count ?? (result as any).itemDetails.withSerialNumber) > 0)
          : false;
        console.log('ℹ️ Master summary after refresh:', {
          itemName: (result as any)?.itemName,
          categoryId: (result as any)?.categoryId ?? (result as any)?.category,
          totalQuantity: (result as any)?.totalQuantity,
          availableQuantity: (result as any)?.availableQuantity,
          userOwnedQuantity: (result as any)?.userOwnedQuantity,
          hasSerialNumber: hasSN
        });
      } catch (_e) {}
      
      // Clear all caches
      clearAllCaches();
      
      return NextResponse.json({
        success: true,
        message: `รีเฟรชข้อมูล ${itemName} เรียบร้อยแล้ว`,
        item: {
          itemName: (result as any).itemName,
          category: (result as any).categoryId ?? (result as any).category,
          totalQuantity: (result as any).totalQuantity,
          availableQuantity: (result as any).availableQuantity,
          userOwnedQuantity: (result as any).userOwnedQuantity,
          hasSerialNumber: ((result as any)?.itemDetails?.withSerialNumber?.count ?? (result as any)?.itemDetails?.withSerialNumber ?? 0) > 0
        }
      });
    } else {
      return NextResponse.json(
        { error: 'กรุณาระบุ itemName และ category หรือตั้งค่า refreshAll เป็น true' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error refreshing master data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการรีเฟรชข้อมูล' },
      { status: 500 }
    );
  }
}
