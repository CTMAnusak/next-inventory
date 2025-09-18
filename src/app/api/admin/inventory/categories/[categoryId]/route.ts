import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig, { ICategoryConfig } from '@/models/InventoryConfig';
import InventoryItem from '@/models/InventoryItem';

interface RouteParams {
  params: Promise<{
    categoryId: string;
  }>;
}

/**
 * GET /api/admin/inventory/categories/[categoryId]
 * Get specific category by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();
    const { categoryId } = await params;
    
    const config = await InventoryConfig.findOne({});
    if (!config) {
      return NextResponse.json({ error: 'ไม่พบการตั้งค่า' }, { status: 404 });
    }
    
    const category = config.categoryConfigs?.find(cat => cat.id === categoryId);
    if (!category) {
      return NextResponse.json({ error: 'ไม่พบหมวดหมู่' }, { status: 404 });
    }
    
    return NextResponse.json({ category });
  } catch (error) {
    console.error('Error fetching category:', error);
    return NextResponse.json({ error: 'โหลดหมวดหมู่ไม่สำเร็จ' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/inventory/categories/[categoryId]
 * Update specific category
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();
    const { categoryId } = await params;
    const body = await request.json();
    const { name, isSpecial, backgroundColor, order } = body as {
      name?: string;
      isSpecial?: boolean;
      backgroundColor?: string;
      order?: number;
    };
    
    const config = await InventoryConfig.findOne({});
    if (!config) {
      return NextResponse.json({ error: 'ไม่พบการตั้งค่า' }, { status: 404 });
    }
    
    const categoryIndex = config.categoryConfigs?.findIndex(cat => cat.id === categoryId);
    if (categoryIndex === -1 || categoryIndex === undefined) {
      return NextResponse.json({ error: 'ไม่พบหมวดหมู่' }, { status: 404 });
    }
    
    const category = config.categoryConfigs![categoryIndex];
    
    // Check if it's a system category (cannot be modified)
    if (category.isSystemCategory && (name !== undefined || isSpecial !== undefined)) {
      return NextResponse.json({ 
        error: 'ไม่สามารถแก้ไขหมวดหมู่ระบบได้' 
      }, { status: 400 });
    }
    
    // Check for duplicate name
    if (name && name.trim() !== category.name) {
      const existingCategory = config.categoryConfigs?.find(cat => 
        cat.name === name.trim() && cat.id !== categoryId
      );
      if (existingCategory) {
        return NextResponse.json({ error: 'ชื่อหมวดหมู่นี้มีอยู่แล้ว' }, { status: 400 });
      }
    }
    
    // Update category properties
    if (name !== undefined) category.name = name.trim();
    if (isSpecial !== undefined) {
      category.isSpecial = isSpecial;
      // Auto-update background color based on special status
      if (!backgroundColor) {
        category.backgroundColor = isSpecial ? '#fed7aa' : '#ffffff';
      }
    }
    if (backgroundColor !== undefined) category.backgroundColor = backgroundColor;
    if (order !== undefined) category.order = order;
    
    category.updatedAt = new Date();
    
    // Categories are now generated from categoryConfigs in API responses
    
    await config.save();
    
    console.log(`✅ Updated category: ${category.name} (ID: ${categoryId})`);
    
    return NextResponse.json({ 
      success: true, 
      category,
      message: 'อัปเดตหมวดหมู่สำเร็จ'
    });
    
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'อัปเดตหมวดหมู่ไม่สำเร็จ' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/inventory/categories/[categoryId]
 * Delete specific category (with validation)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();
    const { categoryId } = await params;
    const url = new URL(request.url);
    const confirmationText = url.searchParams.get('confirm');
    const force = url.searchParams.get('force') === 'true';
    
    const config = await InventoryConfig.findOne({});
    if (!config) {
      return NextResponse.json({ error: 'ไม่พบการตั้งค่า' }, { status: 404 });
    }
    
    const categoryIndex = config.categoryConfigs?.findIndex(cat => cat.id === categoryId);
    if (categoryIndex === -1 || categoryIndex === undefined) {
      return NextResponse.json({ error: 'ไม่พบหมวดหมู่' }, { status: 404 });
    }
    
    const category = config.categoryConfigs![categoryIndex];
    
    // Check if it's a system category (cannot be deleted)
    if (category.isSystemCategory) {
      return NextResponse.json({ 
        error: 'ไม่สามารถลบหมวดหมู่ระบบได้' 
      }, { status: 400 });
    }
    
    // Check for items using this category
    const itemsUsingCategory = await InventoryItem.countDocuments({ 
      category: category.name,
      status: { $ne: 'deleted' }
    });
    
    if (itemsUsingCategory > 0) {
      if (!force) {
        return NextResponse.json({ 
          error: 'ไม่สามารถลบหมวดหมู่ที่มีอุปกรณ์อยู่ได้',
          itemsCount: itemsUsingCategory,
          requiresForce: true
        }, { status: 400 });
      }
      
      // Move items to "ไม่ระบุ" category
      const unassignedCategory = config.categoryConfigs?.find(cat => cat.name === 'ไม่ระบุ');
      if (unassignedCategory) {
        await InventoryItem.updateMany(
          { category: category.name },
          { 
            $set: { 
              category: 'ไม่ระบุ',
              updatedAt: new Date()
            } 
          }
        );
        
        console.log(`📦 Moved ${itemsUsingCategory} items to "ไม่ระบุ" category`);
      }
    }
    
    // For special categories, require additional confirmation
    if (category.isSpecial && confirmationText !== 'DELETE') {
      return NextResponse.json({ 
        error: 'กรุณาพิมพ์ "DELETE" เพื่อยืนยันการลบหมวดหมู่พิเศษ',
        requiresConfirmation: true,
        isSpecial: true
      }, { status: 400 });
    }
    
    // Remove category from array
    config.categoryConfigs!.splice(categoryIndex, 1);
    
    // Categories are now generated from categoryConfigs in API responses
    
    await config.save();
    
    console.log(`🗑️  Deleted category: ${category.name} (ID: ${categoryId})`);
    if (itemsUsingCategory > 0) {
      console.log(`📦 Moved ${itemsUsingCategory} items to "ไม่ระบุ" category`);
    }
    
    return NextResponse.json({ 
      success: true,
      deletedCategory: category,
      itemsMoved: itemsUsingCategory,
      message: `ลบหมวดหมู่ "${category.name}" สำเร็จ${itemsUsingCategory > 0 ? ` และย้าย ${itemsUsingCategory} รายการไปยัง "ไม่ระบุ"` : ''}`
    });
    
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'ลบหมวดหมู่ไม่สำเร็จ' }, { status: 500 });
  }
}
