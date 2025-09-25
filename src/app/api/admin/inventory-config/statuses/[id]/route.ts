import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';
import { InventoryItem } from '@/models/InventoryItemNew';
import { verifyToken } from '@/lib/auth';

// GET - ดึงสภาพอุปกรณ์เดียว
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    
    const config = await InventoryConfig.findOne({
      'statusConfigs.id': id
    });
    
    if (!config) {
      return NextResponse.json(
        { error: 'ไม่พบสภาพอุปกรณ์' },
        { status: 404 }
      );
    }
    
    const status = config.statusConfigs?.find(s => s.id === id);
    
    if (!status) {
      return NextResponse.json(
        { error: 'ไม่พบสภาพอุปกรณ์' },
        { status: 404 }
      );
    }
    
    // นับจำนวนการใช้งาน
    const usageCount = await InventoryItem.countDocuments({ 
      statusId: id,
      deletedAt: { $exists: false }
    });
    
    return NextResponse.json({ 
      status,
      usageCount
    });
    
  } catch (error) {
    console.error('Error fetching status:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสภาพอุปกรณ์' },
      { status: 500 }
    );
  }
}

// PUT - แก้ไขสภาพอุปกรณ์
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
        { error: 'กรุณาระบุชื่อสภาพอุปกรณ์' },
        { status: 400 }
      );
    }
    
    const config = await InventoryConfig.findOne({
      'statusConfigs.id': id
    });
    
    if (!config) {
      return NextResponse.json(
        { error: 'ไม่พบสภาพอุปกรณ์' },
        { status: 404 }
      );
    }
    
    const statusIndex = config.statusConfigs?.findIndex(s => s.id === id);
    
    if (statusIndex === -1 || statusIndex === undefined) {
      return NextResponse.json(
        { error: 'ไม่พบสภาพอุปกรณ์' },
        { status: 404 }
      );
    }
    
    const status = config.statusConfigs![statusIndex];
    
    // ตรวจสอบว่าเป็น system config หรือไม่
    if (status.isSystemConfig) {
      // System config ไม่สามารถเปลี่ยนชื่อได้
      if (name.trim() !== status.name) {
        return NextResponse.json(
          { error: 'ไม่สามารถเปลี่ยนชื่อสภาพอุปกรณ์ระบบได้' },
          { status: 400 }
        );
      }
    } else {
      // ตรวจสอบชื่อซ้ำ (ยกเว้นตัวเอง)
      const existingStatus = config.statusConfigs?.find(s => 
        s.id !== id && s.name.toLowerCase() === name.trim().toLowerCase()
      );
      
      if (existingStatus) {
        return NextResponse.json(
          { error: 'ชื่อสภาพอุปกรณ์นี้มีอยู่แล้ว' },
          { status: 400 }
        );
      }
      
      status.name = name.trim();
    }
    
    status.updatedAt = new Date();
    
    await config.save();
    
    return NextResponse.json({
      message: 'อัปเดตสภาพอุปกรณ์เรียบร้อยแล้ว',
      status
    });
    
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปเดตสภาพอุปกรณ์' },
      { status: 500 }
    );
  }
}

// DELETE - ลบสภาพอุปกรณ์
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
      'statusConfigs.id': id
    });
    
    if (!config) {
      return NextResponse.json(
        { error: 'ไม่พบสภาพอุปกรณ์' },
        { status: 404 }
      );
    }
    
    const status = config.statusConfigs?.find(s => s.id === id);
    
    if (!status) {
      return NextResponse.json(
        { error: 'ไม่พบสภาพอุปกรณ์' },
        { status: 404 }
      );
    }
    
    // ตรวจสอบว่าเป็น system config หรือไม่
    if (status.isSystemConfig) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบสภาพอุปกรณ์ระบบได้' },
        { status: 400 }
      );
    }
    
    // ตรวจสอบว่ามีการใช้งานหรือไม่
    const usageCount = await InventoryItem.countDocuments({ 
      statusId: id,
      deletedAt: { $exists: false }
    });
    
    if (usageCount > 0) {
      return NextResponse.json(
        { 
          error: `ไม่สามารถลบสภาพอุปกรณ์ได้ เนื่องจากมีอุปกรณ์ ${usageCount} รายการที่ใช้สภาพนี้`,
          usageCount
        },
        { status: 400 }
      );
    }
    
    // ลบสภาพอุปกรณ์
    config.statusConfigs = config.statusConfigs?.filter(s => s.id !== id);
    await config.save();
    
    return NextResponse.json({
      message: 'ลบสภาพอุปกรณ์เรียบร้อยแล้ว',
      deletedStatusId: id
    });
    
  } catch (error) {
    console.error('Error deleting status:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบสภาพอุปกรณ์' },
      { status: 500 }
    );
  }
}
