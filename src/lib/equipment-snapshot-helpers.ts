import User from '@/models/User';
import InventoryConfig from '@/models/InventoryConfig';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import TransferLog from '@/models/TransferLog';

/**
 * =========================================
 * HELPER FUNCTIONS สำหรับ POPULATE ชื่อจาก ID
 * =========================================
 */

/**
 * ดึงชื่อ User จาก user_id
 */
export async function getUserName(userId: string): Promise<string> {
  try {
    const user = await User.findOne({ user_id: userId }).select('firstName lastName office userType');
    if (!user) return userId; // ถ้าไม่เจอ return ID เดิม
    
    return user.userType === 'individual'
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.office;
  } catch (error) {
    console.error(`Error getting user name for ${userId}:`, error);
    return userId;
  }
}

/**
 * ดึงชื่อสถานะ (Status) จาก status_id
 */
export async function getStatusName(statusId: string): Promise<string> {
  try {
    const config = await InventoryConfig.findOne();
    if (!config) return statusId;
    
    const statusConfig = config.statusConfigs.find((s: any) => s.id === statusId);
    return statusConfig ? statusConfig.name : statusId;
  } catch (error) {
    console.error(`Error getting status name for ${statusId}:`, error);
    return statusId;
  }
}

/**
 * ดึงชื่อสภาพ (Condition) จาก condition_id
 */
export async function getConditionName(conditionId: string): Promise<string> {
  try {
    const config = await InventoryConfig.findOne();
    if (!config) return conditionId;
    
    const conditionConfig = config.conditionConfigs.find((c: any) => c.id === conditionId);
    return conditionConfig ? conditionConfig.name : conditionId;
  } catch (error) {
    console.error(`Error getting condition name for ${conditionId}:`, error);
    return conditionId;
  }
}

/**
 * =========================================
 * SNAPSHOT FUNCTIONS สำหรับลบ USER
 * =========================================
 */

/**
 * Snapshot RequestLog ก่อนลบ User
 * - อัพเดตชื่อผู้อนุมัติ (approvedBy)
 * - อัพเดตชื่อผู้ปฏิเสธ (rejectedBy)
 * - **ไม่แตะ requester info** เพราะมี Snapshot อยู่แล้ว
 */
export async function snapshotRequestLogsBeforeUserDelete(userId: string) {
  try {
    const userName = await getUserName(userId);
    
    let totalModified = 0;
    
    // อัพเดท approvedBy ในทุก RequestLog
    const approvedResult = await RequestLog.updateMany(
      { approvedBy: userId },
      { 
        $set: {
          approvedByName: userName
        }
      }
    );
    totalModified += approvedResult.modifiedCount;
    
    // อัพเดท rejectedBy ในทุก RequestLog
    const rejectedResult = await RequestLog.updateMany(
      { rejectedBy: userId },
      { 
        $set: {
          rejectedByName: userName
        }
      }
    );
    totalModified += rejectedResult.modifiedCount;
    
    console.log(`✅ Snapshot ${totalModified} RequestLogs (user: ${userId})`);
    console.log(`   - Approved by: ${approvedResult.modifiedCount}`);
    console.log(`   - Rejected by: ${rejectedResult.modifiedCount}`);
    
    return { success: true, modifiedCount: totalModified };
  } catch (error) {
    console.error('Error snapshotting RequestLogs:', error);
    return { success: false, error };
  }
}

/**
 * Snapshot ReturnLog ก่อนลบ User
 * - อัพเดตชื่อผู้อนุมัติ (items[].approvedBy)
 * - **ไม่แตะ returner info** เพราะมี Snapshot อยู่แล้ว
 */
