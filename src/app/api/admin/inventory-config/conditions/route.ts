import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig, { 
  generateConditionId,
  createConditionConfig
} from '@/models/InventoryConfig';
import { InventoryItem } from '@/models/InventoryItemNew';
import { verifyToken } from '@/lib/auth';

// GET - ดึงสถานะอุปกรณ์ทั้งหมด
export async function GET() {
  try {
    await dbConnect();
    
    const config = await InventoryConfig.findOne({});
    if (!config) {
      return NextResponse.json({ conditions: [] });
    }
    
    const conditions = (config.conditionConfigs || []).sort((a: any, b: any) => a.order - b.order);
    
    return NextResponse.json({ conditions });
    
  } catch (error) {
    console.error('Error fetching conditions:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานะอุปกรณ์' },
      { status: 500 }
    );
  }
}

// POST - เพิ่มสถานะอุปกรณ์ใหม่
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
        { error: 'กรุณาระบุชื่อสถานะอุปกรณ์' },
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
    const existingCondition = config.conditionConfigs?.find((condition: any) => 
      condition.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (existingCondition) {
      return NextResponse.json(
        { error: 'ชื่อสถานะอุปกรณ์นี้มีอยู่แล้ว' },
        { status: 400 }
      );
    }
    
    // สร้างสถานะอุปกรณ์ใหม่
    const newOrder = Math.max(...(config.conditionConfigs || []).map((condition: any) => condition.order), 0) + 1;
    const newCondition = {
      id: generateConditionId(),
      name: name.trim(),
      order: newOrder,
      isSystemConfig: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (!config.conditionConfigs) {
      config.conditionConfigs = [];
    }
    
    config.conditionConfigs.push(newCondition as any);
    await config.save();
    
    return NextResponse.json({
      message: 'เพิ่มสถานะอุปกรณ์เรียบร้อยแล้ว',
      condition: newCondition
    });
    
  } catch (error) {
    console.error('Error adding condition:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเพิ่มสถานะอุปกรณ์' },
      { status: 500 }
    );
  }
}

// PUT - อัปเดตลำดับสถานะอุปกรณ์
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
    const { conditions } = body;
    
    if (!Array.isArray(conditions)) {
      return NextResponse.json(
        { error: 'ข้อมูลสถานะอุปกรณ์ไม่ถูกต้อง' },
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
    conditions.forEach((condition: any, index: number) => {
      const existingCondition = config.conditionConfigs?.find((c: any) => c.id === condition.id);
      if (existingCondition) {
        existingCondition.order = index + 1;
        existingCondition.updatedAt = new Date();
      }
    });
    
    await config.save();
    
    return NextResponse.json({
      message: 'อัปเดตลำดับสถานะอุปกรณ์เรียบร้อยแล้ว',
      conditions: config.conditionConfigs?.sort((a: any, b: any) => a.order - b.order)
    });
    
  } catch (error) {
    console.error('Error updating condition order:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปเดตลำดับสถานะอุปกรณ์' },
      { status: 500 }
    );
  }
}
