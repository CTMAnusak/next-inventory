import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';

// GET - ดึงการตั้งค่าทั้งหมด (สำหรับผู้ใช้ทั่วไป)
export async function GET() {
  try {
    await dbConnect();
    
    let config = await InventoryConfig.findOne({});
    
    if (!config) {
      // สร้าง config ใหม่ถ้าไม่มี
      config = new InventoryConfig({
        categoryConfigs: [],
        statusConfigs: [],
        conditionConfigs: []
      });
      await config.save();
    }
    
    // ตรวจสอบและเพิ่ม default configs ถ้าไม่มี
    let needsSave = false;
    
    // เพิ่ม default statuses ถ้าไม่มี
    if (!config.statusConfigs || config.statusConfigs.length === 0) {
      config.statusConfigs = [
        {
          id: 'status_available',
          name: 'มี',
          color: '#10B981',
          order: 1,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'status_missing',
          name: 'หาย',
          color: '#EF4444',
          order: 2,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ] as any;
      needsSave = true;
    }
    
    // เพิ่ม default conditions ถ้าไม่มี
    if (!config.conditionConfigs || config.conditionConfigs.length === 0) {
      config.conditionConfigs = [
        {
          id: 'cond_working',
          name: 'ใช้งานได้',
          color: '#10B981',
          order: 1,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'cond_damaged',
          name: 'ชำรุด',
          color: '#F59E0B',
          order: 2,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'cond_broken',
          name: 'เสีย',
          color: '#EF4444',
          order: 3,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ] as any;
      needsSave = true;
    }
    
    if (needsSave) {
      await config.save();
    }
    
    return NextResponse.json({
      statusConfigs: config.statusConfigs.sort((a: any, b: any) => a.order - b.order),
      conditionConfigs: config.conditionConfigs.sort((a: any, b: any) => a.order - b.order)
    });
    
  } catch (error) {
    console.error('Error fetching inventory config:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการตั้งค่า' },
      { status: 500 }
    );
  }
}
