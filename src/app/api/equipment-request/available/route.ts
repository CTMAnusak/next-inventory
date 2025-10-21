import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
// ItemMaster removed - using InventoryMaster directly
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';
import InventoryConfig from '@/models/InventoryConfig';

// GET - ดึงรายการอุปกรณ์ที่สามารถเบิกได้
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Load configs to get "มี" (available) status and "ใช้งานได้" (working) condition
    const inventoryConfig = await InventoryConfig.findOne({});
    if (!inventoryConfig) {
      return NextResponse.json(
        { error: 'ไม่พบการตั้งค่าระบบ' },
        { status: 500 }
      );
    }

  // Find the "มี" status config (should be status_available)
  const availableStatus = inventoryConfig.statusConfigs?.find((s: any) => s.name === 'มี');
  const availableStatusId = availableStatus?.id || 'status_available';

  // Find the "ใช้งานได้" condition config (should be cond_working)
  const workingCondition = inventoryConfig.conditionConfigs?.find((c: any) => c.name === 'ใช้งานได้');
  const workingConditionId = workingCondition?.id || 'cond_working';

    console.log('🔍 Equipment Request Filter:', {
      availableStatusId,
      workingConditionId,
      availableStatusName: availableStatus?.name,
      workingConditionName: workingCondition?.name
    });
    
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
      // ✅ นับจำนวนอุปกรณ์ที่มีสถานะ "มี" และสภาพ "ใช้งานได้" เท่านั้น
      const actualAvailableCount = await InventoryItem.countDocuments({
        itemName: inventoryMaster.itemName,
        categoryId: inventoryMaster.categoryId,
        'currentOwnership.ownerType': 'admin_stock',
        statusId: availableStatusId,
        conditionId: workingConditionId,
        deletedAt: { $exists: false }
      });
      
      // ข้ามรายการที่ไม่มีอุปกรณ์พร้อมใช้งาน
      if (actualAvailableCount === 0) {
        continue;
      }
      
      // Get sample available items for detailed info
      const sampleItems = await InventoryItem.find({
        itemName: inventoryMaster.itemName,
        categoryId: inventoryMaster.categoryId,
        'currentOwnership.ownerType': 'admin_stock',
        statusId: availableStatusId,
        conditionId: workingConditionId,
        deletedAt: { $exists: false }
      }).limit(3);
      
    availableItems.push({
      itemMasterId: String(inventoryMaster._id), // Legacy compatibility
      itemName: inventoryMaster.itemName,
      categoryId: inventoryMaster.categoryId,
      hasSerialNumber: (inventoryMaster.itemDetails.withSerialNumber as any)?.count > 0 || false,
        availableQuantity: actualAvailableCount, // ✅ ใช้จำนวนที่นับจากอุปกรณ์ที่กรองแล้ว
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
