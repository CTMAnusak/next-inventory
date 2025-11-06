import dbConnect from '@/lib/mongodb';
import Office from '@/models/Office';

/**
 * =========================================
 * OFFICE HELPER FUNCTIONS
 * =========================================
 */

const DEFAULT_OFFICE_ID = 'UNSPECIFIED_OFFICE';
const DEFAULT_OFFICE_NAME = 'ไม่ระบุสาขา';

// Cache สำหรับ office names (เพื่อลดการ query database)
const officeCache = new Map<string, { name: string; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 นาที

// Cache flag สำหรับ ensureDefaultOffice เพื่อไม่ให้เรียกบ่อยเกินไป
let defaultOfficeCheckCache: { checked: boolean; timestamp: number } | null = null;
const DEFAULT_OFFICE_CHECK_TTL = 10 * 60 * 1000; // 10 นาที

/**
 * 🆕 ตรวจสอบและสร้าง Default Office อัตโนมัติ (ถ้ายังไม่มี)
 * @returns Promise<void>
 */
export async function ensureDefaultOffice(): Promise<void> {
  try {
    // Check cache first - ไม่ต้องเช็คบ่อยเกินไป
    if (defaultOfficeCheckCache && Date.now() - defaultOfficeCheckCache.timestamp < DEFAULT_OFFICE_CHECK_TTL) {
      return; // Skip check if recently checked
    }

    await dbConnect();
    
    // ตรวจสอบว่ามี Default Office อยู่หรือไม่
    const defaultOffice = await Office.findOne({ 
      office_id: DEFAULT_OFFICE_ID 
    }).select('isSystemOffice isActive deletedAt').lean() as any;
    
    if (!defaultOffice) {
      // สร้าง Default Office ใหม่
      const newDefaultOffice = new Office({
        office_id: DEFAULT_OFFICE_ID,
        name: DEFAULT_OFFICE_NAME,
        description: 'Default office for users without a specific branch assignment',
        isActive: true,
        isSystemOffice: true
      });
      
      await newDefaultOffice.save();
      console.log('✅ Auto-created Default Office:', DEFAULT_OFFICE_ID);
      
      // Clear cache
      officeCache.clear();
      defaultOfficeCheckCache = { checked: true, timestamp: Date.now() };
    } else if (!defaultOffice.isSystemOffice || !defaultOffice.isActive || defaultOffice.deletedAt) {
      // อัพเดต Default Office ให้ถูกต้อง
      await Office.updateOne(
        { office_id: DEFAULT_OFFICE_ID },
        {
          $set: {
            isSystemOffice: true,
            isActive: true,
            deletedAt: null
          }
        }
      );
      console.log('✅ Updated Default Office settings');
      defaultOfficeCheckCache = { checked: true, timestamp: Date.now() };
    } else {
      // Office exists and is valid, cache the check
      defaultOfficeCheckCache = { checked: true, timestamp: Date.now() };
    }
  } catch (error) {
    console.error('Error ensuring default office:', error);
    // ไม่ throw error เพื่อไม่ให้ระบบหยุดทำงาน
  }
}

/**
 * ดึงชื่อ Office จาก Office ID
 * @param officeId - Office ID
 * @returns Office name หรือ officeId ถ้าไม่เจอ
 */
export async function getOfficeNameById(officeId: string | null | undefined): Promise<string> {
  if (!officeId) return '-';
  
  // 🆕 ถ้าเป็น default office ID ให้ return ชื่อทันที
  if (officeId === DEFAULT_OFFICE_ID) {
    return DEFAULT_OFFICE_NAME;
  }
  
  try {
    // 🆕 ตรวจสอบและสร้าง Default Office อัตโนมัติก่อน
    await ensureDefaultOffice();
    
    await dbConnect();
    
    // ตรวจสอบ cache ก่อน
    const cached = officeCache.get(officeId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return cached.name;
    }
    
    // Query จาก database
    const office = await Office.findOne({ 
      office_id: officeId,
      deletedAt: null // ไม่ต้องเช็ค isActive เพราะอาจเป็น soft delete
    }).select('name').lean() as any;
    
    if (office) {
      // เก็บใน cache
      officeCache.set(officeId, { name: office.name, cachedAt: Date.now() });
      return office.name;
    }
    
    // 🆕 ถ้าไม่เจอ (ถูกลบแล้ว) ให้ return default
    return DEFAULT_OFFICE_NAME;
  } catch (error) {
    console.error(`Error getting office name for ${officeId}:`, error);
    return DEFAULT_OFFICE_NAME; // 🆕 Return default แทน officeId
  }
}

/**
 * ดึงรายการ Office ทั้งหมด (สำหรับ dropdown)
 * @returns Array of { value: officeId, label: name }
 */
export async function getOfficeOptions(): Promise<Array<{ value: string; label: string }>> {
  try {
    // 🆕 ตรวจสอบและสร้าง Default Office อัตโนมัติก่อน
    await ensureDefaultOffice();
    
    await dbConnect();
    
    const offices = await Office.find({
      deletedAt: null // ไม่ต้องเช็ค isActive เพราะอาจมี soft delete
    })
    .select('office_id name isSystemOffice')
    .sort({ isSystemOffice: 1, name: 1 }) // System office อยู่ท้ายสุด
    .lean();
    
    const options = offices.map(office => ({
      value: office.office_id,
      label: office.name
    }));
    
    // 🆕 ตรวจสอบว่ามี default office หรือไม่ ถ้าไม่มีให้เพิ่ม (สำรอง)
    const hasDefault = options.some(opt => opt.value === DEFAULT_OFFICE_ID);
    if (!hasDefault) {
      options.unshift({
        value: DEFAULT_OFFICE_ID,
        label: DEFAULT_OFFICE_NAME
      });
    }
    
    return options;
  } catch (error) {
    console.error('Error getting office options:', error);
    // 🆕 Return default option ถ้า error
    return [{ value: DEFAULT_OFFICE_ID, label: DEFAULT_OFFICE_NAME }];
  }
}

/**
 * ดึงรายการ Office ทั้งหมด (สำหรับ populate batch)
 * @returns Map<officeId, officeName>
 */
export async function getOfficeMap(officeIds: string[]): Promise<Map<string, string>> {
  const officeMap = new Map<string, string>();
  
  if (!officeIds || officeIds.length === 0) {
    return officeMap;
  }
  
  try {
    await dbConnect();
    
    // ตรวจสอบ cache ก่อน
    const uncachedIds: string[] = [];
    for (const officeId of officeIds) {
      const cached = officeCache.get(officeId);
      if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
        officeMap.set(officeId, cached.name);
      } else {
        uncachedIds.push(officeId);
      }
    }
    
    // Query เฉพาะที่ไม่มีใน cache
    if (uncachedIds.length > 0) {
      const offices = await Office.find({
        office_id: { $in: uncachedIds },
        isActive: true,
        deletedAt: null
      })
      .select('office_id name')
      .lean();
      
      for (const office of offices) {
        officeMap.set(office.office_id, office.name);
        // เก็บใน cache
        officeCache.set(office.office_id, { name: office.name, cachedAt: Date.now() });
      }
    }
    
    return officeMap;
  } catch (error) {
    console.error('Error getting office map:', error);
    return officeMap;
  }
}

