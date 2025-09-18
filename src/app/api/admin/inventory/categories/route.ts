import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig, { 
  ICategoryConfig, 
  createDefaultCategoryConfig,
  generateCategoryId 
} from '@/models/InventoryConfig';
import InventoryItem from '@/models/InventoryItem';

/**
 * GET /api/admin/inventory/categories
 * Get all category configurations
 */
export async function GET() {
  try {
    await dbConnect();
    
    const config = await InventoryConfig.findOne({});
    if (!config) {
      return NextResponse.json({ categoryConfigs: [] });
    }
    
    const categoryConfigs = config.categoryConfigs || [];
    const sortedConfigs = categoryConfigs.sort((a, b) => a.order - b.order);
    
    return NextResponse.json({ categoryConfigs: sortedConfigs });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'โหลดหมวดหมู่ไม่สำเร็จ' }, { status: 500 });
  }
}

/**
 * POST /api/admin/inventory/categories
 * Create a new category
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { name, isSpecial } = body as { name: string; isSpecial?: boolean };
    
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'ชื่อหมวดหมู่จำเป็นต้องระบุ' }, { status: 400 });
    }
    
    const config = await InventoryConfig.findOne({}) || new InventoryConfig({});
    
    // Check if category name already exists
    const existingCategory = config.categoryConfigs?.find(cat => cat.name === name.trim());
    if (existingCategory) {
      return NextResponse.json({ error: 'ชื่อหมวดหมู่นี้มีอยู่แล้ว' }, { status: 400 });
    }
    
    // Get next order number
    const maxOrder = Math.max(0, ...(config.categoryConfigs?.map(cat => cat.order) || [0]));
    const nextOrder = maxOrder + 1;
    
    // Create new category config
    const newCategory: ICategoryConfig = {
      id: generateCategoryId(),
      name: name.trim(),
      isSpecial: Boolean(isSpecial),
      backgroundColor: isSpecial ? '#fed7aa' : '#ffffff', // Orange for special, white for normal
      isSystemCategory: false,
      order: nextOrder,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Add to categoryConfigs array
    if (!config.categoryConfigs) config.categoryConfigs = [];
    config.categoryConfigs.push(newCategory);
    
    // Categories are now generated from categoryConfigs in API responses
    
    await config.save();
    
    console.log(`✅ Created new category: ${name} (special: ${isSpecial})`);
    
    return NextResponse.json({ 
      success: true, 
      category: newCategory,
      message: 'เพิ่มหมวดหมู่สำเร็จ'
    });
    
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'เพิ่มหมวดหมู่ไม่สำเร็จ' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/inventory/categories
 * Update multiple categories (reorder, bulk edit)
 */
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { categoryConfigs } = body as { categoryConfigs: ICategoryConfig[] };
    
    if (!Array.isArray(categoryConfigs)) {
      return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }
    
    const config = await InventoryConfig.findOne({}) || new InventoryConfig({});
    
    // Validate and update categoryConfigs
    const validConfigs = categoryConfigs.filter(cat => 
      cat.name && cat.name.trim() && typeof cat.order === 'number'
    );
    
    // Ensure proper timestamps and IDs
    validConfigs.forEach((cat, index) => {
      cat.order = cat.order || index + 1;
      cat.updatedAt = new Date();
      if (!cat.createdAt) cat.createdAt = new Date();
      if (!cat.id) cat.id = generateCategoryId();
    });
    
    config.categoryConfigs = validConfigs;
    
    // Categories are now generated from categoryConfigs in API responses
    
    await config.save();
    
    console.log(`✅ Updated ${validConfigs.length} categories`);
    
    return NextResponse.json({ 
      success: true, 
      categoryConfigs: validConfigs,
      message: 'อัปเดตหมวดหมู่สำเร็จ'
    });
    
  } catch (error) {
    console.error('Error updating categories:', error);
    return NextResponse.json({ error: 'อัปเดตหมวดหมู่ไม่สำเร็จ' }, { status: 500 });
  }
}
