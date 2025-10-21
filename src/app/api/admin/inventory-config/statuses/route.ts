import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig, { 
  generateStatusId,
  createStatusConfig
} from '@/models/InventoryConfig';
import { InventoryItem } from '@/models/InventoryItemNew';
import { verifyToken } from '@/lib/auth';

// GET - ดึงสภาพอุปกรณ์ทั้งหมด
export async function GET() {
  try {
    await dbConnect();
    
    const config = await InventoryConfig.findOne({});
    if (!config) {
      return NextResponse.json({ statuses: [] });
    }
    
    const statuses = (config.statusConfigs || []).sort((a: any, b: any) => a.order - b.order);
    
    return NextResponse.json({ statuses });
    
  } catch (error) {
    console.error('Error fetching statuses:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสภาพอุปกรณ์' },
      { status: 500 }
    );
  }
}

// POST - เพิ่มสภาพอุปกรณ์ใหม่
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
        { error: 'กรุณาระบุชื่อสภาพอุปกรณ์' },
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
    const existingStatus = config.statusConfigs?.find((status: any) => 
      status.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (existingStatus) {
      return NextResponse.json(
        { error: 'ชื่อสภาพอุปกรณ์นี้มีอยู่แล้ว' },
        { status: 400 }
      );
    }
    
    // สร้างสภาพอุปกรณ์ใหม่
    const newOrder = Math.max(...(config.statusConfigs || []).map((status: any) => status.order), 0) + 1;
    const newStatus = {
      id: generateStatusId(),
      name: name.trim(),
      order: newOrder,
      isSystemConfig: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (!config.statusConfigs) {
      config.statusConfigs = [];
    }
    
    config.statusConfigs.push(newStatus as any);
    await config.save();
    
    return NextResponse.json({
      message: 'เพิ่มสภาพอุปกรณ์เรียบร้อยแล้ว',
      status: newStatus
    });
    
  } catch (error) {
    console.error('Error adding status:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเพิ่มสภาพอุปกรณ์' },
      { status: 500 }
    );
  }
}

// PUT - อัปเดตลำดับสภาพอุปกรณ์
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
    const { statuses } = body;
    
    if (!Array.isArray(statuses)) {
      return NextResponse.json(
        { error: 'ข้อมูลสภาพอุปกรณ์ไม่ถูกต้อง' },
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
    statuses.forEach((status: any, index: number) => {
      const existingStatus = config.statusConfigs?.find((s: any) => s.id === status.id);
      if (existingStatus) {
        existingStatus.order = index + 1;
        existingStatus.updatedAt = new Date();
      }
    });
    
    await config.save();
    
    return NextResponse.json({
      message: 'อัปเดตลำดับสภาพอุปกรณ์เรียบร้อยแล้ว',
      statuses: config.statusConfigs?.sort((a: any, b: any) => a.order - b.order)
    });
    
  } catch (error) {
    console.error('Error updating status order:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปเดตลำดับสภาพอุปกรณ์' },
      { status: 500 }
    );
  }
}