/**
 * Populate office name ใน object (backward compatible)
 * @param data - Object ที่มี officeId หรือ office
 * @param fieldName - ชื่อ field ที่ต้องการ populate (default: 'office')
 */
export async function populateOfficeName(
  data: any,
  fieldName: string = 'office'
): Promise<any> {
  if (!data) return data;
  
  const officeIdField = `${fieldName}Id`;
  const officeNameField = `${fieldName}Name`;
  
  // ถ้ามี officeId ให้ populate
  if (data[officeIdField]) {
    data[officeNameField] = await getOfficeNameById(data[officeIdField]);
    // ถ้าไม่มี office field ให้ใช้ officeName เป็น office
    if (!data[fieldName]) {
      data[fieldName] = data[officeNameField];
    }
  } else if (data[fieldName] && !data[officeNameField]) {
    // ถ้ามีแค่ office (ข้อมูลเก่า) ให้ใช้เป็น officeName
    data[officeNameField] = data[fieldName];
  }
  
  return data;
}

/**
 * Populate office name ใน array of objects
 */
export async function populateOfficeNameBatch(
  items: any[],
  fieldName: string = 'office'
): Promise<any[]> {
  if (!items || items.length === 0) return items;
  
  // รวบรวม officeIds ทั้งหมด
  const officeIds = items
    .map(item => {
      const officeIdField = `${fieldName}Id`;
      return item[officeIdField];
    })
    .filter(id => id);
  
  // ดึง office map
  const officeMap = await getOfficeMap(officeIds);
  
  // Populate แต่ละ item
  return items.map(item => {
    const officeIdField = `${fieldName}Id`;
    const officeNameField = `${fieldName}Name`;
    
    if (item[officeIdField]) {
      item[officeNameField] = officeMap.get(item[officeIdField]) || item[officeIdField];
      if (!item[fieldName]) {
        item[fieldName] = item[officeNameField];
      }
    } else if (item[fieldName] && !item[officeNameField]) {
      item[officeNameField] = item[fieldName];
    }
    
    return item;
  });
}

/**
 * Clear office cache (ใช้เมื่อมีการเพิ่ม/แก้ไข/ลบ office)
 */
export function clearOfficeCache(): void {
  officeCache.clear();
}

/**
 * Clear specific office from cache
 */
export function clearOfficeCacheById(officeId: string): void {
  officeCache.delete(officeId);
}

