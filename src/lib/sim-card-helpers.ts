/**
 * SIM Card Helper Functions
 * ฟังก์ชันสำหรับตรวจสอบหมวดหมู่ซิมการ์ด
 * ใช้ใน client-side components
 */

/**
 * ตรวจสอบว่า categoryId เป็นหมวดหมู่ซิมการ์ดหรือไม่ (synchronous version)
 * ใช้สำหรับกรณีที่ต้องการความเร็วและรู้ว่าข้อมูลอยู่ใน cache
 * ใช้ระบบใหม่เท่านั้น (Reference-based system)
 */
export function isSIMCardSync(categoryId: string): boolean {
  if (!categoryId) return false;
  
  // ตรวจสอบจากระบบใหม่ (hardcoded values สำหรับ client-side)
  // ใช้ cat_sim_card เป็น reference ID ตามระบบใหม่
  return categoryId === 'cat_sim_card';
}

/**
 * ตรวจสอบว่า categoryId เป็นหมวดหมู่ซิมการ์ดหรือไม่ (async version)
 * ใช้สำหรับ server-side components ที่สามารถเข้าถึง database ได้
 * ใช้ระบบใหม่เท่านั้น (Reference-based system)
 */
export async function isSIMCard(categoryId: string): Promise<boolean> {
  if (!categoryId) return false;
  
  // ตรวจสอบจากระบบใหม่ (categoryId) - ต้องใช้ใน server-side เท่านั้น
  try {
    const { getCategoryConfigById } = await import('./category-helpers');
    const categoryConfig = await getCategoryConfigById(categoryId);
    return categoryConfig?.name === 'ซิมการ์ด' || false;
  } catch (error) {
    // ถ้าไม่สามารถเข้าถึง database ได้ ให้ใช้ fallback
    console.warn('Cannot access database for SIM card check, using fallback:', error);
    return isSIMCardSync(categoryId);
  }
}