export async function snapshotReturnLogsBeforeUserDelete(userId: string) {
  try {
    const userName = await getUserName(userId);
    
    // ดึง ReturnLog ที่มี items ที่ user นี้เป็นผู้อนุมัติ
    const returnLogs = await ReturnLog.find({
      'items.approvedBy': userId
    });
    
    let modifiedCount = 0;
    
    for (const log of returnLogs) {
      let modified = false;
      
      // อัพเดทแต่ละ item ที่ approvedBy ตรงกับ userId
      log.items = log.items.map((item: any) => {
        if (item.approvedBy === userId) {
          modified = true;
          return {
            ...item.toObject ? item.toObject() : item,
            approvedByName: userName
          };
        }
        return item;
      });
      
      if (modified) {
        await log.save();
        modifiedCount++;
      }
    }
    
    console.log(`✅ Snapshot ${modifiedCount} ReturnLogs (approvedBy: ${userId})`);
    return { success: true, modifiedCount };
  } catch (error) {
    console.error('Error snapshotting ReturnLogs:', error);
    return { success: false, error };
  }
}

/**
 * Snapshot TransferLog ก่อนลบ User
 * - อัพเดตชื่อใน fromOwnership.userName
 * - อัพเดตชื่อใน toOwnership.userName
 * - อัพเดตชื่อใน processedByName
 * - อัพเดตชื่อใน approvedByName
 */
export async function snapshotTransferLogsBeforeUserDelete(userId: string) {
  try {
    const userName = await getUserName(userId);
    
    // ดึง TransferLog ที่เกี่ยวข้องกับ user นี้
    const transferLogs = await TransferLog.find({
      $or: [
        { 'fromOwnership.userId': userId },
        { 'toOwnership.userId': userId },
        { processedBy: userId },
        { approvedBy: userId }
      ]
    });
    
    let modifiedCount = 0;
    
    for (const log of transferLogs) {
      let modified = false;
      const updates: any = {};
      
      // อัพเดต fromOwnership.userName
      if (log.fromOwnership.userId === userId) {
        updates['fromOwnership.userName'] = userName;
        modified = true;
      }
      
      // อัพเดต toOwnership.userName
      if (log.toOwnership.userId === userId) {
        updates['toOwnership.userName'] = userName;
        modified = true;
      }
      
      // อัพเดต processedByName
      if (log.processedBy === userId) {
        updates.processedByName = userName;
        modified = true;
      }
      
      // อัพเดต approvedByName
      if (log.approvedBy === userId) {
        updates.approvedByName = userName;
        modified = true;
      }
      
      if (modified) {
        await TransferLog.findByIdAndUpdate(log._id, { $set: updates });
        modifiedCount++;
      }
    }
    
    console.log(`✅ Snapshot ${modifiedCount} TransferLogs (user: ${userId})`);
    return { success: true, modifiedCount };
  } catch (error) {
    console.error('Error snapshotting TransferLogs:', error);
    return { success: false, error };
  }
}

/**
 * Snapshot ทุก Equipment Logs ก่อนลบ User
 */
export async function snapshotEquipmentLogsBeforeUserDelete(userId: string) {
  console.log(`📸 Snapshotting equipment logs for user ${userId}...`);
  
  const results = {
    requestLogs: await snapshotRequestLogsBeforeUserDelete(userId),
    returnLogs: await snapshotReturnLogsBeforeUserDelete(userId),
    transferLogs: await snapshotTransferLogsBeforeUserDelete(userId)
  };
  
  return results;
}

/**
 * =========================================
 * SNAPSHOT FUNCTIONS สำหรับลบ/แก้ไข CONFIG
 * =========================================
 */

/**
 * Snapshot Status Config ก่อนลบหรือแก้ไข
 * - อัพเดต statusName ใน RequestLog
 * - อัพเดต statusName ใน ReturnLog
 */
export async function snapshotStatusConfigBeforeChange(statusId: string, newName?: string) {
  try {
    const statusName = newName || await getStatusName(statusId);
    
    // อัพเดต RequestLog
    const requestResult = await RequestLog.updateMany(
      { 'items.statusOnRequest': statusId },
      { 
        $set: {
          'items.$[elem].statusOnRequestName': statusName
        }
      },
      {
        arrayFilters: [{ 'elem.statusOnRequest': statusId }]
      }
    );
    
    // อัพเดต ReturnLog
    const returnResult = await ReturnLog.updateMany(
      { 'items.statusOnReturn': statusId },
      { 
        $set: {
          'items.$[elem].statusOnReturnName': statusName
        }
      },
      {
        arrayFilters: [{ 'elem.statusOnReturn': statusId }]
      }
    );
    
    console.log(`✅ Snapshot status "${statusName}":`, {
      requestLogs: requestResult.modifiedCount,
      returnLogs: returnResult.modifiedCount
    });
    
    return {
      success: true,
      requestLogs: requestResult.modifiedCount,
      returnLogs: returnResult.modifiedCount
    };
  } catch (error) {
    console.error('Error snapshotting status config:', error);
    return { success: false, error };
  }
}

