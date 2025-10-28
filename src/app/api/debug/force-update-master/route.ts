import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';

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
    
    console.log(`🔍 Checking ${itemName}...`);
    
    // 1. ตรวจสอบ InventoryItems
    const items = await InventoryItem.find({ 
      itemName, 
      categoryId, 
      deletedAt: { $exists: false } 
    });
    
    console.log(`📦 Found ${items.length} items:`, items.map(i => ({
      _id: i._id,
      itemName: (i as any).itemName,
      categoryId: (i as any).categoryId,
      statusId: i.statusId,
      conditionId: i.conditionId,
      ownerType: i.currentOwnership.ownerType
    })));
    
    // 2. ตรวจสอบ InventoryMaster
    const master = await InventoryMaster.findOne({ itemName, categoryId });
    
    if (!master) {
      return NextResponse.json(
        { error: 'ไม่พบ InventoryMaster', itemName, categoryId },
        { status: 404 }
      );
    }
    
    console.log(`📊 Current InventoryMaster:`, {
      _id: master._id,
      itemName: master.itemName,
      categoryId: master.categoryId,
      totalQuantity: master.totalQuantity,
      relatedItemIds: master.relatedItemIds
    });
    
    // 3. Force update InventoryMaster
    const adminStockItems = items.filter(item => item.currentOwnership.ownerType === 'admin_stock');
    const userOwnedItems = items.filter(item => item.currentOwnership.ownerType === 'user_owned');
    const availableToBorrow = adminStockItems.filter(item => 
      item.statusId === 'status_available' && item.conditionId === 'cond_working'
    );
    
    // Calculate breakdowns
    const statusBreakdown: Record<string, number> = {};
    const conditionBreakdown: Record<string, number> = {};
    
    items.forEach(item => {
      if (item.statusId) {
        statusBreakdown[item.statusId] = (statusBreakdown[item.statusId] || 0) + 1;
      }
      if (item.conditionId) {
        conditionBreakdown[item.conditionId] = (conditionBreakdown[item.conditionId] || 0) + 1;
      }
    });
    
    // 🔧 FORCE UPDATE
    master.totalQuantity = items.length;
    master.availableQuantity = availableToBorrow.length;
    master.userOwnedQuantity = userOwnedItems.length;
    master.relatedItemIds = items.map(item => (item._id as any).toString());
    master.statusBreakdown = statusBreakdown;
    master.conditionBreakdown = conditionBreakdown;
    master.lastUpdated = new Date();
    
    const savedMaster = await master.save();
    
    console.log(`✅ Force updated InventoryMaster:`, {
      _id: savedMaster._id,
      totalQuantity: savedMaster.totalQuantity,
      availableQuantity: savedMaster.availableQuantity,
      userOwnedQuantity: savedMaster.userOwnedQuantity
    });
    
    return NextResponse.json({
      success: true,
      message: 'Force update เรียบร้อยแล้ว',
      itemName,
      categoryId,
      itemsFound: items.length,
      before: {
        totalQuantity: master.totalQuantity
      },
      after: {
        totalQuantity: savedMaster.totalQuantity,
        availableQuantity: savedMaster.availableQuantity,
        userOwnedQuantity: savedMaster.userOwnedQuantity,
        statusBreakdown: savedMaster.statusBreakdown,
        conditionBreakdown: savedMaster.conditionBreakdown
      }
    });
    
  } catch (error) {
    console.error('Force update error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด', details: String(error) },
      { status: 500 }
    );
  }
}

