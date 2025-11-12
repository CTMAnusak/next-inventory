/**
 * ระบบจัดการรายชื่ออีเมลล์ทีม IT Admin
 * รวม Admin หลัก + Admin ทีม IT จาก Database
 */

import dbConnect from './mongodb';
import User from '@/models/User';

/**
 * ดึงรายชื่ออีเมลล์ทีม IT ทั้งหมดจาก Database
 * รวม: Admin หลัก + Admin ทีม IT
 */
export async function getITAdminEmails(): Promise<string[]> {
  try {
    await dbConnect();
    
    // ดึงผู้ใช้ที่เป็น Admin ทีม IT และ Super Admin เท่านั้น (ไม่รวม Admin ทั่วไป)
    const adminUsers = await User.find({
      userRole: { $in: ['it_admin', 'super_admin'] }
    }).select('email');

    const emails = adminUsers.map(user => user.email);
    
    // ถ้าไม่มี Admin ในระบบ ส่ง array ว่าง
    if (emails.length === 0) {
      console.warn('No IT admin users found in database');
      return [];
    }

    return emails;
  } catch (error) {
    console.error('Error fetching IT admin emails:', error);
    // Fallback ถ้าเกิดข้อผิดพลาด - ส่ง array ว่าง
    return [];
  }
}

/**
 * ดึงรายชื่ออีเมลล์ทีม IT (แบบ Sync สำหรับกรณีที่ไม่สามารถใช้ async ได้)
 * ใช้เป็น fallback เท่านั้น - ไม่แนะนำให้ใช้
 * @deprecated ใช้ getITAdminEmails() แทน
 */
export function getITAdminEmailsSync(): string[] {
  console.warn('getITAdminEmailsSync is deprecated, use getITAdminEmails() instead');
  return [];
}

/**
 * ตรวจสอบว่าผู้ใช้เป็น Admin ทีม IT หรือไม่
 */
export async function isUserITAdmin(userId: string): Promise<boolean> {
  try {
    await dbConnect();
    const user = await User.findById(userId).select('userRole');
    return user?.userRole === 'it_admin' || user?.userRole === 'super_admin' || false;
  } catch (error) {
    console.error('Error checking user IT admin status:', error);
    return false;
  }
}
