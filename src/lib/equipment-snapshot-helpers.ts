import User from '@/models/User';
import InventoryConfig from '@/models/InventoryConfig';
import InventoryMaster from '@/models/InventoryMaster';
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
 * - Snapshot ข้อมูลผู้เบิก (requester) แบบแยกตาม userType
 */
export async function snapshotRequestLogsBeforeUserDelete(userId: string) {
  try {
    const userName = await getUserName(userId);
    
    // ดึงข้อมูลผู้ใช้เพื่อ snapshot
    const user = await User.findOne({ user_id: userId }).select('userType firstName lastName nickname department office phone email');
    
    let totalModified = 0;
    
    // 🆕 Snapshot ข้อมูลผู้เบิก (requester) ในทุก RequestLog ที่ userId ตรงกัน
    if (user) {
      // แยกการ snapshot ตาม userType
      let updateFields: any = {};
      
      if (user.userType === 'individual') {
        // ผู้ใช้บุคคล: Snapshot ทุกข้อมูล
        updateFields = {
          requesterFirstName: user.firstName || '',
          requesterLastName: user.lastName || '',
          requesterNickname: user.nickname || '',
          requesterDepartment: user.department || '',
          requesterOffice: user.office || '',
          requesterPhone: user.phone || '',
          requesterEmail: user.email || ''
        };
      } else if (user.userType === 'branch') {
        // ผู้ใช้สาขา: Snapshot เฉพาะข้อมูลสาขา (ห้ามแตะข้อมูลส่วนตัว)
        updateFields = {
          requesterOffice: user.office || '',
          requesterPhone: user.phone || '',
          requesterEmail: user.email || ''
          // ❌ ไม่แตะ: firstName, lastName, nickname, department
          // เพราะข้อมูลเหล่านี้มาจากฟอร์มที่กรอกแต่ละครั้ง
        };
      }
      
      const requesterResult = await RequestLog.updateMany(
        { userId: userId },
        { $set: updateFields }
      );
      totalModified += requesterResult.modifiedCount;
      console.log(`   - Requester (userId): ${requesterResult.modifiedCount}`);
    }
    
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
    console.log(`   - User Type: ${user?.userType || 'unknown'}`);
    
    return { success: true, modifiedCount: totalModified };
  } catch (error) {
    console.error('Error snapshotting RequestLogs:', error);
    return { success: false, error };
  }
}

/**
 * Snapshot ReturnLog ก่อนลบ User
 * - อัพเดตชื่อผู้อนุมัติ (items[].approvedBy)
 * - Snapshot ข้อมูลผู้คืน (returner) แบบแยกตาม userType
 */
