import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ItemMaster from '@/models/ItemMaster';
import { InventoryMaster } from '@/models/InventoryMasterNew';
import { InventoryItem } from '@/models/InventoryItemNew';
import { verifyToken } from '@/lib/auth';

// GET - ดึง ItemMaster เดียว
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    
    const itemMaster = await ItemMaster.findById(id);
    
    if (!itemMaster || !itemMaster.isActive) {
      return NextResponse.json(
        { error: 'ไม่พบอุปกรณ์' },
        { status: 404 }
      );
    }
    
    // Get inventory data
    const inventoryMaster = await InventoryMaster.findOne({ 
      itemMasterId: id 
    });
    
    // Get recent inventory items
    const recentItems = await InventoryItem.find({
      itemMasterId: id,
      deletedAt: { $exists: false }
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('serialNumber numberPhone statusId conditionId currentOwnership createdAt');
    
    return NextResponse.json({
      itemMaster,
      inventory: inventoryMaster ? {
        totalQuantity: inventoryMaster.totalQuantity,
        availableQuantity: inventoryMaster.availableQuantity,
        userOwnedQuantity: inventoryMaster.userOwnedQuantity,
        statusBreakdown: inventoryMaster.statusBreakdown,
        conditionBreakdown: inventoryMaster.conditionBreakdown,
        stockManagement: inventoryMaster.stockManagement
      } : null,
      recentItems
    });
    
  } catch (error) {
    console.error('Error fetching item master:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์' },
      { status: 500 }
    );
  }
}

// PUT - แก้ไข ItemMaster
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
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
    const { itemName, categoryId, hasSerialNumber } = body;
    
    const itemMaster = await ItemMaster.findById(id);
    
    if (!itemMaster || !itemMaster.isActive) {
      return NextResponse.json(
        { error: 'ไม่พบอุปกรณ์' },
        { status: 404 }
      );
    }
    
    // ตรวจสอบชื่อซ้ำ (ยกเว้นตัวเอง)
    if (itemName && itemName.trim() !== itemMaster.itemName) {
      const existingItemMaster = await ItemMaster.findOne({
        itemName: itemName.trim(),
        categoryId: categoryId || itemMaster.categoryId,
        isActive: true,
        _id: { $ne: id }
      });
      
      if (existingItemMaster) {
        return NextResponse.json(
          { error: 'ชื่ออุปกรณ์นี้มีอยู่ในหมวดหมู่นี้แล้ว' },
          { status: 400 }
        );
      }
    }
    
    // อัปเดตข้อมูล
    if (itemName) {
      itemMaster.itemName = itemName.trim();
    }
    
    if (categoryId) {
      itemMaster.categoryId = categoryId;
    }
    
    if (hasSerialNumber !== undefined) {
      itemMaster.hasSerialNumber = hasSerialNumber;
    }
    
    await itemMaster.save();
    
    return NextResponse.json({
      message: 'อัปเดตอุปกรณ์เรียบร้อยแล้ว',
      itemMaster
    });
    
  } catch (error) {
    console.error('Error updating item master:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปเดตอุปกรณ์' },
      { status: 500 }
    );
  }
}

// DELETE - ลบ ItemMaster (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
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
    
    const itemMaster = await ItemMaster.findById(id);
    
    if (!itemMaster || !itemMaster.isActive) {
      return NextResponse.json(
        { error: 'ไม่พบอุปกรณ์' },
        { status: 404 }
      );
    }
    
    // ตรวจสอบว่ามีการใช้งานหรือไม่
    const inventoryItemCount = await InventoryItem.countDocuments({ 
      itemMasterId: id,
      deletedAt: { $exists: false }
    });
    
    if (inventoryItemCount > 0) {
      return NextResponse.json(
        { 
          error: `ไม่สามารถลบอุปกรณ์ได้ เนื่องจากมีรายการ ${inventoryItemCount} รายการที่ใช้อุปกรณ์นี้`,
          itemCount: inventoryItemCount
        },
        { status: 400 }
      );
    }
    
    // Soft delete
    itemMaster.isActive = false;
    await itemMaster.save();
    
    // ลบ InventoryMaster ถ้ามี
    await InventoryMaster.deleteOne({ itemMasterId: id });
    
    return NextResponse.json({
      message: 'ลบอุปกรณ์เรียบร้อยแล้ว',
      deletedItemMasterId: id
    });
    
  } catch (error) {
    console.error('Error deleting item master:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบอุปกรณ์' },
      { status: 500 }
    );
  }
}
