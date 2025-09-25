import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ItemMaster from '@/models/ItemMaster';
import { InventoryMaster } from '@/models/InventoryMasterNew';
import { verifyToken } from '@/lib/auth';

// GET - ดึง ItemMaster ทั้งหมด
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Build query
    const query: any = { isActive: true };
    
    if (categoryId) {
      query.categoryId = categoryId;
    }
    
    if (search) {
      query.itemName = { $regex: search, $options: 'i' };
    }
    
    // Get total count for pagination
    const totalCount = await ItemMaster.countDocuments(query);
    
    // Get paginated results
    const itemMasters = await ItemMaster.find(query)
      .sort({ itemName: 1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get inventory data for each ItemMaster
    const itemMastersWithInventory = await Promise.all(
      itemMasters.map(async (itemMaster) => {
        const inventoryMaster = await InventoryMaster.findOne({ 
          itemMasterId: itemMaster._id.toString() 
        });
        
        return {
          ...itemMaster.toObject(),
          inventory: inventoryMaster ? {
            totalQuantity: inventoryMaster.totalQuantity,
            availableQuantity: inventoryMaster.availableQuantity,
            userOwnedQuantity: inventoryMaster.userOwnedQuantity,
            statusBreakdown: inventoryMaster.statusBreakdown,
            conditionBreakdown: inventoryMaster.conditionBreakdown
          } : null
        };
      })
    );
    
    return NextResponse.json({
      itemMasters: itemMastersWithInventory,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching item masters:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์' },
      { status: 500 }
    );
  }
}

// POST - สร้าง ItemMaster ใหม่
export async function POST(request: NextRequest) {
  try {
    // Verify admin token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    
    await dbConnect();
    
    const body = await request.json();
    const { itemName, categoryId, hasSerialNumber = false } = body;
    
    if (!itemName || !categoryId) {
      return NextResponse.json(
        { error: 'กรุณาระบุชื่ออุปกรณ์และหมวดหมู่' },
        { status: 400 }
      );
    }
    
    // ตรวจสอบว่ามีอยู่แล้วหรือไม่
    const existingItemMaster = await ItemMaster.findOne({
      itemName: itemName.trim(),
      categoryId,
      isActive: true
    });
    
    if (existingItemMaster) {
      return NextResponse.json(
        { error: 'ชื่ออุปกรณ์นี้มีอยู่ในหมวดหมู่นี้แล้ว' },
        { status: 400 }
      );
    }
    
    // สร้าง ItemMaster ใหม่
    const newItemMaster = new ItemMaster({
      itemName: itemName.trim(),
      categoryId,
      hasSerialNumber,
      isActive: true,
      createdBy: payload.userId
    });
    
    await newItemMaster.save();
    
    return NextResponse.json({
      message: 'เพิ่มอุปกรณ์เรียบร้อยแล้ว',
      itemMaster: newItemMaster
    });
    
  } catch (error) {
    console.error('Error creating item master:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเพิ่มอุปกรณ์' },
      { status: 500 }
    );
  }
}
