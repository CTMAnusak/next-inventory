/**
 * Inventory System Constants
 * 
 * กำหนดค่าคงที่สำหรับระบบ inventory เพื่อป้องกันการใช้ hard-coded strings
 * และทำให้การบำรุงรักษาโค้ดง่ายขึ้น
 */

// ประเภทหมวดหมู่อุปกรณ์
export const INVENTORY_CATEGORIES = {
  SIM_CARD: 'ซิมการ์ด',
  COMPUTER: 'คอมพิวเตอร์และแล็ปท็อป',
  NETWORK: 'อุปกรณ์เครือข่าย',
  PRINTER: 'ปริ้นเตอร์และสแกนเนอร์',
  ACCESSORIES: 'อุปกรณ์เสริม',
  SOFTWARE: 'ซอฟต์แวร์',
  OTHER: 'อื่นๆ',
  UNSPECIFIED: 'ไม่ระบุ'
} as const;

// สถานะของอุปกรณ์
export const INVENTORY_STATUS = {
  ACTIVE: 'active',
  MAINTENANCE: 'maintenance',
  DAMAGED: 'damaged',
  RETIRED: 'retired',
  DELETED: 'deleted'
} as const;

// ประเภทการเป็นเจ้าของ
export const OWNERSHIP_TYPE = {
  ADMIN_STOCK: 'admin_stock',
  USER_OWNED: 'user_owned'
} as const;

// ประเภทการเพิ่มข้อมูล
export const ADDED_BY_TYPE = {
  ADMIN: 'admin',
  USER: 'user',
  SYSTEM: 'system'
} as const;

// ฟังก์ชันช่วยเหลือ
export const isSIMCard = (category: string): boolean => {
  return category === INVENTORY_CATEGORIES.SIM_CARD;
};

export const isValidCategory = (category: string): boolean => {
  return Object.values(INVENTORY_CATEGORIES).includes(category as any);
};

export const isValidStatus = (status: string): boolean => {
  return Object.values(INVENTORY_STATUS).includes(status as any);
};

// Type exports สำหรับ TypeScript
export type InventoryCategory = typeof INVENTORY_CATEGORIES[keyof typeof INVENTORY_CATEGORIES];
export type InventoryStatus = typeof INVENTORY_STATUS[keyof typeof INVENTORY_STATUS];
export type OwnershipType = typeof OWNERSHIP_TYPE[keyof typeof OWNERSHIP_TYPE];
export type AddedByType = typeof ADDED_BY_TYPE[keyof typeof ADDED_BY_TYPE];
