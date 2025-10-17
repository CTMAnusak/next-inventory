/**
 * =========================================
 * SNAPSHOT HELPERS
 * =========================================
 * 
 * สร้าง snapshot ของข้อมูลอุปกรณ์เพื่อเก็บไว้ใน RequestLog และ ReturnLog
 * เพื่อป้องกันการสูญหายของข้อมูลเมื่อ InventoryItem หรือ InventoryMaster ถูกลบ
 */

import InventoryItem from '@/models/InventoryItem';
import InventoryConfig from '@/models/InventoryConfig';

/**
 * สร้าง snapshot ของ InventoryItem สำหรับเก็บใน RequestLog
 */
export async function createInventoryItemSnapshot(itemId: string) {
  try {
    const inventoryItem = await InventoryItem.findById(itemId);
    
    if (!inventoryItem) {
      console.warn(`⚠️ InventoryItem not found: ${itemId}`);
      return null;
    }
    
    // Get configurations for names
    const config = await InventoryConfig.findOne({});
    const categoryConfigs = config?.categoryConfigs || [];
    const statusConfigs = config?.statusConfigs || [];
    const conditionConfigs = config?.conditionConfigs || [];
    
    const categoryConfig = categoryConfigs.find((c: any) => c.id === (inventoryItem as any).categoryId);
    const statusConfig = statusConfigs.find((s: any) => s.id === inventoryItem.statusId);
    const conditionConfig = conditionConfigs.find((c: any) => c.id === inventoryItem.conditionId);

    return { 
      itemId: itemId,
      itemName: (inventoryItem as any).itemName || 'ไม่ระบุ',
      categoryId: (inventoryItem as any).categoryId || 'ไม่ระบุ',
      categoryName: categoryConfig?.name || (inventoryItem as any).categoryId || 'ไม่ระบุ',
      serialNumber: inventoryItem.serialNumber || undefined,
      numberPhone: inventoryItem.numberPhone || undefined,
      statusId: inventoryItem.statusId || 'ไม่ระบุ',
      statusName: statusConfig?.name || inventoryItem.statusId || 'ไม่ระบุ',
      conditionId: inventoryItem.conditionId || 'ไม่ระบุ',
      conditionName: conditionConfig?.name || inventoryItem.conditionId || 'ไม่ระบุ'
    };
  } catch (error) {
    console.error(`❌ Error creating snapshot for item ${itemId}:`, error);
    return null;
  }
}

/**
 * สร้าง snapshot สำหรับหลายๆ items พร้อมกัน
 */
export async function createInventoryItemSnapshotsBatch(itemIds: string[]) {
  const snapshots = await Promise.all(
    itemIds.map(itemId => createInventoryItemSnapshot(itemId))
  );
  
  // Filter out null values
  return snapshots.filter(snapshot => snapshot !== null);
}

/**
 * สร้าง snapshot จาก InventoryItem object ที่มีอยู่แล้ว (ประหยัด query)
 */
export async function createInventoryItemSnapshotFromObject(inventoryItem: any) {
  try {
    // Get configurations for names
    const config = await InventoryConfig.findOne({});
    const categoryConfigs = config?.categoryConfigs || [];
    const statusConfigs = config?.statusConfigs || [];
    const conditionConfigs = config?.conditionConfigs || [];
    
    const categoryConfig = categoryConfigs.find((c: any) => c.id === inventoryItem.categoryId);
    const statusConfig = statusConfigs.find((s: any) => s.id === inventoryItem.statusId);
    const conditionConfig = conditionConfigs.find((c: any) => c.id === inventoryItem.conditionId);
    
    return {
      itemId: inventoryItem._id.toString(),
      itemName: inventoryItem.itemName || 'ไม่ระบุ',
      categoryId: inventoryItem.categoryId || 'ไม่ระบุ',
      categoryName: categoryConfig?.name || inventoryItem.categoryId || 'ไม่ระบุ',
      serialNumber: inventoryItem.serialNumber || undefined,
      numberPhone: inventoryItem.numberPhone || undefined,
      statusId: inventoryItem.statusId || 'ไม่ระบุ',
      statusName: statusConfig?.name || inventoryItem.statusId || 'ไม่ระบุ',
      conditionId: inventoryItem.conditionId || 'ไม่ระบุ',
      conditionName: conditionConfig?.name || inventoryItem.conditionId || 'ไม่ระบุ'
    };
  } catch (error) {
    console.error(`❌ Error creating snapshot from object:`, error);
    return null;
  }
}

