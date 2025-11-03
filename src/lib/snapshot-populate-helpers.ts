import dbConnect from '@/lib/mongodb';

/**
 * Helper function สำหรับดึงชื่อปัจจุบันของ item จาก masterId
 * ใช้สำหรับแสดงชื่อปัจจุบันใน snapshot ถ้ามี masterId
 * 
 * @param masterId - InventoryMaster._id
 * @returns ชื่อปัจจุบันของ item หรือ null ถ้าไม่พบ
 */
export async function getCurrentItemName(masterId: string): Promise<string | null> {
  try {
    await dbConnect();
    const InventoryMaster = (await import('@/models/InventoryMaster')).default;
    
    const master = await InventoryMaster.findById(masterId).select('itemName').lean();
    return master?.itemName || null;
  } catch (error) {
    console.error('Error getting current item name:', error);
    return null;
  }
}

/**
 * Helper function สำหรับ populate snapshot itemDetails ด้วยชื่อปัจจุบัน
 * ถ้ามี masterId จะดึงชื่อปัจจุบันจาก InventoryMaster
 * ถ้าไม่มี masterId หรือ master ถูกลบแล้ว จะใช้ชื่อที่ snapshot ไว้
 * 
 * @param itemDetails - Array of item details from snapshot
 * @returns Array of item details with current name populated
 */
export async function populateSnapshotItemNames(itemDetails: Array<{
  masterId?: string;
  itemName: string;
  categoryId: string;
  categoryName: string;    // ชื่อหมวดหมู่ ณ เวลาที่ snapshot
  totalQuantity: number;
  availableQuantity: number;
  userOwnedQuantity: number;
  isLowStock: boolean;
}>): Promise<Array<{
  masterId?: string;
  itemName: string;
  currentItemName: string;  // 🆕 ชื่อปัจจุบัน (ถ้ามี masterId)
  categoryId: string;
  categoryName: string;     // ชื่อหมวดหมู่ ณ เวลาที่ snapshot
  totalQuantity: number;
  availableQuantity: number;
  userOwnedQuantity: number;
  isLowStock: boolean;
}>> {
  try {
    await dbConnect();
    const InventoryMaster = (await import('@/models/InventoryMaster')).default;
    
    // ดึง masterIds ทั้งหมด
    const masterIds = itemDetails
      .map(item => item.masterId)
      .filter((id): id is string => !!id);
    
    // ดึงข้อมูล master ทั้งหมดในครั้งเดียว
    const masters = await InventoryMaster.find({
      _id: { $in: masterIds }
    }).select('_id itemName').lean();
    
    // สร้าง map สำหรับ lookup
    const masterMap = new Map<string, string>();
    masters.forEach(master => {
      masterMap.set(master._id.toString(), master.itemName);
    });
    
    // Populate ชื่อปัจจุบัน
    return itemDetails.map(item => ({
      ...item,
      currentItemName: item.masterId && masterMap.has(item.masterId)
        ? masterMap.get(item.masterId)!
        : item.itemName  // ใช้ชื่อที่ snapshot ไว้ถ้าไม่มี masterId หรือ master ถูกลบแล้ว
    }));
  } catch (error) {
    console.error('Error populating snapshot item names:', error);
    // ถ้าเกิด error ให้ใช้ชื่อเดิม
    return itemDetails.map(item => ({
      ...item,
      currentItemName: item.itemName
    }));
  }
}

