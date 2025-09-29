import dbConnect from '@/lib/mongodb';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';
import InventoryConfig from '@/models/InventoryConfig';

/**
 * ดึงชื่ออุปกรณ์และหมวดหมู่จาก masterItemId หรือ itemId
 */
export async function getItemNameAndCategory(
  masterItemId?: string, 
  itemId?: string
): Promise<{ itemName: string; category: string; categoryId: string } | null> {
  try {
    await dbConnect();
    console.log('🔍 Resolving item:', { masterItemId, itemId });

    // ลองหาจาก masterItemId ก่อน
    if (masterItemId) {
      const masterItem = await InventoryMaster.findById(masterItemId);
      console.log('🔍 Master item found:', masterItem ? masterItem.itemName : 'NOT FOUND');
      if (masterItem) {
        // Resolve category name from categoryId
        const categoryName = await getCategoryNameById(masterItem.categoryId);
        console.log('🔍 Category resolved:', categoryName);
        return {
          itemName: masterItem.itemName,
          category: categoryName || 'Unknown Category',
          categoryId: masterItem.categoryId
        };
      }
    }

    // ถ้าไม่มี masterItemId หรือไม่เจอ ให้หาจาก itemId
    if (itemId) {
      const inventoryItem = await InventoryItem.findById(itemId);
      if (inventoryItem) {
        // Resolve category name from categoryId
        const categoryName = await getCategoryNameById(inventoryItem.categoryId);
        return {
          itemName: inventoryItem.itemName,
          category: categoryName || 'Unknown Category',
          categoryId: inventoryItem.categoryId
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting item name and category:', error);
    return null;
  }
}

/**
 * ดึงชื่อหมวดหมู่จาก categoryId
 */
export async function getCategoryNameById(categoryId: string): Promise<string | null> {
  try {
    await dbConnect();
    console.log('🔍 Resolving category ID:', categoryId);
    
    const config = await InventoryConfig.findOne({ 'categoryConfigs.id': categoryId });
    console.log('🔍 Category config found:', config ? 'YES' : 'NO');
    if (config) {
      const categoryConfig = config.categoryConfigs.find(cat => cat.id === categoryId);
      console.log('🔍 Category name resolved:', categoryConfig?.name);
      return categoryConfig?.name || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting category name:', error);
    return null;
  }
}

/**
 * ดึงชื่อสภาพจาก statusId
 */
export async function getStatusNameById(statusId: string): Promise<string | null> {
  try {
    await dbConnect();
    
    const config = await InventoryConfig.findOne({ 'statusConfigs.id': statusId });
    if (config) {
      const statusConfig = config.statusConfigs.find(status => status.id === statusId);
      return statusConfig?.name || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting status name:', error);
    return null;
  }
}

/**
 * ดึงชื่อสถานะจาก conditionId
 */
export async function getConditionNameById(conditionId: string): Promise<string | null> {
  try {
    await dbConnect();
    
    const config = await InventoryConfig.findOne({ 'conditionConfigs.id': conditionId });
    if (config) {
      const conditionConfig = config.conditionConfigs.find(condition => condition.id === conditionId);
      return conditionConfig?.name || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting condition name:', error);
    return null;
  }
}

/**
 * ดึงชื่ออุปกรณ์และหมวดหมู่สำหรับหลายรายการ
 */
export async function getMultipleItemNames(
  items: Array<{ masterItemId?: string; itemId?: string }>
): Promise<Array<{ itemName: string; category: string; categoryId: string } | null>> {
  try {
    await dbConnect();

    const results = await Promise.all(
      items.map(item => getItemNameAndCategory(item.masterItemId, item.itemId))
    );

    return results;
  } catch (error) {
    console.error('Error getting multiple item names:', error);
    return items.map(() => null);
  }
}
