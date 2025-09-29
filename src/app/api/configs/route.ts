import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';

// GET - Fetch inventory configurations
export async function GET() {
  try {
    await dbConnect();
    
    
    // Get the inventory config document
    const config = await InventoryConfig.findOne({});
    
    if (!config) {
      console.log('❌ No inventory config found');
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลการตั้งค่า' },
        { status: 404 }
      );
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
