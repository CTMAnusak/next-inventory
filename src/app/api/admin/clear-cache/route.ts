/**
 * 🧹 API สำหรับล้าง cache ทั้งหมด
 */

import { NextRequest, NextResponse } from 'next/server';
import { setCachedData } from '@/lib/cache-utils';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Clearing all caches...');
    
    // ล้าง cache ทั้งหมด
    setCachedData('inventory_config', null);
    setCachedData('inventory_items', null);
    setCachedData('inventory_masters', null);
    
    console.log('✅ All caches cleared successfully');
    
    return NextResponse.json({
      success: true,
      message: 'ล้าง cache ทั้งหมดเรียบร้อย',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Clear cache error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการล้าง cache',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}