/**
 * Snapshot Condition Config ก่อนลบหรือแก้ไข
 * - อัพเดต conditionName ใน RequestLog
 * - อัพเดต conditionName ใน ReturnLog
 */
export async function snapshotConditionConfigBeforeChange(conditionId: string, newName?: string) {
  try {
    const conditionName = newName || await getConditionName(conditionId);
    
    // อัพเดต RequestLog
    const requestResult = await RequestLog.updateMany(
      { 'items.conditionOnRequest': conditionId },
      { 
        $set: {
          'items.$[elem].conditionOnRequestName': conditionName
        }
      },
      {
        arrayFilters: [{ 'elem.conditionOnRequest': conditionId }]
      }
    );
    
    // อัพเดต ReturnLog
    const returnResult = await ReturnLog.updateMany(
      { 'items.conditionOnReturn': conditionId },
      { 
        $set: {
          'items.$[elem].conditionOnReturnName': conditionName
        }
      },
      {
        arrayFilters: [{ 'elem.conditionOnReturn': conditionId }]
      }
    );
    
    console.log(`✅ Snapshot condition "${conditionName}":`, {
      requestLogs: requestResult.modifiedCount,
      returnLogs: returnResult.modifiedCount
    });
    
    return {
      success: true,
      requestLogs: requestResult.modifiedCount,
      returnLogs: returnResult.modifiedCount
    };
  } catch (error) {
    console.error('Error snapshotting condition config:', error);
    return { success: false, error };
  }
}

/**
 * =========================================
 * HELPER: ตรวจสอบข้อมูลที่เกี่ยวข้อง
 * =========================================
 */

/**
 * ตรวจสอบว่า User มีข้อมูลที่เกี่ยวข้องใน Equipment Logs หรือไม่
 */
export async function checkUserRelatedEquipmentLogs(userId: string) {
  const [requestCount, returnCount, transferCount] = await Promise.all([
    RequestLog.countDocuments({ approvedBy: userId }),
    ReturnLog.countDocuments({ 'items.approvedBy': userId }),
    TransferLog.countDocuments({
      $or: [
        { 'fromOwnership.userId': userId },
        { 'toOwnership.userId': userId },
        { processedBy: userId },
        { approvedBy: userId }
      ]
    })
  ]);
  
  return {
    requestLogs: requestCount,
    returnLogs: returnCount,
    transferLogs: transferCount,
    total: requestCount + returnCount + transferCount,
    hasRelatedLogs: (requestCount + returnCount + transferCount) > 0
  };
}

/**
 * ตรวจสอบว่า Status Config มีการใช้งานหรือไม่
 */
export async function checkStatusConfigUsage(statusId: string) {
  const [requestCount, returnCount] = await Promise.all([
    RequestLog.countDocuments({ 'items.statusOnRequest': statusId }),
    ReturnLog.countDocuments({ 'items.statusOnReturn': statusId })
  ]);
  
  return {
    requestLogs: requestCount,
    returnLogs: returnCount,
    total: requestCount + returnCount,
    isUsed: (requestCount + returnCount) > 0
  };
}

/**
 * ตรวจสอบว่า Condition Config มีการใช้งานหรือไม่
 */
export async function checkConditionConfigUsage(conditionId: string) {
  const [requestCount, returnCount] = await Promise.all([
    RequestLog.countDocuments({ 'items.conditionOnRequest': conditionId }),
    ReturnLog.countDocuments({ 'items.conditionOnReturn': conditionId })
  ]);
  
  return {
    requestLogs: requestCount,
    returnLogs: returnCount,
    total: requestCount + returnCount,
    isUsed: (requestCount + returnCount) > 0
  };
}

