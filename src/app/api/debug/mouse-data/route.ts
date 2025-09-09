import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    console.log('🔍 Debug: Checking Mouse data in database...');

    // Check InventoryMaster for Mouse
    const mouseMaster = await InventoryMaster.find({ itemName: 'Mouse' });
    console.log('📦 InventoryMaster Mouse records:', mouseMaster.length);
    
    // Check InventoryItem for Mouse
    const mouseItems = await InventoryItem.find({ itemName: 'Mouse' });
    console.log('📦 InventoryItem Mouse records:', mouseItems.length);

    const debugData = {
      inventoryMaster: mouseMaster.map(item => ({
        _id: item._id,
        itemName: item.itemName,
        category: item.category,
        totalQuantity: item.totalQuantity,
        availableQuantity: item.availableQuantity,
        userOwnedQuantity: item.userOwnedQuantity,
        hasSerialNumber: item.hasSerialNumber,
        stockManagement: item.stockManagement,
        adminStockOperations: item.adminStockOperations?.slice(-3) || [], // Last 3 operations
        lastUpdated: item.lastUpdated
      })),
      inventoryItems: mouseItems.map(item => ({
        _id: item._id,
        itemName: item.itemName,
        category: item.category,
        serialNumber: item.serialNumber,
        status: item.status,
        currentOwnership: item.currentOwnership,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      })),
      summary: {
        masterRecords: mouseMaster.length,
        itemRecords: mouseItems.length,
        adminStockItems: mouseItems.filter(item => item.currentOwnership?.ownerType === 'admin_stock').length,
        userOwnedItems: mouseItems.filter(item => item.currentOwnership?.ownerType === 'user_owned').length
      }
    };

    return NextResponse.json(debugData);

  } catch (error) {
    console.error('Debug Mouse error:', error);
    return NextResponse.json(
      { error: 'Debug failed' },
      { status: 500 }
    );
  }
}
