import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig, { 
  generateCategoryId,
  createDefaultCategoryConfig
} from '@/models/InventoryConfig';
import { verifyToken } from '@/lib/auth';

// GET - ดึงหมวดหมู่ทั้งหมด
export async function GET() {
  try {
    await dbConnect();
    
    const config = await InventoryConfig.findOne({});
    if (!config) {
      return NextResponse.json({ categories: [] });
    }
    
    const categories = (config.categoryConfigs || []).sort((a: any, b: any) => a.order - b.order);
    
    return NextResponse.json({ categories });
    
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลหมวดหมู่' },
      { status: 500 }
    );
  }
}

// POST - เพิ่มหมวดหมู่ใหม่
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
    const { name } = body;
    
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'กรุณาระบุชื่อหมวดหมู่' },
        { status: 400 }
      );
    }
    
    let config = await InventoryConfig.findOne({});
    if (!config) {
      config = new InventoryConfig({
        categoryConfigs: [],
        statusConfigs: [],
        conditionConfigs: []
      });
    }
    
    // ตรวจสอบชื่อซ้ำ
    const existingCategory = config.categoryConfigs?.find((cat: any) => 
      cat.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (existingCategory) {
      return NextResponse.json(
        { error: 'ชื่อหมวดหมู่นี้มีอยู่แล้ว' },
        { status: 400 }
      );
    }
    
    // สร้างหมวดหมู่ใหม่
    const newOrder = Math.max(...(config.categoryConfigs || []).map((cat: any) => cat.order), 0) + 1;
    const newCategory = {
      id: generateCategoryId(),
      name: name.trim(),
      isSystemCategory: false,
      order: newOrder,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (!config.categoryConfigs) {
      config.categoryConfigs = [];
    }
    
    config.categoryConfigs.push(newCategory as any);
    await config.save();
    
    return NextResponse.json({
      message: 'เพิ่มหมวดหมู่เรียบร้อยแล้ว',
      category: newCategory
    });
    
  } catch (error) {
    console.error('Error adding category:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเพิ่มหมวดหมู่' },
      { status: 500 }
    );
  }
}

// PUT - อัปเดตลำดับหมวดหมู่
export async function PUT(request: NextRequest) {
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
    const { categories } = body;
    
    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { error: 'ข้อมูลหมวดหมู่ไม่ถูกต้อง' },
        { status: 400 }
      );
    }
    
    const config = await InventoryConfig.findOne({});
    if (!config) {
      return NextResponse.json(
        { error: 'ไม่พบการตั้งค่า' },
        { status: 404 }
      );
    }
    
    // อัปเดตลำดับ
    categories.forEach((cat: any, index: number) => {
      const existingCat = config.categoryConfigs?.find((c: any) => c.id === cat.id);
      if (existingCat) {
        existingCat.order = index + 1;
        existingCat.updatedAt = new Date();
      }
    });
    
    await config.save();
    
    return NextResponse.json({
      message: 'อัปเดตลำดับหมวดหมู่เรียบร้อยแล้ว',
      categories: config.categoryConfigs?.sort((a: any, b: any) => a.order - b.order)
    });
    
  } catch (error) {
    console.error('Error updating category order:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปเดตลำดับหมวดหมู่' },
      { status: 500 }
    );
  }
}
