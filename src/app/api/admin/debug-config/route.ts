/**
 * 🔍 API Debug สำหรับตรวจสอบข้อมูล config จาก DB โดยตรง
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';

export async function GET() {
  try {
    
    await dbConnect();
    
    // อ่านข้อมูลจาก DB โดยตรง โดยไม่ผ่าน cache
    const config = await InventoryConfig.findOne({}).lean();
    
    
    if (config && 'statusConfigs' in config) {
    }
    
    const result = {
      debug: {
        hasConfig: !!config,
        configId: config && '_id' in config ? config._id : null,
        statusConfigsLength: config && 'statusConfigs' in config ? config.statusConfigs?.length || 0 : 0,
        categoryConfigsLength: config && 'categoryConfigs' in config ? config.categoryConfigs?.length || 0 : 0,
        allFields: config ? Object.keys(config) : []
      },
      rawData: config,
      statusConfigs: config && 'statusConfigs' in config ? config.statusConfigs || [] : [],
      categoryConfigs: config && 'categoryConfigs' in config ? config.categoryConfigs || [] : []
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
