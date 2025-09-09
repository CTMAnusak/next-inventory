import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';
import { updateInventoryMaster } from '@/lib/inventory-helpers';
import { clearAllCaches } from '@/lib/cache-utils';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    console.log('🔧 Debug: Fixing Mouse data inconsistency...');

    // Force update InventoryMaster for Mouse
    const result = await updateInventoryMaster('Mouse', 'อุปกรณ์เสริม');
    
    console.log('✅ Mouse InventoryMaster updated:', result);

    // Clear all caches to force refresh
    clearAllCaches();
    
    console.log('🗑️ All caches cleared');

    // Get fresh data to verify fix
    const mouseMaster = await InventoryMaster.findOne({ 
      itemName: 'Mouse', 
      category: 'อุปกรณ์เสริม' 
    });

    if (!mouseMaster) {
      return NextResponse.json(
        { error: 'Mouse InventoryMaster not found after fix' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: '✅ Mouse data fixed successfully',
      result: {
        itemName: mouseMaster.itemName,
        category: mouseMaster.category,
        totalQuantity: mouseMaster.totalQuantity,
        availableQuantity: mouseMaster.availableQuantity,
        userOwnedQuantity: mouseMaster.userOwnedQuantity,
        lastUpdated: mouseMaster.lastUpdated
      }
    });

  } catch (error) {
    console.error('❌ Fix Mouse error:', error);
    return NextResponse.json(
      { error: 'Fix failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
