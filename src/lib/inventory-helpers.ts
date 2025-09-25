/**
 * Helper functions for the new Reference-based inventory system
 * These functions provide common operations for ItemMaster, InventoryItem, and InventoryMaster
 */

import ItemMaster from '../models/ItemMaster';
import { InventoryItem } from '../models/InventoryItemNew';
import { InventoryMaster } from '../models/InventoryMasterNew';
import InventoryConfig from '../models/InventoryConfig';
import TransferLog from '../models/TransferLog';
import dbConnect from './mongodb';

// Types
export interface CreateItemParams {
  itemName: string;
  categoryId: string;
  serialNumber?: string;
  numberPhone?: string;
  statusId?: string;      // Default: 'status_available'
  conditionId?: string;   // Default: 'cond_working'
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
    categoryId,
    serialNumber,
    numberPhone,
    statusId = 'status_available',
    conditionId = 'cond_working',
    addedBy,
    addedByUserId,
    initialOwnerType,
    userId,
    assignedBy,
    notes
  } = params;

  // Validate categoryId exists
  const config = await InventoryConfig.findOne({ 'categoryConfigs.id': categoryId });
  if (!config) {
    throw new Error(`Invalid categoryId: ${categoryId}`);
  }

  // Validate statusId exists
  const statusExists = await InventoryConfig.findOne({ 'statusConfigs.id': statusId });
  if (!statusExists) {
    throw new Error(`Invalid statusId: ${statusId}`);
  }

  // Validate conditionId exists
  const conditionExists = await InventoryConfig.findOne({ 'conditionConfigs.id': conditionId });
  if (!conditionExists) {
    throw new Error(`Invalid conditionId: ${conditionId}`);
  }

  // Enhanced Serial Number validation
  if (serialNumber && serialNumber.trim() !== '') {
    const trimmedSerialNumber = serialNumber.trim();
    
    const existingItem = await InventoryItem.findOne({ 
      serialNumber: trimmedSerialNumber,
      deletedAt: { $exists: false }
    });
    
    if (existingItem) {
      throw new Error(`Serial Number "${trimmedSerialNumber}" already exists`);
    }
  }

  // Enhanced Phone Number validation for SIM cards
  if (numberPhone && numberPhone.trim() !== '') {
    const trimmedNumberPhone = numberPhone.trim();
    
    // Check for duplicate phone number in SIM card category
    const existingPhoneItem = await InventoryItem.findOne({ 
      numberPhone: trimmedNumberPhone,
      categoryId: finalCategory,
      deletedAt: { $exists: false }
    });
    
    if (existingPhoneItem) {
      throw new Error(`Phone Number "${trimmedNumberPhone}" already exists in SIM card category`);
    }
  }

  // Find or create ItemMaster
  let itemMaster = await ItemMaster.findOne({ itemName, categoryId });
  if (!itemMaster) {
    console.log('📦 Creating new ItemMaster for:', { itemName, categoryId });
    itemMaster = new ItemMaster({
      itemName,
      categoryId,
      hasSerialNumber: !!serialNumber,
      isActive: true,
      createdBy: addedByUserId || 'system'
    });
    await itemMaster.save();
  }

  // Validate parameters
  if (addedBy === 'user' && !addedByUserId) {
    throw new Error('User-added items must have addedByUserId');
  }

  if (initialOwnerType === 'user_owned' && !userId) {
    throw new Error('User-owned items must have userId');
  }

  // Create InventoryItem
  const cleanSerialNumber = serialNumber && serialNumber.trim() !== '' ? serialNumber.trim() : undefined;
  const cleanNumberPhone = numberPhone && numberPhone.trim() !== '' ? numberPhone.trim() : undefined;
  const cleanNotes = notes && notes.trim() !== '' ? notes.trim() : undefined;
  
  console.log('🏗️ Creating new InventoryItem with data:', {
    itemMasterId: itemMaster._id,
    serialNumber: cleanSerialNumber,
    statusId,
    conditionId,
    initialOwnerType,
    addedBy
  });
  
  const newItem = new InventoryItem({
    itemMasterId: itemMaster._id.toString(),
    serialNumber: cleanSerialNumber,
    numberPhone: cleanNumberPhone,
    statusId,
    conditionId,
    
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
      notes: cleanNotes
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
      await updateInventoryMaster(itemMaster._id.toString());
      console.log('✅ InventoryMaster updated successfully');
    } catch (masterError) {
      console.error('❌ Failed to update InventoryMaster:', masterError);
      // Don't throw here - item is already saved
    }

    // Create TransferLog
    console.log('📝 Creating TransferLog...');
    try {
      await TransferLog.create({
        itemId: savedItem._id.toString(),
        itemName,
        category: categoryId,
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
        reason: cleanNotes || (addedBy === 'user' ? 'User reported existing equipment' : 'Admin added new equipment')
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

  // Get ItemMaster for logging
  const itemMaster = await ItemMaster.findById(item.itemMasterId);
  if (!itemMaster) {
    throw new Error(`ItemMaster not found: ${item.itemMasterId}`);
  }

  // Validate current ownership
  if (item.currentOwnership.ownerType !== fromOwnerType) {
    throw new Error(`Item ownership mismatch. Expected: ${fromOwnerType}, Actual: ${item.currentOwnership.ownerType}`);
  }

  if (fromOwnerType === 'user_owned' && item.currentOwnership.userId !== fromUserId) {
    throw new Error(`Item user mismatch. Expected: ${fromUserId}, Actual: ${item.currentOwnership.userId}`);
  }

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
  await updateInventoryMaster(item.itemMasterId);

  // Create TransferLog
  await TransferLog.create({
    itemId: savedItem._id.toString(),
    itemName: itemMaster.itemName,
    category: itemMaster.categoryId,
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
export async function findAvailableItems(itemMasterId: string, quantity: number = 1) {
  return await InventoryItem.find({
    itemMasterId,
    'currentOwnership.ownerType': 'admin_stock',
    statusId: 'status_available',    // มี
    conditionId: 'cond_working',     // ใช้งานได้
    deletedAt: { $exists: false }    // ไม่ถูกลบ
  }).limit(quantity);
}

/**
 * หา InventoryItem ที่ user เป็นเจ้าของ
 */
export async function findUserOwnedItems(userId: string) {
  return await InventoryItem.find({
    'currentOwnership.ownerType': 'user_owned',
    'currentOwnership.userId': userId,
    deletedAt: { $exists: false }
  }).sort({ 'currentOwnership.ownedSince': -1 });
}

/**
 * อัปเดต InventoryMaster สำหรับ item เดียว
 */
export async function updateInventoryMaster(itemMasterId: string, options: { skipAutoDetection?: boolean } = {}) {
  console.log('🔍 updateInventoryMaster called with:', { itemMasterId });
  
  try {
    // Find or create the master record
    let updatedMaster = await InventoryMaster.findOne({ itemMasterId });
    if (!updatedMaster) {
      console.log('📦 Creating new InventoryMaster for:', { itemMasterId });
      updatedMaster = new InventoryMaster({ 
        itemMasterId,
        totalQuantity: 0,
        availableQuantity: 0,
        userOwnedQuantity: 0
      });
    }
  
    // Calculate quantities from actual InventoryItems
    console.log('🔍 Finding InventoryItems for:', { itemMasterId });
    const allItems = await InventoryItem.find({
      itemMasterId,
      deletedAt: { $exists: false }
    });
    console.log('📦 Found InventoryItems:', allItems.length);
    
    const adminStockItems = allItems.filter(item => item.currentOwnership.ownerType === 'admin_stock');
    const userOwnedItems = allItems.filter(item => item.currentOwnership.ownerType === 'user_owned');
    
    updatedMaster.totalQuantity = allItems.length;
    updatedMaster.availableQuantity = adminStockItems.length;
    updatedMaster.userOwnedQuantity = userOwnedItems.length;
    
    // Calculate status breakdown
    const statusCounts: { [key: string]: number } = {};
    const conditionCounts: { [key: string]: number } = {};
    
    allItems.forEach(item => {
      statusCounts[item.statusId] = (statusCounts[item.statusId] || 0) + 1;
      conditionCounts[item.conditionId] = (conditionCounts[item.conditionId] || 0) + 1;
    });
    
    updatedMaster.statusBreakdown = Object.entries(statusCounts).map(([statusId, count]) => ({
      statusId,
      count
    }));
    
    updatedMaster.conditionBreakdown = Object.entries(conditionCounts).map(([conditionId, count]) => ({
      conditionId,
      count
    }));
    
    // Initialize stock management if not exists
    if (!updatedMaster.stockManagement) {
      updatedMaster.stockManagement = {
        adminDefinedStock: 0,
        userContributedCount: 0,
        currentlyAllocated: 0,
        realAvailable: 0
      };
    }
    
    // Count user-contributed items
    const userContributedItems = await InventoryItem.find({
      itemMasterId,
      'sourceInfo.addedBy': 'user',
      deletedAt: { $exists: false }
    });
    
    updatedMaster.stockManagement.userContributedCount = userContributedItems.length;
    
    // Calculate currently allocated
    const allocatedItems = await InventoryItem.find({
      itemMasterId,
      'currentOwnership.ownerType': 'user_owned',
      'sourceInfo.addedBy': 'admin',
      deletedAt: { $exists: false }
    });
    
    updatedMaster.stockManagement.currentlyAllocated = allocatedItems.length;
    
    await updatedMaster.save();
    
    return updatedMaster;
  } catch (error) {
    console.error('❌ updateInventoryMaster failed:', error);
    throw error;
  }
}

/**
 * เปลี่ยนสถานะของ InventoryItem
 */
export async function changeItemStatus(
  itemId: string, 
  newStatusId: string,
  newConditionId: string,
  changedBy: string,
  reason?: string
) {
  const item = await InventoryItem.findById(itemId);
  if (!item) {
    throw new Error(`InventoryItem not found: ${itemId}`);
  }

  // Get ItemMaster for logging
  const itemMaster = await ItemMaster.findById(item.itemMasterId);
  if (!itemMaster) {
    throw new Error(`ItemMaster not found: ${item.itemMasterId}`);
  }

  const oldStatusId = item.statusId;
  const oldConditionId = item.conditionId;
  
  item.statusId = newStatusId;
  item.conditionId = newConditionId;
  
  const savedItem = await item.save();

  // Update InventoryMaster
  await updateInventoryMaster(item.itemMasterId);

  // Log the status change
  await TransferLog.create({
    itemId: savedItem._id.toString(),
    itemName: itemMaster.itemName,
    category: itemMaster.categoryId,
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
    reason: reason || `Status changed from ${oldStatusId}/${oldConditionId} to ${newStatusId}/${newConditionId}`
  });

  return savedItem;
}

/**
 * ลบ InventoryItem (soft delete)
 */
export async function softDeleteInventoryItem(itemId: string, deletedBy: string, reason?: string) {
  const item = await InventoryItem.findById(itemId);
  if (!item) {
    throw new Error(`InventoryItem not found: ${itemId}`);
  }

  item.deletedAt = new Date();
  item.deleteReason = reason || 'Soft deleted by admin';
  
  const savedItem = await item.save();

  // Update InventoryMaster
  await updateInventoryMaster(item.itemMasterId);

  return savedItem;
}

/**
 * Get configuration data
 */
export async function getInventoryConfigs() {
  const config = await InventoryConfig.findOne({});
  if (!config) {
    throw new Error('InventoryConfig not found');
  }
  
  return {
    categories: config.categoryConfigs || [],
    statuses: config.statusConfigs || [],
    conditions: config.conditionConfigs || []
  };
}

/**
 * Get ItemMaster by category
 */
export async function getItemMastersByCategory(categoryId: string) {
  return await ItemMaster.find({
    categoryId,
    isActive: true
  }).sort({ itemName: 1 });
}

/**
 * Get InventoryMaster with populated ItemMaster data
 */
export async function getInventoryMastersWithDetails() {
  const masters = await InventoryMaster.find({}).sort({ lastUpdated: -1 });
  
  const result = [];
  for (const master of masters) {
    const itemMaster = await ItemMaster.findById(master.itemMasterId);
    if (itemMaster) {
      result.push({
        ...master.toObject(),
        itemName: itemMaster.itemName,
        categoryId: itemMaster.categoryId,
        hasSerialNumber: itemMaster.hasSerialNumber
      });
    }
  }
  
  return result;
}

/**
 * Legacy compatibility functions
 * These functions maintain compatibility with existing code
 */

// Backward compatibility for old createInventoryItem calls
export async function createInventoryItemLegacy(params: any) {
  // Convert old parameters to new format
  const newParams: CreateItemParams = {
    itemName: params.itemName,
    categoryId: params.categoryId || params.category,
    serialNumber: params.serialNumber,
    numberPhone: params.numberPhone,
    statusId: params.statusId || 'status_available',
    conditionId: params.conditionId || 'cond_working',
    addedBy: params.addedBy,
    addedByUserId: params.addedByUserId,
    initialOwnerType: params.initialOwnerType,
    userId: params.userId,
    assignedBy: params.assignedBy,
    notes: params.notes
  };
  
  return await createInventoryItem(newParams);
}

// Backward compatibility for old updateInventoryMaster calls
export async function updateInventoryMasterLegacy(itemName: string, categoryId: string) {
  // Find ItemMaster by name and category
  const itemMaster = await ItemMaster.findOne({ itemName, categoryId });
  if (!itemMaster) {
    console.log(`ItemMaster not found for ${itemName} (${categoryId})`);
    return null;
  }
  
  return await updateInventoryMaster(itemMaster._id.toString());
}