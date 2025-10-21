import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';
import InventoryItem from '@/models/InventoryItem';
import { verifyToken } from '@/lib/auth';
import { snapshotCategoryConfigBeforeChange, checkCategoryConfigUsage } from '@/lib/equipment-snapshot-helpers';

// GET - ดึงหมวดหมู่เดียว
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    
    const config = await InventoryConfig.findOne({
      'categoryConfigs.id': id
    });
    
    if (!config) {
      return NextResponse.json(
        { error: 'ไม่พบหมวดหมู่' },
        { status: 404 }
      );
    }
    
    const category = config.categoryConfigs?.find((cat: any) => cat.id === id);
    
    if (!category) {
      return NextResponse.json(
        { error: 'ไม่พบหมวดหมู่' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ category });
    
  } catch (error) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลหมวดหมู่' },
      { status: 500 }
    );
  }
}

// PUT - แก้ไขหมวดหมู่
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
    const { name } = body;
    
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'กรุณาระบุชื่อหมวดหมู่' },
        { status: 400 }
      );
    }
    
    const config = await InventoryConfig.findOne({
      'categoryConfigs.id': id
    });
    
    if (!config) {
      return NextResponse.json(
        { error: 'ไม่พบหมวดหมู่' },
        { status: 404 }
      );
    }
    
    const categoryIndex = config.categoryConfigs?.findIndex((cat: any) => cat.id === id);
    
    if (categoryIndex === -1 || categoryIndex === undefined) {
      return NextResponse.json(
        { error: 'ไม่พบหมวดหมู่' },
        { status: 404 }
      );
    }
    
    const category = config.categoryConfigs![categoryIndex];
    
    // ตรวจสอบว่าเป็น system category หรือไม่
    if (category.isSystemCategory) {
      return NextResponse.json(
        { error: 'ไม่สามารถแก้ไขหมวดหมู่ระบบได้' },
        { status: 400 }
      );
    }
    
    // ตรวจสอบชื่อซ้ำ (ยกเว้นตัวเอง)
    const existingCategory = config.categoryConfigs?.find((cat: any) =>
      cat.id !== id && cat.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (existingCategory) {
      return NextResponse.json(
        { error: 'ชื่อหมวดหมู่นี้มีอยู่แล้ว' },
        { status: 400 }
      );
    }
    
    // Snapshot ชื่อใหม่ใน Equipment Logs ก่อนแก้ไข
    await snapshotCategoryConfigBeforeChange(id, name.trim());
    
    // อัปเดตหมวดหมู่
    category.name = name.trim();
    category.updatedAt = new Date();
    
    await config.save();
    
    return NextResponse.json({
      message: 'อัปเดตหมวดหมู่เรียบร้อยแล้ว',
      category
    });
    
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปเดตหมวดหมู่' },
      { status: 500 }
    );
  }
}

// DELETE - ลบหมวดหมู่
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
    
    const config = await InventoryConfig.findOne({
      'categoryConfigs.id': id
    });
    
    if (!config) {
      return NextResponse.json(
        { error: 'ไม่พบหมวดหมู่' },
        { status: 404 }
      );
    }
    
    const category = config.categoryConfigs?.find((cat: any) => cat.id === id);
    
    if (!category) {
      return NextResponse.json(
        { error: 'ไม่พบหมวดหมู่' },
        { status: 404 }
      );
    }
    
    // ตรวจสอบว่าเป็น system category หรือไม่
    if (category.isSystemCategory) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบหมวดหมู่ระบบได้' },
        { status: 400 }
      );
    }
    
    // ตรวจสอบว่ามีการใช้งานหรือไม่ (ทั้งใน Inventory Items และ Equipment Logs)
    const inventoryUsage = await InventoryItem.countDocuments({ 
      categoryId: id,
      deletedAt: { $exists: false }
    });
    
    const logsUsage = await checkCategoryConfigUsage(id);
    
    if (inventoryUsage > 0 || logsUsage.isUsed) {
      const totalUsage = inventoryUsage + logsUsage.total;
      return NextResponse.json(
        { 
          error: `ไม่สามารถลบหมวดหมู่ได้ เนื่องจากมีการใช้งาน ${totalUsage} รายการ (อุปกรณ์: ${inventoryUsage}, ประวัติ: ${logsUsage.total})`,
          itemCount: totalUsage,
          inventoryUsage,
          logsUsage: logsUsage.total
        },
        { status: 400 }
      );
    }
    
    // Snapshot ชื่อล่าสุดก่อนลบ (เผื่อมีการใช้งานใน Logs ที่ยังไม่ได้ snapshot)
    await snapshotCategoryConfigBeforeChange(id);
    
    // ลบหมวดหมู่
    config.categoryConfigs = config.categoryConfigs?.filter((cat: any) => cat.id !== id);
    await config.save();
    
    return NextResponse.json({
      message: 'ลบหมวดหมู่เรียบร้อยแล้ว',
      deletedCategoryId: id
    });
    
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบหมวดหมู่' },
      { status: 500 }
    );
  }
}
