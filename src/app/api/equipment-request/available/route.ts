import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ItemMaster from '@/models/ItemMaster';
import { InventoryMaster } from '@/models/InventoryMasterNew';
import { findAvailableItems } from '@/lib/inventory-helpers';

// GET - ดึงรายการอุปกรณ์ที่สามารถเบิกได้
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Build query for ItemMaster
    const query: any = { isActive: true };
    
    if (categoryId) {
      query.categoryId = categoryId;
    }
    
    if (search) {
      query.itemName = { $regex: search, $options: 'i' };
    }
    
    // Get ItemMasters with available inventory
    const itemMasters = await ItemMaster.find(query)
      .sort({ itemName: 1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get inventory data for each ItemMaster
    const availableItems = [];
    
    for (const itemMaster of itemMasters) {
      const inventoryMaster = await InventoryMaster.findOne({ 
        itemMasterId: itemMaster._id.toString() 
      });
      
      // Only include items that have available inventory
      if (inventoryMaster && inventoryMaster.availableQuantity > 0) {
        // Get actual available items for detailed info
        const actualAvailableItems = await findAvailableItems(
          itemMaster._id.toString(), 
          inventoryMaster.availableQuantity
        );
        
        availableItems.push({
          itemMasterId: itemMaster._id.toString(),
          itemName: itemMaster.itemName,
          categoryId: itemMaster.categoryId,
          hasSerialNumber: itemMaster.hasSerialNumber,
          availableQuantity: inventoryMaster.availableQuantity,
          totalQuantity: inventoryMaster.totalQuantity,
          statusBreakdown: inventoryMaster.statusBreakdown,
          conditionBreakdown: inventoryMaster.conditionBreakdown,
          // Include some sample items for display
          sampleItems: actualAvailableItems.slice(0, 3).map(item => ({
            id: item._id,
            serialNumber: item.serialNumber,
            numberPhone: item.numberPhone,
            statusId: item.statusId,
            conditionId: item.conditionId
          }))
        });
      }
    }
    
    // Get total count for pagination
    const totalCount = availableItems.length;
    
    return NextResponse.json({
      availableItems,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching available equipment:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์' },
      { status: 500 }
    );
  }
}