/**
 * =========================================
 * UPDATE SNAPSHOT BEFORE DELETE
 * =========================================
 * อัปเดต snapshot ในทุก RequestLog ที่มี itemId นี้ก่อนที่จะลบ
 * เพื่อเก็บข้อมูลล่าสุดของอุปกรณ์ไว้
 */
export async function updateSnapshotsBeforeDelete(itemId: string) {
  try {
    console.log(`\n📸 Updating snapshots before deleting item: ${itemId}`);
    
    // ดึงข้อมูลล่าสุดของ InventoryItem
    const inventoryItem = await InventoryItem.findById(itemId);
    
    if (!inventoryItem) {
      console.warn(`⚠️ InventoryItem not found: ${itemId}`);
      return { success: false, message: 'Item not found' };
    }
    
    // สร้าง snapshot ล่าสุด
    const latestSnapshot = await createInventoryItemSnapshotFromObject(inventoryItem);
    
    if (!latestSnapshot) {
      console.error(`❌ Failed to create snapshot for item: ${itemId}`);
      return { success: false, message: 'Failed to create snapshot' };
    }
    
    console.log(`📸 Created latest snapshot:`, latestSnapshot);
    
    // อัปเดต snapshot ใน RequestLog ทั้งหมดที่มี itemId นี้
    const RequestLog = (await import('@/models/RequestLog')).default;
    
    const requestLogs = await RequestLog.find({
      'items.assignedItemIds': itemId
    });
    
    console.log(`📋 Found ${requestLogs.length} RequestLogs with this item`);
    
    let updatedCount = 0;
    
    for (const requestLog of requestLogs) {
      let hasUpdates = false;
      
      for (const item of requestLog.items) {
        // เช็คว่า item นี้มี itemId ที่เราจะลบหรือไม่
        if (item.assignedItemIds?.includes(itemId)) {
          // Initialize assignedItemSnapshots ถ้ายังไม่มี
          if (!item.assignedItemSnapshots) {
            (item as any).assignedItemSnapshots = [];
          }
          
          // หา snapshot เดิมของ itemId นี้
          const existingSnapshotIndex = (item as any).assignedItemSnapshots.findIndex(
            (s: any) => s.itemId === itemId
          );
          
          if (existingSnapshotIndex >= 0) {
            // อัปเดต snapshot เดิม
            (item as any).assignedItemSnapshots[existingSnapshotIndex] = latestSnapshot;
            console.log(`   ✅ Updated existing snapshot for item in RequestLog ${requestLog._id}`);
          } else {
            // เพิ่ม snapshot ใหม่
            (item as any).assignedItemSnapshots.push(latestSnapshot);
            console.log(`   ✅ Added new snapshot for item in RequestLog ${requestLog._id}`);
          }
          
          hasUpdates = true;
        }
      }
      
      if (hasUpdates) {
        (requestLog as any).markModified('items');
        await requestLog.save();
        updatedCount++;
      }
    }
    
    console.log(`✅ Updated ${updatedCount} RequestLogs with latest snapshot`);
    
    return {
      success: true,
      updatedRequestLogs: updatedCount,
      snapshot: latestSnapshot
    };
    
  } catch (error) {
    console.error(`❌ Error updating snapshots before delete:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
