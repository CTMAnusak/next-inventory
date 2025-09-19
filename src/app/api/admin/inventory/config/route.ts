import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig, { 
  ICategoryConfig,
  IStatusConfig, 
  createDefaultCategoryConfig,
  generateCategoryId,
  generateStatusId,
  createStatusConfig,
  DEFAULT_CATEGORY_CONFIGS
} from '@/models/InventoryConfig';
import InventoryMaster from '@/models/InventoryMaster';
import { getCachedData, setCachedData } from '@/lib/cache-utils';
import { createRotatingBackup } from '@/lib/backup-helpers';
import { createStatusBackup } from '@/lib/status-backup-helpers';

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
  
  // Create new config with default categoryConfigs ONLY - ไม่มี statuses เก่า
  const created = new InventoryConfig({
    categoryConfigs: DEFAULT_CATEGORY_CONFIGS,
    statusConfigs: [] // เริ่มต้นด้วย array ว่าง
  });
  await created.save();
  console.log('✅ Created new inventory config with default categoryConfigs and empty statusConfigs');
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
    
    // Clean categoryConfigs to ensure proper serialization
    const cleanedCategoryConfigs = categoryConfigs.map(config => ({
      id: config.id,
      name: config.name,
      isSpecial: Boolean(config.isSpecial),
      isSystemCategory: Boolean(config.isSystemCategory),
      order: Number(config.order),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    }));
    
    // Get statusConfigs and ensure proper serialization
    console.log('🔍 Raw config.statusConfigs:', config.statusConfigs);
    console.log('🔍 statusConfigs length:', config.statusConfigs?.length || 0);
    
    const cleanedStatusConfigs = (config.statusConfigs || []).map((statusConfig: IStatusConfig) => ({
      id: statusConfig.id,
      name: statusConfig.name,
      order: Number(statusConfig.order),
      createdAt: statusConfig.createdAt,
      updatedAt: statusConfig.updatedAt
    })).sort((a: any, b: any) => a.order - b.order);
    
    console.log('✅ Cleaned statusConfigs:', cleanedStatusConfigs);

    const result = { 
      statusConfigs: cleanedStatusConfigs, // New status system only
      categoryConfigs: cleanedCategoryConfigs
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
      statusConfigs,
      categoryConfigs 
    } = body as { 
      statusConfigs?: IStatusConfig[];
      categoryConfigs?: ICategoryConfig[] 
    };

    const config = await ensureConfig();
    
    // Create backup before making changes
    await createRotatingBackup();
    if (statusConfigs) {
      await createStatusBackup(); // ✅ Status backup แยก
    }
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
    
    // Handle statusConfigs update (new method)
    if (Array.isArray(statusConfigs)) {
      console.log('🔍 Received statusConfigs for update:', statusConfigs);
      
      // Validate statusConfigs
      const validStatusConfigs = statusConfigs.filter(status => 
        status.name && status.name.trim() && typeof status.order === 'number'
      );
      
      console.log('🔍 Valid statusConfigs after filter:', validStatusConfigs);
      
      // Ensure proper ordering and timestamps
      validStatusConfigs.forEach((status, index) => {
        status.order = status.order || index + 1;
        status.updatedAt = new Date();
        if (!status.createdAt) status.createdAt = new Date();
        if (!status.id) status.id = generateStatusId();
      });
      
      console.log('🔍 Final statusConfigs before save:', validStatusConfigs);
      
      config.statusConfigs = validStatusConfigs;
      
      // Clear cache
      setCachedData('inventory_config', null);
      
      console.log(`✅ Updated statusConfigs: ${validStatusConfigs.length} status configs`);
    }
    
    console.log('💾 Saving config to DB...');
    console.log('🔍 Config before save - statusConfigs length:', config.statusConfigs?.length || 0);
    
    // ใช้ updateOne แทน save เพื่อแก้ปัญหาการบันทึก
    const updateData: any = {};
    if (Array.isArray(categoryConfigs)) {
      updateData.categoryConfigs = config.categoryConfigs;
    }
    if (Array.isArray(statusConfigs)) {
      updateData.statusConfigs = config.statusConfigs;
    }
    
    if (Object.keys(updateData).length > 0) {
      const result = await InventoryConfig.collection.updateOne(
        { _id: config._id },
        { $set: updateData }
      );
      console.log('💾 Update result:', result);
    }
    
    console.log('✅ Config saved successfully!');
    
    // Reload config to get fresh data
    const savedConfig = await InventoryConfig.findOne();
    console.log('🔍 Config after save - statusConfigs length:', savedConfig?.statusConfigs?.length || 0);

      // Clean categoryConfigs for response - ใช้ savedConfig
      const cleanedResponseConfigs = (savedConfig?.categoryConfigs || []).map((categoryConfig: ICategoryConfig) => ({
        id: categoryConfig.id,
        name: categoryConfig.name,
        isSpecial: Boolean(categoryConfig.isSpecial),
        isSystemCategory: Boolean(categoryConfig.isSystemCategory),
        order: Number(categoryConfig.order),
        createdAt: categoryConfig.createdAt,
        updatedAt: categoryConfig.updatedAt
      }));

      // Clean statusConfigs for response - ใช้ savedConfig
      const cleanedResponseStatusConfigs = (savedConfig?.statusConfigs || []).map((statusConfig: IStatusConfig) => ({
        id: statusConfig.id,
        name: statusConfig.name,
        order: Number(statusConfig.order),
        createdAt: statusConfig.createdAt,
        updatedAt: statusConfig.updatedAt
      })).sort((a: any, b: any) => a.order - b.order);

      const response = {
        statusConfigs: cleanedResponseStatusConfigs, // New status system only
        categoryConfigs: cleanedResponseConfigs
      };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating inventory config:', error);
    return NextResponse.json({ error: 'บันทึกการตั้งค่าไม่สำเร็จ' }, { status: 500 });
  }
}


