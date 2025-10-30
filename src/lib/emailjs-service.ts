import emailjs from '@emailjs/browser';
import { getITAdminEmails } from './admin-emails';

// EmailJS Configuration
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || 'YOUR_PUBLIC_KEY';
const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'YOUR_TEMPLATE_ID';

// Initialize EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY);

export interface EmailData {
  issueId: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  email: string;
  department: string;
  office: string;
  issueCategory: string;
  customCategory?: string;
  urgency: string;
  description: string;
  images?: string[];
  reportDate: Date;
}

/**
 * ส่งอีเมลแจ้งปัญหา IT ผ่าน EmailJS
 * จะส่งจากอีเมลผู้แจ้งไปยังทีม IT Support ทั้งหมดโดยอัตโนมัติ
 */
export async function sendITReportEmail(data: EmailData): Promise<boolean> {
  try {
    // ดึงรายชื่ออีเมล IT Admin จาก database
    const itAdminEmails = await getITAdminEmails();
    
    if (itAdminEmails.length === 0) {
      console.error('No IT admin emails found');
      return false;
    }

    // ส่งอีเมลให้แต่ละ IT Admin
    const sendPromises = itAdminEmails.map(async (adminEmail) => {
      const templateParams = {
        // ข้อมูลผู้แจ้ง
        from_name: `${data.firstName} ${data.lastName}`,
        from_email: data.email,
        reply_to: data.email,
        
        // ข้อมูลการแจ้ง
        issue_id: data.issueId,
        reporter_name: `${data.firstName} ${data.lastName} (${data.nickname})`,
        reporter_phone: data.phone,
        reporter_department: data.department,
        reporter_office: data.office,
        
        // รายละเอียดปัญหา
        issue_category: data.issueCategory + (data.customCategory ? ` - ${data.customCategory}` : ''),
        urgency: data.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ',
        description: data.description,
        report_date: data.reportDate.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }),
        report_time: data.reportDate.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' }),
        
        // รูปภาพ (ถ้ามี)
        images: data.images && data.images.length > 0 
          ? data.images.map(img => `${window.location.origin}/assets/IssueLog/${img}`).join('\n')
          : 'ไม่มี',
        
        // ส่งถึงทีม IT Support
        to_email: adminEmail,
        
        // Subject
        subject: `⚠️ แจ้งปัญหาใหม่จากพนักงาน - ${data.issueId}`
      };

      return emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams
      );
    });

    // รอให้อีเมลทั้งหมดส่งเสร็จ
    const results = await Promise.allSettled(sendPromises);
    
    const successCount = results.filter(result => result.status === 'fulfilled').length;
    const failCount = results.filter(result => result.status === 'rejected').length;
    
    console.log(`Email sending results: ${successCount} success, ${failCount} failed`);
    
    // ถือว่าสำเร็จถ้าส่งได้อย่างน้อย 1 ฉบับ
    return successCount > 0;

  } catch (error) {
    console.error('EmailJS error:', error);
    return false;
  }
}

/**
 * ตรวจสอบว่า EmailJS พร้อมใช้งานหรือไม่
 */
export function isEmailJSConfigured(): boolean {
  return !!(EMAILJS_PUBLIC_KEY && 
           EMAILJS_SERVICE_ID && 
           EMAILJS_TEMPLATE_ID &&
           EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY' &&
           EMAILJS_SERVICE_ID !== 'YOUR_SERVICE_ID' &&
           EMAILJS_TEMPLATE_ID !== 'YOUR_TEMPLATE_ID');
}
