import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig, { 
  ICategoryConfig,
  IStatusConfig,
  IConditionConfig,
  createDefaultCategoryConfig,
  generateCategoryId,
  generateStatusId,
  generateConditionId,
  createStatusConfig,
  DEFAULT_CATEGORY_CONFIGS,
  DEFAULT_STATUS_CONFIGS,
  DEFAULT_CONDITION_CONFIGS
} from '@/models/InventoryConfig';
import InventoryMaster from '@/models/InventoryMaster';
import { getCachedData, setCachedData } from '@/lib/cache-utils';
import { createRotatingBackup } from '@/lib/backup-helpers';
import { createStatusBackup } from '@/lib/status-backup-helpers';

async function ensureConfig() {
  let existing = await InventoryConfig.findOne({});
  
  if (existing) {
    let needsSave = false;
    
    // Ensure categoryConfigs exists
    if (!existing.categoryConfigs || existing.categoryConfigs.length === 0) {
      existing.categoryConfigs = DEFAULT_CATEGORY_CONFIGS;
      needsSave = true;
    }
    
    // Ensure statusConfigs exists
    if (!existing.statusConfigs || existing.statusConfigs.length === 0) {
      existing.statusConfigs = DEFAULT_STATUS_CONFIGS;
      needsSave = true;
    }
    
    // Ensure conditionConfigs exists
    if (!existing.conditionConfigs || existing.conditionConfigs.length === 0) {
      existing.conditionConfigs = DEFAULT_CONDITION_CONFIGS;
      needsSave = true;
    }
    
    if (needsSave) {
      await existing.save();
    }
    
    return existing;
  }
  
  // Create new config with default configs
  const created = new InventoryConfig({
    categoryConfigs: DEFAULT_CATEGORY_CONFIGS,
    statusConfigs: DEFAULT_STATUS_CONFIGS,
    conditionConfigs: DEFAULT_CONDITION_CONFIGS
  });
  await created.save();
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
    
    // If no categoryConfigs exist, create only "ไม่ระบุ" category
    if (categoryConfigs.length === 0) {
      categoryConfigs = [{
        id: 'cat_unassigned',
        name: 'ไม่ระบุ',
        isSystemCategory: true,
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }];
      
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
      isSystemCategory: Boolean(config.isSystemCategory),
      order: Number(config.order),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    }));
    
    // Get statusConfigs and ensure proper serialization
    
    const cleanedStatusConfigs = (config.statusConfigs || []).map((statusConfig: IStatusConfig) => ({
      id: statusConfig.id,
      name: statusConfig.name,
      order: Number(statusConfig.order),
      isSystemConfig: Boolean(statusConfig.isSystemConfig),
      createdAt: statusConfig.createdAt,
      updatedAt: statusConfig.updatedAt
    })).sort((a: any, b: any) => a.order - b.order);
    
    
    // Get conditionConfigs and ensure proper serialization
    
    const cleanedConditionConfigs = (config.conditionConfigs || []).map((conditionConfig: IConditionConfig) => ({
      id: conditionConfig.id,
      name: conditionConfig.name,
      order: Number(conditionConfig.order),
      isSystemConfig: Boolean(conditionConfig.isSystemConfig),
      createdAt: conditionConfig.createdAt,
      updatedAt: conditionConfig.updatedAt
    })).sort((a: any, b: any) => a.order - b.order);
    

    const result = { 
      statusConfigs: cleanedStatusConfigs, // New status system only
      categoryConfigs: cleanedCategoryConfigs,
      conditionConfigs: cleanedConditionConfigs
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
      categoryConfigs,
      conditionConfigs
    } = body as { 
      statusConfigs?: IStatusConfig[];
      categoryConfigs?: ICategoryConfig[];
      conditionConfigs?: IConditionConfig[];
    };

    const config = await ensureConfig();
    
    // Create backup before making changes
    await createRotatingBackup();
    if (statusConfigs) {
      await createStatusBackup(); // ✅ Status backup แยก
    }
    
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
      
    }
    
    // Handle statusConfigs update (new method)
    if (Array.isArray(statusConfigs)) {
      
      // Validate statusConfigs
      const validStatusConfigs = statusConfigs.filter(status => 
        status.name && status.name.trim() && typeof status.order === 'number'
      );
      
      
      // Ensure proper ordering and timestamps
      validStatusConfigs.forEach((status, index) => {
        status.order = status.order || index + 1;
        status.updatedAt = new Date();
        if (!status.createdAt) status.createdAt = new Date();
        if (!status.id) status.id = generateStatusId();
      });
      
      
      config.statusConfigs = validStatusConfigs;
      
      // Clear cache
      setCachedData('inventory_config', null);
      
    }
    
    // Handle conditionConfigs update
    if (Array.isArray(conditionConfigs)) {
      
      // Validate conditionConfigs
      const validConditionConfigs = conditionConfigs.filter(condition => 
        condition.name && condition.name.trim() && typeof condition.order === 'number'
      );
      
      
      // Ensure proper ordering and timestamps
      validConditionConfigs.forEach((condition, index) => {
        condition.order = condition.order || index + 1;
        condition.updatedAt = new Date();
        if (!condition.createdAt) condition.createdAt = new Date();
        if (!condition.id) condition.id = generateConditionId();
      });
      
      
      config.conditionConfigs = validConditionConfigs;
      
      // Clear cache
      setCachedData('inventory_config', null);
      
    }
    
    
    // ใช้ updateOne แทน save เพื่อแก้ปัญหาการบันทึก
    const updateData: any = {};
    if (Array.isArray(categoryConfigs)) {
      updateData.categoryConfigs = config.categoryConfigs;
    }
    if (Array.isArray(statusConfigs)) {
      updateData.statusConfigs = config.statusConfigs;
    }
    if (Array.isArray(conditionConfigs)) {
      updateData.conditionConfigs = config.conditionConfigs;
    }
    
    if (Object.keys(updateData).length > 0) {
      const result = await InventoryConfig.collection.updateOne(
        { _id: config._id },
        { $set: updateData }
      );
    }
    
    
    // Reload config to get fresh data
    const savedConfig = await InventoryConfig.findOne();

      // Clean categoryConfigs for response - ใช้ savedConfig
      const cleanedResponseConfigs = (savedConfig?.categoryConfigs || []).map((categoryConfig: ICategoryConfig) => ({
        id: categoryConfig.id,
        name: categoryConfig.name,
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
        isSystemConfig: Boolean(statusConfig.isSystemConfig),
        createdAt: statusConfig.createdAt,
        updatedAt: statusConfig.updatedAt
      })).sort((a: any, b: any) => a.order - b.order);

      // Clean conditionConfigs for response - ใช้ savedConfig
      const cleanedResponseConditionConfigs = (savedConfig?.conditionConfigs || []).map((conditionConfig: IConditionConfig) => ({
        id: conditionConfig.id,
        name: conditionConfig.name,
        order: Number(conditionConfig.order),
        isSystemConfig: Boolean(conditionConfig.isSystemConfig),
        createdAt: conditionConfig.createdAt,
        updatedAt: conditionConfig.updatedAt
      })).sort((a: any, b: any) => a.order - b.order);

      const response = {
        statusConfigs: cleanedResponseStatusConfigs, // New status system only
        categoryConfigs: cleanedResponseConfigs,
        conditionConfigs: cleanedResponseConditionConfigs
      };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating inventory config:', error);
    return NextResponse.json({ error: 'บันทึกการตั้งค่าไม่สำเร็จ' }, { status: 500 });
  }
}


