import { getStatusName, getConditionName, getUserName } from '@/lib/equipment-snapshot-helpers';

/**
 * =========================================
 * POPULATE FUNCTIONS สำหรับแสดงผล
 * =========================================
 */

/**
 * Populate RequestLog items ให้มีชื่อสถานะและสภาพ
 * และชื่อ Admin ผู้อนุมัติ/ปฏิเสธ
 */
export async function populateRequestLogItems(requestLog: any) {
  if (!requestLog) return requestLog;
  
  const populated = requestLog.toObject ? requestLog.toObject() : requestLog;
  
  // Populate แต่ละ item (ถ้ามี)
  if (populated.items) {
    for (const item of populated.items) {
      // Populate status name (ถ้ามี statusOnRequest)
      if (item.statusOnRequest && !item.statusOnRequestName) {
        item.statusOnRequestName = await getStatusName(item.statusOnRequest);
      }
      
      // Populate condition name (ถ้ามี conditionOnRequest)
      if (item.conditionOnRequest && !item.conditionOnRequestName) {
        item.conditionOnRequestName = await getConditionName(item.conditionOnRequest);
      }
    }
  }
  
  // Populate approvedByName (ถ้ามี approvedBy)
  if (populated.approvedBy && !populated.approvedByName) {
    populated.approvedByName = await getUserName(populated.approvedBy);
  }
  
  // Populate rejectedByName (ถ้ามี rejectedBy)
  if (populated.rejectedBy && !populated.rejectedByName) {
    populated.rejectedByName = await getUserName(populated.rejectedBy);
  }
  
  return populated;
}

/**
 * Populate ReturnLog items ให้มีชื่อสถานะและสภาพ และชื่อ Admin ผู้อนุมัติ
 */
export async function populateReturnLogItems(returnLog: any) {
  if (!returnLog || !returnLog.items) return returnLog;
  
  const populated = returnLog.toObject ? returnLog.toObject() : returnLog;
  
  // Populate แต่ละ item
  for (const item of populated.items) {
    // Populate status name (ถ้ามี statusOnReturn)
    if (item.statusOnReturn && !item.statusOnReturnName) {
      item.statusOnReturnName = await getStatusName(item.statusOnReturn);
    }
    
    // Populate condition name (ถ้ามี conditionOnReturn)
    if (item.conditionOnReturn && !item.conditionOnReturnName) {
      item.conditionOnReturnName = await getConditionName(item.conditionOnReturn);
    }
    
    // Populate approvedBy name (ถ้ามี approvedBy)
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

