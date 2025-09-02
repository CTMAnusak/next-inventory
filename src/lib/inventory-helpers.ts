/**
 * Helper functions for the new inventory system
 * These functions provide common operations for InventoryItem, InventoryMaster, and TransferLog
 */

import InventoryItem from '../models/InventoryItem';
import InventoryMaster from '../models/InventoryMaster';
import TransferLog from '../models/TransferLog';
import dbConnect from './mongodb';

// Types
export interface CreateItemParams {
  itemName: string;
  category: string;
  serialNumber?: string;
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
  const {
    itemName,
    category,
    serialNumber,
    status = 'active',
    addedBy,
    addedByUserId,
    initialOwnerType,
    userId,
    assignedBy,
    notes
  } = params;

  // Application-level validation: ตรวจสอบ serialNumber ที่ซ้ำ (เฉพาะเมื่อมี SN)
  if (serialNumber && serialNumber.trim() !== '') {
    const trimmedSerialNumber = serialNumber.trim();
    const existingItem = await InventoryItem.findOne({ 
      serialNumber: trimmedSerialNumber,
      status: { $ne: 'deleted' } // ยกเว้นรายการที่ถูกลบแล้ว
    });
    
    if (existingItem) {
      throw new Error(`Serial Number "${trimmedSerialNumber}" already exists for item: ${existingItem.itemName}`);
    }
  }

  // Validate parameters
  if (addedBy === 'user' && !addedByUserId) {
    throw new Error('User-added items must have addedByUserId');
  }

  if (initialOwnerType === 'user_owned' && !userId) {
    throw new Error('User-owned items must have userId');
  }

  // Create InventoryItem - ทำความสะอาด serialNumber
  const cleanSerialNumber = serialNumber && serialNumber.trim() !== '' ? serialNumber.trim() : undefined;
  
