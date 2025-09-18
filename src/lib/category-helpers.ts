import InventoryConfig, { ICategoryConfig } from '@/models/InventoryConfig';
import { getCachedData, setCachedData } from '@/lib/cache-utils';

// Cache หมวดหมู่ 5 นาที
const CATEGORY_CACHE_DURATION = 5 * 60 * 1000;

/**
 * ดึงหมวดหมู่ทั้งหมดจาก DB พร้อม cache
 */
export async function getAllCategoryConfigs(): Promise<ICategoryConfig[]> {
  const cacheKey = 'all_category_configs';
  const cached = getCachedData(cacheKey);
  
  if (cached) {
    return cached as ICategoryConfig[];
  }
  
  const config = await InventoryConfig.findOne({});
  const categoryConfigs = config?.categoryConfigs || [];
  
  setCachedData(cacheKey, categoryConfigs, CATEGORY_CACHE_DURATION);
  return categoryConfigs;
}

/**
 * สร้าง Map สำหรับ lookup categoryId -> categoryName
 */
export async function getCategoryLookupMap(): Promise<Map<string, string>> {
  const categoryConfigs = await getAllCategoryConfigs();
  const map = new Map<string, string>();
  
  categoryConfigs.forEach(config => {
    map.set(config.id, config.name);
  });
  
  return map;
}

/**
 * หา categoryName จาก categoryId
 */
export async function getCategoryNameById(categoryId: string): Promise<string> {
  const map = await getCategoryLookupMap();
  return map.get(categoryId) || 'ไม่ระบุ';
}

/**
 * หา categoryId จาก categoryName (สำหรับ migration)
 */
export async function getCategoryIdByName(categoryName: string): Promise<string | null> {
  const categoryConfigs = await getAllCategoryConfigs();
  const config = categoryConfigs.find(cat => cat.name === categoryName);
  return config?.id || null;
}

/**
 * หา categoryConfig ทั้งหมดจาก categoryId
 */
export async function getCategoryConfigById(categoryId: string): Promise<ICategoryConfig | null> {
  const categoryConfigs = await getAllCategoryConfigs();
  return categoryConfigs.find(cat => cat.id === categoryId) || null;
}

/**
 * Clear category cache (เรียกเมื่อมีการเปลี่ยนแปลงหมวดหมู่)
 */
export function clearCategoryCache(): void {
  setCachedData('all_category_configs', null);
}

/**
 * เพิ่ม categoryName field ให้ inventory items โดยใช้ categoryId lookup
 */
export async function enrichItemsWithCategoryName<T extends { categoryId: string }>(
  items: T[]
): Promise<(T & { categoryName: string })[]> {
  const categoryMap = await getCategoryLookupMap();
  
  return items.map(item => ({
    ...item,
    categoryName: categoryMap.get(item.categoryId) || 'ไม่ระบุ'
  }));
}

/**
 * Helper สำหรับดึงข้อมูล category พร้อม validation
 */
export async function validateCategoryId(categoryId: string): Promise<boolean> {
  const config = await getCategoryConfigById(categoryId);
  return config !== null;
}
