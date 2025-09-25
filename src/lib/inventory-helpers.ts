/**
 * Helper functions for the new Reference-based inventory system
 * These functions provide common operations for InventoryItem and InventoryMaster
 */

// ItemMaster removed - no longer needed
import InventoryItem from '../models/InventoryItem';
import InventoryMaster from '../models/InventoryMaster';
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
  console.log('🔍 Validating categoryId:', categoryId);
  const config = await InventoryConfig.findOne({ 'categoryConfigs.id': categoryId });
  console.log('🔍 Category config found:', config ? 'Yes' : 'No');
  if (!config) {
    throw new Error(`Invalid categoryId: ${categoryId}`);
  }

  // Validate statusId exists
  const statusExists = await InventoryConfig.findOne({ 'statusConfigs.id': statusId });
  if (!statusExists) {
    throw new Error(`Invalid statusId: ${statusId}`);
  }

  // Validate conditionId exists
  console.log('🔍 Validating conditionId:', conditionId);
  const conditionExists = await InventoryConfig.findOne({ 'conditionConfigs.id': conditionId });
  console.log('🔍 Condition config found:', conditionExists ? 'Yes' : 'No');
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
      categoryId: categoryId,
      deletedAt: { $exists: false }
    });
    
    if (existingPhoneItem) {
      throw new Error(`Phone Number "${trimmedNumberPhone}" already exists in SIM card category`);
    }
  }

  // ItemMaster removed - InventoryMaster will be created/updated automatically

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
    itemName,
    categoryId,
    serialNumber: cleanSerialNumber,
    statusId,
    conditionId,
    initialOwnerType,
    addedBy
  });
  
  const newItem = new InventoryItem({
    itemName,
    categoryId,
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
      await updateInventoryMasterLegacy(itemName, categoryId);
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
  await updateInventoryMaster(item.itemName, item.categoryId);

  // Create TransferLog (use item data directly - no ItemMaster needed)
  await TransferLog.create({
    itemId: savedItem._id.toString(),
    itemName: item.itemName,          // จาก InventoryItem โดยตรง
    category: item.categoryId,        // จาก InventoryItem โดยตรง
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
 * Updated: ใช้ itemName และ categoryId แทน itemMasterId
 */
export async function findAvailableItems(itemName: string, categoryId: string, quantity: number = 10) {
  return await InventoryItem.find({
    itemName,
    categoryId,
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
export async function updateInventoryMaster(itemName: string, categoryId: string, options: { skipAutoDetection?: boolean } = {}) {
  console.log('🔍 updateInventoryMaster called with:', { itemName, categoryId });
  
  try {
    // Find or create the master record
    let updatedMaster = await InventoryMaster.findOne({ itemName, categoryId });
    if (!updatedMaster) {
      console.log('📦 Creating new InventoryMaster for:', { itemName, categoryId });
      updatedMaster = new InventoryMaster({ 
        itemName,
        categoryId,
        totalQuantity: 0,
        availableQuantity: 0,
        userOwnedQuantity: 0
      });
    }

    // Calculate quantities from actual InventoryItems
    console.log('🔍 Finding InventoryItems for:', { itemName, categoryId });
    const allItems = await InventoryItem.find({
      itemName,
      categoryId,
      deletedAt: { $exists: false }
    });
    console.log('📦 Found InventoryItems:', allItems.length);
    
    const adminStockItems = allItems.filter(item => item.currentOwnership.ownerType === 'admin_stock');
    const userOwnedItems = allItems.filter(item => item.currentOwnership.ownerType === 'user_owned');
    
    updatedMaster.totalQuantity = allItems.length;
    updatedMaster.availableQuantity = adminStockItems.length;
    updatedMaster.userOwnedQuantity = userOwnedItems.length;
    
    // Calculate status breakdown based on model structure
    const statusCounts = {
      active: 0,
      maintenance: 0,
      damaged: 0,
      retired: 0
    };
    
    // Count items by status mapping
    allItems.forEach(item => {
      // Map statusId to statusBreakdown structure
      switch (item.statusId) {
        case 'status_available':
        case 'status_in_use':
          statusCounts.active++;
          break;
        case 'status_maintenance':
          statusCounts.maintenance++;
          break;
        case 'status_damaged':
          statusCounts.damaged++;
          break;
        case 'status_retired':
          statusCounts.retired++;
          break;
        default:
          statusCounts.active++; // Default to active for unknown status
      }
    });
    
    updatedMaster.statusBreakdown = statusCounts;
    
    // Calculate item details breakdown
    const itemsWithSerialNumber = allItems.filter(item => item.serialNumber && item.serialNumber.trim() !== '');
    const itemsWithPhoneNumber = allItems.filter(item => item.numberPhone && item.numberPhone.trim() !== '');
    const otherItems = allItems.filter(item => 
      (!item.serialNumber || item.serialNumber.trim() === '') && 
      (!item.numberPhone || item.numberPhone.trim() === '')
    );
    
    updatedMaster.itemDetails = {
      withSerialNumber: itemsWithSerialNumber.length,
      withPhoneNumber: itemsWithPhoneNumber.length,
      other: otherItems.length
    };
    
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
      itemName,
      categoryId,
      'sourceInfo.addedBy': 'user',
      deletedAt: { $exists: false }
    });
    
    updatedMaster.stockManagement.userContributedCount = userContributedItems.length;
    
    // Calculate currently allocated
    const allocatedItems = await InventoryItem.find({
      itemName,
      categoryId,
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

  // Store old values before change
  const oldStatusId = item.statusId;
  const oldConditionId = item.conditionId;
  
  // Update status and condition
  item.statusId = newStatusId;
  item.conditionId = newConditionId;
  
  const savedItem = await item.save();

  // Update InventoryMaster
  await updateInventoryMaster(item.itemName, item.categoryId);

  // Log the status change (use item data directly - no ItemMaster needed)
  await TransferLog.create({
    itemId: savedItem._id.toString(),
    itemName: item.itemName,          // จาก InventoryItem โดยตรง
    category: item.categoryId,        // จาก InventoryItem โดยตรง
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
  await updateInventoryMaster(item.itemName, item.categoryId);

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

// getItemMastersByCategory removed - ItemMaster no longer exists

// getInventoryMastersWithDetails removed - InventoryMaster already has itemName and categoryId

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
  return await updateInventoryMaster(itemName, categoryId);
}

/**
 * อัปเดต InventoryMaster summary สำหรับ item ทั้งหมด
 */
export async function refreshAllMasterSummaries() {
  console.log('🔄 refreshAllMasterSummaries called');
  
  // Get all unique combinations of itemName and categoryId from InventoryItems
  const combinations = await InventoryItem.aggregate([
    {
      $match: {
        deletedAt: { $exists: false } // ไม่นับรายการที่ถูกลบ
      }
    },
    {
      $group: {
        _id: {
          itemName: '$itemName',
          categoryId: '$categoryId'
        }
      }
    }
  ]);
  
  console.log(`🔍 Found ${combinations.length} unique item combinations`);
  
  const results = [];
  for (const combo of combinations) {
    try {
      console.log(`🔄 Updating InventoryMaster for: ${combo._id.itemName} (${combo._id.categoryId})`);
      const result = await updateInventoryMaster(combo._id.itemName, combo._id.categoryId);
      results.push(result);
    } catch (error) {
      console.error(`❌ Failed to update InventoryMaster for ${combo._id.itemName}:`, error);
      // Continue with other items even if one fails
    }
  }
  
  console.log(`✅ Successfully updated ${results.length} InventoryMaster records`);
  return results;
}

/**
 * 🆕 Helper functions สำหรับดึงข้อมูล real-time จาก InventoryItems
 */

/**
 * ดึงรายการ Serial Numbers ที่มีจริง
 */
export async function getSerialNumbers(itemName: string, categoryId: string): Promise<string[]> {
  const items = await InventoryItem.find({
    itemName,
    categoryId,
    serialNumber: { $exists: true, $ne: '', $ne: null },
    deletedAt: { $exists: false }
  }, { serialNumber: 1 }).lean();
  
  return items.map(item => item.serialNumber).filter(Boolean);
}

/**
 * ดึงรายการ Phone Numbers ที่มีจริง
 */
export async function getPhoneNumbers(itemName: string, categoryId: string): Promise<string[]> {
  const items = await InventoryItem.find({
    itemName,
    categoryId,
    numberPhone: { $exists: true, $ne: '', $ne: null },
    deletedAt: { $exists: false }
  }, { numberPhone: 1 }).lean();
  
  return items.map(item => item.numberPhone).filter(Boolean);
}

/**
 * ตรวจสอบว่าอุปกรณ์ประเภทนี้มี Serial Number หรือไม่
 */
export async function itemTypeHasSerialNumber(itemName: string, categoryId: string): Promise<boolean> {
  const master = await InventoryMaster.findOne({ itemName, categoryId });
  return master ? master.itemDetails.withSerialNumber > 0 : false;
}

/**
 * ตรวจสอบว่าอุปกรณ์ประเภทนี้มี Phone Number หรือไม่
 */
export async function itemTypeHasPhoneNumber(itemName: string, categoryId: string): Promise<boolean> {
  const master = await InventoryMaster.findOne({ itemName, categoryId });
  return master ? master.itemDetails.withPhoneNumber > 0 : false;
}

/**
 * ดึงรายละเอียดอุปกรณ์ที่มีทั้ง Serial Number และ Phone Number
 */
export async function getItemsWithDetails(itemName: string, categoryId: string) {
  const items = await InventoryItem.find({
    itemName,
    categoryId,
    deletedAt: { $exists: false }
  }).lean();
  
  const withSerial = items.filter(item => item.serialNumber && item.serialNumber.trim() !== '');
  const withPhone = items.filter(item => item.numberPhone && item.numberPhone.trim() !== '');
  const other = items.filter(item => 
    (!item.serialNumber || item.serialNumber.trim() === '') && 
    (!item.numberPhone || item.numberPhone.trim() === '')
  );
  
  return {
    total: items.length,
    withSerial,
    withPhone,
    other,
    breakdown: {
      withSerialNumber: withSerial.length,
      withPhoneNumber: withPhone.length,
      other: other.length
    },
    serialNumbers: items.map(item => item.serialNumber).filter(Boolean),
    phoneNumbers: items.map(item => item.numberPhone).filter(Boolean)
  };
}
