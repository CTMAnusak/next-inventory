/**
 * Status Helper Functions
 * ฟังก์ชันสำหรับจัดการการแปลงระหว่าง statusId และ statusName
 */

export interface IStatusConfig {
  id: string;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * แปลง statusId เป็น statusName
 */
export const getStatusNameById = (statusId: string, statusConfigs: IStatusConfig[]): string => {
  if (!statusId || !statusConfigs || statusConfigs.length === 0) {
    return statusId || 'ไม่ระบุ';
  }
  
  const found = statusConfigs.find(s => s.id === statusId);
  return found?.name || statusId;
};

/**
 * แปลง statusName เป็น statusId
 */
export const getStatusIdByName = (statusName: string, statusConfigs: IStatusConfig[]): string => {
  if (!statusName || !statusConfigs || statusConfigs.length === 0) {
    return '';
  }
  
  const found = statusConfigs.find(s => s.name === statusName);
  return found?.id || '';
};

/**
 * ดึง status config object จาก statusId
 */
export const getStatusConfigById = (statusId: string, statusConfigs: IStatusConfig[]): IStatusConfig | null => {
  if (!statusId || !statusConfigs || statusConfigs.length === 0) {
    return null;
  }
  
  return statusConfigs.find(s => s.id === statusId) || null;
};

/**
 * แปลง statusId เป็น CSS class สำหรับแสดงสี
 * รองรับทั้ง statusId และ status string (backward compatibility)
 */
export const getStatusClass = (statusIdOrName: string, statusConfigs?: IStatusConfig[]): string => {
  let statusName = statusIdOrName;
  
  // ถ้าส่ง statusConfigs มา ให้พยายามแปลง statusId เป็น name
  if (statusConfigs && statusConfigs.length > 0) {
    const foundById = statusConfigs.find(s => s.id === statusIdOrName);
    if (foundById) {
      statusName = foundById.name;
    }
  }
  
  // Map ชื่อสถานะเป็นสี (รองรับทั้งชื่อไทยและอังกฤษ)
  const statusLower = statusName.toLowerCase();
  
  if (statusLower === 'active' || statusName === 'ใช้งานได้' || statusName === 'ปกติ') {
    return 'bg-green-100 text-green-800';
  }
  if (statusLower === 'maintenance' || statusName === 'ซ่อมบำรุง' || statusName === 'ซ่อม') {
    return 'bg-yellow-100 text-yellow-800';
  }
  if (statusLower === 'damaged' || statusName === 'ชำรุด' || statusName === 'เสียหาย') {
    return 'bg-red-100 text-red-800';
  }
  if (statusLower === 'retired' || statusName === 'เลิกใช้' || statusName === 'ปลดระวาง') {
    return 'bg-gray-100 text-gray-800';
  }
  
  // Default สีเทา
  return 'bg-gray-100 text-gray-800';
};

/**
 * แปลง status string (เก่า) เป็น ชื่อไทยที่แสดงผล
 * รองรับ backward compatibility
 */
export const getDisplayStatusText = (statusIdOrName: string, statusConfigs?: IStatusConfig[]): string | null => {
  // ถ้าไม่มี statusConfigs ให้ return null
  if (!statusConfigs || statusConfigs.length === 0) {
    return null;
  }
  
  // ถ้าส่ง statusConfigs มา ให้พยายามแปลง statusId เป็น name
  const foundById = statusConfigs.find(s => s.id === statusIdOrName);
  if (foundById) {
    return foundById.name;
  }
  
  // Fallback: แปลง status string เก่าเป็นไทย
  const statusMap: Record<string, string> = {
    'active': 'ใช้งานได้',
    'maintenance': 'ซ่อมบำรุง',
    'damaged': 'ชำรุด', 
    'retired': 'เลิกใช้',
    'deleted': 'ลบแล้ว'
  };
  
  return statusMap[statusIdOrName] || statusIdOrName;
};

/**
 * สร้าง statusConfigs จาก statuses ที่มีอยู่จริงใน DB
 * ไม่ใช้ default configs เพราะแต่ละระบบมีสถานะที่แตกต่างกัน
 */
export const createStatusConfigsFromStatuses = (statuses: string[]): IStatusConfig[] => {
  const now = new Date();
  
  return statuses.map((status, index) => {
    const name = getDisplayStatusText(status) || status; // fallback ถ้า null
    return {
      id: `status_${status}`,
      name: name,
      order: index + 1,
      createdAt: now,
      updatedAt: now
    };
  });
};

/**
 * Migration helper: แปลง status string เก่าเป็น statusId ใหม่
 */
export const migrateStatusStringToId = (oldStatus: string): string => {
  const migrationMap: Record<string, string> = {
    'active': 'status_active',
    'maintenance': 'status_maintenance',
    'damaged': 'status_damaged', 
    'retired': 'status_retired',
    'deleted': 'status_deleted'
  };
  
  return migrationMap[oldStatus] || `status_${oldStatus}`;
};

/**
 * Validation: ตรวจสอบว่า statusId ที่ส่งมาถูกต้องหรือไม่
 */
export const isValidStatusId = (statusId: string, statusConfigs: IStatusConfig[]): boolean => {
  if (!statusId || !statusConfigs || statusConfigs.length === 0) {
    return false;
  }
  
  return statusConfigs.some(s => s.id === statusId);
};

/**
 * Get available status options สำหรับ dropdown
 */
export const getStatusOptions = (statusConfigs: IStatusConfig[]) => {
  return statusConfigs
    .sort((a, b) => a.order - b.order)
    .map(config => ({
      value: config.id,
      label: config.name,
      order: config.order
    }));
};

/**
 * Filter helper: เปรียบเทียบ status ในการ filter
 */
export const matchesStatusFilter = (
  itemStatusId: string, 
  filterStatusId: string, 
  statusConfigs: IStatusConfig[]
): boolean => {
  if (!filterStatusId) return true; // ไม่มี filter
  
  // เปรียบเทียบ ID โดยตรง (วิธีที่เร็วที่สุด)
  if (itemStatusId === filterStatusId) return true;
  
  // Fallback: เปรียบเทียบผ่านชื่อ (สำหรับ backward compatibility)
  const itemStatusName = getStatusNameById(itemStatusId, statusConfigs);
  const filterStatusName = getStatusNameById(filterStatusId, statusConfigs);
  
  return itemStatusName === filterStatusName;
};
