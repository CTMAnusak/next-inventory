import RecycleBin from '@/models/RecycleBin';
import InventoryItem from '@/models/InventoryItem';
import { updateInventoryMaster } from './inventory-helpers';
import dbConnect from './mongodb';

export interface MoveToRecycleBinParams {
  item: any;  // InventoryItem document
  deleteType: 'individual_item' | 'category_bulk';
  deleteReason: string;
  deletedBy: string;
  deletedByName: string;
}

export interface RestoreFromRecycleBinParams {
  recycleBinId: string;
  restoredBy: string;
  restoredByName: string;
}

/**
 * ย้ายอุปกรณ์ไปยังถังขยะ
 */
export async function moveToRecycleBin(params: MoveToRecycleBinParams) {
  const { item, deleteType, deleteReason, deletedBy, deletedByName } = params;
  
  await dbConnect();
  
  // สร้างรายการในถังขยะ
  const recycleBinItem = new RecycleBin({
    itemName: item.itemName,
    category: item.category,
    serialNumber: item.serialNumber,
    numberPhone: item.numberPhone,  // เพิ่ม numberPhone
    deleteType,
    deleteReason,
    deletedBy,
    deletedByName,
    deletedAt: new Date(),
    originalData: item.toObject ? item.toObject() : item
  });
  
  await recycleBinItem.save();
  
  return recycleBinItem;
}

/**
 * กู้คืนอุปกรณ์จากถังขยะ
 */
