import { getStatusName, getConditionName, getUserName } from '@/lib/equipment-snapshot-helpers';
import { getItemNameAndCategory, getCategoryNameById } from '@/lib/item-name-resolver';
import InventoryMaster from '@/models/InventoryMaster';

/**
 * =========================================
 * POPULATE FUNCTIONS สำหรับแสดงผล
 * =========================================
 * 
 * หลักการ: ใช้ Populate สำหรับข้อมูลที่ยังมีอยู่
 * ถ้าข้อมูลถูกลบ จะใช้ Snapshot ที่เก็บไว้
 */

/**
 * Populate RequestLog items ให้มีชื่อสถานะและสภาพ
 * และชื่อ Admin ผู้อนุมัติ/ปฏิเสธ
 * และชื่ออุปกรณ์/หมวดหมู่ล่าสุด
 */
export async function populateRequestLogItems(requestLog: any) {
  if (!requestLog) return requestLog;
  
  const populated = requestLog.toObject ? requestLog.toObject() : requestLog;
  
  // Populate แต่ละ item (ถ้ามี)
  if (populated.items) {
    for (const item of populated.items) {
      // Populate item name และ category (ถ้ามี masterId และยังไม่มี snapshot)
      if (item.masterId && !item.itemName) {
        const itemInfo = await getItemNameAndCategory(item.masterId);
        if (itemInfo) {
          item.itemName = itemInfo.itemName;
          item.category = itemInfo.category;
          item.categoryId = itemInfo.categoryId;
        } else {
          // ถ้าไม่เจอ InventoryMaster (อาจถูกลบ) ใช้ masterId เป็น fallback
          item.itemName = item.itemName || `[Deleted Item: ${item.masterId}]`;
          item.category = item.category || 'Unknown';
        }
      }
      // ถ้ามี itemName อยู่แล้ว (snapshot) ไม่ต้อง populate
      
      // Populate status name (ถ้ามี statusOnRequest และยังไม่มี snapshot)
      if (item.statusOnRequest && !item.statusOnRequestName) {
        item.statusOnRequestName = await getStatusName(item.statusOnRequest);
      }
      
      // Populate condition name (ถ้ามี conditionOnRequest และยังไม่มี snapshot)
      if (item.conditionOnRequest && !item.conditionOnRequestName) {
        item.conditionOnRequestName = await getConditionName(item.conditionOnRequest);
      }
    }
  }
  
  // Populate approvedByName (ถ้ามี approvedBy และยังไม่มี snapshot)
  if (populated.approvedBy && !populated.approvedByName) {
    populated.approvedByName = await getUserName(populated.approvedBy);
  }
  
  // Populate rejectedByName (ถ้ามี rejectedBy และยังไม่มี snapshot)
  if (populated.rejectedBy && !populated.rejectedByName) {
    populated.rejectedByName = await getUserName(populated.rejectedBy);
  }
  
  return populated;
}

/**
 * Populate ReturnLog items ให้มีชื่อสถานะและสภาพ และชื่อ Admin ผู้อนุมัติ
 * และชื่ออุปกรณ์/หมวดหมู่ล่าสุด
 */
export async function populateReturnLogItems(returnLog: any) {
  if (!returnLog || !returnLog.items) return returnLog;
  
  const populated = returnLog.toObject ? returnLog.toObject() : returnLog;
  
  // Populate แต่ละ item
  for (const item of populated.items) {
    // Populate item name และ category (ถ้ามี inventoryItemId หรือ itemId และยังไม่มี snapshot)
    if ((item.inventoryItemId || item.itemId) && !item.itemName) {
      const itemInfo = await getItemNameAndCategory(undefined, item.inventoryItemId || item.itemId);
      if (itemInfo) {
        item.itemName = itemInfo.itemName;
        item.category = itemInfo.category;
        item.categoryId = itemInfo.categoryId;
      } else {
        // ถ้าไม่เจอ InventoryItem (อาจถูกลบ) ใช้ itemId เป็น fallback
        item.itemName = item.itemName || `[Deleted Item: ${item.itemId}]`;
        item.category = item.category || 'Unknown';
      }
    }
    // ถ้ามี itemName อยู่แล้ว (snapshot) ไม่ต้อง populate
    
    // Populate status name (ถ้ามี statusOnReturn และยังไม่มี snapshot)
    if (item.statusOnReturn && !item.statusOnReturnName) {
      item.statusOnReturnName = await getStatusName(item.statusOnReturn);
    }
    
    // Populate condition name (ถ้ามี conditionOnReturn และยังไม่มี snapshot)
    if (item.conditionOnReturn && !item.conditionOnReturnName) {
      item.conditionOnReturnName = await getConditionName(item.conditionOnReturn);
    }
    
    // Populate approvedBy name (ถ้ามี approvedBy และยังไม่มี snapshot)
    if (item.approvedBy && !item.approvedByName) {
      item.approvedByName = await getUserName(item.approvedBy);
    }
  }
  
  return populated;
}

/**
 * Populate TransferLog ให้มีชื่อผู้ใช้ทั้งหมด
 */
