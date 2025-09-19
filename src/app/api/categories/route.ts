import { NextRequest, NextResponse } from 'next/server';
import { getAllCategoryConfigs } from '@/lib/category-helpers';

// GET - Fetch all categories from configuration
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching categories from configuration...');
    
    // Get all category configurations
    const categoryConfigs = await getAllCategoryConfigs();
    
    // Convert to format expected by frontend
    const categories = categoryConfigs.map(config => ({
      id: config.id,
      name: config.name,
      isSpecial: config.isSpecial,
      isSystemCategory: config.isSystemCategory,
      order: config.order
    }));
    
    // Sort by order
    categories.sort((a, b) => a.order - b.order);
    
    console.log(`📦 Found ${categories.length} categories:`, categories.map(cat => cat.name));
    
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
