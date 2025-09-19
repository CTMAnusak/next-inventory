/**
 * 🧹 API สำหรับทำความสะอาด Collection inventoryconfigs
 * 
 * ลบ fields ที่ไม่จำเป็น:
 * - statuses (เก่า)
 * - createdAt/updatedAt (redundant)
 * - __v (Mongoose version)
 */

import { NextRequest, NextResponse } from 'next/server';
import cleanup from '@/scripts/cleanup-inventory-config';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 API: เริ่มทำความสะอาด Collection inventoryconfigs');
    
    await cleanup();
    
    return NextResponse.json({
      success: true,
      message: 'ทำความสะอาด Collection inventoryconfigs สำเร็จ',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ API Cleanup Error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการทำความสะอาด',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