export async function populateTransferLog(transferLog: any) {
  if (!transferLog) return transferLog;
  
  const populated = transferLog.toObject ? transferLog.toObject() : transferLog;
  
  // Populate fromOwnership.userName
  if (populated.fromOwnership?.userId && !populated.fromOwnership.userName) {
    populated.fromOwnership.userName = await getUserName(populated.fromOwnership.userId);
  }
  
  // Populate toOwnership.userName
  if (populated.toOwnership?.userId && !populated.toOwnership.userName) {
    populated.toOwnership.userName = await getUserName(populated.toOwnership.userId);
  }
  
  // Populate processedByName
  if (populated.processedBy && !populated.processedByName) {
    populated.processedByName = await getUserName(populated.processedBy);
  }
  
  // Populate approvedByName
  if (populated.approvedBy && !populated.approvedByName) {
    populated.approvedByName = await getUserName(populated.approvedBy);
  }
  
  return populated;
}

/**
 * Populate หลายๆ RequestLog พร้อมกัน
 */
export async function populateRequestLogItemsBatch(requestLogs: any[]) {
  return Promise.all(requestLogs.map(log => populateRequestLogItems(log)));
}

/**
 * Populate หลายๆ ReturnLog พร้อมกัน
 */
export async function populateReturnLogItemsBatch(returnLogs: any[]) {
  return Promise.all(returnLogs.map(log => populateReturnLogItems(log)));
}

/**
 * Populate หลายๆ TransferLog พร้อมกัน
 */
export async function populateTransferLogBatch(transferLogs: any[]) {
  return Promise.all(transferLogs.map(log => populateTransferLog(log)));
}

/**
 * =========================================
 * POPULATE USER INFO สำหรับ EQUIPMENT LOGS
 * =========================================
 */

/**
 * Populate ข้อมูล User ใน RequestLog
 * - Populate ข้อมูลผู้เบิกล่าสุดจาก User collection
 * - ถ้า User ถูกลบ จะใช้ snapshot ที่เก็บไว้
 */
export async function populateRequestLogUser(requestLog: any) {
  if (!requestLog) return requestLog;
  
  const populated = requestLog.toObject ? requestLog.toObject() : requestLog;
  
  // ถ้ามี userId ให้ populate ข้อมูลล่าสุด
  if (populated.userId) {
    const User = (await import('@/models/User')).default;
    const user = await User.findOne({ user_id: populated.userId }).select(
      'firstName lastName nickname department office phone email userType'
    );
    
    if (user) {
      // Individual User: Populate ทุกฟิลด์
      if (user.userType === 'individual') {
        populated.firstName = user.firstName;
        populated.lastName = user.lastName;
        populated.nickname = user.nickname;
        populated.department = user.department;
        populated.office = user.office;
        populated.phone = user.phone;
        populated.email = user.email;
      }
      // Branch User: Populate เฉพาะ office
      else if (user.userType === 'branch') {
        populated.office = user.office;
        // firstName, lastName, etc. ใช้จาก snapshot (ที่กรอกในฟอร์ม)
      }
    }
    // ถ้าไม่เจอ user (ถูกลบแล้ว) จะใช้ snapshot ที่เก็บไว้
  }
  
  return populated;
}

/**
 * Populate ข้อมูล User ใน ReturnLog
 * - Populate ข้อมูลผู้คืนล่าสุดจาก User collection
 * - ถ้า User ถูกลบ จะใช้ snapshot ที่เก็บไว้
 */
export async function populateReturnLogUser(returnLog: any) {
  if (!returnLog) return returnLog;
  
  const populated = returnLog.toObject ? returnLog.toObject() : returnLog;
  
  // ถ้ามี userId ให้ populate ข้อมูลล่าสุด
  if (populated.userId) {
    const User = (await import('@/models/User')).default;
    const user = await User.findOne({ user_id: populated.userId }).select(
      'firstName lastName nickname department office phone email userType'
    );
    
    if (user) {
      // Individual User: Populate ทุกฟิลด์
      if (user.userType === 'individual') {
        populated.firstName = user.firstName;
        populated.lastName = user.lastName;
        populated.nickname = user.nickname;
        populated.department = user.department;
        populated.office = user.office;
        populated.phone = user.phone;
        populated.email = user.email;
      }
      // Branch User: Populate เฉพาะ office
      else if (user.userType === 'branch') {
        populated.office = user.office;
        // firstName, lastName, etc. ใช้จาก snapshot (ที่กรอกในฟอร์ม)
      }
    }
    // ถ้าไม่เจอ user (ถูกลบแล้ว) จะใช้ snapshot ที่เก็บไว้
  }
  
  return populated;
}

/**
 * Populate ข้อมูลครบถ้วนสำหรับ RequestLog
 * - Populate user info
 * - Populate item info (names, categories, status, condition)
 */
export async function populateRequestLogComplete(requestLog: any) {
  let result = await populateRequestLogUser(requestLog);
  result = await populateRequestLogItems(result);
  return result;
}

/**
 * Populate ข้อมูลครบถ้วนสำหรับ ReturnLog
 * - Populate user info
 * - Populate item info (names, categories, status, condition)
 */
export async function populateReturnLogComplete(returnLog: any) {
  let result = await populateReturnLogUser(returnLog);
  result = await populateReturnLogItems(result);
  return result;
}

/**
 * Populate หลายๆ RequestLog พร้อมกัน (แบบครบถ้วน)
 */
export async function populateRequestLogCompleteBatch(requestLogs: any[]) {
  return Promise.all(requestLogs.map(log => populateRequestLogComplete(log)));
}

/**
 * Populate หลายๆ ReturnLog พร้อมกัน (แบบครบถ้วน)
 */
export async function populateReturnLogCompleteBatch(returnLogs: any[]) {
  return Promise.all(returnLogs.map(log => populateReturnLogComplete(log)));
}

