import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';
import ItemMaster from '@/models/ItemMaster';
import { verifyToken } from '@/lib/auth';

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
    
    const category = config.categoryConfigs?.find(cat => cat.id === id);
    
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
    
    const categoryIndex = config.categoryConfigs?.findIndex(cat => cat.id === id);
    
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
    const existingCategory = config.categoryConfigs?.find(cat => 
      cat.id !== id && cat.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (existingCategory) {
      return NextResponse.json(
        { error: 'ชื่อหมวดหมู่นี้มีอยู่แล้ว' },
        { status: 400 }
      );
    }
    
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
    
    const category = config.categoryConfigs?.find(cat => cat.id === id);
    
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
    
    // ตรวจสอบว่ามีการใช้งานหรือไม่
    const itemMasterCount = await ItemMaster.countDocuments({ 
      categoryId: id,
      isActive: true
    });
    
    if (itemMasterCount > 0) {
      return NextResponse.json(
        { 
          error: `ไม่สามารถลบหมวดหมู่ได้ เนื่องจากมีอุปกรณ์ ${itemMasterCount} รายการที่ใช้หมวดหมู่นี้`,
          itemCount: itemMasterCount
        },
        { status: 400 }
      );
    }
    
    // ลบหมวดหมู่
    config.categoryConfigs = config.categoryConfigs?.filter(cat => cat.id !== id);
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
