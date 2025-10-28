import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get('itemName') || 'AIS';
    
    // Check InventoryItems
    const items = await InventoryItem.find({ 
      itemName, 
      deletedAt: { $exists: false } 
    });
    
    // Check InventoryMaster
    const master = await InventoryMaster.findOne({ itemName });
    
    const result = {
      itemName,
      inventoryItems: {
        count: items.length,
        items: items.map(item => ({
          _id: item._id,
          statusId: item.statusId,
          conditionId: item.conditionId,
          ownerType: item.currentOwnership?.ownerType,
          deletedAt: item.deletedAt
        }))
      },
      inventoryMaster: master ? {
        _id: master._id,
        totalQuantity: master.totalQuantity,
        availableQuantity: master.availableQuantity,
        userOwnedQuantity: master.userOwnedQuantity,
        relatedItemIds: master.relatedItemIds,
        statusBreakdown: master.statusBreakdown,
        conditionBreakdown: master.conditionBreakdown
      } : null,
      diagnosis: {
        itemsExist: items.length > 0,
        masterExists: !!master,
        totalQuantityMatch: master?.totalQuantity === items.length,
        issue: master?.totalQuantity === 0 && items.length > 0 
          ? '⚠️ InventoryMaster.totalQuantity = 0 but items exist!' 
          : master?.totalQuantity !== items.length
          ? '⚠️ Quantity mismatch!'
          : '✅ Data is consistent'
      }
    };
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Debug check error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด', details: String(error) },
      { status: 500 }
    );
  }
}

