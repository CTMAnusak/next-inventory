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

/**
 * =========================================
 * USER DELETION SNAPSHOT FUNCTIONS
 * =========================================
 * Snapshot ข้อมูลผู้ใช้ก่อนลบเพื่อเก็บข้อมูลล่าสุดไว้ในทุกตารางที่เกี่ยวข้อง
 */

/**
 * Snapshot ข้อมูลผู้ใช้ในทุกตารางที่เกี่ยวข้องก่อนลบ
 * ครอบคลุม: IssueLog, RequestLog, ReturnLog, TransferLog
 */
export async function snapshotUserBeforeDelete(userId: string) {
  try {
    console.log(`📸 Starting snapshot for user ${userId}...`);
    
    // Import equipment snapshot helpers
    const { snapshotEquipmentLogsBeforeUserDelete } = await import('@/lib/equipment-snapshot-helpers');
    
    // Snapshot Equipment Logs (RequestLog, ReturnLog, TransferLog)
    const equipmentResults = await snapshotEquipmentLogsBeforeUserDelete(userId);
    
    // Snapshot IssueLog (ถ้ามี)
    const issueResults = await snapshotIssueLogsBeforeUserDelete(userId);
    
    const totalModified = 
      equipmentResults.requestLogs.modifiedCount +
      equipmentResults.returnLogs.modifiedCount +
      equipmentResults.transferLogs.modifiedCount +
      issueResults.requester.modifiedCount +
      issueResults.admin.modifiedCount;
    
    console.log(`✅ Snapshot completed for user ${userId}:`);
    console.log(`   - RequestLogs: ${equipmentResults.requestLogs.modifiedCount}`);
    console.log(`   - ReturnLogs: ${equipmentResults.returnLogs.modifiedCount}`);
    console.log(`   - TransferLogs: ${equipmentResults.transferLogs.modifiedCount}`);
    console.log(`   - IssueLogs (Requester): ${issueResults.requester.modifiedCount}`);
    console.log(`   - IssueLogs (Admin): ${issueResults.admin.modifiedCount}`);
    console.log(`   - Total: ${totalModified} records`);
    
    return {
      success: true,
      totalModified,
      equipment: equipmentResults,
      issues: issueResults
    };
    
  } catch (error) {
    console.error(`❌ Error snapshotting user ${userId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Snapshot IssueLog ก่อนลบ User
 * - อัพเดตชื่อผู้แจ้ง (requesterName)
 * - อัพเดตชื่อผู้รับงาน (assignedToName)
 */
async function snapshotIssueLogsBeforeUserDelete(userId: string) {
  try {
    const IssueLog = (await import('@/models/IssueLog')).default;
    const { getUserName } = await import('@/lib/equipment-snapshot-helpers');
    
    const userName = await getUserName(userId);
    
    // Snapshot as Requester
    const requesterResult = await IssueLog.updateMany(
      { requester: userId },
      { 
        $set: {
          requesterName: userName
        }
      }
    );
    
    // Snapshot as Admin (assignedTo)
    const adminResult = await IssueLog.updateMany(
      { assignedTo: userId },
      { 
        $set: {
          assignedToName: userName
        }
      }
    );
    
    console.log(`✅ Snapshot IssueLogs (user: ${userId})`);
    console.log(`   - As Requester: ${requesterResult.modifiedCount}`);
    console.log(`   - As Admin: ${adminResult.modifiedCount}`);
    
    return {
      requester: { success: true, modifiedCount: requesterResult.modifiedCount },
      admin: { success: true, modifiedCount: adminResult.modifiedCount }
    };
    
  } catch (error) {
    console.error('Error snapshotting IssueLogs:', error);
    return {
      requester: { success: false, modifiedCount: 0, error },
      admin: { success: false, modifiedCount: 0, error }
    };
  }
}

/**
 * ตรวจสอบว่าผู้ใช้มีข้อมูลที่เกี่ยวข้องในระบบหรือไม่
 */
export async function checkUserRelatedIssues(userId: string) {
  try {
    const IssueLog = (await import('@/models/IssueLog')).default;
    const RequestLog = (await import('@/models/RequestLog')).default;
    const ReturnLog = (await import('@/models/ReturnLog')).default;
    const TransferLog = (await import('@/models/TransferLog')).default;
    
    // ตรวจสอบ IssueLog
    const issueAsRequester = await IssueLog.countDocuments({ requester: userId });
    const issueAsAdmin = await IssueLog.countDocuments({ assignedTo: userId });
    
    // ตรวจสอบ RequestLog
    const requestAsRequester = await RequestLog.countDocuments({ requester: userId });
    const requestAsApprover = await RequestLog.countDocuments({ approvedBy: userId });
    const requestAsRejecter = await RequestLog.countDocuments({ rejectedBy: userId });
    
    // ตรวจสอบ ReturnLog
    const returnAsReturner = await ReturnLog.countDocuments({ returner: userId });
    const returnAsApprover = await ReturnLog.countDocuments({ 'items.approvedBy': userId });
    
    // ตรวจสอบ TransferLog
    const transferAsFrom = await TransferLog.countDocuments({ 'fromOwnership.userId': userId });
    const transferAsTo = await TransferLog.countDocuments({ 'toOwnership.userId': userId });
    const transferAsProcessor = await TransferLog.countDocuments({ processedBy: userId });
    const transferAsApprover = await TransferLog.countDocuments({ approvedBy: userId });
    
    const total = 
      issueAsRequester + issueAsAdmin +
      requestAsRequester + requestAsApprover + requestAsRejecter +
      returnAsReturner + returnAsApprover +
      transferAsFrom + transferAsTo + transferAsProcessor + transferAsApprover;
    
    return {
      total,
      hasRelatedIssues: total > 0,
      asRequester: issueAsRequester + requestAsRequester + returnAsReturner,
      asAdmin: issueAsAdmin + requestAsApprover + requestAsRejecter + returnAsApprover + transferAsProcessor + transferAsApprover,
      asTransferFrom: transferAsFrom,
      asTransferTo: transferAsTo
    };
    
  } catch (error) {
    console.error('Error checking user related issues:', error);
    return {
      total: 0,
      hasRelatedIssues: false,
      asRequester: 0,
      asAdmin: 0,
      asTransferFrom: 0,
      asTransferTo: 0,
      error
    };
  }
}