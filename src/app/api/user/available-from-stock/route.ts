import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryConfig from '@/models/InventoryConfig';
import { verifyToken } from '@/lib/auth';

/**
 * GET /api/user/available-from-stock
 * 
 * ดึงรายการอุปกรณ์ที่สามารถเลือกจากคลังอุปกรณ์สำหรับเพิ่มอุปกรณ์ที่มี (Dashboard)
 * กรองเฉพาะอุปกรณ์ที่มี:
 * - สถานะ: มี (status_available)
 * - สภาพ: ใช้งานได้ (cond_working)
 * - เจ้าของ: admin_stock
 * 
 * Query Parameters:
 * - categoryId: หมวดหมู่อุปกรณ์ (required)
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Verify user authentication
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    
    if (!categoryId) {
      return NextResponse.json(
        { error: 'กรุณาระบุหมวดหมู่' },
        { status: 400 }
      );
    }
    
    // Load configs to get "มี" (available) status and "ใช้งานได้" (working) condition
    const inventoryConfig = await InventoryConfig.findOne({});
    if (!inventoryConfig) {
      return NextResponse.json(
        { error: 'ไม่พบการตั้งค่าระบบ' },
        { status: 500 }
      );
    }

    // Find the "มี" status config (should be status_available)
    const availableStatus = inventoryConfig.statusConfigs?.find(s => s.name === 'มี');
    const availableStatusId = availableStatus?.id || 'status_available';

    // Find the "ใช้งานได้" condition config (should be cond_working)
    const workingCondition = inventoryConfig.conditionConfigs?.find(c => c.name === 'ใช้งานได้');
    const workingConditionId = workingCondition?.id || 'cond_working';

    console.log('🔍 Dashboard Available Stock Filter:', {
      categoryId,
      availableStatusId,
      workingConditionId,
      availableStatusName: availableStatus?.name,
      workingConditionName: workingCondition?.name
    });
    
    // Get all InventoryMasters in this category
    const inventoryMasters = await InventoryMaster.find({
      categoryId: categoryId,
      availableQuantity: { $gt: 0 }
    }).sort({ itemName: 1 });
    
    // For each InventoryMaster, check if there are items with status "มี" and condition "ใช้งานได้"
    const availableItems: {
      itemName: string;
      availableCount: number;
      sampleItem: {
        itemId: string;
        statusId: string;
        statusName: string;
        conditionId: string;
        conditionName: string;
        serialNumber?: string;
        numberPhone?: string;
      } | null;
    }[] = [];
    
    for (const inventoryMaster of inventoryMasters) {
      // Count items with correct status and condition
      const count = await InventoryItem.countDocuments({
        itemName: inventoryMaster.itemName,
        categoryId: inventoryMaster.categoryId,
        'currentOwnership.ownerType': 'admin_stock',
        statusId: availableStatusId,
        conditionId: workingConditionId,
        deletedAt: { $exists: false }
      });
      
      if (count > 0) {
        // Get one sample item to show statusId and conditionId
        const sampleItem = await InventoryItem.findOne({
          itemName: inventoryMaster.itemName,
          categoryId: inventoryMaster.categoryId,
          'currentOwnership.ownerType': 'admin_stock',
          statusId: availableStatusId,
          conditionId: workingConditionId,
          deletedAt: { $exists: false }
        });
        
        availableItems.push({
          itemName: inventoryMaster.itemName,
          availableCount: count,
          sampleItem: sampleItem ? {
            itemId: sampleItem._id.toString(),
            statusId: sampleItem.statusId || availableStatusId,
            statusName: availableStatus?.name || 'มี',
            conditionId: sampleItem.conditionId || workingConditionId,
            conditionName: workingCondition?.name || 'ใช้งานได้',
            serialNumber: sampleItem.serialNumber,
            numberPhone: sampleItem.numberPhone
          } : null
        });
      }
    }
    
    console.log(`✅ Found ${availableItems.length} available item types in category ${categoryId}`);
    
    return NextResponse.json({
      categoryId,
      availableItems,
      filters: {
        statusId: availableStatusId,
        statusName: availableStatus?.name || 'มี',
        conditionId: workingConditionId,
        conditionName: workingCondition?.name || 'ใช้งานได้'
      }
    });
    
  } catch (error) {
    console.error('Error fetching available stock items:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}

