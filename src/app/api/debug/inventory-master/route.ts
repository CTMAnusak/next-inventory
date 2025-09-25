import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryMaster from '@/models/InventoryMaster';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const inventoryMasters = await InventoryMaster.find({}).limit(10);
    
    console.log('InventoryMaster data found:', inventoryMasters.length);
    console.log('Sample data:', inventoryMasters[0] || 'No data found');
    
    return NextResponse.json({
      count: inventoryMasters.length,
      sample: inventoryMasters[0] || null,
      allData: inventoryMasters
    });
  } catch (error) {
    console.error('Error fetching InventoryMaster:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}