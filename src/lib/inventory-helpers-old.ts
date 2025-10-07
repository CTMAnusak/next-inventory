/**
 * Helper functions for the new inventory system
 * These functions provide common operations for InventoryItem, InventoryMaster, and TransferLog
 */

import InventoryItem from '../models/InventoryItem';
import InventoryMaster from '../models/InventoryMaster';
import TransferLog from '../models/TransferLog';
import dbConnect from './mongodb';
import { isSIMCardSync } from './sim-card-helpers';

// Types
export interface CreateItemParams {
  itemName: string;
  categoryId: string; // ใช้ categoryId เป็นหลัก
  serialNumber?: string;
  numberPhone?: string;
  status?: 'active' | 'maintenance' | 'damaged' | 'retired';
  addedBy: 'admin' | 'user';
  addedByUserId?: string;
  initialOwnerType: 'admin_stock' | 'user_owned';
  userId?: string;
  assignedBy?: string;
  notes?: string;
}

export interface TransferItemParams {
  itemId: string;
  fromOwnerType: 'admin_stock' | 'user_owned';
  fromUserId?: string;
  toOwnerType: 'admin_stock' | 'user_owned';
  toUserId?: string;
  transferType: 'user_report' | 'admin_add' | 'request_approved' | 'return_completed' | 'status_change' | 'ownership_change';
  processedBy: string;
  requestId?: string;
  returnId?: string;
  reason?: string;
}

/**
 * สร้าง InventoryItem ใหม่และอัปเดต InventoryMaster
 */
export async function createInventoryItem(params: CreateItemParams) {
  try {
    await dbConnect();
  } catch (dbError) {
    console.error('❌ Database connection failed:', dbError);
    throw new Error(`Database connection failed: ${dbError}`);
  }
  
  const {
    itemName,
    categoryId,
    serialNumber,
    numberPhone,
    status = 'active',
    addedBy,
    addedByUserId,
    initialOwnerType,
    userId,
    assignedBy,
    notes
  } = params;
  
  const finalCategory = categoryId;

  // Enhanced Item Name validation - check for duplicates in recycle bin
  if (itemName && itemName.trim() !== '') {
    const { checkItemNameInRecycleBin } = await import('./recycle-bin-helpers');
    const recycleBinItem = await checkItemNameInRecycleBin(itemName.trim(), finalCategory);
    if (recycleBinItem) {
      throw new Error(`เพิ่มรายการไม่ได้เพราะชื่อซ้ำกับในถังขยะ: "${itemName.trim()}" (รอกู้คืนใน 30 วัน)`);
    }
  }

  // Enhanced Serial Number validation with Recycle Bin check - allow duplicates across different categories
  if (serialNumber && serialNumber.trim() !== '') {
    const trimmedSerialNumber = serialNumber.trim();
    const existingActiveItem = await InventoryItem.findOne({ 
      serialNumber: trimmedSerialNumber,
      categoryId: finalCategory,
      status: { $ne: 'deleted' }
    });
    if (existingActiveItem) {
      throw new Error(`ACTIVE_SN_EXISTS:Serial Number "${trimmedSerialNumber}" already exists in this category for item: ${existingActiveItem.itemName}`);
    }
    const { checkSerialNumberInRecycleBin } = await import('./recycle-bin-helpers');
    const recycleBinItem = await checkSerialNumberInRecycleBin(trimmedSerialNumber);
    if (recycleBinItem) {
      throw new Error(`RECYCLE_SN_EXISTS:Serial Number "${trimmedSerialNumber}" exists in recycle bin for item: ${recycleBinItem.itemName}`);
    }
  }

  // Enhanced Phone Number validation for SIM cards
  if (numberPhone && numberPhone.trim() !== '' && isSIMCardSync(categoryId)) {
    const trimmedNumberPhone = numberPhone.trim();
    const existingPhoneItem = await InventoryItem.findOne({ 
      numberPhone: trimmedNumberPhone,
      categoryId: 'cat_sim_card',
      statusId: { $ne: 'deleted' }
    });
    if (existingPhoneItem) {
      throw new Error(`ACTIVE_PHONE_EXISTS:Phone Number "${trimmedNumberPhone}" already exists for SIM card: ${existingPhoneItem.itemName}`);
    }
    const { checkPhoneNumberInRecycleBin } = await import('./recycle-bin-helpers');
    const recycleBinPhoneItem = await checkPhoneNumberInRecycleBin(trimmedNumberPhone);
    if (recycleBinPhoneItem) {
      throw new Error(`RECYCLE_PHONE_EXISTS:Phone Number "${trimmedNumberPhone}" exists in recycle bin for SIM card: ${recycleBinPhoneItem.itemName}`);
    }
  }

  if (addedBy === 'user' && !addedByUserId) {
    throw new Error('User-added items must have addedByUserId');
  }
  if (initialOwnerType === 'user_owned' && !userId) {
    throw new Error('User-owned items must have userId');
  }

  const cleanSerialNumber = serialNumber && serialNumber.trim() !== '' ? serialNumber.trim() : undefined;
  const cleanNumberPhone = numberPhone && numberPhone.trim() !== '' ? numberPhone.trim() : undefined;

  const newItem = new InventoryItem({
    itemName,
    categoryId: finalCategory,
    serialNumber: cleanSerialNumber,
    numberPhone: cleanNumberPhone,
    status,
    currentOwnership: {
      ownerType: initialOwnerType,
      userId: userId,
      ownedSince: new Date(),
      assignedBy: assignedBy
    },
    sourceInfo: {
      addedBy,
      addedByUserId,
      dateAdded: new Date(),
      initialOwnerType,
      acquisitionMethod: addedBy === 'user' ? 'self_reported' : 'admin_purchased',
      notes
    }
  });

  try {
    const savedItem = await newItem.save();
    try {
      await updateInventoryMaster(itemName, finalCategory);
    } catch (masterError) {
      console.error('❌ Failed to update InventoryMaster:', masterError);
    }
    try {
      await TransferLog.create({
        itemId: (savedItem._id as any).toString(),
        itemName,
        categoryId,
        serialNumber: cleanSerialNumber,
        numberPhone: cleanNumberPhone,
        transferType: addedBy === 'user' ? 'user_report' : 'admin_add',
        fromOwnership: { ownerType: 'new_item' },
        toOwnership: { ownerType: initialOwnerType, userId: userId },
        transferDate: new Date(),
        processedBy: addedByUserId || assignedBy || 'system',
        reason: notes || (addedBy === 'user' ? 'User reported existing equipment' : 'Admin added new equipment')
      });
    } catch (logError) {
      console.error('❌ Failed to create TransferLog:', logError);
    }
    return savedItem;
  } catch (saveError) {
    console.error('❌ Failed to save InventoryItem to database:', saveError);
    throw new Error(`Failed to save to database: ${saveError}`);
  }
}

