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

  // Validate statusId exists - use more flexible query
  const statusExists = await InventoryConfig.findOne({ 
    'statusConfigs.id': statusId 
  });
  if (!statusExists) {
    console.log('⚠️ StatusId not found, checking if it\'s a default value...');
    // Allow default values even if config is not found
    if (statusId === 'status_available' || statusId === 'status_missing') {
      console.log('✅ Using default statusId:', statusId);
    } else {
      throw new Error(`Invalid statusId: ${statusId}`);
    }
  }

  // Validate conditionId exists - use more flexible query
  console.log('🔍 Validating conditionId:', conditionId);
  const conditionExists = await InventoryConfig.findOne({ 
    'conditionConfigs.id': conditionId 
  });
  console.log('🔍 Condition config found:', conditionExists ? 'Yes' : 'No');
  if (!conditionExists) {
    console.log('⚠️ ConditionId not found, checking if it\'s a default value...');
    // Allow default values even if config is not found
    if (conditionId === 'cond_working' || conditionId === 'cond_damaged') {
      console.log('✅ Using default conditionId:', conditionId);
    } else {
      throw new Error(`Invalid conditionId: ${conditionId}`);
    }
  }

  // Enhanced Serial Number validation - allow duplicates across different categories
  if (serialNumber && serialNumber.trim() !== '') {
    const trimmedSerialNumber = serialNumber.trim();
    
    const existingItem = await InventoryItem.findOne({ 
      serialNumber: trimmedSerialNumber,
      categoryId: categoryId, // ตรวจสอบเฉพาะในหมวดหมู่เดียวกัน
      deletedAt: { $exists: false }
    });
    
    if (existingItem) {
      throw new Error(`Serial Number "${trimmedSerialNumber}" already exists in this category`);
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
    conditionId: conditionId || 'cond_working', // ใช้ default value หากไม่มี
    
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
 * อัปเดต InventoryMaster สำหรับ item เดียว (ใช้ masterItemId)
 */
export async function updateInventoryMaster(itemName: string, categoryId: string, options: { skipAutoDetection?: boolean } = {}) {
  console.log('🔍 updateInventoryMaster called with:', { itemName, categoryId });
  
  try {
    // หา master record จาก itemName และ categoryId โดยตรง
    let updatedMaster = await InventoryMaster.findOne({ 
      itemName: itemName, 
      categoryId: categoryId 
    });
    
    console.log('🔍 Found existing master:', updatedMaster ? 'Yes' : 'No');
    
    if (!updatedMaster) {
      // สร้าง master ใหม่ - ต้องหา item แรกที่จะเป็น master
      const firstItem = await InventoryItem.findOne({ itemName, categoryId, deletedAt: { $exists: false } });
      if (!firstItem) {
        console.log('❌ No items found for:', { itemName, categoryId });
        return null;
      }
      
      console.log('📦 Creating new InventoryMaster for:', { itemName, categoryId });
      console.log('📦 Using first item as master:', firstItem._id);
      
      updatedMaster = new InventoryMaster({ 
        masterItemId: firstItem._id.toString(),
        itemName: itemName,
        categoryId,
        relatedItemIds: [firstItem._id.toString()],
        totalQuantity: 0,
        availableQuantity: 0,
        userOwnedQuantity: 0
      });
      
      console.log('📦 New master created, saving...');
      await updatedMaster.save();
      console.log('✅ New master saved successfully');
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
    
    console.log('📊 Quantity breakdown:', {
      total: allItems.length,
      adminStock: adminStockItems.length,
      userOwned: userOwnedItems.length
    });
    
    updatedMaster.totalQuantity = allItems.length;
    updatedMaster.availableQuantity = adminStockItems.length;
    updatedMaster.userOwnedQuantity = userOwnedItems.length;
    
    // 🔧 Fix: อัปเดต relatedItemIds ให้ตรงกับ InventoryItems ที่มีอยู่จริง
    const currentRelatedIds = allItems.map(item => item._id.toString());
    const existingRelatedIds = updatedMaster.relatedItemIds || [];
    
    // ตรวจสอบว่ามีการเปลี่ยนแปลงหรือไม่
    const hasChanges = currentRelatedIds.length !== existingRelatedIds.length || 
                      !currentRelatedIds.every(id => existingRelatedIds.includes(id));
    
    if (hasChanges) {
      updatedMaster.relatedItemIds = currentRelatedIds;
    }
    
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
    
    // อัปเดต itemDetails แบบใหม่ (เก็บทั้ง count และ itemIds)
    updatedMaster.itemDetails = {
      withSerialNumber: {
        count: itemsWithSerialNumber.length,
        itemIds: itemsWithSerialNumber.map(item => item._id.toString())
      },
      withPhoneNumber: {
        count: itemsWithPhoneNumber.length,
        itemIds: itemsWithPhoneNumber.map(item => item._id.toString())
      },
      other: {
        count: otherItems.length,
        itemIds: otherItems.map(item => item._id.toString())
      }
    };
    
    // hasSerialNumber removed - use itemDetails.withSerialNumber > 0 instead
    
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
    
    // 🔧 CRITICAL FIX: Update adminDefinedStock to match availableQuantity
    updatedMaster.stockManagement.adminDefinedStock = updatedMaster.availableQuantity;
    updatedMaster.stockManagement.realAvailable = updatedMaster.availableQuantity;
    
    console.log('💾 Saving updated master with quantities:', {
      totalQuantity: updatedMaster.totalQuantity,
      availableQuantity: updatedMaster.availableQuantity,
      userOwnedQuantity: updatedMaster.userOwnedQuantity,
      adminDefinedStock: updatedMaster.stockManagement.adminDefinedStock
    });
    
    await updatedMaster.save();
    console.log('✅ Master updated and saved successfully');
    
    return updatedMaster;
  } catch (error) {
    console.error('❌ updateInventoryMaster failed:', error);
    throw error;
  }
}

/**
 * 🔧 ซิงค์ relatedItemIds สำหรับ InventoryMaster ทั้งหมด (ใช้แก้ไขข้อมูลเก่า)
 */
export async function syncAllRelatedItemIds() {
  try {
    const masters = await InventoryMaster.find({});
    let syncedCount = 0;
    let errorCount = 0;
    
    for (const master of masters) {
      try {
        // หา InventoryItems ที่เกี่ยวข้อง
        const relatedItems = await InventoryItem.find({
          itemName: master.itemName,
          categoryId: master.categoryId,
          deletedAt: { $exists: false }
        });
        
        const currentRelatedIds = relatedItems.map(item => item._id.toString());
        const existingRelatedIds = master.relatedItemIds || [];
        
        // ตรวจสอบว่าต้องอัปเดตหรือไม่
        const hasChanges = currentRelatedIds.length !== existingRelatedIds.length || 
                          !currentRelatedIds.every(id => existingRelatedIds.includes(id));
        
        if (hasChanges) {
          master.relatedItemIds = currentRelatedIds;
          master.lastUpdated = new Date();
          await master.save();
          syncedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error syncing master ${master._id}:`, error);
        errorCount++;
      }
    }
    
    return { syncedCount, errorCount, total: masters.length };
    
  } catch (error) {
    console.error('❌ syncAllRelatedItemIds failed:', error);
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
 * ลบ InventoryItem (soft delete) พร้อมจัดการ masterItem
 */
export async function softDeleteInventoryItem(itemId: string, deletedBy: string, reason?: string) {
  const item = await InventoryItem.findById(itemId);
  if (!item) {
    throw new Error(`InventoryItem not found: ${itemId}`);
  }

  // Soft delete the item
  item.deletedAt = new Date();
  item.deleteReason = reason || 'Soft deleted by admin';
  const savedItem = await item.save();

  // 🆕 จัดการ InventoryMaster เมื่อ masterItem ถูกลบ
  await handleMasterItemDeletion(itemId);

  return savedItem;
}

/**
 * 🆕 จัดการเมื่อ masterItem ถูกลบ (พร้อม Priority Selection และ Enhanced Logging)
 */
export async function handleMasterItemDeletion(deletedItemId: string) {
  console.log(`🗑️ Master item deleted: ${deletedItemId}`);
  
  try {
    // หา InventoryMaster ที่มี masterItemId เป็น item ที่ถูกลบ
    const master = await InventoryMaster.findOne({ masterItemId: deletedItemId });
    
    if (!master) {
      console.log('ℹ️ No InventoryMaster found with masterItemId:', deletedItemId);
      return;
    }
    
    console.log('🔍 Found InventoryMaster that needs masterItem update:', master._id);
    
    // ลบ deletedItemId ออกจาก relatedItemIds
    master.relatedItemIds = master.relatedItemIds.filter(id => id !== deletedItemId);
    
    if (master.relatedItemIds.length === 0) {
      // ไม่มี item เหลือ -> ลบ InventoryMaster
      console.log('❌ No items left in group, deleting InventoryMaster:', master._id);
      await InventoryMaster.deleteOne({ _id: master._id });
      console.log('✅ InventoryMaster deleted successfully');
      return;
    }
    
    // 🆕 หา item ตัวถัดไปด้วย Priority Selection
    const nextMasterItem = await InventoryItem.findOne({
      _id: { $in: master.relatedItemIds },
      deletedAt: { $exists: false }  // ต้องไม่ถูกลบ
    }).sort({ 
      'currentOwnership.ownerType': 1,  // admin_stock ก่อน user_owned
      createdAt: 1                      // แล้วเรียงตามวันที่
    });
    
    if (!nextMasterItem) {
      // ไม่มี item ที่ใช้งานได้เหลือ -> ลบ InventoryMaster
      console.log('❌ No active items left in group, deleting InventoryMaster:', master._id);
      await InventoryMaster.deleteOne({ _id: master._id });
      console.log('✅ InventoryMaster deleted successfully');
      return;
    }
    
    // อัปเดต masterItemId เป็น item ตัวใหม่
    const oldMasterItemId = master.masterItemId;
    master.masterItemId = nextMasterItem._id.toString();
    master.lastUpdated = new Date();
    
    await master.save();
    
    // 🆕 Enhanced Logging
    console.log(`📋 Promoting item ${nextMasterItem._id} to master`);
    console.log(`🔄 Master updated: ${oldMasterItemId} → ${master.masterItemId}`);
    console.log(`👤 New master ownership: ${nextMasterItem.currentOwnership.ownerType}`);
    console.log(`📊 Remaining items in group: ${master.relatedItemIds.length}`);
    console.log(`✅ Master item delegation completed successfully`);
    
  } catch (error) {
    console.error('❌ handleMasterItemDeletion failed:', error);
    throw error;
  }
}

/**
 * 🆕 ฟื้นฟู InventoryItem จาก soft delete พร้อมจัดการ InventoryMaster
 */
export async function restoreInventoryItem(itemId: string, restoredBy: string) {
  console.log('🔄 restoreInventoryItem called for:', itemId);
  
  try {
    const item = await InventoryItem.findById(itemId);
    if (!item) {
      throw new Error(`InventoryItem not found: ${itemId}`);
    }
    
    if (!item.deletedAt) {
      throw new Error(`InventoryItem is not deleted: ${itemId}`);
    }
    
    // Restore the item
    item.deletedAt = undefined;
    item.deleteReason = undefined;
    const savedItem = await item.save();
    
    const itemName = (savedItem as any).itemName;
    const categoryId = (savedItem as any).categoryId;
    
    // หา InventoryMaster ที่เกี่ยวข้อง
    let master = await findInventoryMasterByItemNameAndCategory(itemName, categoryId);
    
    if (!master) {
      // สร้าง InventoryMaster ใหม่
      console.log('📦 Creating new InventoryMaster for restored item');
      master = new InventoryMaster({
        masterItemId: savedItem._id.toString(),
        categoryId,
        relatedItemIds: [savedItem._id.toString()],
        totalQuantity: 0,
        availableQuantity: 0,
        userOwnedQuantity: 0
      });
      await master.save();
    } else {
      // เพิ่ม item กลับเข้า relatedItemIds
      if (!master.relatedItemIds.includes(itemId)) {
        master.relatedItemIds.push(itemId);
        master.lastUpdated = new Date();
        await master.save();
      }
    }
    
    // อัปเดตสถิติ
    await updateInventoryMaster(itemName, categoryId);
    
    console.log(`✅ Restored InventoryItem and updated InventoryMaster`);
    return savedItem;
    
  } catch (error) {
    console.error('❌ restoreInventoryItem failed:', error);
    throw error;
  }
}

/**
 * 🆕 ค้นหา InventoryMaster จาก itemName และ categoryId
 */
async function findInventoryMasterByItemNameAndCategory(itemName: string, categoryId: string) {
  const allMasters = await InventoryMaster.find({ categoryId });
  
  for (const master of allMasters) {
    const masterItem = await InventoryItem.findById(master.masterItemId);
    if (masterItem && (masterItem as any).itemName === itemName && (masterItem as any).categoryId === categoryId) {
      return master;
    }
  }
  
  return null;
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
  return master ? master.itemDetails.withSerialNumber.count > 0 : false;
}

/**
 * ตรวจสอบว่าอุปกรณ์ประเภทนี้มี Phone Number หรือไม่
 */
export async function itemTypeHasPhoneNumber(itemName: string, categoryId: string): Promise<boolean> {
  const master = await InventoryMaster.findOne({ itemName, categoryId });
  return master ? master.itemDetails.withPhoneNumber.count > 0 : false;
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

/**
 * 🆕 อัปเดตชื่ออุปกรณ์ทั้งหมดใน group (แนวทางที่ 1)
 */
export async function updateEquipmentGroupName(itemId: string, newItemName: string, updatedBy: string) {
  console.log('🔄 updateEquipmentGroupName called:', { itemId, newItemName, updatedBy });
  
  try {
    await dbConnect();
    
    // 1. หา item ที่จะแก้
    const targetItem = await InventoryItem.findById(itemId);
    if (!targetItem) {
      throw new Error(`InventoryItem not found: ${itemId}`);
    }
    
    const oldItemName = (targetItem as any).itemName;
    const categoryId = (targetItem as any).categoryId;
    
    // 2. หา InventoryMaster ที่เกี่ยวข้อง
    const master = await InventoryMaster.findOne({
      relatedItemIds: itemId
    });
    
    if (!master) {
      throw new Error(`InventoryMaster not found for item: ${itemId}`);
    }
    
    // 3. อัปเดตชื่อทุกตัวใน group
    const updateResult = await InventoryItem.updateMany(
      { _id: { $in: master.relatedItemIds } },
      { 
        $set: { 
          itemName: newItemName,
          updatedAt: new Date()
        } 
      }
    );
    
    // 4. อัปเดต InventoryMaster
    master.lastUpdated = new Date();
    master.lastUpdatedBy = updatedBy;
    await master.save();
    
    console.log(`✅ Updated ${updateResult.modifiedCount} items from "${oldItemName}" to "${newItemName}"`);
    
    return {
      success: true,
      updatedCount: updateResult.modifiedCount,
      oldName: oldItemName,
      newName: newItemName,
      masterId: master._id.toString()
    };
    
  } catch (error) {
    console.error('❌ updateEquipmentGroupName failed:', error);
    throw error;
  }
}

/**
 * Helper function to get item breakdown data
 */
async function getItemBreakdown(itemName: string, categoryId: string) {
  try {
    // Calculate type breakdown - same logic as in breakdown API
    const typeBreakdown = await InventoryItem.aggregate([
      { 
        $match: { 
          itemName, 
          categoryId, 
          status: { $ne: 'deleted' } 
        } 
      },
      {
        $group: {
          _id: null,
          withoutSN: { 
            $sum: { 
              $cond: [
                { $and: [
                  { $or: [
                    { $eq: ['$serialNumber', null] },
                    { $eq: ['$serialNumber', ''] },
                    { $eq: [{ $type: '$serialNumber' }, 'missing'] }
                  ]},
                  { $or: [
                    { $eq: ['$numberPhone', null] },
                    { $eq: ['$numberPhone', ''] },
                    { $eq: [{ $type: '$numberPhone' }, 'missing'] }
                  ]}
                ]}, 
                1, 
                0
              ] 
            } 
          },
          withSN: { 
            $sum: { 
              $cond: [
                { $and: [
                  { $ne: [{ $type: '$serialNumber' }, 'missing'] },
                  { $ne: [{ $type: '$serialNumber' }, 'null'] },
                  { $ne: [{ $type: '$serialNumber' }, 'undefined'] },
                  { $gt: [{ $ifNull: ['$serialNumber', ''] }, ''] }
                ]}, 
                1, 
                0
              ] 
            } 
          },
          withPhone: { 
            $sum: { 
              $cond: [
                { $and: [
                  { $ne: [{ $type: '$numberPhone' }, 'missing'] },
                  { $ne: [{ $type: '$numberPhone' }, 'null'] },
                  { $ne: [{ $type: '$numberPhone' }, 'undefined'] },
                  { $gt: [{ $ifNull: ['$numberPhone', ''] }, ''] }
                ]}, 
                1, 
                0
              ] 
            } 
          }
        }
      }
    ]);
    
    // Calculate status breakdown
    const statusBreakdown = await InventoryItem.aggregate([
      { 
        $match: { 
          itemName, 
          categoryId, 
          status: { $ne: 'deleted' } 
        } 
      },
      { 
        $group: { 
          _id: '$statusId', 
          count: { $sum: 1 } 
        } 
      }
    ]);
    
    // Calculate condition breakdown
    const conditionBreakdown = await InventoryItem.aggregate([
      { 
        $match: { 
          itemName, 
          categoryId, 
          status: { $ne: 'deleted' } 
        } 
      },
      { 
        $group: { 
          _id: '$conditionId', 
          count: { $sum: 1 } 
        } 
      }
    ]);
    
    // Convert results to objects
    const statusResult = statusBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);
    
    const conditionResult = conditionBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);
    
    const typeResult = typeBreakdown[0] || { withoutSN: 0, withSN: 0, withPhone: 0 };
    
    return {
      statusBreakdown: statusResult,
      conditionBreakdown: conditionResult,
      typeBreakdown: typeResult
    };
  } catch (error) {
    console.error('Error getting item breakdown:', error);
    return {
      statusBreakdown: {},
      conditionBreakdown: {},
      typeBreakdown: { withoutSN: 0, withSN: 0, withPhone: 0 }
    };
  }
}

/**
 * Helper functions สำหรับ Admin Stock Management
 */
export async function getAdminStockInfo(itemName: string, categoryId: string) {
  await dbConnect();
  
  // Find the specific item
  const item = await InventoryMaster.findOne({ itemName, categoryId });
  
  if (!item) {
    throw new Error(`ไม่พบรายการ ${itemName} ในหมวดหมู่ ${categoryId}`);
  }
  
  console.log(`📊 Stock Info - Raw InventoryMaster data for ${itemName}:`, {
    totalQuantity: item.totalQuantity,
    availableQuantity: item.availableQuantity,
    userOwnedQuantity: item.userOwnedQuantity
  });
  
  // Get breakdown data to include withoutSerialNumber count
  const breakdownData = await getItemBreakdown(itemName, categoryId);
  
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
    },
    // Add breakdown data including withoutSerialNumber
    withoutSerialNumber: {
      count: breakdownData?.typeBreakdown?.withoutSN || 0
    },
    statusBreakdown: breakdownData?.statusBreakdown || {},
    conditionBreakdown: breakdownData?.conditionBreakdown || {},
    typeBreakdown: breakdownData?.typeBreakdown || {
      withoutSN: 0,
      withSN: 0,
      withPhone: 0
    }
  };
}

export async function syncAdminStockItems(itemName: string, categoryId: string, targetAdminStock: number, reason: string, adminId: string, newCategoryId?: string, newStatusId?: string, newConditionId?: string) {
  console.log(`🔄 Syncing admin stock items for ${itemName}: target items = ${targetAdminStock}`);
  console.log(`🔧 Update options:`, { newCategoryId, newStatusId, newConditionId });
  
  // Get current admin stock items
  const currentAdminItems = await InventoryItem.find({
    itemName,
    categoryId,
    'currentOwnership.ownerType': 'admin_stock',
    status: { $ne: 'deleted' }
  });
  
  const currentCount = currentAdminItems.length;
  console.log(`📊 Current admin items: ${currentCount}, Target: ${targetAdminStock}`);
  
  // Update existing items if new values are specified
  if (newCategoryId || newStatusId || newConditionId) {
    console.log(`🔄 Updating existing items with new values...`);
    for (const item of currentAdminItems) {
      let updated = false;
      
      if (newCategoryId && item.categoryId !== newCategoryId) {
        item.categoryId = newCategoryId;
        updated = true;
      }
      if (newStatusId && item.statusId !== newStatusId) {
        item.statusId = newStatusId;
        updated = true;
      }
      if (newConditionId && item.conditionId !== newConditionId) {
        item.conditionId = newConditionId;
        updated = true;
      }
      
      if (updated) {
        item.lastModified = new Date();
        await item.save();
        console.log(`✅ Updated item ${item._id} with new values`);
      }
    }
  }
  
  if (currentCount < targetAdminStock) {
    // Need to create more items
    const itemsToCreate = targetAdminStock - currentCount;
    console.log(`➕ Creating ${itemsToCreate} new admin stock items`);
    
    for (let i = 0; i < itemsToCreate; i++) {
      await createInventoryItem({
        itemName,
        categoryId: categoryId, // ใช้หมวดหมู่เดิม (ไม่เปลี่ยนหมวดหมู่)
        statusId: newStatusId || 'status_available', // ใช้สถานะใหม่หากระบุ
        conditionId: newConditionId || 'cond_working', // ใช้สภาพใหม่หากระบุ
        addedBy: 'admin',
        addedByUserId: adminId,
        initialOwnerType: 'admin_stock',
        notes: `Auto-created via stock adjustment: ${reason}`
      });
    }
  } else if (currentCount > targetAdminStock) {
    // Need to remove items
    const itemsToRemove = currentCount - targetAdminStock;
    console.log(`➖ Removing ${itemsToRemove} admin stock items`);
    
    // Remove items without serial numbers first
    const itemsWithoutSN = currentAdminItems.filter(item => !item.serialNumber);
    const itemsToDelete = itemsWithoutSN.slice(0, itemsToRemove);
    
    for (const item of itemsToDelete) {
      item.status = 'deleted';
      item.deletedAt = new Date();
      await item.save();
    }
  }
  
  // Update InventoryMaster - ไม่มีการเปลี่ยนหมวดหมู่
  console.log(`🔄 Updating InventoryMaster for: ${itemName} (${categoryId})`);
  await updateInventoryMaster(itemName, categoryId);
  
  return true;
}

/**
 * 🆕 ดึงรายการอุปกรณ์สำหรับ dropdown (ใช้ masterItemId)
 */
export async function getEquipmentTypesForDropdown() {
  console.log('🔍 getEquipmentTypesForDropdown called');
  
  try {
    await dbConnect();
    
    const masters = await InventoryMaster.find({}).lean();
    const config = await InventoryConfig.findOne({});
    const categoryConfigs = config?.categoryConfigs || [];
    
    const equipmentTypes = await Promise.all(masters.map(async (master) => {
      // ดึงชื่อจาก masterItem (real-time)
      const masterItem = await InventoryItem.findById(master.masterItemId).lean();
      if (!masterItem) {
        console.warn(`⚠️ Master item not found: ${master.masterItemId}`);
        return null;
      }
      
      const categoryConfig = categoryConfigs.find(c => c.id === master.categoryId);
      
      return {
        masterId: master._id.toString(),
        itemName: (masterItem as any).itemName,
        categoryId: master.categoryId,
        categoryName: categoryConfig?.name || 'ไม่ระบุ',
        availableQuantity: master.availableQuantity,
        totalQuantity: master.totalQuantity,
        hasSerialNumber: master.itemDetails.withSerialNumber.count > 0
      };
    }));
    
    // กรองรายการที่ null ออก
    return equipmentTypes.filter(Boolean);
    
  } catch (error) {
    console.error('❌ getEquipmentTypesForDropdown failed:', error);
    throw error;
  }
}

/**
 * 🆕 อัปเดต itemDetails สำหรับ master item หนึ่งรายการ
 */
export async function updateItemDetails(masterId: string): Promise<void> {
  try {
    const master = await InventoryMaster.findById(masterId);
    if (!master) {
      throw new Error(`Master item not found: ${masterId}`);
    }

    // ดึงข้อมูล items ทั้งหมดที่เกี่ยวข้อง
    const items = await InventoryItem.find({
      _id: { $in: master.relatedItemIds },
      deletedAt: { $exists: false }
    });

    // จัดกลุ่มตามประเภท
    const itemsWithSerialNumber = items.filter(item => item.serialNumber && item.serialNumber.trim() !== '');
    const itemsWithPhoneNumber = items.filter(item => item.numberPhone && item.numberPhone.trim() !== '');
    const otherItems = items.filter(item => 
      (!item.serialNumber || item.serialNumber.trim() === '') && 
      (!item.numberPhone || item.numberPhone.trim() === '')
    );

    // อัปเดต itemDetails
    master.itemDetails = {
      withSerialNumber: {
        count: itemsWithSerialNumber.length,
        itemIds: itemsWithSerialNumber.map(item => item._id.toString())
      },
      withPhoneNumber: {
        count: itemsWithPhoneNumber.length,
        itemIds: itemsWithPhoneNumber.map(item => item._id.toString())
      },
      other: {
        count: otherItems.length,
        itemIds: otherItems.map(item => item._id.toString())
      }
    };

    await master.save();
    console.log(`✅ Updated itemDetails for master: ${masterId}`);
    
  } catch (error) {
    console.error('❌ updateItemDetails failed:', error);
    throw error;
  }
}

/**
 * 🆕 อัปเดต itemDetails สำหรับ master items ทั้งหมด
 */
export async function updateAllItemDetails(): Promise<void> {
  try {
    console.log('🔄 Starting updateAllItemDetails...');
    
    const masters = await InventoryMaster.find({});
    let updatedCount = 0;
    
    for (const master of masters) {
      await updateItemDetails(master._id.toString());
      updatedCount++;
    }
    
    console.log(`✅ Updated itemDetails for ${updatedCount} master items`);
    
  } catch (error) {
    console.error('❌ updateAllItemDetails failed:', error);
    throw error;
  }
}

/**
 * 🆕 ดึงข้อมูลรายละเอียดอุปกรณ์แบบละเอียด
 */
export async function getItemDetailsDetailed(itemName: string, categoryId: string) {
  try {
    const master = await InventoryMaster.findOne({ itemName, categoryId });
    if (!master) {
      return null;
    }

    // ถ้ายังไม่มี itemDetails แบบใหม่ ให้สร้างใหม่
    if (!master.itemDetails || typeof master.itemDetails.withSerialNumber === 'number') {
      await updateItemDetails(master._id.toString());
      await master.save();
    }

    return master.itemDetails;
    
  } catch (error) {
    console.error('❌ getItemDetailsDetailed failed:', error);
    throw error;
  }
}
