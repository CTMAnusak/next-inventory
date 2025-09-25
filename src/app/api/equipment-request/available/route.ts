import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
// ItemMaster removed - using InventoryMaster directly
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';

// GET - ดึงรายการอุปกรณ์ที่สามารถเบิกได้
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Build query for InventoryMaster (direct query - no ItemMaster needed)
    const query: any = {};
    
    if (categoryId) {
      query.categoryId = categoryId;
    }
    
    if (search) {
      query.itemName = { $regex: search, $options: 'i' };
    }
    
    // Only get InventoryMasters with available inventory
    query.availableQuantity = { $gt: 0 };
    
    // Get InventoryMasters directly
    const inventoryMasters = await InventoryMaster.find(query)
      .sort({ itemName: 1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Build available items list
    const availableItems = [];
    
    for (const inventoryMaster of inventoryMasters) {
      // Get sample available items for detailed info
      const sampleItems = await InventoryItem.find({
        itemName: inventoryMaster.itemName,
        categoryId: inventoryMaster.categoryId,
        'currentOwnership.ownerType': 'admin_stock',
        statusId: 'status_available',
        conditionId: 'cond_working',
        deletedAt: { $exists: false }
      }).limit(3);
      
      availableItems.push({
        itemMasterId: inventoryMaster._id.toString(), // Legacy compatibility
        itemName: inventoryMaster.itemName,
        categoryId: inventoryMaster.categoryId,
        hasSerialNumber: inventoryMaster.itemDetails.withSerialNumber > 0,
        availableQuantity: inventoryMaster.availableQuantity,
        totalQuantity: inventoryMaster.totalQuantity,
        statusBreakdown: inventoryMaster.statusBreakdown,
        itemDetails: inventoryMaster.itemDetails,
        // Include some sample items for display
        sampleItems: sampleItems.map(item => ({
          id: item._id,
          serialNumber: item.serialNumber,
          numberPhone: item.numberPhone,
          statusId: item.statusId,
          conditionId: item.conditionId
        }))
      });
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
