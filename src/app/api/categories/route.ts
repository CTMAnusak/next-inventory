import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryMaster from '@/models/InventoryMaster';

// GET - Fetch all unique categories from all inventory items (both admin and user added)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    console.log('🔍 Fetching unified categories from all inventory items...');
    
    // Get all unique categories from inventory
    const categories = await InventoryMaster.distinct('category');
    
    // Filter out empty/null categories and sort
    const validCategories = categories
      .filter(cat => cat && typeof cat === 'string' && cat.trim() !== '')
      .map(cat => cat.trim())
      .sort();
    
    // Remove duplicates (case-insensitive)
    const uniqueCategories = Array.from(
      new Set(validCategories.map(cat => cat.toLowerCase()))
    ).map(lowerCat => 
      validCategories.find(cat => cat.toLowerCase() === lowerCat)
    ).filter(Boolean);
    
    console.log(`📦 Found ${uniqueCategories.length} unique categories:`, uniqueCategories);
    
    return NextResponse.json({
      categories: uniqueCategories,
      total: uniqueCategories.length
    });
    
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงหมวดหมู่' },
      { status: 500 }
    );
  }
}
