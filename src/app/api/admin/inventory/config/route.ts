import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';
import InventoryMaster from '@/models/InventoryMaster';
import { getCachedData, setCachedData } from '@/lib/cache-utils';

async function ensureConfig() {
  const existing = await InventoryConfig.findOne({});
  if (existing) return existing;
  const created = new InventoryConfig({});
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
    
    // Get categories from inventory master
    const adminCategories = await InventoryMaster.distinct('category', { 
      availableQuantity: { $gt: 0 } // Available warehouse items
    });
    
    // Merge with config categories and remove duplicates
    const allCategories = [...new Set([...config.categories, ...adminCategories])];
    
    const result = { 
      categories: allCategories, 
      statuses: config.statuses 
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
    const { categories, statuses } = body as { categories?: string[]; statuses?: string[] };

    const config = await ensureConfig();
    if (Array.isArray(categories)) config.categories = categories.filter(Boolean);
    if (Array.isArray(statuses)) config.statuses = statuses.filter(Boolean);
    await config.save();

    return NextResponse.json({ categories: config.categories, statuses: config.statuses });
  } catch (error) {
    console.error('Error updating inventory config:', error);
    return NextResponse.json({ error: 'บันทึกการตั้งค่าไม่สำเร็จ' }, { status: 500 });
  }
}


