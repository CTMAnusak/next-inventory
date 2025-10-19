import { getStatusName, getConditionName, getUserName, getCategoryName } from '@/lib/equipment-snapshot-helpers';
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
      // Populate item name และ category (ถ้ามี masterId)
      if (item.masterId) {
        // ถ้ายังไม่มี itemName หรือ category ให้ดึงข้อมูลจาก InventoryMaster
        if (!item.itemName || !item.category) {
          const itemInfo = await getItemNameAndCategory(item.masterId);
          if (itemInfo) {
            if (!item.itemName) item.itemName = itemInfo.itemName;
            if (!item.category) item.category = itemInfo.category;
            if (!item.categoryId) item.categoryId = itemInfo.categoryId;
          } else {
            // ถ้าไม่เจอ InventoryMaster (อาจถูกลบ) ใช้ fallback
            item.itemName = item.itemName || `[Deleted Item: ${item.masterId}]`;
            item.category = item.category || 'Unknown';
          }
        }
      }
      // ถ้าไม่มี masterId หรือมีข้อมูลครบแล้ว ไม่ต้อง populate
      
      // ✅ ถ้ามี categoryId แต่ไม่มี category name ให้ populate จาก config
      if (item.categoryId && !item.category) {
        const categoryName = await getCategoryName(item.categoryId);
        if (categoryName) {
          item.category = categoryName;
        }
      }
      
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
    // Populate item name และ category (ถ้ามี inventoryItemId หรือ itemId)
    if (item.inventoryItemId || item.itemId) {
      // ถ้ายังไม่มี itemName หรือ category ให้ดึงข้อมูลจาก InventoryItem
      if (!item.itemName || !item.category) {
        const itemInfo = await getItemNameAndCategory(undefined, item.inventoryItemId || item.itemId);
        if (itemInfo) {
          if (!item.itemName) item.itemName = itemInfo.itemName;
          if (!item.category) item.category = itemInfo.category;
          if (!item.categoryId) item.categoryId = itemInfo.categoryId;
        } else {
          // ถ้าไม่เจอ InventoryItem (อาจถูกลบ) ใช้ fallback
          item.itemName = item.itemName || `[Deleted Item: ${item.itemId}]`;
          item.category = item.category || 'Unknown';
        }
      }
    }
    // ถ้าไม่มี itemId หรือมีข้อมูลครบแล้ว ไม่ต้อง populate
    
    // ✅ ถ้ามี categoryId แต่ไม่มี category name ให้ populate จาก config
    if (item.categoryId && !item.category) {
      const categoryName = await getCategoryName(item.categoryId);
      if (categoryName) {
        item.category = categoryName;
      }
    }
    
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
 * 
 * **Individual User:**
 * - Populate ข้อมูลทั้งหมดจาก User collection (real-time)
 * - ถ้า User ถูกลบ → ใช้ snapshot ใน DeletedUsers
 * 
 * **Branch User:**
 * - Populate เฉพาะ office, phone, email จาก User collection (real-time)
 * - ข้อมูลส่วนตัว (firstName, lastName, etc.) → ใช้ snapshot จากฟอร์มที่กรอก
 * - ⚠️ Snapshot จากฟอร์ม = ข้อมูลที่กรอกในแต่ละครั้ง (ไม่ใช่ข้อมูลล่าสุดก่อนลบ)
 * 
 * @param requestLog - RequestLog document
 * @returns Populated RequestLog with user info
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
      // ✅ ตรวจสอบประเภทผู้ใช้จาก User collection ก่อน (ข้อมูลล่าสุด)
      // Branch User: Populate เฉพาะข้อมูลสาขา (ข้อมูลส่วนตัวใช้จากฟอร์ม)
      if (user.userType === 'branch') {
        populated.office = user.office;
        populated.email = user.email;
        // ✅ firstName, lastName, phone, etc. → ใช้จาก requesterFirstName, requesterLastName (snapshot ในฟอร์ม)
        // ⚠️ ไม่ populate จาก User collection เพราะเป็นข้อมูลส่วนตัวที่เปลี่ยนไปตามคนที่มาเบิก
        populated.firstName = populated.requesterFirstName || '-';
        populated.lastName = populated.requesterLastName || '-';
        populated.nickname = populated.requesterNickname || '-';
        populated.department = populated.requesterDepartment || '-';
        populated.phone = populated.requesterPhone || '-';
      }
      // Individual User: Populate ทุกฟิลด์จาก User collection (ข้อมูลล่าสุด)
      else if (user.userType === 'individual') {
        populated.firstName = user.firstName;
        populated.lastName = user.lastName;
        populated.nickname = user.nickname;
        populated.department = user.department;
        populated.office = user.office;
        populated.phone = user.phone;
        populated.email = user.email;
      }
    } else {
      // ✅ ไม่เจอ user (ถูกลบแล้ว) → ค้นหาจาก DeletedUsers collection
      const DeletedUsers = (await import('@/models/DeletedUser')).default;
      const deletedUser = await DeletedUsers.findOne({ user_id: populated.userId }).select(
        'firstName lastName nickname department office phone email userType'
      );
      
      if (deletedUser) {
        // ✅ แยกการจัดการตามประเภทผู้ใช้
        if (deletedUser.userType === 'branch') {
          // ผู้ใช้สาขา: ข้อมูลส่วนตัวจากฟอร์ม, เฉพาะสาขาจาก DeletedUsers
          populated.firstName = populated.requesterFirstName || '-';
          populated.lastName = populated.requesterLastName || '-';
          populated.nickname = populated.requesterNickname || '-';
          populated.department = populated.requesterDepartment || '-';
          populated.phone = populated.requesterPhone || '-';        // จากฟอร์ม
          populated.email = populated.requesterEmail || '-';        // จากฟอร์ม
          // เฉพาะสาขาใช้จาก DeletedUsers (ข้อมูลล่าสุดก่อนลบ)
          populated.office = deletedUser.office || populated.requesterOffice || '-';
        } else {
          // ผู้ใช้บุคคล: ใช้ข้อมูลจาก DeletedUsers เป็นหลัก (ข้อมูลล่าสุดก่อนลบ)
          populated.firstName = deletedUser.firstName ?? populated.requesterFirstName ?? '-';
          populated.lastName = deletedUser.lastName ?? populated.requesterLastName ?? '-';
          populated.nickname = deletedUser.nickname ?? populated.requesterNickname ?? '-';
          populated.department = deletedUser.department ?? populated.requesterDepartment ?? '-';
          populated.office = deletedUser.office ?? populated.requesterOffice ?? '-';
          populated.phone = deletedUser.phone ?? populated.requesterPhone ?? '-';
          populated.email = deletedUser.email ?? '-';
        }
      } else {
        // ✅ Fallback: ใช้ snapshot จากฟอร์ม
        populated.firstName = populated.requesterFirstName || '-';
        populated.lastName = populated.requesterLastName || '-';
        populated.nickname = populated.requesterNickname || '-';
        populated.department = populated.requesterDepartment || '-';
        populated.office = populated.requesterOffice || '-';
        populated.phone = populated.requesterPhone || '-';
      }
    }
  }
  
  return populated;
}

