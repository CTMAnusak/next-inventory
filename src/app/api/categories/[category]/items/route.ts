import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Inventory from '@/models/Inventory';

// GET - Fetch all unique items in a specific category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params;
    
    if (!category) {
      return NextResponse.json(
        { error: 'กรุณาระบุหมวดหมู่' },
        { status: 400 }
      );
    }
    
    await dbConnect();
    
    console.log(`🔍 Fetching items in category: ${decodeURIComponent(category)}`);
    
    // Get all unique item names in this category
    const items = await Inventory.distinct('itemName', {
      category: { $regex: new RegExp(`^${decodeURIComponent(category)}$`, 'i') }
    });
    
    // Filter and sort items
    const validItems = items
      .filter(item => item && typeof item === 'string' && item.trim() !== '')
      .map(item => item.trim())
      .sort();
    
    // Remove duplicates (case-insensitive)
    const uniqueItems = Array.from(
      new Set(validItems.map(item => item.toLowerCase()))
    ).map(lowerItem => 
      validItems.find(item => item.toLowerCase() === lowerItem)
    ).filter(Boolean);
    
    console.log(`📦 Found ${uniqueItems.length} unique items in "${decodeURIComponent(category)}":`, uniqueItems);
    
    return NextResponse.json({
      category: decodeURIComponent(category),
      items: uniqueItems,
      total: uniqueItems.length
    });
    
  } catch (error) {
    console.error('Error fetching category items:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงรายการอุปกรณ์' },
      { status: 500 }
    );
  }
}