export async function transferInventoryItem(params: TransferItemParams) {
  const {
    itemId,
    fromOwnerType,
    fromUserId,
    toOwnerType,
    toUserId,
    transferType,
    processedBy,
    requestId,
    returnId,
    reason
  } = params;

  const item = await InventoryItem.findById(itemId);
  if (!item) {
    throw new Error(`InventoryItem not found: ${itemId}`);
  }
  if (item.currentOwnership.ownerType !== fromOwnerType) {
    throw new Error(`Item ownership mismatch. Expected: ${fromOwnerType}, Actual: ${item.currentOwnership.ownerType}`);
  }
  if (fromOwnerType === 'user_owned' && item.currentOwnership.userId !== fromUserId) {
    throw new Error(`Item user mismatch. Expected: ${fromUserId}, Actual: ${item.currentOwnership.userId}`);
  }

  const oldOwnership = { ...item.currentOwnership };

  item.currentOwnership = {
    ownerType: toOwnerType,
    userId: toUserId,
    ownedSince: new Date(),
    assignedBy: toOwnerType === 'user_owned' ? processedBy : undefined
  };

  item.transferInfo = {
    transferredFrom: fromOwnerType,
    transferDate: new Date(),
    approvedBy: processedBy,
    requestId,
    returnId
  };

  const savedItem = await item.save();
  await updateInventoryMaster(item.itemName, item.categoryId);
  await TransferLog.create({
    itemId: (savedItem._id as any).toString(),
    itemName: savedItem.itemName,
    categoryId: savedItem.categoryId,
    serialNumber: savedItem.serialNumber,
    transferType,
    fromOwnership: { ownerType: fromOwnerType, userId: fromUserId },
    toOwnership: { ownerType: toOwnerType, userId: toUserId },
    transferDate: new Date(),
    processedBy,
    requestId,
    returnId,
    reason
  });
  return savedItem;
}