/**
 * Populate ข้อมูล User ใน ReturnLog
 * 
 * **Individual User:**
 * - Populate ข้อมูลทั้งหมดจาก User collection (real-time)
 * - ถ้า User ถูกลบ → ใช้ snapshot ใน DeletedUsers
 * 
 * **Branch User:**
 * - Populate เฉพาะ office, phone, email จาก User collection (real-time)
 * - ข้อมูลส่วนตัว (firstName, lastName, etc.) → ใช้ snapshot จากฟอร์มที่กรอก
 * - ⚠️ Snapshot จากฟอร์ม = ข้อมูลที่กรอกในแต่ละครั้ง (ไม่ใช่ข้อมูลล่าสุดก่อนลบ)
 * 
 * @param returnLog - ReturnLog document
 * @returns Populated ReturnLog with user info
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
      // ✅ ตรวจสอบประเภทผู้ใช้จาก User collection ก่อน (ข้อมูลล่าสุด)
      // Branch User: Populate เฉพาะข้อมูลสาขา (ข้อมูลส่วนตัวใช้จากฟอร์ม)
      if (user.userType === 'branch') {
        populated.office = user.office;
        populated.email = user.email;
        // ✅ firstName, lastName, phone, etc. → ใช้จาก returnerFirstName, returnerLastName (snapshot ในฟอร์ม)
        // ⚠️ ไม่ populate จาก User collection เพราะเป็นข้อมูลส่วนตัวที่เปลี่ยนไปตามคนที่มาคืน
        populated.firstName = populated.returnerFirstName || '-';
        populated.lastName = populated.returnerLastName || '-';
        populated.nickname = populated.returnerNickname || '-';
        populated.department = populated.returnerDepartment || '-';
        populated.phone = populated.returnerPhone || '-';
      }
      // Individual User: Populate ทุกฟิลด์จาก User collection (ข้อมูลล่าสุด)
      else if (user.userType === 'individual') {
        populated.firstName = user.firstName;
        populated.lastName = user.lastName;
        populated.nickname = user.nickname;
        populated.department = user.department;
        populated.office = user.office;
        populated.phone = user.phone;
        populated.email = user.email;
      }
    } else {
      // ✅ ไม่เจอ user (ถูกลบแล้ว) → ค้นหาจาก DeletedUsers collection
      const DeletedUsers = (await import('@/models/DeletedUser')).default;
      const deletedUser = await DeletedUsers.findOne({ user_id: populated.userId }).select(
        'firstName lastName nickname department office phone email userType'
      );
      
      if (deletedUser) {
        // ✅ แยกการจัดการตามประเภทผู้ใช้
        if (deletedUser.userType === 'branch') {
          // ผู้ใช้สาขา: ข้อมูลส่วนตัวจากฟอร์ม, เฉพาะสาขาจาก DeletedUsers
          populated.firstName = populated.returnerFirstName || '-';
          populated.lastName = populated.returnerLastName || '-';
          populated.nickname = populated.returnerNickname || '-';
          populated.department = populated.returnerDepartment || '-';
          populated.phone = populated.returnerPhone || '-';        // จากฟอร์ม
          populated.email = populated.returnerEmail || '-';        // จากฟอร์ม
          // เฉพาะสาขาใช้จาก DeletedUsers (ข้อมูลล่าสุดก่อนลบ)
          populated.office = deletedUser.office || populated.returnerOffice || '-';
        } else {
          // ผู้ใช้บุคคล: ใช้ข้อมูลจาก DeletedUsers เป็นหลัก (ข้อมูลล่าสุดก่อนลบ)
          populated.firstName = deletedUser.firstName ?? populated.returnerFirstName ?? '-';
          populated.lastName = deletedUser.lastName ?? populated.returnerLastName ?? '-';
          populated.nickname = deletedUser.nickname ?? populated.returnerNickname ?? '-';
          populated.department = deletedUser.department ?? populated.returnerDepartment ?? '-';
          populated.office = deletedUser.office ?? populated.returnerOffice ?? '-';
          populated.phone = deletedUser.phone ?? populated.returnerPhone ?? '-';
          populated.email = deletedUser.email ?? '-';
        }
      } else {
        // ✅ Fallback: ใช้ snapshot จากฟอร์ม
        populated.firstName = populated.returnerFirstName || '-';
        populated.lastName = populated.returnerLastName || '-';
        populated.nickname = populated.returnerNickname || '-';
        populated.department = populated.returnerDepartment || '-';
        populated.office = populated.returnerOffice || '-';
        populated.phone = populated.returnerPhone || '-';
      }
    }
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