export async function restoreFromRecycleBin(params: RestoreFromRecycleBinParams) {
  const { recycleBinId, restoredBy, restoredByName } = params;
  
  await dbConnect();
  
  // หา item ในถังขยะ
  const recycleBinItem = await RecycleBin.findById(recycleBinId);
  if (!recycleBinItem) {
    throw new Error('ไม่พบรายการในถังขยะ');
  }
  
  if (recycleBinItem.deleteType === 'individual_item') {
    // กู้คืนอุปกรณ์รายชิ้น
    // 🔧 CRITICAL FIX: ป้องกัน duplicate key error สำหรับ serialNumber
    const itemData: any = {
      itemName: recycleBinItem.itemName,
      category: recycleBinItem.category,
      status: recycleBinItem.originalData.status, // กู้คืนสถานะเดิม
      currentOwnership: recycleBinItem.originalData.currentOwnership,
      sourceInfo: recycleBinItem.originalData.sourceInfo,
      transferInfo: recycleBinItem.originalData.transferInfo
    };
    
    // เพิ่ม serialNumber เฉพาะเมื่อมีค่าจริง (ไม่ใช่ null หรือ undefined)
    if (recycleBinItem.serialNumber && recycleBinItem.serialNumber.trim() !== '') {
      itemData.serialNumber = recycleBinItem.serialNumber;
    }
    
    // เพิ่ม numberPhone เฉพาะเมื่อมีค่าจริง (ไม่ใช่ null หรือ undefined)
    if (recycleBinItem.numberPhone && recycleBinItem.numberPhone.trim() !== '') {
      itemData.numberPhone = recycleBinItem.numberPhone;
    }
    
    const restoredItem = new InventoryItem(itemData);
    
    try {
      await restoredItem.save();
    } catch (error) {
      console.error(`❌ Error saving restored item:`, error);
      
      // ถ้าเป็น duplicate key error ให้แสดงข้อมูลเพิ่มเติม
      if ((error as any).code === 11000) {
        console.error(`🔍 Duplicate key details:`, {
          itemName: itemData.itemName,
          category: itemData.category,
          serialNumber: itemData.serialNumber,
          numberPhone: itemData.numberPhone
        });
        throw new Error(`รายการนี้มีอยู่ในระบบแล้ว: ${itemData.itemName} ${itemData.serialNumber ? `(SN: ${itemData.serialNumber})` : '(ไม่มี SN)'}`);
      }
      throw error;
    }
    
    // อัปเดต InventoryMaster (ข้าม auto-detection เพื่อป้องกันการสร้างรายการเพิ่ม)
    await updateInventoryMaster(recycleBinItem.itemName, recycleBinItem.categoryId, { skipAutoDetection: true });
    
    // ลบข้อมูลออกจากถังขยะ (เนื่องจากกู้คืนเสร็จแล้ว)
    await RecycleBin.findByIdAndDelete(recycleBinId);
    
    return { type: 'individual', item: restoredItem };
    
  } else if ((recycleBinItem as any).deleteType === 'category_bulk') {
    // กู้คืนหมวดหมู่ทั้งหมด
    const categoryItems = await RecycleBin.find({
      itemName: recycleBinItem.itemName,
      category: recycleBinItem.category,
      deleteType: 'category_bulk'
    });
    
    const restoredItems = [];
    const errors = [];
    
    for (const item of categoryItems) {
      try {
        // 🔧 CRITICAL FIX: ป้องกัน duplicate key error สำหรับ category bulk restore
        const itemData: any = {
          itemName: item.itemName,
          category: item.category,
          status: item.originalData.status, // กู้คืนสถานะเดิม
          currentOwnership: item.originalData.currentOwnership,
          sourceInfo: item.originalData.sourceInfo,
          transferInfo: item.originalData.transferInfo
        };
        
        // เพิ่ม serialNumber เฉพาะเมื่อมีค่าจริง (ไม่ใช่ null หรือ undefined)
        if (item.serialNumber && item.serialNumber.trim() !== '') {
          itemData.serialNumber = item.serialNumber;
        }
        
        // เพิ่ม numberPhone เฉพาะเมื่อมีค่าจริง (ไม่ใช่ null หรือ undefined)
        if (item.numberPhone && item.numberPhone.trim() !== '') {
          itemData.numberPhone = item.numberPhone;
        }
        
        const restoredItem = new InventoryItem(itemData);
        await restoredItem.save();
        restoredItems.push(restoredItem);
        
      } catch (error) {
        console.error(`❌ Error restoring item ${item.itemName}:`, error);
        
        // ถ้าเป็น duplicate key error ให้เก็บ error ไว้แต่ไม่หยุดการทำงาน
        if ((error as any).code === 11000) {
          const errorMsg = `รายการ ${item.itemName} ${item.serialNumber ? `(SN: ${item.serialNumber})` : '(ไม่มี SN)'} มีอยู่ในระบบแล้ว`;
          errors.push(errorMsg);
          console.error(`🔍 Duplicate key: ${errorMsg}`);
        } else {
          errors.push(`เกิดข้อผิดพลาดกับรายการ ${item.itemName}: ${(error as Error).message}`);
        }
      }
    }
    
    if (errors.length > 0) {
      console.log(`⚠️ Errors encountered: ${errors.length} items`);
      errors.forEach(error => console.log(`   - ${error}`));
    }
    
    // อัปเดต InventoryMaster (ข้าม auto-detection เพื่อป้องกันการสร้างรายการเพิ่ม)
    await updateInventoryMaster(recycleBinItem.itemName, recycleBinItem.categoryId, { skipAutoDetection: true });
    
    // ลบข้อมูลทั้งหมดของ category นี้ออกจากถังขยะ (เนื่องจากกู้คืนเสร็จแล้ว)
    const deleteResult = await RecycleBin.deleteMany({
      itemName: recycleBinItem.itemName,
      category: recycleBinItem.category,
      deleteType: 'category_bulk'
    });
    
    // ถ้ามี errors ให้ throw error พร้อมรายละเอียด
    if (errors.length > 0) {
      const successCount = restoredItems.length;
      const errorCount = errors.length;
      const totalCount = categoryItems.length;
      
      throw new Error(`กู้คืนสำเร็จ ${successCount}/${totalCount} รายการ. ไม่สามารถกู้คืนได้ ${errorCount} รายการเนื่องจาก:\n${errors.join('\n')}`);
    }
    
    return { type: 'category', items: restoredItems };
  }
  
  throw new Error('ประเภทการลบไม่ถูกต้อง');
}

/**
 * ตรวจสอบว่า Serial Number มีอยู่ในถังขยะหรือไม่
 */
export async function checkSerialNumberInRecycleBin(serialNumber: string, options?: { itemName?: string; categoryId?: string }) {
  if (!serialNumber || serialNumber.trim() === '') {
    return null;
  }
  
  await dbConnect();
  
  // ✅ ใหม่: ไม่ต้องตรวจสอบ isRestored เพราะข้อมูลที่กู้คืนแล้วจะถูกลบออกจากถังขยะ
  // หากระบุ itemName/categoryId ให้ match เฉพาะรายการที่เป็นอุปกรณ์เดียวกันเท่านั้น
  const query: any = { serialNumber: serialNumber.trim() };
  if (options?.itemName) {
    query.itemName = options.itemName.trim();
  }
  if (options?.categoryId) {
    query.categoryId = options.categoryId;
  }
  const recycleBinItem = await RecycleBin.findOne(query);
  return recycleBinItem;
}

