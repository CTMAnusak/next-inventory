/**
 * Thai Date Utilities
 * Helper functions for working with Thai timezone (GMT+7)
 */

/**
 * สร้าง Date object ที่ตั้งค่าเป็นเวลาไทย (GMT+7)
 * @returns Date object ที่แสดงเวลาปัจจุบันในไทย
 */
function getThaiDate(): Date {
  // สร้าง Date ปัจจุบัน
  const now = new Date();
  
  // แปลงเป็นเวลาไทย (GMT+7)
  const thaiTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
  
  return thaiTime;
}

/**
 * สร้าง Date object จาก timestamp ที่ตั้งค่าเป็นเวลาไทย
 * @param timestamp - timestamp หรือ date string
 * @returns Date object ที่แปลงเป็นเวลาไทย
 */
function createThaiDate(timestamp?: string | number | Date): Date {
  if (!timestamp) {
    return getThaiDate();
  }
  
  const date = new Date(timestamp);
  const thaiTime = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
  
  return thaiTime;
}

/**
 * แปลง Date object เป็น string ในรูปแบบไทย
 * @param date - Date object
 * @param options - options สำหรับการแสดงผล
 * @returns string ในรูปแบบวันที่ไทย
 */
function formatThaiDate(date: Date, options?: {
  includeTime?: boolean;
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  timeStyle?: 'full' | 'long' | 'medium' | 'short';
}): string {
  const defaultOptions = {
    includeTime: true,
    dateStyle: 'medium' as const,
    timeStyle: 'short' as const
  };
  
  const opts = { ...defaultOptions, ...options };
  
  if (opts.includeTime) {
    return date.toLocaleString('th-TH', {
      dateStyle: opts.dateStyle,
      timeStyle: opts.timeStyle,
      timeZone: 'Asia/Bangkok'
    });
  } else {
    return date.toLocaleDateString('th-TH', {
      dateStyle: opts.dateStyle,
      timeZone: 'Asia/Bangkok'
    });
  }
}

/**
 * แปลง Date object เป็น string เฉพาะเวลา
 * @param date - Date object
 * @returns string เวลาในรูปแบบไทย
 */
function formatThaiTime(date: Date): string {
  return date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok'
  });
}

/**
 * ตรวจสอบว่าวันที่อยู่ในวันเดียวกันหรือไม่ (เวลาไทย)
 * @param date1 - Date object แรก
 * @param date2 - Date object ที่สอง
 * @returns boolean
 */
function isSameThaiDay(date1: Date, date2: Date): boolean {
  const thai1 = date1.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
  const thai2 = date2.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
  return thai1 === thai2;
}

/**
 * สร้าง Date object สำหรับการบันทึกในฐานข้อมูล
 * จะบันทึกเป็น UTC แต่คำนวณจากเวลาไทยปัจจุบัน
 * @returns Date object ที่พร้อมบันทึกในฐานข้อมูล
 */
function createDatabaseDate(): Date {
  // สร้างเวลาไทยปัจจุบัน
  const now = new Date();
  const thaiOffset = 7 * 60; // GMT+7 in minutes
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const thaiTime = new Date(utc + (thaiOffset * 60000));
  
  return thaiTime;
}

/**
 * แปลง Date object เป็นรูปแบบที่ใช้ในตาราง equipment tracking
 * @param date - Date object
 * @returns object ที่มี dateString และ timeString
 */
function formatEquipmentTrackingDate(date: Date): {
  dateString: string;
  timeString: string;
} {
  return {
    dateString: date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Bangkok'
    }),
    timeString: date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bangkok'
    })
  };
}

// ES Module exports
export {
  getThaiDate,
  createThaiDate,
  formatThaiDate,
  formatThaiTime,
  isSameThaiDay,
  createDatabaseDate,
  formatEquipmentTrackingDate
};

// CommonJS exports for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getThaiDate,
    createThaiDate,
    formatThaiDate,
    formatThaiTime,
    isSameThaiDay,
    createDatabaseDate,
    formatEquipmentTrackingDate
  };
}
