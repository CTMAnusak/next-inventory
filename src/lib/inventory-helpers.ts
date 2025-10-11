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
  // ✅ เพิ่มข้อมูลผู้ใช้สาขา
  requesterInfo?: {
    firstName?: string;
    lastName?: string;
    nickname?: string;
    department?: string;
    phone?: string;
    office?: string;
  };
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
  // ✅ เพิ่มข้อมูลผู้ใช้สาขา (สำหรับการเบิกอุปกรณ์)
  requesterInfo?: {
    firstName?: string;
    lastName?: string;
    nickname?: string;
    department?: string;
    phone?: string;
    office?: string;
  };
}

/**
 * สร้าง InventoryItem ใหม่และอัปเดต InventoryMaster
 */
export async function createInventoryItem(params: CreateItemParams) {
  const { itemName, categoryId, serialNumber } = params;
  
  try {
    await dbConnect();
  } catch (dbError) {
    console.error('❌ Database connection failed:', dbError);
    throw new Error(`Database connection failed: ${dbError}`);
  }
  
  const {
    numberPhone,
    statusId = 'status_available',
    conditionId = 'cond_working',
    addedBy,
    addedByUserId,
    initialOwnerType,
    userId,
    assignedBy,
    notes,
    requesterInfo
  } = params;

  // Validate categoryId exists
  const config = await InventoryConfig.findOne({ 'categoryConfigs.id': categoryId });
  if (!config) {
    throw new Error(`Invalid categoryId: ${categoryId}`);
  }

  // Validate statusId exists - use more flexible query
  const statusExists = await InventoryConfig.findOne({ 
    'statusConfigs.id': statusId 
  });
  if (!statusExists) {
    // Allow default values even if config is not found
    if (statusId === 'status_available' || statusId === 'status_missing') {
      // Using default statusId
    } else {
      throw new Error(`Invalid statusId: ${statusId}`);
    }
  }

  // Validate conditionId exists - use more flexible query
  const conditionExists = await InventoryConfig.findOne({ 
    'conditionConfigs.id': conditionId 
  });
  if (!conditionExists) {
    // Allow default values even if config is not found
    if (conditionId === 'cond_working' || conditionId === 'cond_damaged') {
      // Using default conditionId
    } else {
      throw new Error(`Invalid conditionId: ${conditionId}`);
    }
  }

  // Enhanced Item Name validation - check for duplicates in recycle bin
  if (itemName && itemName.trim() !== '') {
    const { checkItemNameInRecycleBin } = await import('./recycle-bin-helpers');
    const recycleBinItem = await checkItemNameInRecycleBin(itemName.trim(), categoryId);
    
    if (recycleBinItem) {
      throw new Error(`เพิ่มรายการไม่ได้เพราะชื่อซ้ำกับในถังขยะ: "${itemName.trim()}" (รอกู้คืนใน 30 วัน)`);
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

    // Check if SN exists in recycle bin
    const { checkSerialNumberInRecycleBin } = await import('./recycle-bin-helpers');
    // อนุญาต SN ซ้ำข้าม "คนละชื่ออุปกรณ์" ดังนั้นตรวจเฉพาะภายในอุปกรณ์เดียวกัน (itemName+categoryId)
    const recycleBinItem = await checkSerialNumberInRecycleBin(trimmedSerialNumber, { itemName, categoryId });
    
    if (recycleBinItem) {
      throw new Error(`Serial Number "${trimmedSerialNumber}" exists in recycle bin for item: ${recycleBinItem.itemName} (รอกู้คืนใน 30 วัน)`);
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

    // ✅ Cross-validation: Check if phone number exists in User collection
    const User = (await import('../models/User')).default;
    const existingUser = await User.findOne({ 
      phone: trimmedNumberPhone,
      $or: [
        { deletedAt: { $exists: false } }, // Users without deletedAt field
        { deletedAt: null } // Users with deletedAt: null
      ]
    });
    if (existingUser) {
      throw new Error(`เบอร์โทรศัพท์ "${trimmedNumberPhone}" ถูกใช้โดยผู้ใช้: ${existingUser.firstName || ''} ${existingUser.lastName || ''} (${existingUser.office || ''})`);
    }

    // Check if phone number exists in recycle bin
    const { checkPhoneNumberInRecycleBin } = await import('./recycle-bin-helpers');
    // อนุญาตเบอร์ซ้ำข้าม "คนละชื่ออุปกรณ์" ดังนั้นตรวจเฉพาะภายในอุปกรณ์เดียวกัน (itemName+categoryId)
    const recycleBinPhoneItem = await checkPhoneNumberInRecycleBin(trimmedNumberPhone, { itemName, categoryId });
    
    if (recycleBinPhoneItem) {
      throw new Error(`Phone Number "${trimmedNumberPhone}" exists in recycle bin for SIM card: ${recycleBinPhoneItem.itemName} (รอกู้คืนใน 30 วัน)`);
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
  
  // Creating new InventoryItem
  
  const itemData: any = {
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
  };
  
  // ✅ เพิ่มข้อมูลผู้ใช้สาขา (เฉพาะเมื่อมีข้อมูล)
  if (requesterInfo) {
    console.log('💾 Saving requesterInfo:', requesterInfo);
    itemData.requesterInfo = requesterInfo;
  }
  
  const newItem = new InventoryItem(itemData);
  

  try {
    const savedItem = await newItem.save();

    // Update InventoryMaster immediately and ensure it completes
    try {
      await updateInventoryMaster(itemName, categoryId);
    } catch (masterError) {
      console.error('❌ Failed to update InventoryMaster:', masterError);
      // Force retry once more for critical sync
      try {
        await updateInventoryMaster(itemName, categoryId);
      } catch (retryError) {
        console.error('❌ InventoryMaster retry also failed:', retryError);
        // Don't throw here - item is already saved
      }
    }

    // Create TransferLog
    try {
      await TransferLog.create({
        itemId: (savedItem._id as any).toString(),
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
    } catch (logError) {
      console.error('❌ Failed to create TransferLog:', logError);
      // Don't throw here - item is already saved
    }

    return savedItem;
  } catch (saveError) {
    console.error('❌ Failed to save InventoryItem to database:', saveError);
    console.error('❌ Save error details:', {
      itemName: params.itemName,
      categoryId: params.categoryId,
      serialNumber: params.serialNumber,
      error: saveError instanceof Error ? saveError.message : String(saveError)
    });
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
    reason,
    requesterInfo
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

  // ✅ อัปเดต acquisitionMethod เป็น 'transferred' เมื่อโอนจาก admin_stock ให้ user
  if (fromOwnerType === 'admin_stock' && toOwnerType === 'user_owned') {
    item.sourceInfo.acquisitionMethod = 'transferred';
  }

  // ✅ คัดลอกข้อมูลผู้ใช้สาขา (เมื่อโอนให้ user_owned)
  if (toOwnerType === 'user_owned' && requesterInfo) {
    item.requesterInfo = {
      firstName: requesterInfo.firstName,
      lastName: requesterInfo.lastName,
      nickname: requesterInfo.nickname,
      department: requesterInfo.department,
      phone: requesterInfo.phone,
      office: requesterInfo.office
    };
  }

  const savedItem = await item.save();

  // Update InventoryMaster quantities
  await updateInventoryMaster(item.itemName, item.categoryId);

  // Create TransferLog (use item data directly - no ItemMaster needed)
  await TransferLog.create({
    itemId: (savedItem._id as any).toString(),
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
  
  try {
    // หา master record จาก itemName และ categoryId โดยตรง
    let updatedMaster = await InventoryMaster.findOne({ 
      itemName: itemName, 
      categoryId: categoryId 
    });
    
    
    if (!updatedMaster) {
      // สร้าง master ใหม่ - ต้องหา item แรกที่จะเป็น master
      const firstItem = await InventoryItem.findOne({ itemName, categoryId, deletedAt: { $exists: false } });
      if (!firstItem) {
        console.log('❌ No items found for:', { itemName, categoryId });
        return null;
      }
      
      
      updatedMaster = new InventoryMaster({ 
        masterItemId: (firstItem._id as any).toString(),
        itemName: itemName,
        categoryId,
        relatedItemIds: [(firstItem._id as any).toString()],
        totalQuantity: 0,
        availableQuantity: 0,
        userOwnedQuantity: 0
      });
      
      await updatedMaster.save();
    }

    // Calculate quantities from actual InventoryItems
    const allItems = await InventoryItem.find({
      itemName,
      categoryId,
      deletedAt: { $exists: false }
    });
    
    const adminStockItems = allItems.filter(item => item.currentOwnership.ownerType === 'admin_stock');
    const userOwnedItems = allItems.filter(item => item.currentOwnership.ownerType === 'user_owned');
    
    updatedMaster.totalQuantity = allItems.length;
    // 🆕 FIXED: availableQuantity ควรหมายถึงอุปกรณ์ทั้งหมดที่ยังอยู่ในระบบ (ไม่ได้ถูกเบิกไป)
    // รวมทุกสถานะของ admin_stock เพราะยังคงเป็น "คงเหลือ" ในระบบ
    updatedMaster.availableQuantity = adminStockItems.length;
    updatedMaster.userOwnedQuantity = userOwnedItems.length;
    
    // 🔧 Fix: อัปเดต relatedItemIds ให้ตรงกับ InventoryItems ที่มีอยู่จริง
    const currentRelatedIds = allItems.map(item => (item._id as any).toString());
    const existingRelatedIds = updatedMaster.relatedItemIds || [];
    
    // ตรวจสอบว่ามีการเปลี่ยนแปลงหรือไม่
    const hasChanges = currentRelatedIds.length !== existingRelatedIds.length || 
                      !currentRelatedIds.every(id => existingRelatedIds.includes(id));
    
    if (hasChanges) {
      updatedMaster.relatedItemIds = currentRelatedIds;
    }
    
    // 🆕 FIXED: Calculate status breakdown dynamically from all items using statusId
    const dynamicStatusBreakdown: Record<string, number> = {};
    const dynamicConditionBreakdown: Record<string, number> = {};
    
    allItems.forEach(item => {
      // Count by statusId (e.g., status_available, status_missing)
      if (item.statusId) {
        dynamicStatusBreakdown[item.statusId] = (dynamicStatusBreakdown[item.statusId] || 0) + 1;
      }
      // Count by conditionId (e.g., cond_working, cond_damaged)
      if (item.conditionId) {
        dynamicConditionBreakdown[item.conditionId] = (dynamicConditionBreakdown[item.conditionId] || 0) + 1;
      }
    });
    
    
    // 🆕 BREAKING CHANGE: Replace old statusBreakdown with dynamic one
    updatedMaster.statusBreakdown = dynamicStatusBreakdown;
    
    // 🆕 NEW: Save conditionBreakdown as well
    if (updatedMaster.conditionBreakdown !== undefined) {
      updatedMaster.conditionBreakdown = dynamicConditionBreakdown;
    } else {
      // Add conditionBreakdown if it doesn't exist (for backward compatibility)
      (updatedMaster as any).conditionBreakdown = dynamicConditionBreakdown;
    }
    
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
        itemIds: itemsWithSerialNumber.map(item => (item._id as any).toString())
      },
      withPhoneNumber: {
        count: itemsWithPhoneNumber.length,
        itemIds: itemsWithPhoneNumber.map(item => (item._id as any).toString())
      },
      other: {
        count: otherItems.length,
        itemIds: otherItems.map(item => (item._id as any).toString())
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
    
    await updatedMaster.save();
    
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
        
        const currentRelatedIds = relatedItems.map(item => (item._id as any).toString());
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
    itemId: (savedItem._id as any).toString(),
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
 * เปลี่ยนสถานะของอุปกรณ์ที่ไม่มี SN โดยใช้ STRICT MATCHING
 * 
 * กรณีที่ 1: เปลี่ยนสถานะแต่ไม่เปลี่ยนสภาพ → ต้องมีสภาพ "ใช้งานได้" เท่านั้น
 * กรณีที่ 2: เปลี่ยนสภาพแต่ไม่เปลี่ยนสถานะ → ต้องมีสถานะ "มี" เท่านั้น
 * 
 * @param itemName ชื่ออุปกรณ์
 * @param categoryId หมวดหมู่
 * @param newStatusId สถานะใหม่ (ถ้าต้องการเปลี่ยน)
 * @param newConditionId สภาพใหม่ (ถ้าต้องการเปลี่ยน)
 * @param currentStatusId สถานะปัจจุบันที่ต้องการเปลี่ยน (สำหรับ status change)
 * @param currentConditionId สภาพปัจจุบันที่ต้องการเปลี่ยน (สำหรับ condition change)
 * @param quantity จำนวนที่ต้องการเปลี่ยน
 * @param changedBy ผู้ทำการเปลี่ยน
 * @param reason เหตุผล
 * @throws Error เมื่อไม่พบอุปกรณ์ที่ตรงตามเงื่อนไข strict matching
 */
export async function changeNonSNItemStatusWithPriority(
  itemName: string,
  categoryId: string,
  newStatusId?: string,
  newConditionId?: string,
  currentStatusId?: string,
  currentConditionId?: string,
  quantity: number = 1,
  changedBy: string,
  reason?: string
  ) {
    // สร้าง query สำหรับอุปกรณ์ที่ไม่มี SN
  const baseQuery = {
    itemName,
    categoryId,
    'currentOwnership.ownerType': 'admin_stock',
    deletedAt: { $exists: false },
    $and: [
      { $or: [{ serialNumber: { $exists: false } }, { serialNumber: '' }] },
      { $or: [{ numberPhone: { $exists: false } }, { numberPhone: '' }] }
    ]
  };

  let targetItems: any[] = [];

  // กรณีที่ 1: เปลี่ยนสถานะแต่ไม่เปลี่ยนสภาพ
  if (newStatusId && !newConditionId && currentStatusId) {
    
    // หาอุปกรณ์ที่มีสภาพ "ใช้งานได้" เท่านั้น
    const workingItems = await InventoryItem.find({
      ...baseQuery,
      statusId: currentStatusId,
      conditionId: 'cond_working'
    }).limit(quantity);


    // ตรวจสอบว่าเพียงพอหรือไม่
    if (workingItems.length < quantity) {
      throw new Error(`ไม่พบอุปกรณ์ที่มีสภาพ "ใช้งานได้" เพียงพอสำหรับการเปลี่ยนสถานะ (พบ ${workingItems.length} ชิ้น ต้องการ ${quantity} ชิ้น)`);
    }

    targetItems = workingItems;

    // อัปเดตสถานะ
    for (const item of targetItems) {
      await InventoryItem.findByIdAndUpdate(item._id, {
        statusId: newStatusId,
        updatedAt: new Date()
      });
    }
  }
  
  // กรณีที่ 2: เปลี่ยนสภาพแต่ไม่เปลี่ยนสถานะ
  else if (newConditionId && !newStatusId && currentConditionId) {
    
    // หาอุปกรณ์ที่มีสถานะ "มี" เท่านั้น
    const availableItems = await InventoryItem.find({
      ...baseQuery,
      conditionId: currentConditionId,
      statusId: 'status_available'
    }).limit(quantity);


    // ตรวจสอบว่าเพียงพอหรือไม่
    if (availableItems.length < quantity) {
      throw new Error(`ไม่พบอุปกรณ์ที่มีสถานะ "มี" เพียงพอสำหรับการเปลี่ยนสภาพ (พบ ${availableItems.length} ชิ้น ต้องการ ${quantity} ชิ้น)`);
    }

    targetItems = availableItems;

    // อัปเดตสภาพ
    for (const item of targetItems) {
      await InventoryItem.findByIdAndUpdate(item._id, {
        conditionId: newConditionId,
        updatedAt: new Date()
      });
    }
  }
  
  // กรณีที่ 3: เปลี่ยนทั้งสถานะและสภาพ
  else if (newStatusId && newConditionId && currentStatusId && currentConditionId) {
    
    targetItems = await InventoryItem.find({
      ...baseQuery,
      statusId: currentStatusId,
      conditionId: currentConditionId
    }).limit(quantity);


    // อัปเดตทั้งสถานะและสภาพ
    for (const item of targetItems) {
      await InventoryItem.findByIdAndUpdate(item._id, {
        statusId: newStatusId,
        conditionId: newConditionId,
        updatedAt: new Date()
      });
    }
  }
  
  else {
    throw new Error('Invalid parameters: Must specify either newStatusId or newConditionId with corresponding current values');
  }

  if (targetItems.length === 0) {
    throw new Error('ไม่พบอุปกรณ์ที่ตรงตามเงื่อนไขที่ระบุ');
  }


  // อัปเดต InventoryMaster
  await updateInventoryMaster(itemName, categoryId);

  // สร้าง log สำหรับการเปลี่ยนแปลง
  const logReason = reason || `Bulk status/condition change: ${targetItems.length} items updated`;
  
  // สร้าง TransferLog สำหรับแต่ละรายการ
  for (const item of targetItems) {
    await TransferLog.create({
      itemId: (item._id as any).toString(),
      itemName: item.itemName,
      category: item.categoryId,
      serialNumber: item.serialNumber,
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
      reason: logReason
    });
  }

  return {
    updatedCount: targetItems.length,
    updatedItems: targetItems.map(item => ({
      id: item._id.toString(),
      statusId: newStatusId || item.statusId,
      conditionId: newConditionId || item.conditionId
    }))
  };
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
  
  try {
    // หา InventoryMaster ที่มี masterItemId เป็น item ที่ถูกลบ
    const master = await InventoryMaster.findOne({ masterItemId: deletedItemId });
    
    if (!master) {
      return;
    }
    
    
    // ลบ deletedItemId ออกจาก relatedItemIds
    master.relatedItemIds = master.relatedItemIds.filter(id => id !== deletedItemId);
    
    if (master.relatedItemIds.length === 0) {
      // ไม่มี item เหลือ -> ลบ InventoryMaster
      console.log('❌ No items left in group, deleting InventoryMaster:', master._id);
      await InventoryMaster.deleteOne({ _id: master._id });
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
      return;
    }
    
    // อัปเดต masterItemId เป็น item ตัวใหม่
    const oldMasterItemId = master.masterItemId;
    master.masterItemId = (nextMasterItem._id as any).toString();
    master.lastUpdated = new Date();
    
    await master.save();
    
    // 🆕 Enhanced Logging
    
  } catch (error) {
    console.error('❌ handleMasterItemDeletion failed:', error);
    throw error;
  }
}

/**
 * 🆕 ฟื้นฟู InventoryItem จาก soft delete พร้อมจัดการ InventoryMaster
 */
export async function restoreInventoryItem(itemId: string, restoredBy: string) {
  
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
      master = new InventoryMaster({
        masterItemId: (savedItem._id as any).toString(),
        categoryId,
        relatedItemIds: [(savedItem._id as any).toString()],
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
  
  
  const results = [];
  for (const combo of combinations) {
    try {
      const result = await updateInventoryMaster(combo._id.itemName, combo._id.categoryId);
      results.push(result);
    } catch (error) {
      console.error(`❌ Failed to update InventoryMaster for ${combo._id.itemName}:`, error);
      // Continue with other items even if one fails
    }
  }
  
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
    serialNumber: { $exists: true, $nin: [null, ''] },
    deletedAt: { $exists: false }
  }, { serialNumber: 1 }).lean();
  
  return items.map(item => item.serialNumber).filter((sn): sn is string => Boolean(sn));
}

/**
 * ดึงรายการ Phone Numbers ที่มีจริง
 */
export async function getPhoneNumbers(itemName: string, categoryId: string): Promise<string[]> {
  const items = await InventoryItem.find({
    itemName,
    categoryId,
    numberPhone: { $exists: true, $nin: [null, ''] },
    deletedAt: { $exists: false }
  }, { numberPhone: 1 }).lean();
  
  return items.map(item => item.numberPhone).filter((phone): phone is string => Boolean(phone));
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
    
    
    return {
      success: true,
      updatedCount: updateResult.modifiedCount,
      oldName: oldItemName,
      newName: newItemName,
      masterId: (master._id as any).toString()
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
                { $or: [
                  { $eq: ['$serialNumber', null] },
                  { $eq: ['$serialNumber', ''] },
                  { $eq: [{ $type: '$serialNumber' }, 'missing'] }
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
    }
  };
}

export async function syncAdminStockItems(itemName: string, categoryId: string, targetAdminStock: number, reason: string, adminId: string, newCategoryId?: string, newStatusId?: string, newConditionId?: string) {
  
  // Get current admin stock items
  const currentAdminItems = await InventoryItem.find({
    itemName,
    categoryId,
    'currentOwnership.ownerType': 'admin_stock',
    deletedAt: { $exists: false } // 🆕 FIXED: ใช้ deletedAt เพื่อกรองรายการที่ถูกลบ
  }).sort({ updatedAt: -1 }); // 🆕 FIXED: เรียงตามวันที่อัปเดตล่าสุด ใหม่ไปเก่า
  
  const currentCount = currentAdminItems.length;
  
  // 🆕 DEBUG: แสดงรายการอุปกรณ์ทั้งหมดที่พบ
  currentAdminItems.forEach((item, index) => {
    console.log(`  ${index + 1}. ID: ${item._id}, Status: ${item.statusId}, Condition: ${item.conditionId}, SN: ${item.serialNumber || 'No SN'}`);
  });
  
  // Update existing items if new values are specified
  if (newCategoryId || newStatusId || newConditionId) {
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
        item.updatedAt = new Date();
        await item.save();
      }
    }
  }
  
  if (currentCount < targetAdminStock) {
    // Need to create more items - BUT only if targeting available+working
    const itemsToCreate = targetAdminStock - currentCount;
    console.log(`➕ Need to create ${itemsToCreate} new admin stock items`);
    
    // 🆕 CRITICAL: Only create new items if they will be status_available + cond_working
    const createNewItems = (newStatusId === 'status_available' || !newStatusId) && 
                           (newConditionId === 'cond_working' || !newConditionId);
    
    if (createNewItems) {
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
    } else {
    }
  } else if (currentCount > targetAdminStock) {
    // Need to remove items
    const itemsToRemove = currentCount - targetAdminStock;
    console.log(`➖ Removing ${itemsToRemove} admin stock items`);
    
    // 🆕 FIXED: Remove only items without SN that have BOTH status "available" AND condition "working"
    // ต้องตรงทั้ง 2 เงื่อนไขพร้อมกัน ถึงจะสามารถลบได้
    const itemsWithoutSN = currentAdminItems.filter(item => {
      const hasNoSN = !item.serialNumber && !item.numberPhone;
      const isAvailable = item.statusId === 'status_available';
      const isWorking = item.conditionId === 'cond_working';
      
      
      return hasNoSN && isAvailable && isWorking;
    }).sort((a, b) => {
      // 🔧 CRITICAL FIX: เรียงตาม updatedAt เก่าก่อน (ลบตัวที่อัปเดตเก่าก่อน)
      // เพื่อไม่ให้ลบอุปกรณ์ที่เพิ่งเปลี่ยนสถานะ
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });
    
    
    // 🆕 DEBUG: แสดงรายการอุปกรณ์ที่กรองแล้ว
    itemsWithoutSN.forEach((item, index) => {
    });
    
    if (itemsWithoutSN.length < itemsToRemove) {
      console.warn(`⚠️ Warning: Only ${itemsWithoutSN.length} items available for deletion, but need to remove ${itemsToRemove}`);
      currentAdminItems.forEach(item => {
        console.log(`  - ID: ${item._id}, Status: ${item.statusId}, Condition: ${item.conditionId}, SN: ${item.serialNumber || 'No SN'}`);
      });
    }
    
    const itemsToDelete = itemsWithoutSN.slice(0, itemsToRemove);
    
    // 🆕 DEBUG: แสดงรายการที่จะถูกลบ
    itemsToDelete.forEach((item, index) => {
    });
    
    for (const item of itemsToDelete) {
      // 🔧 CRITICAL FIX: Use hard delete for non-SN items to prevent count discrepancy
      // Only non-SN items with "available" status and "working" condition should be deleted
      
      // Hard delete the item to prevent count discrepancy
      await InventoryItem.findByIdAndDelete(item._id);
    }
    
    // 🆕 CRITICAL: Check if we couldn't delete enough items
    if (itemsToDelete.length < itemsToRemove) {
      console.error(`❌ Could only delete ${itemsToDelete.length} out of ${itemsToRemove} required items`);
      console.error(`❌ Available items for deletion: ${itemsWithoutSN.length} (non-SN + available + working)`);
      console.error(`❌ Current admin items by status/condition:`);
      const statusConditionBreakdown: Record<string, number> = {};
      currentAdminItems.forEach(item => {
        const key = `${item.statusId}_${item.conditionId}`;
        statusConditionBreakdown[key] = (statusConditionBreakdown[key] || 0) + 1;
      });
      console.error(`❌ Breakdown:`, statusConditionBreakdown);
      
      throw new Error(`ไม่สามารถลดจำนวนได้ มีอุปกรณ์ที่สถานะ "มี" และสภาพ "ใช้งานได้" เพียง ${itemsWithoutSN.length} ชิ้น แต่ต้องการลด ${itemsToRemove} ชิ้น`);
    }
  }
  
  // Update InventoryMaster - ไม่มีการเปลี่ยนหมวดหมู่
  await updateInventoryMaster(itemName, categoryId);
  
  return true;
}

/**
 * 🆕 ดึงรายการอุปกรณ์สำหรับ dropdown (ใช้ masterItemId)
 */
export async function getEquipmentTypesForDropdown() {
  
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
      
      const categoryConfig = categoryConfigs.find((c: any) => c.id === master.categoryId);
      
      return {
        masterId: (master._id as any).toString(),
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
        itemIds: itemsWithSerialNumber.map(item => (item._id as any).toString())
      },
      withPhoneNumber: {
        count: itemsWithPhoneNumber.length,
        itemIds: itemsWithPhoneNumber.map(item => (item._id as any).toString())
      },
      other: {
        count: otherItems.length,
        itemIds: otherItems.map(item => (item._id as any).toString())
      }
    };

    await master.save();
    
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
    
    const masters = await InventoryMaster.find({});
    let updatedCount = 0;
    
    for (const master of masters) {
      await updateItemDetails((master._id as any).toString());
      updatedCount++;
    }
    
    
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
      await updateItemDetails((master._id as any).toString());
      await master.save();
    }

    return master.itemDetails;
    
  } catch (error) {
    console.error('❌ getItemDetailsDetailed failed:', error);
    throw error;
  }
}
