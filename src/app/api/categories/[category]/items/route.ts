import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryMaster from '@/models/InventoryMaster';
import { getCategoryNameById, validateCategoryId } from '@/lib/category-helpers';

// GET - Fetch all unique items in a specific category by categoryId
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
    
    const categoryId = decodeURIComponent(category);
    console.log(`🔍 Fetching items in categoryId: ${categoryId}`);
    
    // Validate categoryId
    const isValidCategory = await validateCategoryId(categoryId);
    if (!isValidCategory) {
      return NextResponse.json(
        { error: 'ไม่พบหมวดหมู่ที่ระบุ' },
        { status: 404 }
      );
    }
    
    // Get category name for response
    const categoryName = await getCategoryNameById(categoryId);
    
    // Get all unique item names in this category using categoryId
    const items = await InventoryMaster.distinct('itemName', {
      categoryId: categoryId
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
    
    console.log(`📦 Found ${uniqueItems.length} unique items in "${categoryName}" (${categoryId}):`, uniqueItems);
    
    return NextResponse.json({
      categoryId: categoryId,
      categoryName: categoryName,
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
