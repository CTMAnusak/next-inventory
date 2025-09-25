import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';
import { InventoryItem } from '@/models/InventoryItemNew';
import { verifyToken } from '@/lib/auth';

// GET - ดึงสถานะอุปกรณ์เดียว
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    
    const config = await InventoryConfig.findOne({
      'conditionConfigs.id': id
    });
    
    if (!config) {
      return NextResponse.json(
        { error: 'ไม่พบสถานะอุปกรณ์' },
        { status: 404 }
      );
    }
    
    const condition = config.conditionConfigs?.find(c => c.id === id);
    
    if (!condition) {
      return NextResponse.json(
        { error: 'ไม่พบสถานะอุปกรณ์' },
        { status: 404 }
      );
    }
    
    // นับจำนวนการใช้งาน
    const usageCount = await InventoryItem.countDocuments({ 
      conditionId: id,
      deletedAt: { $exists: false }
    });
    
    return NextResponse.json({ 
      condition,
      usageCount
    });
    
  } catch (error) {
    console.error('Error fetching condition:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานะอุปกรณ์' },
      { status: 500 }
    );
  }
}

// PUT - แก้ไขสถานะอุปกรณ์
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
        { error: 'กรุณาระบุชื่อสถานะอุปกรณ์' },
        { status: 400 }
      );
    }
    
    const config = await InventoryConfig.findOne({
      'conditionConfigs.id': id
    });
    
    if (!config) {
      return NextResponse.json(
        { error: 'ไม่พบสถานะอุปกรณ์' },
        { status: 404 }
      );
    }
    
    const conditionIndex = config.conditionConfigs?.findIndex(c => c.id === id);
    
    if (conditionIndex === -1 || conditionIndex === undefined) {
      return NextResponse.json(
        { error: 'ไม่พบสถานะอุปกรณ์' },
        { status: 404 }
      );
    }
    
    const condition = config.conditionConfigs![conditionIndex];
    
    // ตรวจสอบว่าเป็น system config หรือไม่
    if (condition.isSystemConfig) {
      // System config ไม่สามารถเปลี่ยนชื่อได้
      if (name.trim() !== condition.name) {
        return NextResponse.json(
          { error: 'ไม่สามารถเปลี่ยนชื่อสถานะอุปกรณ์ระบบได้' },
          { status: 400 }
        );
      }
    } else {
      // ตรวจสอบชื่อซ้ำ (ยกเว้นตัวเอง)
      const existingCondition = config.conditionConfigs?.find(c => 
        c.id !== id && c.name.toLowerCase() === name.trim().toLowerCase()
      );
      
      if (existingCondition) {
        return NextResponse.json(
          { error: 'ชื่อสถานะอุปกรณ์นี้มีอยู่แล้ว' },
          { status: 400 }
        );
      }
      
      condition.name = name.trim();
    }
    
    condition.updatedAt = new Date();
    
    await config.save();
    
    return NextResponse.json({
      message: 'อัปเดตสถานะอุปกรณ์เรียบร้อยแล้ว',
      condition
    });
    
  } catch (error) {
    console.error('Error updating condition:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปเดตสถานะอุปกรณ์' },
      { status: 500 }
    );
  }
}

// DELETE - ลบสถานะอุปกรณ์
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
      'conditionConfigs.id': id
    });
    
    if (!config) {
      return NextResponse.json(
        { error: 'ไม่พบสถานะอุปกรณ์' },
        { status: 404 }
      );
    }
    
    const condition = config.conditionConfigs?.find(c => c.id === id);
    
    if (!condition) {
      return NextResponse.json(
        { error: 'ไม่พบสถานะอุปกรณ์' },
        { status: 404 }
      );
    }
    
    // ตรวจสอบว่าเป็น system config หรือไม่
    if (condition.isSystemConfig) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบสถานะอุปกรณ์ระบบได้' },
        { status: 400 }
      );
    }
    
    // ตรวจสอบว่ามีการใช้งานหรือไม่
    const usageCount = await InventoryItem.countDocuments({ 
      conditionId: id,
      deletedAt: { $exists: false }
    });
    
    if (usageCount > 0) {
      return NextResponse.json(
        { 
          error: `ไม่สามารถลบสถานะอุปกรณ์ได้ เนื่องจากมีอุปกรณ์ ${usageCount} รายการที่ใช้สถานะนี้`,
          usageCount
        },
        { status: 400 }
      );
    }
    
    // ลบสถานะอุปกรณ์
    config.conditionConfigs = config.conditionConfigs?.filter(c => c.id !== id);
    await config.save();
    
    return NextResponse.json({
      message: 'ลบสถานะอุปกรณ์เรียบร้อยแล้ว',
      deletedConditionId: id
    });
    
  } catch (error) {
    console.error('Error deleting condition:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบสถานะอุปกรณ์' },
      { status: 500 }
    );
  }
}
