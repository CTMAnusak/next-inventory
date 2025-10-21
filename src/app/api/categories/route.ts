import { NextRequest, NextResponse } from 'next/server';
import { getAllCategoryConfigs } from '@/lib/category-helpers';

// GET - Fetch all categories from configuration
export async function GET(request: NextRequest) {
  try {
    
    // Get all category configurations
    const categoryConfigs = await getAllCategoryConfigs();
    
  // Convert to format expected by frontend
  const categories = categoryConfigs.map((config: any) => ({
    id: config.id,
    name: config.name,
    isSpecial: config.isSpecial,
    isSystemCategory: config.isSystemCategory,
    order: config.order
  }));
    
    // Sort by order
    categories.sort((a, b) => a.order - b.order);
    
    
    return NextResponse.json({
      categories: categories,
      total: categories.length
    });
    
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงหมวดหมู่' },
      { status: 500 }
    );
  }
}
