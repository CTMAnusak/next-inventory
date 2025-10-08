import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';

// GET - Fetch inventory configurations
export async function GET() {
  try {
    await dbConnect();
    
    // Get the inventory config document
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
    
    // เพิ่ม default categories ถ้าไม่มี
    if (!config.categoryConfigs || config.categoryConfigs.length === 0) {
      config.categoryConfigs = [
        {
          id: 'cat_sim_card',
          name: 'ซิมการ์ด',
          isSystemCategory: true,
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'cat_unassigned',
          name: 'ไม่ระบุ',
          isSystemCategory: true,
          order: 999,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ] as any;
      needsSave = true;
    }
    
    // เพิ่ม default statuses ถ้าไม่มี
    if (!config.statusConfigs || config.statusConfigs.length === 0) {
      config.statusConfigs = [
        {
          id: 'status_available',
          name: 'มี',
          order: 1,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'status_missing',
          name: 'หาย',
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
          order: 1,
          isSystemConfig: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'cond_damaged',
          name: 'ชำรุด',
          order: 2,
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
    
    console.log('📊 Config found:', {
      statusConfigs: config.statusConfigs?.length || 0,
      conditionConfigs: config.conditionConfigs?.length || 0,
      categoryConfigs: config.categoryConfigs?.length || 0
    });
    
    // Return the configuration data
    return NextResponse.json({
      statusConfigs: config.statusConfigs || [],
      conditionConfigs: config.conditionConfigs || [],
      categoryConfigs: config.categoryConfigs || []
    });
    
  } catch (error) {
    console.error('❌ Error fetching inventory configs:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูลการตั้งค่า' },
      { status: 500 }
    );
  }
}
