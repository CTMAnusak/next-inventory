/**
 * 🔍 API Debug สำหรับตรวจสอบข้อมูล config จาก DB โดยตรง
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';

export async function GET() {
  try {
    console.log('🔍 Debug: Fetching config directly from DB...');
    
    await dbConnect();
    
    // อ่านข้อมูลจาก DB โดยตรง โดยไม่ผ่าน cache
    const config = await InventoryConfig.findOne({}).lean();
    
    console.log('📋 Raw config from DB:', config);
    console.log('📝 statusConfigs length:', config?.statusConfigs?.length || 0);
    console.log('📝 categoryConfigs length:', config?.categoryConfigs?.length || 0);
    
    if (config?.statusConfigs) {
      console.log('🎯 statusConfigs data:', config.statusConfigs);
    }
    
    const result = {
      debug: {
        hasConfig: !!config,
        configId: config?._id,
        statusConfigsLength: config?.statusConfigs?.length || 0,
        categoryConfigsLength: config?.categoryConfigs?.length || 0,
        allFields: config ? Object.keys(config) : []
      },
      rawData: config,
      statusConfigs: config?.statusConfigs || [],
      categoryConfigs: config?.categoryConfigs || []
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Debug API error:', error);
    return NextResponse.json({ 
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