export async function findAvailableItems(itemName: string, categoryId: string, quantity: number = 1) {
  return await InventoryItem.find({
    itemName,
    categoryId,
    'currentOwnership.ownerType': 'admin_stock',
    status: { $in: ['active', 'maintenance', 'damaged'] }
  }).limit(quantity);
}

export async function findUserOwnedItems(userId: string) {
  return await InventoryItem.find({
    'currentOwnership.ownerType': 'user_owned',
    'currentOwnership.userId': userId,
    status: { $ne: 'retired' }
  }).sort({ 'currentOwnership.ownedSince': -1 });
}

export async function findItemBySerialNumber(serialNumber: string) {
  return await InventoryItem.findOne({ serialNumber });
}

export async function refreshAllMasterSummaries() {
  const combinations = await InventoryItem.aggregate([
    { $group: { _id: { itemName: '$itemName', categoryId: '$categoryId' } } }
  ]);
  const results: any[] = [];
  for (const combo of combinations) {
    const result = await updateInventoryMaster(combo._id.itemName, combo._id.categoryId);
    results.push(result);
  }
  return results;
}

export async function updateInventoryMaster(itemName: string, categoryId: string, options: { skipAutoDetection?: boolean } = {}) {
  try {
    let updatedMaster = await InventoryMaster.findOne({ itemName, categoryId });
    if (!updatedMaster) {
      updatedMaster = new InventoryMaster({ itemName, categoryId, totalQuantity: 0, availableQuantity: 0, userOwnedQuantity: 0 });
    }
    const allItems = await InventoryItem.find({ itemName, categoryId, statusId: { $ne: 'deleted' } });
    const adminStockItems = allItems.filter(item => item.currentOwnership.ownerType === 'admin_stock');
    const userOwnedItems = allItems.filter(item => item.currentOwnership.ownerType === 'user_owned');
    updatedMaster.totalQuantity = allItems.length;
    updatedMaster.availableQuantity = adminStockItems.length;
    updatedMaster.userOwnedQuantity = userOwnedItems.length;
    if (!updatedMaster.stockManagement) {
      updatedMaster.stockManagement = { adminDefinedStock: 0, userContributedCount: 0, currentlyAllocated: 0, realAvailable: 0 } as any;
    }
    const userContributedItems = await InventoryItem.find({ itemName, categoryId, 'sourceInfo.addedBy': 'user' });
    updatedMaster.stockManagement.userContributedCount = userContributedItems.length;
    const allocatedItems = await InventoryItem.find({ itemName, categoryId, 'currentOwnership.ownerType': 'user_owned', 'sourceInfo.addedBy': 'admin' });
    updatedMaster.stockManagement.currentlyAllocated = allocatedItems.length;
    const actualAdminStockItems = await InventoryItem.find({ itemName, categoryId, 'sourceInfo.addedBy': 'admin', 'currentOwnership.ownerType': 'admin_stock', status: { $ne: 'deleted' } });
    const actualAdminStockCount = actualAdminStockItems.length;
    const recordedAdminStock = (updatedMaster.stockManagement as any).adminDefinedStock;
    const shouldRunAutoDetection = (recordedAdminStock === 0 && actualAdminStockCount > 0) || (recordedAdminStock !== actualAdminStockCount);
    if (!options.skipAutoDetection && shouldRunAutoDetection) {
      (updatedMaster.stockManagement as any).adminDefinedStock = actualAdminStockCount;
      if (!updatedMaster.adminStockOperations) updatedMaster.adminStockOperations = [] as any;
      const operationType = recordedAdminStock === 0 ? 'initial_stock' : 'adjust_stock';
      const reason = recordedAdminStock === 0 
        ? `ตรวจพบอุปกรณ์ที่ Admin เคยเพิ่มไว้ ${actualAdminStockCount} ชิ้น (Auto-detection)`
        : `แก้ไขข้อมูลให้ตรงกับจำนวนจริงใน stock: ${recordedAdminStock} → ${actualAdminStockCount} (Auto-correction)`;
      (updatedMaster.adminStockOperations as any).push({
        date: new Date(), adminId: 'system', adminName: 'System Auto-Detection', operationType, previousStock: recordedAdminStock, newStock: actualAdminStockCount, adjustmentAmount: actualAdminStockCount - recordedAdminStock, reason
      });
    }
    await updatedMaster.save();
    return updatedMaster;
  } catch (error) {
    console.error('❌ updateInventoryMaster failed:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
}

export async function setAdminStock(itemName: string, categoryId: string, newStock: number, reason: string, adminId: string, adminName: string) {
  const master = await InventoryMaster.findOne({ itemName, categoryId });
  if (!master) throw new Error(`InventoryMaster not found for ${itemName} in ${categoryId}`);
  if (!master.stockManagement) master.stockManagement = { adminDefinedStock: 0, userContributedCount: 0, currentlyAllocated: 0, realAvailable: 0 } as any;
  const previousStock = (master.stockManagement as any).adminDefinedStock;
  (master.stockManagement as any).adminDefinedStock = newStock;
  if (!master.adminStockOperations) master.adminStockOperations = [] as any;
  (master.adminStockOperations as any).push({ date: new Date(), adminId, adminName, operationType: 'set_stock', previousStock, newStock, adjustmentAmount: newStock - previousStock, reason });
  return await master.save();
}

export async function adjustAdminStock(itemName: string, categoryId: string, adjustment: number, reason: string, adminId: string, adminName: string) {
  const master = await InventoryMaster.findOne({ itemName, categoryId });
  if (!master) throw new Error(`InventoryMaster not found for ${itemName} in ${categoryId}`);
  if (!master.stockManagement) master.stockManagement = { adminDefinedStock: 0, userContributedCount: 0, currentlyAllocated: 0, realAvailable: 0 } as any;
  const previousStock = (master.stockManagement as any).adminDefinedStock;
  const newStock = previousStock + adjustment;
  (master.stockManagement as any).adminDefinedStock = newStock;
  if (!master.adminStockOperations) master.adminStockOperations = [] as any;
  (master.adminStockOperations as any).push({ date: new Date(), adminId, adminName, operationType: 'adjust_stock', previousStock, newStock, adjustmentAmount: adjustment, reason });
  return await master.save();
}

export async function getAdminStockInfo(itemName: string, categoryId: string) {
  await dbConnect();
  const item = await InventoryMaster.findOne({ itemName, categoryId });
  if (!item) throw new Error(`ไม่พบรายการ ${itemName} ในหมวดหมู่ ${categoryId}`);
  return {
    itemName: item.itemName,
    categoryId: item.categoryId,
    stockManagement: {
      adminDefinedStock: item.availableQuantity,
      userContributedCount: item.userOwnedQuantity,
      currentlyAllocated: item.userOwnedQuantity,
      realAvailable: item.availableQuantity
    },
    adminStockOperations: item.adminStockOperations || [],
    currentStats: {
      totalQuantity: item.totalQuantity,
      availableQuantity: item.availableQuantity,
      userOwnedQuantity: item.userOwnedQuantity
    }
  };
}

export async function getItemTransferHistory(itemId: string) {
  return await TransferLog.find({ itemId }).sort({ transferDate: -1 });
}

export async function syncAdminStockItems(itemName: string, categoryId: string, targetAdminStock: number, reason: string, adminId: string) {
  const currentAdminItems = await InventoryItem.find({ itemName, categoryId, 'currentOwnership.ownerType': 'admin_stock', status: { $ne: 'deleted' } });
  const itemsWithoutSN = currentAdminItems.filter(item => !item.serialNumber);
  const itemsWithSN = currentAdminItems.filter(item => item.serialNumber);
  if (itemsWithoutSN.length < targetAdminStock) {
    const itemsToCreate = targetAdminStock - itemsWithoutSN.length;
    for (let i = 0; i < itemsToCreate; i++) {
      await createInventoryItem({ itemName, categoryId, serialNumber: undefined, addedBy: 'admin', initialOwnerType: 'admin_stock', notes: `${reason} (Auto-created non-SN item ${i + 1}/${itemsToCreate})` });
    }
  } else if (itemsWithoutSN.length > targetAdminStock) {
    const itemsToRemove = itemsWithoutSN.length - targetAdminStock;
    const availableWorkingItems = itemsWithoutSN.filter(item => item.statusId === 'status_available' && item.conditionId === 'cond_working');
    if (availableWorkingItems.length < itemsToRemove) {
      throw new Error(`ไม่สามารถลดจำนวนได้ มีอุปกรณ์ที่สถานะ "มี" และสภาพ "ใช้งานได้" เพียง ${availableWorkingItems.length} ชิ้น แต่ต้องการลด ${itemsToRemove} ชิ้น`);
    }
    const itemsToDelete = availableWorkingItems
      .sort((a, b) => new Date(a.sourceInfo.dateAdded).getTime() - new Date(b.sourceInfo.dateAdded).getTime())
      .slice(0, itemsToRemove);
    for (const item of itemsToDelete) {
      await TransferLog.create({ itemId: (item._id as any).toString(), itemName, categoryId, serialNumber: item.serialNumber || 'No SN', transferType: 'ownership_change', fromOwnership: { ownerType: 'admin_stock' }, toOwnership: { ownerType: 'admin_stock' }, processedBy: adminId, reason: `${reason} (Stock adjustment - item permanently removed)`, notes: `Admin stock reduced by permanently removing non-SN item from inventory` });
      await InventoryItem.findByIdAndDelete(item._id);
    }
  }
}

export async function getUserTransferHistory(userId: string, limit: number = 50) {
  return await TransferLog.find({ $or: [ { 'fromOwnership.userId': userId }, { 'toOwnership.userId': userId } ] }).sort({ transferDate: -1 }).limit(limit);
}

export async function cleanupSoftDeletedItems(itemName?: string, categoryId?: string) {
  await dbConnect();
  const query: any = { status: 'deleted' };
  if (itemName && categoryId) { query.itemName = itemName; query.categoryId = categoryId; }
  const softDeletedItems = await InventoryItem.find(query);
  if (softDeletedItems.length === 0) return { cleaned: 0, message: 'No soft-deleted items found' };
  let cleanedCount = 0;
  for (const item of softDeletedItems) {
    try {
      await TransferLog.create({ itemId: (item._id as any).toString(), itemName: item.itemName, categoryId: item.categoryId, serialNumber: item.serialNumber || 'No SN', numberPhone: item.numberPhone || undefined, transferType: 'ownership_change', fromOwnership: { ownerType: 'admin_stock' }, toOwnership: { ownerType: 'admin_stock' }, processedBy: 'system_cleanup', reason: `Database cleanup - permanently removing soft-deleted item (originally deleted: ${item.deleteReason || 'Unknown reason'})`, notes: `System cleanup to fix count discrepancy - item was soft-deleted on ${item.deletedAt?.toISOString() || 'unknown date'}` });
    } catch {}
    await InventoryItem.findByIdAndDelete(item._id);
    cleanedCount++;
  }
  if (itemName && categoryId) {
    await updateInventoryMaster(itemName, categoryId);
  } else {
    const uniqueCombinations = [...new Set(softDeletedItems.map(item => `${item.itemName}|${item.categoryId}`))];
    for (const combo of uniqueCombinations) {
      const [name, cat] = combo.split('|');
      try { await updateInventoryMaster(name, cat); } catch {}
    }
  }
  return { cleaned: cleanedCount, message: `Successfully cleaned up ${cleanedCount} soft-deleted items` };
}

export async function changeItemStatus(
  itemId: string, 
  newStatus: 'active' | 'maintenance' | 'damaged' | 'retired',
  changedBy: string,
  reason?: string
) {
  const item = await InventoryItem.findById(itemId);
  if (!item) throw new Error(`InventoryItem not found: ${itemId}`);
  const oldStatus = item.statusId;
  item.statusId = newStatus;
  const savedItem = await item.save();
  await updateInventoryMaster(item.itemName, item.categoryId);
  await TransferLog.create({
    itemId: (savedItem._id as any).toString(),
    itemName: savedItem.itemName,
    categoryId: savedItem.categoryId,
    serialNumber: savedItem.serialNumber,
    transferType: 'status_change',
    fromOwnership: { ownerType: item.currentOwnership.ownerType, userId: item.currentOwnership.userId },
    toOwnership: { ownerType: item.currentOwnership.ownerType, userId: item.currentOwnership.userId },
    transferDate: new Date(),
    processedBy: changedBy,
    reason: reason || `Status changed from ${oldStatus} to ${newStatus}`,
    statusChange: { fromStatus: oldStatus, toStatus: newStatus }
  });
  return savedItem;
}

export async function retireInventoryItem(itemId: string, retiredBy: string, reason?: string) {
  return await changeItemStatus(itemId, 'retired', retiredBy, reason || 'Item retired from inventory');
}