  const newItem = new InventoryItem({
    itemName,
    category,
    serialNumber: cleanSerialNumber,
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

  const savedItem = await newItem.save();

  // Update InventoryMaster
  await updateInventoryMaster(itemName, category);

  // Create TransferLog
  await TransferLog.create({
    itemId: savedItem._id.toString(),
    itemName,
    category,
    serialNumber,
    transferType: addedBy === 'user' ? 'user_report' : 'admin_add',
    fromOwnership: {
      ownerType: 'new_item'
    },
    toOwnership: {
      ownerType: initialOwnerType,
      userId: userId
    },
    transferDate: new Date(),
    processedBy: addedByUserId || assignedBy || 'system',
    reason: notes || (addedBy === 'user' ? 'User reported existing equipment' : 'Admin added new equipment')
  });

  return savedItem;
}

/**
 * โอนย้าย InventoryItem จาก owner หนึ่งไปอีก owner หนึ่ง
 */
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

  // Find the item
  const item = await InventoryItem.findById(itemId);
  if (!item) {
    throw new Error(`InventoryItem not found: ${itemId}`);
  }

  // Validate current ownership
  if (item.currentOwnership.ownerType !== fromOwnerType) {
    throw new Error(`Item ownership mismatch. Expected: ${fromOwnerType}, Actual: ${item.currentOwnership.ownerType}`);
  }

  if (fromOwnerType === 'user_owned' && item.currentOwnership.userId !== fromUserId) {
    throw new Error(`Item user mismatch. Expected: ${fromUserId}, Actual: ${item.currentOwnership.userId}`);
  }

  // Store old ownership for logging
  const oldOwnership = { ...item.currentOwnership };

  // Update ownership
  item.currentOwnership = {
    ownerType: toOwnerType,
    userId: toUserId,
    ownedSince: new Date(),
    assignedBy: toOwnerType === 'user_owned' ? processedBy : undefined
  };

  // Add transfer info
  item.transferInfo = {
    transferredFrom: fromOwnerType,
    transferDate: new Date(),
    approvedBy: processedBy,
    requestId,
    returnId
  };

  const savedItem = await item.save();

  // Update InventoryMaster quantities
  await updateInventoryMaster(item.itemName, item.category);

  // Create TransferLog
  await TransferLog.create({
    itemId: savedItem._id.toString(),
    itemName: savedItem.itemName,
    category: savedItem.category,
    serialNumber: savedItem.serialNumber,
    transferType,
    fromOwnership: {
      ownerType: fromOwnerType,
      userId: fromUserId
    },
    toOwnership: {
      ownerType: toOwnerType,
      userId: toUserId
    },
    transferDate: new Date(),
    processedBy,
    requestId,
    returnId,
    reason
  });

  return savedItem;
}

/**
 * หา InventoryItem ที่ว่างสำหรับการเบิก
 */
export async function findAvailableItems(itemName: string, category: string, quantity: number = 1) {
  return await InventoryItem.find({
    itemName,
    category,
    'currentOwnership.ownerType': 'admin_stock',
    status: 'active'
  }).limit(quantity);
}

/**
 * หา InventoryItem ที่ user เป็นเจ้าของ
 */
export async function findUserOwnedItems(userId: string) {
  return await InventoryItem.find({
    'currentOwnership.ownerType': 'user_owned',
    'currentOwnership.userId': userId,
    status: { $ne: 'retired' }
  }).sort({ 'currentOwnership.ownedSince': -1 });
}

/**
 * หา InventoryItem ด้วย Serial Number
 */
export async function findItemBySerialNumber(serialNumber: string) {
  return await InventoryItem.findOne({ serialNumber });
}

/**
 * อัปเดต InventoryMaster summary สำหรับ item ทั้งหมด
 */
export async function refreshAllMasterSummaries() {
  const combinations = await InventoryItem.aggregate([
    {
      $group: {
        _id: {
          itemName: '$itemName',
          category: '$category'
        }
      }
    }
  ]);

  const results = [];
  for (const combo of combinations) {
    const result = await InventoryMaster.updateSummary(combo._id.itemName, combo._id.category);
    results.push(result);
  }

  return results;
}

/**
 * อัปเดต InventoryMaster สำหรับ item เดียว
 */
export async function updateInventoryMaster(itemName: string, category: string) {
  const updatedMaster = await InventoryMaster.updateSummary(itemName, category);
  
  // Initialize stock management if not exists
  if (!updatedMaster.stockManagement) {
    updatedMaster.stockManagement = {
      adminDefinedStock: 0,
      userContributedCount: 0,
      currentlyAllocated: 0,
      realAvailable: 0
    };
  }
  
  // Count user-contributed items (items added by users initially)
  const userContributedItems = await InventoryItem.find({
    itemName,
    category,
    'sourceInfo.addedBy': 'user'
  });
  
  updatedMaster.stockManagement.userContributedCount = userContributedItems.length;
  
  // Calculate currently allocated (items transferred from admin_stock to user_owned)
  const allocatedItems = await InventoryItem.find({
    itemName,
    category,
    'currentOwnership.ownerType': 'user_owned',
    'sourceInfo.addedBy': 'admin' // Only count admin-added items that are now with users
  });
  
  updatedMaster.stockManagement.currentlyAllocated = allocatedItems.length;
  
  // 🆕 Enhanced Auto-detect admin stock with comprehensive checks
  // Check actual admin items in stock vs recorded adminDefinedStock
  const actualAdminStockItems = await InventoryItem.find({
    itemName,
    category,
    'sourceInfo.addedBy': 'admin',
    'currentOwnership.ownerType': 'admin_stock'
  });
  
  const actualAdminStockCount = actualAdminStockItems.length;
  const recordedAdminStock = updatedMaster.stockManagement.adminDefinedStock;
  
  const shouldRunAutoDetection = (
    (recordedAdminStock === 0 && actualAdminStockCount > 0) ||  // No record but items exist
    (recordedAdminStock !== actualAdminStockCount)              // Mismatch between recorded and actual
  );
  
  console.log(`🔍 Auto-detection check for ${itemName} (${category}):`, {
    actualItemsInStock: actualAdminStockCount,
    recordedAdminStock: recordedAdminStock,
    hasOperations: updatedMaster.adminStockOperations?.length > 0,
    shouldRun: shouldRunAutoDetection
  });
  
  if (shouldRunAutoDetection) {
    console.log(`📊 Running auto-detection/correction for ${itemName}...`);
    console.log(`🔄 Correcting adminDefinedStock from ${recordedAdminStock} to ${actualAdminStockCount}`);
    
    // Set adminDefinedStock to match actual items in stock
    updatedMaster.stockManagement.adminDefinedStock = actualAdminStockCount;
    
    // Create correction operation log
    if (!updatedMaster.adminStockOperations) {
      updatedMaster.adminStockOperations = [];
    }
    
    const operationType = recordedAdminStock === 0 ? 'initial_stock' : 'adjust_stock';
    const reason = recordedAdminStock === 0 
      ? `ตรวจพบอุปกรณ์ที่ Admin เคยเพิ่มไว้ ${actualAdminStockCount} ชิ้น (Auto-detection)`
      : `แก้ไขข้อมูลให้ตรงกับจำนวนจริงใน stock: ${recordedAdminStock} → ${actualAdminStockCount} (Auto-correction)`;
    
    updatedMaster.adminStockOperations.push({
      date: new Date(),
      adminId: 'system',
      adminName: 'System Auto-Detection',
      operationType: operationType,
      previousStock: recordedAdminStock,
      newStock: actualAdminStockCount,
      adjustmentAmount: actualAdminStockCount - recordedAdminStock,
      reason: reason
    });
    
    console.log(`✅ Auto-corrected admin stock for ${itemName}: ${recordedAdminStock} → ${actualAdminStockCount}`);
  }
  
  // realAvailable will be auto-calculated in pre-save hook
  await updatedMaster.save();
  
  return updatedMaster;
}

/**
 * Helper functions สำหรับ Admin Stock Management
 */
export async function setAdminStock(itemName: string, category: string, newStock: number, reason: string, adminId: string, adminName: string) {
  return await InventoryMaster.setAdminStock(itemName, category, newStock, reason, adminId, adminName);
}

export async function adjustAdminStock(itemName: string, category: string, adjustment: number, reason: string, adminId: string, adminName: string) {
  return await InventoryMaster.adjustAdminStock(itemName, category, adjustment, reason, adminId, adminName);
}

export async function getAdminStockInfo(itemName: string, category: string) {
  // 🆕 EXACT SAME CODE AS INVENTORY TABLE: Use InventoryMaster.find() directly
  await dbConnect();
  
  // Find the specific item (same as Inventory Table logic)
  const item = await InventoryMaster.findOne({ itemName, category });
  
  if (!item) {
    throw new Error(`ไม่พบรายการ ${itemName} ในหมวดหมู่ ${category}`);
  }
  
  // 🆕 Get detailed breakdown of items with and without serial numbers in admin_stock
  const adminStockItems = await InventoryItem.find({
    itemName,
    category,
    'currentOwnership.ownerType': 'admin_stock'
  });
  
  // Count items with and without serial numbers in admin_stock
  const adminItemsWithSN = adminStockItems.filter(item => item.serialNumber && item.serialNumber.trim() !== '');
  const adminItemsWithoutSN = adminStockItems.filter(item => !item.serialNumber || item.serialNumber.trim() === '');
  
  console.log(`📊 Stock Info - Detailed breakdown for ${itemName}:`, {
    totalQuantity: item.totalQuantity,
    availableQuantity: item.availableQuantity,
    userOwnedQuantity: item.userOwnedQuantity,
    adminItemsWithSN: adminItemsWithSN.length,
    adminItemsWithoutSN: adminItemsWithoutSN.length,
    totalAdminItems: adminStockItems.length
  });
  
  // For Stock Modal display purposes:
  // - "Admin ตั้งไว้" = adminItemsWithoutSN (เฉพาะที่ไม่มี SN)
  // - "User เพิ่มมา" = userOwnedQuantity (items with users) 
  // - "รวมทั้งหมด" = totalQuantity (same as table)
  
  return {
    itemName: item.itemName,
    category: item.category,
    stockManagement: {
      adminDefinedStock: adminItemsWithoutSN.length,            // 🔧 FIXED: Only items without SN in admin_stock
      userContributedCount: item.userOwnedQuantity,             // Items with users
      currentlyAllocated: item.userOwnedQuantity,               // Items with users
      realAvailable: adminItemsWithoutSN.length                 // 🔧 FIXED: Only items without SN available for adjustment
    },
    adminStockOperations: item.adminStockOperations || [],
    currentStats: {
      totalQuantity: item.totalQuantity,                        // EXACTLY same as Inventory Table
      availableQuantity: item.availableQuantity,                // EXACTLY same as Inventory Table  
      userOwnedQuantity: item.userOwnedQuantity,                // EXACTLY same as Inventory Table
      // 🆕 NEW: Add breakdown for frontend
      adminItemsWithSN: adminItemsWithSN.length,                // Items with SN in admin_stock
      adminItemsWithoutSN: adminItemsWithoutSN.length           // Items without SN in admin_stock
    }
  };
}



/**
 * ดูประวัติการ transfer ของ item
 */
export async function getItemTransferHistory(itemId: string) {
  return await TransferLog.find({ itemId }).sort({ transferDate: -1 });
}

/**
 * 🆕 Sync InventoryItem records to match adminDefinedStock
 * Create or remove admin-added items as needed
 */
export async function syncAdminStockItems(itemName: string, category: string, targetAdminStock: number, reason: string, adminId: string) {
  console.log(`🔄 Syncing admin stock items for ${itemName}: target = ${targetAdminStock}`);
  
  // Get current admin-added items in admin_stock
  const currentAdminItems = await InventoryItem.find({
    itemName,
    category,
    'sourceInfo.addedBy': 'admin',
    'currentOwnership.ownerType': 'admin_stock'
  });
  
  const currentCount = currentAdminItems.length;
  console.log(`📊 Current admin items in stock: ${currentCount}, target: ${targetAdminStock}`);
  
  if (currentCount < targetAdminStock) {
    // Need to create more items
    const itemsToCreate = targetAdminStock - currentCount;
    console.log(`➕ Creating ${itemsToCreate} new admin items`);
    
    for (let i = 0; i < itemsToCreate; i++) {
      await createInventoryItem({
        itemName,
        category,
        addedBy: 'admin',
        initialOwnerType: 'admin_stock',
        notes: `${reason} (Auto-created ${i + 1}/${itemsToCreate})`
      });
    }
  } else if (currentCount > targetAdminStock) {
    // Need to remove items
    const itemsToRemove = currentCount - targetAdminStock;
    console.log(`➖ Need to remove ${itemsToRemove} admin items`);
    
    // 🆕 NEW LOGIC: Remove items WITHOUT serial numbers first
    // Separate items by serial number presence
    const itemsWithoutSN = currentAdminItems.filter(item => !item.serialNumber);
    const itemsWithSN = currentAdminItems.filter(item => item.serialNumber);
    
    console.log(`📊 Current breakdown: ${itemsWithoutSN.length} without SN, ${itemsWithSN.length} with SN`);
    
    // 🔍 VALIDATION: Check if we can remove the required amount without touching SN items
    if (itemsToRemove > itemsWithoutSN.length) {
      const shortfall = itemsToRemove - itemsWithoutSN.length;
      console.error(`❌ Cannot reduce stock: Need to remove ${itemsToRemove} items, but only ${itemsWithoutSN.length} items without SN available. Would need to remove ${shortfall} items with SN.`);
      throw new Error(`ไม่สามารถลดจำนวนได้ มีรายการที่ไม่มี Serial Number เพียง ${itemsWithoutSN.length} รายการ แต่ต้องลบ ${itemsToRemove} รายการ จะต้องลบรายการที่มี Serial Number ${shortfall} รายการ กรุณาใช้ฟังก์ชั่น "แก้ไขรายการ" เพื่อลบรายการที่มี Serial Number แบบ Manual เท่านั้น`);
    }
    
    // ✅ SAFE TO REMOVE: Only remove items without SN (newest first within this group)
    const itemsToDelete = itemsWithoutSN
      .sort((a, b) => new Date(b.sourceInfo.dateAdded).getTime() - new Date(a.sourceInfo.dateAdded).getTime())
      .slice(0, itemsToRemove);
    
    console.log(`✅ Will remove ${itemsToDelete.length} items without SN (preserving all ${itemsWithSN.length} items with SN)`);
    
    for (const item of itemsToDelete) {
      // Delete the item first
      await InventoryItem.findByIdAndDelete(item._id);
      
      // Create transfer log for deletion using valid enum values
      await TransferLog.create({
        itemId: item._id.toString(),
        itemName,
        category,
        serialNumber: item.serialNumber || 'No SN',
        transferType: 'ownership_change',                    // ✅ Valid enum value
        fromOwnership: { 
          ownerType: 'admin_stock'                           // ✅ Valid enum value
        },
        toOwnership: { 
          ownerType: 'admin_stock'                           // ✅ Valid enum value (indicating removal from stock)
        },
        processedBy: adminId,
        reason: `${reason} (Stock adjustment - item removed)`,
        notes: `Admin stock reduced by removing item from inventory`
      });
    }
  }
  
  console.log(`✅ Admin stock sync completed: ${currentCount} → ${targetAdminStock}`);
}

/**
 * ดูประวัติการ transfer ของ user
 */
export async function getUserTransferHistory(userId: string, limit: number = 50) {
  return await TransferLog.find({
    $or: [
      { 'fromOwnership.userId': userId },
      { 'toOwnership.userId': userId }
    ]
  })
  .sort({ transferDate: -1 })
  .limit(limit);
}

/**
 * เปลี่ยนสถานะของ InventoryItem
 */
export async function changeItemStatus(
  itemId: string, 
  newStatus: 'active' | 'maintenance' | 'damaged' | 'retired',
  changedBy: string,
  reason?: string
) {
  const item = await InventoryItem.findById(itemId);
  if (!item) {
    throw new Error(`InventoryItem not found: ${itemId}`);
  }

  const oldStatus = item.status;
  item.status = newStatus;
  const savedItem = await item.save();

  // Update InventoryMaster
  await updateInventoryMaster(item.itemName, item.category);

  // Log the status change
  await TransferLog.create({
    itemId: savedItem._id.toString(),
    itemName: savedItem.itemName,
    category: savedItem.category,
    serialNumber: savedItem.serialNumber,
    transferType: 'status_change',
    fromOwnership: {
      ownerType: item.currentOwnership.ownerType,
      userId: item.currentOwnership.userId
    },
    toOwnership: {
      ownerType: item.currentOwnership.ownerType,
      userId: item.currentOwnership.userId
    },
    transferDate: new Date(),
    processedBy: changedBy,
    reason: reason || `Status changed from ${oldStatus} to ${newStatus}`,
    statusChange: {
      fromStatus: oldStatus,
      toStatus: newStatus
    }
  });

  return savedItem;
}

/**
 * ลบ InventoryItem (soft delete)
 */
export async function retireInventoryItem(itemId: string, retiredBy: string, reason?: string) {
  return await changeItemStatus(itemId, 'retired', retiredBy, reason || 'Item retired from inventory');
}