/**
 * ตรวจสอบว่า Phone Number มีอยู่ในถังขยะหรือไม่
 */
export async function checkPhoneNumberInRecycleBin(numberPhone: string, options?: { itemName?: string; categoryId?: string }) {
  if (!numberPhone || numberPhone.trim() === '') {
    return null;
  }
  
  await dbConnect();
  
  // ✅ ใหม่: ไม่ต้องตรวจสอบ isRestored เพราะข้อมูลที่กู้คืนแล้วจะถูกลบออกจากถังขยะ
  // หากระบุ itemName/categoryId ให้ match เฉพาะรายการที่เป็นอุปกรณ์เดียวกันเท่านั้น
  const query: any = { numberPhone: numberPhone.trim() };
  if (options?.itemName) {
    query.itemName = options.itemName.trim();
  }
  if (options?.categoryId) {
    query.categoryId = options.categoryId;
  }
  const recycleBinItem = await RecycleBin.findOne(query);
  return recycleBinItem;
}

/**
 * ตรวจสอบว่า Item Name มีอยู่ในถังขยะหรือไม่
 */
export async function checkItemNameInRecycleBin(itemName: string, categoryId?: string) {
  if (!itemName || itemName.trim() === '') {
    return null;
  }
  
  await dbConnect();
  
  const query: any = {
    itemName: itemName.trim()
  };
  
  // ถ้ามี categoryId ให้ตรวจสอบเฉพาะในหมวดหมู่นั้น
  if (categoryId) {
    query.categoryId = categoryId;
  }
  
  const recycleBinItem = await RecycleBin.findOne(query);
  return recycleBinItem;
}

/**
 * ลบรายการในถังขยะอย่างถาวร (Auto-cleanup)
 */
export async function permanentDeleteExpiredItems() {
  await dbConnect();
  
  
  const expiredItems = await (RecycleBin as any).findExpiredItems();
  
  if (expiredItems.length === 0) {
    return { deletedCount: 0, items: [] };
  }
  
  const deletedItems = [];
  for (const item of expiredItems) {
    deletedItems.push({
      itemName: item.itemName,
      category: item.category,
      serialNumber: item.serialNumber,
      deletedAt: item.deletedAt,
      permanentDeleteAt: item.permanentDeleteAt
    });
  }
  
  // ลบรายการทั้งหมดที่หมดอายุ
  const result = await RecycleBin.deleteMany({
    _id: { $in: expiredItems.map((item: any) => item._id) }
  });
  
  
  return {
    deletedCount: result.deletedCount,
    items: deletedItems
  };
}

/**
 * ดึงรายการในถังขยะ (สำหรับ UI)
 */
export async function getRecycleBinItems(type: 'individual' | 'category' = 'individual', page: number = 1, limit: number = 50) {
  await dbConnect();
  
  if (type === 'individual') {
    const items = await (RecycleBin as any).findDeletedItems(page, limit);
    const total = await RecycleBin.countDocuments({ 
      deleteType: 'individual_item'
    });
    
    return { items, total, page, limit };
  } else {
    // Group by itemName + category for category view
    const categories = await RecycleBin.aggregate([
      {
        $match: {
          deleteType: 'category_bulk'
        }
      },
      {
        $group: {
          _id: { itemName: '$itemName', category: '$category' },
          count: { $sum: 1 },
          deletedAt: { $first: '$deletedAt' },
          deleteReason: { $first: '$deleteReason' },
          deletedBy: { $first: '$deletedBy' },
          deletedByName: { $first: '$deletedByName' },
          permanentDeleteAt: { $first: '$permanentDeleteAt' },
          sampleId: { $first: '$_id' }
        }
      },
      {
        $sort: { deletedAt: -1 }
      },
      {
        $skip: (page - 1) * limit
      },
      {
        $limit: limit
      }
    ]);
    
    const totalCategories = await RecycleBin.aggregate([
      {
        $match: {
          deleteType: 'category_bulk'
        }
      },
      {
        $group: {
          _id: { itemName: '$itemName', category: '$category' }
        }
      },
      {
        $count: 'total'
      }
    ]);
    
    const total = totalCategories[0]?.total || 0;
    
    return { items: categories, total, page, limit };
  }
}
