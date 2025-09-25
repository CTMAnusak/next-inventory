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
    if (!currentUser || !['admin', 'it_admin'].includes(currentUser.userRole)) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { itemName, category, refreshAll } = body;

    console.log(`🔄 Refresh Master Data API called:`, {
      itemName,
      category,
      refreshAll,
      adminId: currentUser.user_id
    });

    if (refreshAll) {
      // Refresh all InventoryMaster records
      console.log('🔄 Refreshing ALL InventoryMaster summaries...');
      const results = await refreshAllMasterSummaries();
      
      console.log(`✅ Refreshed ${results.length} InventoryMaster records`);
      
      // Clear all caches
      clearAllCaches();
      console.log('🗑️ Cleared all caches');
      
      return NextResponse.json({
        success: true,
        message: `รีเฟรชข้อมูล InventoryMaster ทั้งหมดเรียบร้อยแล้ว (${results.length} รายการ)`,
        refreshedItems: results.length
      });
    } else if (itemName && category) {
      // Refresh specific item
      console.log(`🔄 Refreshing InventoryMaster for: ${itemName} (${category})`);
      const result = await updateInventoryMaster(itemName, category); // category is actually categoryId here
      
      console.log(`✅ Refreshed InventoryMaster for ${itemName}:`, {
        totalQuantity: result.totalQuantity,
        availableQuantity: result.availableQuantity,
        userOwnedQuantity: result.userOwnedQuantity,
        hasSerialNumber: result.hasSerialNumber
      });
      
      // Clear all caches
      clearAllCaches();
      console.log('🗑️ Cleared all caches');
      
      return NextResponse.json({
        success: true,
        message: `รีเฟรชข้อมูล ${itemName} เรียบร้อยแล้ว`,
        item: {
          itemName: result.itemName,
          category: result.category,
          totalQuantity: result.totalQuantity,
          availableQuantity: result.availableQuantity,
          userOwnedQuantity: result.userOwnedQuantity,
          hasSerialNumber: result.hasSerialNumber
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
