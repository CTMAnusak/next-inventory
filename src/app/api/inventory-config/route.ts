import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryConfig from '@/models/InventoryConfig';

// GET - ดึงการตั้งค่าทั้งหมด (สำหรับผู้ใช้ทั่วไป)
export async function GET() {
  const startTime = Date.now();
  
  try {
    // Check cache first
    const { getCachedData, setCachedData } = await import('@/lib/cache-utils');
    const cacheKey = 'inventory_config_user';
    const cached = getCachedData(cacheKey);
    if (cached) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Inventory Config API - Cache hit (${Date.now() - startTime}ms)`);
      }
      return NextResponse.json(cached);
    }
    
    await dbConnect();
    
    let config = await InventoryConfig.findOne({})
      .select('categoryConfigs statusConfigs conditionConfigs')
      .lean();
    
    // ✅ Only create default configs if config doesn't exist AND hasn't been created before
    // Use a flag to prevent repeated saves
    if (!config) {
      // Check if we need to create defaults (only once)
      const existingConfig = await InventoryConfig.findOne({}).lean();
      if (!existingConfig) {
        // Create config with defaults only if truly doesn't exist
        const newConfig = new InventoryConfig({
          categoryConfigs: [
            {
              id: 'cat_sim_card',
              name: 'ซิมการ์ด',
              isSystemCategory: true,
              order: 1,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              id: 'cat_unassigned',
              name: 'ไม่ระบุ',
              isSystemCategory: true,
              order: 999,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ],
          statusConfigs: [
            {
              id: 'status_available',
              name: 'มี',
              color: '#10B981',
              order: 1,
              isSystemConfig: true,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              id: 'status_missing',
              name: 'หาย',
              color: '#EF4444',
              order: 2,
              isSystemConfig: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ],
          conditionConfigs: [
            {
              id: 'cond_working',
              name: 'ใช้งานได้',
              color: '#10B981',
              order: 1,
              isSystemConfig: true,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              id: 'cond_damaged',
              name: 'ชำรุด',
              color: '#F59E0B',
              order: 2,
              isSystemConfig: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ]
        });
        await newConfig.save();
        config = newConfig.toObject();
      } else {
        config = existingConfig;
      }
    }
    
    // ✅ Use existing configs or defaults - don't save every time
    const result = {
      categoryConfigs: (config?.categoryConfigs || []).sort((a: any, b: any) => a.order - b.order),
      statusConfigs: (config?.statusConfigs || []).sort((a: any, b: any) => a.order - b.order),
      conditionConfigs: (config?.conditionConfigs || []).sort((a: any, b: any) => a.order - b.order)
    };
    
    // Cache the result
    setCachedData(cacheKey, result);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Inventory Config API - Fetched config (${Date.now() - startTime}ms)`);
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error fetching inventory config:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการตั้งค่า' },
      { status: 500 }
    );
  }
}
