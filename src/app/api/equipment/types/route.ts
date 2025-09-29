import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getEquipmentTypesForDropdown } from '@/lib/inventory-helpers';

// GET - ดึงรายการอุปกรณ์สำหรับ dropdown
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    
    const equipmentTypes = await getEquipmentTypesForDropdown();
    
    return NextResponse.json({
      success: true,
      equipmentTypes,
      totalCount: equipmentTypes.length
    });
    
  } catch (error) {
    console.error('❌ Equipment types API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงรายการอุปกรณ์',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}
