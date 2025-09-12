import dbConnect from '@/lib/mongodb';
import { InventoryMaster } from '@/models/InventoryMaster';
import { InventoryItem } from '@/models/InventoryItem';

/**
 * ดึงชื่ออุปกรณ์และหมวดหมู่จาก masterItemId หรือ itemId
 */
export async function getItemNameAndCategory(
  masterItemId?: string, 
  itemId?: string
): Promise<{ itemName: string; category: string } | null> {
  try {
    await dbConnect();

    // ลองหาจาก masterItemId ก่อน
    if (masterItemId) {
      const masterItem = await InventoryMaster.findById(masterItemId);
      if (masterItem) {
        return {
          itemName: masterItem.itemName,
          category: masterItem.category
        };
      }
    }

    // ถ้าไม่มี masterItemId หรือไม่เจอ ให้หาจาก itemId
    if (itemId) {
      const inventoryItem = await InventoryItem.findById(itemId);
      if (inventoryItem) {
        return {
          itemName: inventoryItem.itemName,
          category: inventoryItem.category
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
 * ดึงชื่ออุปกรณ์และหมวดหมู่สำหรับหลายรายการ
 */
export async function getMultipleItemNames(
  items: Array<{ masterItemId?: string; itemId?: string }>
): Promise<Array<{ itemName: string; category: string } | null>> {
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
