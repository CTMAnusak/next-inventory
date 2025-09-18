import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig, { 
  ICategoryConfig, 
  createDefaultCategoryConfig,
  generateCategoryId,
  DEFAULT_CATEGORY_CONFIGS,
  DEFAULT_STATUSES
} from '@/models/InventoryConfig';
import InventoryMaster from '@/models/InventoryMaster';
import { getCachedData, setCachedData } from '@/lib/cache-utils';
import { createRotatingBackup } from '@/lib/backup-helpers';

async function ensureConfig() {
  let existing = await InventoryConfig.findOne({});
  
  if (existing) {
    // Ensure categoryConfigs exists
    if (!existing.categoryConfigs || existing.categoryConfigs.length === 0) {
      console.log('⚠️  No categoryConfigs found, initializing...');
      existing.categoryConfigs = DEFAULT_CATEGORY_CONFIGS;
      await existing.save();
    }
    return existing;
  }
  
  // Create new config with default categoryConfigs
  const created = new InventoryConfig({
    categoryConfigs: DEFAULT_CATEGORY_CONFIGS,
    statuses: DEFAULT_STATUSES
  });
  await created.save();
  console.log('✅ Created new inventory config with default categoryConfigs');
  return created;
}

export async function GET() {
  try {
    // Check cache first
    const cacheKey = 'inventory_config';
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    await dbConnect();
    const config = await ensureConfig();
    
    // Get categories from inventory master for backward compatibility
    const adminCategories = await InventoryMaster.distinct('category', { 
      availableQuantity: { $gt: 0 } // Available warehouse items
    });
    
    // Get categoryConfigs and ensure they exist
    let categoryConfigs: ICategoryConfig[] = config.categoryConfigs || [];
    
    // If no categoryConfigs exist, create from admin categories
    if (categoryConfigs.length === 0) {
      console.log('⚠️  No categoryConfigs found, creating from admin categories');
      categoryConfigs = adminCategories.map((name, index) => 
        createDefaultCategoryConfig(name, index + 1, name === 'ซิมการ์ด')
      );
      
      // Ensure "ไม่ระบุ" category exists
      const hasUnassigned = categoryConfigs.some(cat => cat.name === 'ไม่ระบุ');
      if (!hasUnassigned) {
        categoryConfigs.push({
          id: 'cat_unassigned',
          name: 'ไม่ระบุ',
          isSpecial: false,
          isSystemCategory: true,
          order: 999,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      // Save the generated categoryConfigs
      config.categoryConfigs = categoryConfigs;
      await config.save();
    }
    
    // Sort by order
    categoryConfigs = categoryConfigs.sort((a, b) => a.order - b.order);
    
    const result = { 
      statuses: config.statuses,
      categoryConfigs: categoryConfigs
    };

    // Cache the result
    setCachedData(cacheKey, result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching inventory config:', error);
    return NextResponse.json({ error: 'โหลดการตั้งค่าไม่สำเร็จ' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { 
      statuses, 
      categoryConfigs 
    } = body as { 
      statuses?: string[]; 
      categoryConfigs?: ICategoryConfig[] 
    };

    const config = await ensureConfig();
    
    // Create backup before making changes
    await createRotatingBackup();
    console.log('📦 Backup created before config update');
    
    // Handle categoryConfigs update (preferred method)
    if (Array.isArray(categoryConfigs)) {
      // Validate categoryConfigs
      const validConfigs = categoryConfigs.filter(cat => 
        cat.name && cat.name.trim() && typeof cat.order === 'number'
      );
      
      // Ensure proper ordering and timestamps
      validConfigs.forEach((cat, index) => {
        cat.order = cat.order || index + 1;
        cat.updatedAt = new Date();
        if (!cat.createdAt) cat.createdAt = new Date();
        if (!cat.id) cat.id = generateCategoryId();
      });
      
      config.categoryConfigs = validConfigs;
      
      // Clear cache
      setCachedData('inventory_config', null);
      
      console.log(`✅ Updated categoryConfigs: ${validConfigs.length} categories`);
    }
    
    // Handle statuses update
    if (Array.isArray(statuses)) {
      config.statuses = statuses.filter(Boolean);
    }
    
    await config.save();

      const response = {
        statuses: config.statuses,
        categoryConfigs: config.categoryConfigs || []
      };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating inventory config:', error);
    return NextResponse.json({ error: 'บันทึกการตั้งค่าไม่สำเร็จ' }, { status: 500 });
  }
}


