/**
 * Helper functions for the new inventory system
 * These functions provide common operations for InventoryItem, InventoryMaster, and TransferLog
 */

import InventoryItem from '../models/InventoryItem';
import InventoryMaster from '../models/InventoryMaster';
import TransferLog from '../models/TransferLog';
import dbConnect from './mongodb';
import { INVENTORY_CATEGORIES, isSIMCard } from './inventory-constants';

// Types
export interface CreateItemParams {
  itemName: string;
  category: string;
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
  console.log('🏗️ createInventoryItem called with:', JSON.stringify(params, null, 2));
  
  try {
    await dbConnect();
    console.log('✅ Database connected successfully');
  } catch (dbError) {
    console.error('❌ Database connection failed:', dbError);
    throw new Error(`Database connection failed: ${dbError}`);
  }
  
  const {
    itemName,
    category,
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

  // Enhanced Serial Number validation with Recycle Bin check
  if (serialNumber && serialNumber.trim() !== '') {
    const trimmedSerialNumber = serialNumber.trim();
    
    // Check if SN exists in active items
    const existingActiveItem = await InventoryItem.findOne({ 
      serialNumber: trimmedSerialNumber,
      status: { $ne: 'deleted' } // ยกเว้นรายการที่ถูกลบแล้ว
    });
    
    if (existingActiveItem) {
      throw new Error(`ACTIVE_SN_EXISTS:Serial Number "${trimmedSerialNumber}" already exists for item: ${existingActiveItem.itemName}`);
    }
    
    // Check if SN exists in recycle bin
    const { checkSerialNumberInRecycleBin } = await import('./recycle-bin-helpers');
    const recycleBinItem = await checkSerialNumberInRecycleBin(trimmedSerialNumber);
    
    if (recycleBinItem) {
      throw new Error(`RECYCLE_SN_EXISTS:Serial Number "${trimmedSerialNumber}" exists in recycle bin for item: ${recycleBinItem.itemName}`);
    }
  }

  // Enhanced Phone Number validation for SIM cards
  if (numberPhone && numberPhone.trim() !== '' && isSIMCard(category)) {
    console.log('📱 Validating phone number for SIM card:', numberPhone.trim());
    const trimmedNumberPhone = numberPhone.trim();
    
    try {
      // Check if phone number exists in active items
      const existingPhoneItem = await InventoryItem.findOne({ 
        numberPhone: trimmedNumberPhone,
        category: INVENTORY_CATEGORIES.SIM_CARD,
        status: { $ne: 'deleted' } // ยกเว้นรายการที่ถูกลบแล้ว
      });
      
      if (existingPhoneItem) {
        console.error('❌ Phone number already exists:', trimmedNumberPhone);
        throw new Error(`ACTIVE_PHONE_EXISTS:Phone Number "${trimmedNumberPhone}" already exists for SIM card: ${existingPhoneItem.itemName}`);
      }
      
      // Check if phone number exists in recycle bin
      const { checkPhoneNumberInRecycleBin } = await import('./recycle-bin-helpers');
      const recycleBinPhoneItem = await checkPhoneNumberInRecycleBin(trimmedNumberPhone);
      
      if (recycleBinPhoneItem) {
        throw new Error(`RECYCLE_PHONE_EXISTS:Phone Number "${trimmedNumberPhone}" exists in recycle bin for SIM card: ${recycleBinPhoneItem.itemName}`);
      }
      
      console.log('✅ Phone number validation passed');
    } catch (phoneError) {
      console.error('❌ Phone number validation error:', phoneError);
      throw phoneError;
    }
  }

  // Validate parameters
  if (addedBy === 'user' && !addedByUserId) {
    throw new Error('User-added items must have addedByUserId');
  }

  if (initialOwnerType === 'user_owned' && !userId) {
    throw new Error('User-owned items must have userId');
  }

  // Create InventoryItem - ทำความสะอาด serialNumber และ numberPhone
  const cleanSerialNumber = serialNumber && serialNumber.trim() !== '' ? serialNumber.trim() : undefined;
  const cleanNumberPhone = numberPhone && numberPhone.trim() !== '' ? numberPhone.trim() : undefined;
  
  console.log('🏗️ Creating new InventoryItem with data:', {
    itemName,
    category,
    serialNumber: cleanSerialNumber,
    numberPhone: cleanNumberPhone,
    status,
    initialOwnerType,
    addedBy
  });
  
  const newItem = new InventoryItem({
    itemName,
    category,
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
  
  console.log('✅ InventoryItem instance created successfully');

  console.log('💾 Saving InventoryItem to database...');
  try {
    const savedItem = await newItem.save();
    console.log('✅ InventoryItem saved successfully:', savedItem._id);

    // Update InventoryMaster
    console.log('📊 Updating InventoryMaster...');
    try {
      await updateInventoryMaster(itemName, category);
      console.log('✅ InventoryMaster updated successfully');
    } catch (masterError) {
      console.error('❌ Failed to update InventoryMaster:', masterError);
      // Don't throw here - item is already saved
    }

    // Create TransferLog
    console.log('📝 Creating TransferLog...');
    try {
      await TransferLog.create({
        itemId: (savedItem._id as any).toString(),
        itemName,
        category,
        serialNumber: cleanSerialNumber,
        numberPhone: cleanNumberPhone,
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
      console.log('✅ TransferLog created successfully');
    } catch (logError) {
      console.error('❌ Failed to create TransferLog:', logError);
      // Don't throw here - item is already saved
    }

    return savedItem;
  } catch (saveError) {
    console.error('❌ Failed to save InventoryItem to database:', saveError);
    throw new Error(`Failed to save to database: ${saveError}`);
  }
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
    itemId: (savedItem._id as any).toString(),
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
  // 🔧 CRITICAL FIX: Use consistent status filtering - allow active, maintenance, damaged but exclude deleted
  return await InventoryItem.find({
    itemName,
    category,
    'currentOwnership.ownerType': 'admin_stock',
    status: { $in: ['active', 'maintenance', 'damaged'] } // ✅ Exclude soft-deleted items
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
    const result = await updateInventoryMaster(combo._id.itemName, combo._id.category);
    results.push(result);
  }

  return results;
}

/**
 * อัปเดต InventoryMaster สำหรับ item เดียว
 */
export async function updateInventoryMaster(itemName: string, category: string, options: { skipAutoDetection?: boolean } = {}) {
  // Find or create the master record
  let updatedMaster = await InventoryMaster.findOne({ itemName, category });
  if (!updatedMaster) {
    updatedMaster = new InventoryMaster({ 
      itemName, 
      category,
      totalQuantity: 0,
      availableQuantity: 0,
      userOwnedQuantity: 0
    });
  }
  
  // Calculate quantities from actual InventoryItems
  const allItems = await InventoryItem.find({
    itemName,
    category,
    status: { $ne: 'deleted' }
  });
  
  const adminStockItems = allItems.filter(item => item.currentOwnership.ownerType === 'admin_stock');
  const userOwnedItems = allItems.filter(item => item.currentOwnership.ownerType === 'user_owned');
  
  updatedMaster.totalQuantity = allItems.length;
  updatedMaster.availableQuantity = adminStockItems.length;
  updatedMaster.userOwnedQuantity = userOwnedItems.length;
  
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
  // 🔧 CRITICAL FIX: Exclude deleted items from count
  const actualAdminStockItems = await InventoryItem.find({
    itemName,
    category,
    'sourceInfo.addedBy': 'admin',
    'currentOwnership.ownerType': 'admin_stock',
    status: { $ne: 'deleted' } // ✅ Exclude soft-deleted items
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
    shouldRun: shouldRunAutoDetection,
    excludedDeletedItems: true // ✅ Indicates we're properly filtering deleted items
  });
  
  if (options.skipAutoDetection) {
    console.log(`⚠️ Auto-detection skipped (restore operation)`);
    console.log(`📊 Current counts - Actual admin items: ${actualAdminStockCount}, Recorded: ${recordedAdminStock}`);
  } else if (shouldRunAutoDetection) {
    console.log(`📊 Running auto-detection/correction for ${itemName}...`);
    console.log(`🔄 Correcting adminDefinedStock from ${recordedAdminStock} to ${actualAdminStockCount}`);
    
    // Set adminDefinedStock to match actual items in stock
    updatedMaster.stockManagement.adminDefinedStock = actualAdminStockCount;
    
    // Create correction operation log
    if (!updatedMaster.adminStockOperations) {
      updatedMaster.adminStockOperations = [] as any;
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
  // Find the master record
  const master = await InventoryMaster.findOne({ itemName, category });
  if (!master) {
    throw new Error(`InventoryMaster not found for ${itemName} in ${category}`);
  }
  
  // Update admin stock
  if (!master.stockManagement) {
    master.stockManagement = {
      adminDefinedStock: 0,
      userContributedCount: 0,
      currentlyAllocated: 0,
      realAvailable: 0
    };
  }
  
  const previousStock = master.stockManagement.adminDefinedStock;
  master.stockManagement.adminDefinedStock = newStock;
  
  // Add operation log
  if (!master.adminStockOperations) {
    master.adminStockOperations = [] as any;
  }
  
  master.adminStockOperations.push({
    date: new Date(),
    adminId,
    adminName,
    operationType: 'set_stock',
    previousStock,
    newStock,
    adjustmentAmount: newStock - previousStock,
    reason
  });
  
  return await master.save();
}

export async function adjustAdminStock(itemName: string, category: string, adjustment: number, reason: string, adminId: string, adminName: string) {
  // Find the master record
  const master = await InventoryMaster.findOne({ itemName, category });
  if (!master) {
    throw new Error(`InventoryMaster not found for ${itemName} in ${category}`);
  }
  
  // Update admin stock
  if (!master.stockManagement) {
    master.stockManagement = {
      adminDefinedStock: 0,
      userContributedCount: 0,
      currentlyAllocated: 0,
      realAvailable: 0
    };
  }
  
  const previousStock = master.stockManagement.adminDefinedStock;
  const newStock = previousStock + adjustment;
  master.stockManagement.adminDefinedStock = newStock;
  
  // Add operation log
  if (!master.adminStockOperations) {
    master.adminStockOperations = [] as any;
  }
  
  master.adminStockOperations.push({
    date: new Date(),
    adminId,
    adminName,
    operationType: 'adjust_stock',
    previousStock,
    newStock,
    adjustmentAmount: adjustment,
    reason
  });
  
  return await master.save();
}

export async function getAdminStockInfo(itemName: string, category: string) {
  // 🆕 EXACT SAME CODE AS INVENTORY TABLE: Use InventoryMaster.find() directly
  await dbConnect();
  
  // Find the specific item (same as Inventory Table logic)
  const item = await InventoryMaster.findOne({ itemName, category });
  
  if (!item) {
    throw new Error(`ไม่พบรายการ ${itemName} ในหมวดหมู่ ${category}`);
  }
  
  // 🆕 EXACTLY SAME LOGIC AS INVENTORY TABLE: Use InventoryMaster fields directly
  console.log(`📊 Stock Info - Raw InventoryMaster data for ${itemName}:`, {
    totalQuantity: item.totalQuantity,        // Same as Inventory Table  
    availableQuantity: item.availableQuantity,// admin_stock items (จำนวนที่เหลือให้เบิก)
    userOwnedQuantity: item.userOwnedQuantity // user_owned items
  });
  
  // For Stock Modal display purposes:
  // - "Admin ตั้งไว้" = availableQuantity (items in admin_stock)
  // - "User เพิ่มมา" = userOwnedQuantity (items with users) 
  // - "รวมทั้งหมด" = totalQuantity (same as table)
  
  return {
    itemName: item.itemName,
    category: item.category,
    stockManagement: {
      adminDefinedStock: item.availableQuantity,                // Items in admin_stock  
      userContributedCount: item.userOwnedQuantity,             // Items with users
      currentlyAllocated: item.userOwnedQuantity,               // Items with users
      realAvailable: item.availableQuantity                     // Items in admin_stock
    },
    adminStockOperations: item.adminStockOperations || [],
    currentStats: {
      totalQuantity: item.totalQuantity,                        // EXACTLY same as Inventory Table
      availableQuantity: item.availableQuantity,                // EXACTLY same as Inventory Table  
      userOwnedQuantity: item.userOwnedQuantity                 // EXACTLY same as Inventory Table
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
 * 
 * 🔧 FIXED: targetAdminStock represents TOTAL desired non-SN items, not total items
 */
export async function syncAdminStockItems(itemName: string, category: string, targetAdminStock: number, reason: string, adminId: string) {
  console.log(`🔄 Syncing admin stock items for ${itemName}: target non-SN items = ${targetAdminStock}`);
  
  // Get current admin stock items (consistent with updateInventoryMaster counting)
  // 🔧 CRITICAL FIX: Count ALL admin stock items regardless of who added them originally
  const currentAdminItems = await InventoryItem.find({
    itemName,
    category,
    'currentOwnership.ownerType': 'admin_stock',
    status: { $ne: 'deleted' } // ✅ Exclude soft-deleted items (consistent with updateInventoryMaster)
  });
  
  // 🔧 FIXED: targetAdminStock represents desired NON-SN items only
  // SN items are NOT affected by stock adjustment
  const itemsWithoutSN = currentAdminItems.filter(item => !item.serialNumber);
  const itemsWithSN = currentAdminItems.filter(item => item.serialNumber);
  
  const currentTotalCount = currentAdminItems.length; // Total items (with + without SN)
  const currentWithoutSNCount = itemsWithoutSN.length;
  const currentWithSNCount = itemsWithSN.length;
  
  console.log(`📊 Current admin items breakdown: ${currentWithoutSNCount} without SN, ${currentWithSNCount} with SN, ${currentTotalCount} total`);
  console.log(`🎯 Target non-SN items: ${targetAdminStock}, Current non-SN: ${currentWithoutSNCount} (SN items preserved: ${currentWithSNCount})`);
  
  // Debug: Log each item for verification
  console.log(`🔍 Current admin items breakdown:`);
  currentAdminItems.forEach((item, index) => {
    console.log(`  ${index + 1}. ID: ${item._id}, Status: ${item.status}, SN: ${item.serialNumber || 'No SN'}`);
  });
  
  if (currentWithoutSNCount < targetAdminStock) {
    // Need to create more items WITHOUT serial numbers
    const itemsToCreate = targetAdminStock - currentWithoutSNCount;
    console.log(`➕ Creating ${itemsToCreate} new non-SN admin items`);
    
    for (let i = 0; i < itemsToCreate; i++) {
      console.log(`➕ Creating non-SN item ${i + 1}/${itemsToCreate}...`);
      const newItem = await createInventoryItem({
        itemName,
        category,
        // ✅ Explicitly NO serialNumber for admin stock adjustment
        serialNumber: undefined,
        addedBy: 'admin',
        initialOwnerType: 'admin_stock',
        notes: `${reason} (Auto-created non-SN item ${i + 1}/${itemsToCreate})`
      });
      console.log(`✅ Created non-SN item: ${newItem._id}`);
    }
  } else if (currentWithoutSNCount > targetAdminStock) {
    // Need to remove items WITHOUT serial numbers only
    const itemsToRemove = currentWithoutSNCount - targetAdminStock;
    console.log(`➖ Need to remove ${itemsToRemove} non-SN admin items (preserving all SN items)`);
    
    console.log(`📊 Current breakdown: ${currentWithoutSNCount} without SN, ${currentWithSNCount} with SN`);
    
    // ✅ SAFE TO REMOVE: Only remove items without SN (newest first)
    const itemsToDelete = itemsWithoutSN
      .sort((a, b) => new Date(b.sourceInfo.dateAdded).getTime() - new Date(a.sourceInfo.dateAdded).getTime())
      .slice(0, itemsToRemove);
    
    console.log(`✅ Will remove ${itemsToDelete.length} non-SN items (preserving all ${currentWithSNCount} items with SN)`);
    
    for (const item of itemsToDelete) {
      // 🔧 CRITICAL FIX: Use hard delete for non-SN items to prevent count discrepancy
      // Only non-SN items should be deleted during stock adjustment
      console.log(`🗑️ Hard deleting non-SN item: ${item._id} (no serial number)`);
      
      // Create transfer log BEFORE deletion
      await TransferLog.create({
        itemId: (item._id as any).toString(),
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
        reason: `${reason} (Stock adjustment - item permanently removed)`,
        notes: `Admin stock reduced by permanently removing non-SN item from inventory`
      });
      
      // Hard delete the item to prevent count discrepancy
      await InventoryItem.findByIdAndDelete(item._id);
      console.log(`✅ Permanently deleted non-SN item: ${item._id}`);
    }
  }
  
  // 🔧 FIXED: Calculate final counts based on non-SN items only
  const finalWithSNCount = currentWithSNCount; // SN items are preserved
  const finalWithoutSNCount = targetAdminStock; // This is what we set it to
  const finalTotalCount = finalWithSNCount + finalWithoutSNCount;
  
  console.log(`✅ Admin stock sync completed: Non-SN items ${currentWithoutSNCount} → ${finalWithoutSNCount}, SN items preserved: ${finalWithSNCount}`);
  console.log(`📊 Final breakdown: ${finalWithoutSNCount} without SN, ${finalWithSNCount} with SN, ${finalTotalCount} total`);
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
 * 🆕 ทำความสะอาดรายการที่ถูก soft delete แล้วในระบบ
 * ใช้สำหรับแก้ไขปัญหาการนับจำนวนที่ไม่ตรงกัน
 */
export async function cleanupSoftDeletedItems(itemName?: string, category?: string) {
  console.log('🧹 Starting cleanup of soft-deleted items...');
  
  await dbConnect();
  
  // Build query - if itemName and category provided, clean only those items
  const query: any = { status: 'deleted' };
  if (itemName && category) {
    query.itemName = itemName;
    query.category = category;
    console.log(`🎯 Cleaning up soft-deleted items for: ${itemName} (${category})`);
  } else {
    console.log('🌐 Cleaning up ALL soft-deleted items in the system');
  }
  
  // Find all soft-deleted items
  const softDeletedItems = await InventoryItem.find(query);
  
  console.log(`🔍 Found ${softDeletedItems.length} soft-deleted items to clean up`);
  
  if (softDeletedItems.length === 0) {
    console.log('✅ No soft-deleted items found - database is clean');
    return { cleaned: 0, message: 'No soft-deleted items found' };
  }
  
  // Hard delete all soft-deleted items
  let cleanedCount = 0;
  for (const item of softDeletedItems) {
    console.log(`🗑️ Permanently deleting soft-deleted item: ${item._id} (${item.itemName})`);
    
    // Create cleanup log in TransferLog
    try {
      await TransferLog.create({
        itemId: (item._id as any).toString(),
        itemName: item.itemName,
        category: item.category,
        serialNumber: item.serialNumber || 'No SN',
        numberPhone: item.numberPhone || undefined,
        transferType: 'ownership_change',
        fromOwnership: { 
          ownerType: 'admin_stock'
        },
        toOwnership: { 
          ownerType: 'admin_stock'
        },
        processedBy: 'system_cleanup',
        reason: `Database cleanup - permanently removing soft-deleted item (originally deleted: ${item.deleteReason || 'Unknown reason'})`,
        notes: `System cleanup to fix count discrepancy - item was soft-deleted on ${item.deletedAt?.toISOString() || 'unknown date'}`
      });
    } catch (logError) {
      console.error('❌ Failed to create cleanup log:', logError);
      // Continue with cleanup even if logging fails
    }
    
    // Hard delete the item
    await InventoryItem.findByIdAndDelete(item._id);
    cleanedCount++;
    console.log(`✅ Permanently deleted: ${item._id}`);
  }
  
  // Update InventoryMaster records for affected items
  if (itemName && category) {
    console.log(`🔄 Updating InventoryMaster for ${itemName} (${category})`);
    await updateInventoryMaster(itemName, category);
  } else {
    // Update all unique combinations
    const uniqueCombinations = [...new Set(softDeletedItems.map(item => `${item.itemName}|${item.category}`))];
    console.log(`🔄 Updating InventoryMaster for ${uniqueCombinations.length} unique item combinations`);
    
    for (const combo of uniqueCombinations) {
      const [name, cat] = combo.split('|');
      try {
        await updateInventoryMaster(name, cat);
        console.log(`✅ Updated InventoryMaster: ${name} (${cat})`);
      } catch (updateError) {
        console.error(`❌ Failed to update InventoryMaster for ${name} (${cat}):`, updateError);
      }
    }
  }
  
  console.log(`🧹 Cleanup completed: ${cleanedCount} soft-deleted items permanently removed`);
  return { 
    cleaned: cleanedCount, 
    message: `Successfully cleaned up ${cleanedCount} soft-deleted items` 
  };
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
    itemId: (savedItem._id as any).toString(),
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