export async function snapshotReturnLogsBeforeUserDelete(userId: string) {
  try {
    const userName = await getUserName(userId);
    
    // ดึงข้อมูลผู้ใช้เพื่อ snapshot
    const user = await User.findOne({ user_id: userId }).select('userType firstName lastName nickname department office phone email');
    
    let modifiedCount = 0;
    
    // 🆕 Snapshot ข้อมูลผู้คืน (returner) ในทุก ReturnLog ที่ userId ตรงกัน
    if (user) {
      // แยกการ snapshot ตาม userType
      let updateFields: any = {};
      
      if (user.userType === 'individual') {
        // ผู้ใช้บุคคล: Snapshot ทุกข้อมูล
        updateFields = {
          returnerFirstName: user.firstName || '',
          returnerLastName: user.lastName || '',
          returnerNickname: user.nickname || '',
          returnerDepartment: user.department || '',
          returnerOffice: user.office || '',
          returnerPhone: user.phone || '',
          returnerEmail: user.email || ''
        };
      } else if (user.userType === 'branch') {
        // ผู้ใช้สาขา: Snapshot เฉพาะข้อมูลสาขา (ห้ามแตะข้อมูลส่วนตัว)
        updateFields = {
          returnerOffice: user.office || '',
          returnerPhone: user.phone || '',
          returnerEmail: user.email || ''
          // ❌ ไม่แตะ: firstName, lastName, nickname, department
          // เพราะข้อมูลเหล่านี้มาจากฟอร์มที่กรอกแต่ละครั้ง
        };
      }
      
      const returnerResult = await ReturnLog.updateMany(
        { userId: userId },
        { $set: updateFields }
      );
      modifiedCount += returnerResult.modifiedCount;
      console.log(`   - Returner (userId): ${returnerResult.modifiedCount}`);
    }
    
    // ดึง ReturnLog ที่มี items ที่ user นี้เป็นผู้อนุมัติ
    const returnLogs = await ReturnLog.find({
      'items.approvedBy': userId
    });
    
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
    
    console.log(`✅ Snapshot ${modifiedCount} ReturnLogs (user: ${userId})`);
    console.log(`   - User Type: ${user?.userType || 'unknown'}`);
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

/**
 * =========================================
 * SNAPSHOT FUNCTIONS สำหรับลบ/แก้ไข CATEGORY
 * =========================================
 */

/**
 * ดึงชื่อ Category จาก categoryId
 */
export async function getCategoryName(categoryId: string): Promise<string> {
  try {
    const config = await InventoryConfig.findOne();
    if (!config) return categoryId;
    
    const categoryConfig = config.categoryConfigs.find((c: any) => c.id === categoryId);
    return categoryConfig ? categoryConfig.name : categoryId;
  } catch (error) {
    console.error(`Error getting category name for ${categoryId}:`, error);
    return categoryId;
  }
}

/**
 * Snapshot Category Config ก่อนลบหรือแก้ไข
 * - อัพเดต categoryName ใน RequestLog
 * - อัพเดต categoryName ใน ReturnLog
 * - อัพเดต categoryName ใน TransferLog
 */
export async function snapshotCategoryConfigBeforeChange(categoryId: string, newName?: string) {
  try {
    const categoryName = newName || await getCategoryName(categoryId);
    
    // อัพเดต RequestLog
    const requestResult = await RequestLog.updateMany(
      { 'items.categoryId': categoryId },
      { 
        $set: {
          'items.$[elem].category': categoryName
        }
      },
      {
        arrayFilters: [{ 'elem.categoryId': categoryId }]
      }
    );
    
    // อัพเดต ReturnLog
    const returnResult = await ReturnLog.updateMany(
      { 'items.categoryId': categoryId },
      { 
        $set: {
          'items.$[elem].category': categoryName
        }
      },
      {
        arrayFilters: [{ 'elem.categoryId': categoryId }]
      }
    );
    
    // อัพเดต TransferLog
    const transferResult = await TransferLog.updateMany(
      { categoryId: categoryId },
      { 
        $set: {
          categoryName: categoryName
        }
      }
    );
    
    console.log(`✅ Snapshot category "${categoryName}":`, {
      requestLogs: requestResult.modifiedCount,
      returnLogs: returnResult.modifiedCount,
      transferLogs: transferResult.modifiedCount
    });
    
    return {
      success: true,
      requestLogs: requestResult.modifiedCount,
      returnLogs: returnResult.modifiedCount,
      transferLogs: transferResult.modifiedCount
    };
  } catch (error) {
    console.error('Error snapshotting category config:', error);
    return { success: false, error };
  }
}

/**
 * ตรวจสอบว่า Category Config มีการใช้งานหรือไม่
 */
export async function checkCategoryConfigUsage(categoryId: string) {
  const [requestCount, returnCount, transferCount] = await Promise.all([
    RequestLog.countDocuments({ 'items.categoryId': categoryId }),
    ReturnLog.countDocuments({ 'items.categoryId': categoryId }),
    TransferLog.countDocuments({ categoryId: categoryId })
  ]);
  
  return {
    requestLogs: requestCount,
    returnLogs: returnCount,
    transferLogs: transferCount,
    total: requestCount + returnCount + transferCount,
    isUsed: (requestCount + returnCount + transferCount) > 0
  };
}

/**
 * =========================================
 * SNAPSHOT FUNCTIONS สำหรับลบ INVENTORY MASTER
 * =========================================
 */

/**
 * Snapshot ItemName และ Category ก่อนลบ InventoryMaster
 * - อัพเดตชื่ออุปกรณ์และหมวดหมู่ใน RequestLog และ ReturnLog
 * - เมื่อ InventoryMaster ถูกลบ logs จะยังมีข้อมูลชื่ออุปกรณ์อยู่
 */
export async function snapshotItemNameBeforeDelete(masterId: string) {
  try {
    const master = await InventoryMaster.findById(masterId);
    if (!master) {
      console.log(`⚠️ InventoryMaster not found: ${masterId}`);
      return { success: false, error: 'InventoryMaster not found' };
    }
    
    const itemName = master.itemName;
    const categoryId = master.categoryId;
    
    // ดึงชื่อหมวดหมู่จาก InventoryConfig
    let categoryName = categoryId; // fallback
    try {
      const config = await InventoryConfig.findOne();
      const categoryConfig = config?.categoryConfigs?.find((c: any) => c.id === categoryId);
      if (categoryConfig) {
        categoryName = categoryConfig.name;
      }
    } catch (error) {
      console.warn('Failed to get category name:', error);
    }
    
    console.log(`📸 Snapshotting item "${itemName}" (${categoryName}) before deleting InventoryMaster...`);
    
    // Snapshot ใน RequestLog
    const requestResult = await RequestLog.updateMany(
      { 'items.masterId': masterId },
      { 
        $set: { 
          'items.$[elem].itemName': itemName,
          'items.$[elem].category': categoryName,
          'items.$[elem].categoryId': categoryId
        } 
      },
      { arrayFilters: [{ 'elem.masterId': masterId }] }
    );
    
    // Snapshot ใน ReturnLog (ถ้ามีการเก็บ masterId - ปัจจุบัน ReturnLog ใช้ itemId แต่เผื่ออนาคต)
    // Note: ReturnLog ไม่มี masterId แต่เราเตรียมไว้สำหรับอนาคต
    const returnResult = { modifiedCount: 0 }; // placeholder
    
    console.log(`✅ Snapshot item "${itemName}":`, {
      requestLogs: requestResult.modifiedCount,
      returnLogs: returnResult.modifiedCount
    });
    
    return {
      success: true,
      itemName,
      categoryName,
      requestLogs: requestResult.modifiedCount,
      returnLogs: returnResult.modifiedCount
    };
  } catch (error) {
    console.error('Error snapshotting item name:', error);
    return { success: false, error };
  }
}

/**
 * ตรวจสอบว่า InventoryMaster ถูกใช้ใน logs หรือไม่
 */
export async function checkInventoryMasterUsage(masterId: string) {
  try {
    const requestCount = await RequestLog.countDocuments({
      'items.masterId': masterId
    });
    
    // ReturnLog ไม่มี masterId แต่เราเตรียมไว้
    const returnCount = 0;
    
    return {
      requestLogs: requestCount,
      returnLogs: returnCount,
      total: requestCount + returnCount,
      isUsed: (requestCount + returnCount) > 0
    };
  } catch (error) {
    console.error('Error checking InventoryMaster usage:', error);
    return {
      requestLogs: 0,
      returnLogs: 0,
      total: 0,
      isUsed: false
    };
  }
}

/**
 * =========================================
 * BULK SNAPSHOT FUNCTIONS สำหรับ CONFIG CHANGES
 * =========================================
 */

/**
 * Snapshot การเปลี่ยนแปลง Config ทั้งหมดก่อน Bulk Update
 * - เปรียบเทียบ config เก่ากับใหม่
 * - Snapshot เฉพาะรายการที่มีการเปลี่ยนชื่อ
 */
export async function snapshotConfigChangesBeforeBulkUpdate(
  oldConfig: any,
  newConfig: {
    categoryConfigs?: any[];
    statusConfigs?: any[];
    conditionConfigs?: any[];
  }
) {
  const results = {
    categories: { updated: 0, errors: 0 },
    statuses: { updated: 0, errors: 0 },
    conditions: { updated: 0, errors: 0 }
  };

  try {
    // 1. Snapshot Categories ที่เปลี่ยนชื่อ
    if (newConfig.categoryConfigs && oldConfig.categoryConfigs) {
      for (const newCat of newConfig.categoryConfigs) {
        const oldCat = oldConfig.categoryConfigs.find((c: any) => c.id === newCat.id);
        if (oldCat && oldCat.name !== newCat.name) {
          try {
            await snapshotCategoryConfigBeforeChange(newCat.id, newCat.name);
            results.categories.updated++;
            console.log(`📸 Snapshot category: "${oldCat.name}" → "${newCat.name}"`);
          } catch (error) {
            console.error(`Error snapshotting category ${newCat.id}:`, error);
            results.categories.errors++;
          }
        }
      }
    }

    // 2. Snapshot Statuses ที่เปลี่ยนชื่อ
    if (newConfig.statusConfigs && oldConfig.statusConfigs) {
      for (const newStatus of newConfig.statusConfigs) {
        const oldStatus = oldConfig.statusConfigs.find((s: any) => s.id === newStatus.id);
        if (oldStatus && oldStatus.name !== newStatus.name) {
          try {
            await snapshotStatusConfigBeforeChange(newStatus.id, newStatus.name);
            results.statuses.updated++;
            console.log(`📸 Snapshot status: "${oldStatus.name}" → "${newStatus.name}"`);
          } catch (error) {
            console.error(`Error snapshotting status ${newStatus.id}:`, error);
            results.statuses.errors++;
          }
        }
      }
    }

    // 3. Snapshot Conditions ที่เปลี่ยนชื่อ
    if (newConfig.conditionConfigs && oldConfig.conditionConfigs) {
      for (const newCondition of newConfig.conditionConfigs) {
        const oldCondition = oldConfig.conditionConfigs.find((c: any) => c.id === newCondition.id);
        if (oldCondition && oldCondition.name !== newCondition.name) {
          try {
            await snapshotConditionConfigBeforeChange(newCondition.id, newCondition.name);
            results.conditions.updated++;
            console.log(`📸 Snapshot condition: "${oldCondition.name}" → "${newCondition.name}"`);
          } catch (error) {
            console.error(`Error snapshotting condition ${newCondition.id}:`, error);
            results.conditions.errors++;
          }
        }
      }
    }

    console.log('✅ Bulk snapshot completed:', results);
    return {
      success: true,
      results
    };

  } catch (error) {
    console.error('Error in bulk snapshot:', error);
    return {
      success: false,
      error,
      results
    };
  }
}

