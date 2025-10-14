import nodemailer from 'nodemailer';
import { getITAdminEmails } from './admin-emails';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendIssueNotification(issueData: any) {
  try {
    // ดึงรายชื่ออีเมล IT Admin ทั้งหมด
    const itAdminEmails = await getITAdminEmails();
    const results = [];
    
    if (itAdminEmails.length === 0) {
      console.error('No IT admin emails found');
      return { success: false, error: 'No IT admin emails found' };
    }

    const urgencyText = issueData.urgency === 'very_urgent' ? 'ด่วน' : 'ปกติ';
    const issueTitle = issueData.issueCategory + (issueData.customCategory ? ` - ${issueData.customCategory}` : '');
    
    // เตรียม attachments สำหรับรูปภาพ
    const attachments = [];
    console.log('📧 sendIssueNotification - issueData.images:', issueData.images);
    
    if (issueData.images && issueData.images.length > 0) {
      const path = require('path');
      const fs = require('fs');
      
      for (let i = 0; i < issueData.images.length; i++) {
        const img = issueData.images[i];
        const imagePath = path.join(process.cwd(), 'public', 'assets', 'IssueLog', img);
        
        console.log(`🔍 Checking image ${i+1}:`, imagePath);
        console.log(`📁 File exists:`, fs.existsSync(imagePath));
        
        // ตรวจสอบว่าไฟล์มีอยู่จริง
        if (fs.existsSync(imagePath)) {
          attachments.push({
            filename: img,
            path: imagePath,
            cid: `image${i}@issueLog` // Content-ID สำหรับอ้างอิงในอีเมล
          });
          console.log(`✅ Added attachment ${i+1}:`, img);
        } else {
          console.log(`❌ Image file not found:`, imagePath);
        }
      }
    }
    
    console.log(`📎 Total attachments: ${attachments.length}`);
    
    // ส่งอีเมลไปยังแอดมิน IT ทุกคน
    for (const adminEmail of itAdminEmails) {
      const mailOptions = {
        from: `VSQ IT Service Desk <${process.env.EMAIL_FROM || 'it@vsqclinic.com'}>`, // From: ระบบ IT (ผู้ส่งคืออีเมลระบบ)
        replyTo: issueData.email, // Reply-To: อีเมลผู้แจ้งจริง (สำหรับตอบกลับ)
        to: adminEmail, // To: แอดมิน IT แต่ละคน
        subject: `แจ้งงาน IT VSQ [${urgencyText}] จาก ${issueData.firstName} ${issueData.lastName} (${issueData.issueId}) - ${issueTitle}`,
        attachments: attachments, // แนบรูปภาพ
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; text-align: center;">🔔 แจ้งปัญหาด้าน IT</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
            
            <!-- Issue ID และวันที่แจ้ง -->
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 5px solid #667eea;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; width: 180px;"><strong>📋 Issue ID:</strong></td>
                  <td style="padding: 8px 0; color: #667eea; font-weight: bold; font-size: 16px;">${issueData.issueId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>📅 วันที่แจ้ง:</strong></td>
                  <td style="padding: 8px 0;">${new Date(issueData.reportDate).toLocaleDateString('th-TH', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    timeZone: 'Asia/Bangkok' 
                  })} เวลา ${new Date(issueData.reportDate).toLocaleTimeString('th-TH', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: 'Asia/Bangkok' 
                  })} น.</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>📊 สถานะปัจจุบัน:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #ffc107; color: #000; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 14px;">⏳ รอดำเนินการ</span></td>
                </tr>
              </table>
            </div>

            <!-- ข้อมูลผู้แจ้ง -->
            <div style="margin: 25px 0;">
              <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 15px;">👤 ข้อมูลผู้แจ้ง</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; width: 180px;"><strong>ชื่อ-นามสกุล:</strong></td>
                  <td style="padding: 8px 0;">${issueData.firstName} ${issueData.lastName} (${issueData.nickname})</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>แผนก:</strong></td>
                  <td style="padding: 8px 0;">${issueData.department}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>ออฟฟิศ/สาขา:</strong></td>
                  <td style="padding: 8px 0;">${issueData.office}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>เบอร์โทร:</strong></td>
                  <td style="padding: 8px 0;">${issueData.phone}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>อีเมล:</strong></td>
                  <td style="padding: 8px 0;"><a href="mailto:${issueData.email}" style="color: #667eea; text-decoration: none;">${issueData.email}</a></td>
                </tr>
              </table>
            </div>

            <!-- รายละเอียดปัญหา -->
            <div style="margin: 25px 0;">
              <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 15px;">🔧 รายละเอียดปัญหา</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; width: 180px;"><strong>ประเภทปัญหา:</strong></td>
                  <td style="padding: 8px 0;">${issueTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>ความเร่งด่วน:</strong></td>
                  <td style="padding: 8px 0;">
                    ${issueData.urgency === 'very_urgent' 
                      ? '<span style="background-color: #f44336; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold;">🔴 ด่วนมาก</span>' 
                      : '<span style="background-color: #4caf50; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold;">🟢 ปกติ</span>'}
                  </td>
                </tr>
              </table>
              
              <div style="margin-top: 15px;">
                <strong>รายละเอียด:</strong>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 8px; border-left: 4px solid #667eea; white-space: normal; word-wrap: break-word;">
                  ${issueData.description}
                </div>
              </div>

              ${issueData.notes ? `
              <div style="margin-top: 15px;">
                <strong>หมายเหตุ จาก Admin:</strong>
                <div style="background-color: #fff9c4; padding: 15px; border-radius: 8px; margin-top: 8px; border-left: 4px solid #fbc02d;">
                  ${issueData.notes}
                </div>
              </div>
              ` : ''}
            </div>

            <!-- รูปภาพ -->
            ${issueData.images && issueData.images.length > 0 ? `
            <div style="margin: 25px 0;">
              <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 15px;">📷 รูปภาพประกอบ (${issueData.images.length} รูป)</h2>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                ${issueData.images.map((img: string, index: number) => `
                  <div style="margin: 20px 0; text-align: center;">
                    <p style="margin: 0 0 10px 0; font-weight: 600; color: #667eea; font-size: 14px;">รูปที่ ${index + 1}</p>
                    <img src="cid:image${index}@issueLog" 
                         alt="รูปที่ ${index + 1}" 
                         style="max-width: 100%; max-height: 400px; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 2px solid #e8eaf6; display: block; margin: 0 auto;">
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #666; word-break: break-all;">${img}</p>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

            <!-- ปุ่มดำเนินการ -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; margin: 30px 0; border-radius: 10px; text-align: center;">
              <p style="color: white; margin: 0 0 15px 0; font-size: 18px; font-weight: bold;">🔧 ดำเนินการรับงาน</p>
              <p style="color: #f0f0f0; margin: 0 0 20px 0; font-size: 14px;">คลิกปุ่มด้านล่างเพื่อเข้าสู่ระบบและรับงานนี้</p>
              <a href="${process.env.NEXTAUTH_URL}/admin/it-reports" 
                 style="display: inline-block; background-color: #ffc107; color: #000; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                🔗 เข้าสู่ระบบ IT Admin
              </a>
            </div>

          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; border: 1px solid #e0e0e0; border-top: none;">
            <p style="margin: 0; color: #666; font-size: 14px;">📧 อีเมลนี้ถูกส่งจากระบบ Inventory Management Dashboard</p>
            <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">กรุณาอย่าตอบกลับอีเมลนี้โดยตรง</p>
          </div>
        </div>
      `
    };

      try {
        await transporter.sendMail(mailOptions);
        results.push({ success: true, email: adminEmail });
        console.log(`Email sent successfully to IT Admin: ${adminEmail}`);
      } catch (error) {
        results.push({ success: false, email: adminEmail, error: error });
        console.error(`Failed to send email to IT Admin ${adminEmail}:`, error);
      }
    }

    return { 
      success: results.some(r => r.success), 
      results: results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length
    };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error };
  }
}

// 1.5 ส่งอีเมลยืนยันให้ผู้แจ้งเมื่อแจ้งงาน IT สำเร็จ
export async function sendIssueConfirmationToReporter(issueData: any) {
  const urgencyText = issueData.urgency === 'very_urgent' ? 'ด่วน' : 'ปกติ';
  const issueTitle = issueData.issueCategory + (issueData.customCategory ? ` - ${issueData.customCategory}` : '');
  
  // เตรียม attachments สำหรับรูปภาพ
  const attachments = [];
  console.log('📧 sendIssueConfirmationToReporter - issueData.images:', issueData.images);
  
  if (issueData.images && issueData.images.length > 0) {
    const path = require('path');
    const fs = require('fs');
    
    for (let i = 0; i < issueData.images.length; i++) {
      const img = issueData.images[i];
      const imagePath = path.join(process.cwd(), 'public', 'assets', 'IssueLog', img);
      
      console.log(`🔍 [Confirmation] Checking image ${i+1}:`, imagePath);
      console.log(`📁 [Confirmation] File exists:`, fs.existsSync(imagePath));
      
      if (fs.existsSync(imagePath)) {
        attachments.push({
          filename: img,
          path: imagePath,
          cid: `image${i}@issueLog`
        });
        console.log(`✅ [Confirmation] Added attachment ${i+1}:`, img);
      } else {
        console.log(`❌ [Confirmation] Image file not found:`, imagePath);
      }
    }
  }
  
  console.log(`📎 [Confirmation] Total attachments: ${attachments.length}`);
  
  const mailOptions = {
    from: `VSQ IT Service Desk <${process.env.EMAIL_FROM || 'it@vsqclinic.com'}>`,
    to: issueData.email,
    subject: `✅ ได้รับเรื่องแจ้งงาน IT VSQ [${urgencyText}] - ${issueData.issueId}`,
    attachments: attachments,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px; text-align: center;">✅ ระบบได้รับเรื่องแจ้งปัญหาแล้ว</h1>
        </div>
        
        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
          
          <div style="background-color: #e8f5e9; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 5px solid #4caf50; text-align: center;">
            <p style="margin: 0; font-size: 18px; color: #2e7d32;"><strong>ขอบคุณที่แจ้งปัญหา</strong></p>
            <p style="margin: 10px 0 0 0; color: #666;">ทีม IT จะดำเนินการตรวจสอบและติดต่อกลับโดยเร็วที่สุด</p>
          </div>

          <!-- Issue ID และวันที่แจ้ง -->
          <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 5px solid #4caf50;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; width: 180px;"><strong>📋 Issue ID:</strong></td>
                <td style="padding: 8px 0; color: #4caf50; font-weight: bold; font-size: 16px;">${issueData.issueId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>📅 วันที่แจ้ง:</strong></td>
                <td style="padding: 8px 0;">${new Date(issueData.reportDate).toLocaleDateString('th-TH', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  timeZone: 'Asia/Bangkok' 
                })} เวลา ${new Date(issueData.reportDate).toLocaleTimeString('th-TH', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  timeZone: 'Asia/Bangkok' 
                })} น.</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>📊 สถานะปัจจุบัน:</strong></td>
                <td style="padding: 8px 0;"><span style="background-color: #ffc107; color: #000; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 14px;">⏳ รอดำเนินการ</span></td>
              </tr>
            </table>
          </div>

          <!-- ข้อมูลผู้แจ้ง -->
          <div style="margin: 25px 0;">
            <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 15px;">👤 ข้อมูลผู้แจ้ง</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; width: 180px;"><strong>ชื่อ-นามสกุล:</strong></td>
                <td style="padding: 8px 0;">${issueData.firstName} ${issueData.lastName} (${issueData.nickname})</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>แผนก:</strong></td>
                <td style="padding: 8px 0;">${issueData.department}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>ออฟฟิศ/สาขา:</strong></td>
                <td style="padding: 8px 0;">${issueData.office}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>เบอร์โทร:</strong></td>
                <td style="padding: 8px 0;">${issueData.phone}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>อีเมล:</strong></td>
                <td style="padding: 8px 0;">${issueData.email}</td>
              </tr>
            </table>
          </div>

          <!-- รายละเอียดปัญหา -->
          <div style="margin: 25px 0;">
            <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 15px;">🔧 รายละเอียดปัญหา</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; width: 180px;"><strong>ประเภทปัญหา:</strong></td>
                <td style="padding: 8px 0;">${issueTitle}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>ความเร่งด่วน:</strong></td>
                <td style="padding: 8px 0;">
                  ${issueData.urgency === 'very_urgent' 
                    ? '<span style="background-color: #f44336; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold;">🔴 ด่วนมาก</span>' 
                    : '<span style="background-color: #4caf50; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold;">🟢 ปกติ</span>'}
                </td>
              </tr>
            </table>
            
            <div style="margin-top: 15px;">
              <strong>รายละเอียด:</strong>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 8px; border-left: 4px solid #1976d2; white-space: normal; word-wrap: break-word;">
                ${issueData.description}
              </div>
            </div>

            ${issueData.notes ? `
            <div style="margin-top: 15px;">
              <strong>หมายเหตุ จาก Admin:</strong>
              <div style="background-color: #fff9c4; padding: 15px; border-radius: 8px; margin-top: 8px; border-left: 4px solid #fbc02d;">
                ${issueData.notes}
              </div>
            </div>
            ` : ''}
          </div>

          <!-- รูปภาพ -->
          ${issueData.images && issueData.images.length > 0 ? `
          <div style="margin: 25px 0;">
            <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 15px;">📷 รูปภาพประกอบ (${issueData.images.length} รูป)</h2>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
              ${issueData.images.map((img: string, index: number) => `
                <div style="margin: 20px 0; text-align: center;">
                  <p style="margin: 0 0 10px 0; font-weight: 600; color: #1976d2; font-size: 14px;">รูปที่ ${index + 1}</p>
                  <img src="cid:image${index}@issueLog" 
                       alt="รูปที่ ${index + 1}" 
                       style="max-width: 100%; max-height: 400px; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 2px solid #e3f2fd; display: block; margin: 0 auto;">
                  <p style="margin: 8px 0 0 0; font-size: 11px; color: #666; word-break: break-all;">${img}</p>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <!-- ปุ่มติดตามสถานะ -->
          <div style="background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); padding: 25px; margin: 30px 0; border-radius: 10px; text-align: center;">
            <p style="color: white; margin: 0 0 15px 0; font-size: 18px; font-weight: bold;">📊 ติดตามสถานะงาน</p>
            <p style="color: #f0f0f0; margin: 0 0 20px 0; font-size: 14px;">คุณสามารถติดตามสถานะการดำเนินงานได้ตลอดเวลา</p>
            <a href="${process.env.NEXTAUTH_URL}/it-tracking" 
               style="display: inline-block; background-color: #ffc107; color: #000; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
              🔍 ติดตามสถานะ
            </a>
          </div>

          <div style="background-color: #e3f2fd; padding: 15px; margin: 20px 0; border-radius: 8px;">
            <p style="margin: 0; color: #1976d2; font-size: 14px;"><strong>📌 หมายเหตุ:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
              <li>ทีม IT จะติดต่อกลับหากต้องการข้อมูลเพิ่มเติม</li>
              <li>คุณจะได้รับอีเมลแจ้งเตือนเมื่อทีม IT รับงานและส่งงาน</li>
              <li>กรุณาเก็บ Issue ID ไว้เพื่อใช้ในการติดตามงาน</li>
            </ul>
          </div>

        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; border: 1px solid #e0e0e0; border-top: none;">
          <p style="margin: 0; color: #666; font-size: 14px;">📧 อีเมลนี้ถูกส่งจากระบบ Inventory Management Dashboard</p>
        </div>
      </div>
    `
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Confirmation email sent to reporter: ${issueData.email}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Confirmation email send error:', error);
    return { success: false, error: error as Error };
  }
}

// 2. ส่งอีเมลแจ้งผู้แจ้งเมื่อ IT รับงาน (pending → in_progress)
export async function sendJobAcceptedNotification(issueData: any) {
  try {
    const itAdminEmails = await getITAdminEmails();
    const results = [];
    
    const urgencyText = issueData.urgency === 'very_urgent' ? 'ด่วน' : 'ปกติ';
    const issueTitle = issueData.issueCategory + (issueData.customCategory ? ` - ${issueData.customCategory}` : '');
    
    // เตรียม attachments สำหรับรูปภาพ
    const attachments = [];
    if (issueData.images && issueData.images.length > 0) {
      const path = require('path');
      const fs = require('fs');
      
      for (let i = 0; i < issueData.images.length; i++) {
        const img = issueData.images[i];
        const imagePath = path.join(process.cwd(), 'public', 'assets', 'IssueLog', img);
        
        if (fs.existsSync(imagePath)) {
          attachments.push({
            filename: img,
            path: imagePath,
            cid: `image${i}@issueLog`
          });
        }
      }
    }
    
    // รวมอีเมลผู้แจ้งและ IT Admin ทั้งหมด
    const allRecipients = [issueData.email, ...itAdminEmails];
    
    // ส่งอีเมลไปยังทุกคน
    for (const recipientEmail of allRecipients) {
      const mailOptions = {
        from: `VSQ IT Service Desk <${process.env.EMAIL_FROM || 'it@vsqclinic.com'}>`,
        to: recipientEmail,
        subject: `แจ้งงาน IT VSQ [${urgencyText}] จาก ${issueData.firstName} ${issueData.lastName} (${issueData.issueId}) - ${issueTitle} : ✅ IT รับงานแล้ว`,
        attachments: attachments,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px; text-align: center;">✅ ทีม IT รับงานเรียบร้อยแล้ว</h1>
        </div>
        
        <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
          
          <!-- Issue ID และวันที่แจ้ง -->
          <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 5px solid #4caf50;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; width: 180px;"><strong>📋 Issue ID:</strong></td>
                <td style="padding: 8px 0; color: #4caf50; font-weight: bold; font-size: 16px;">${issueData.issueId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>📅 วันที่แจ้ง:</strong></td>
                <td style="padding: 8px 0;">${new Date(issueData.reportDate).toLocaleDateString('th-TH', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  timeZone: 'Asia/Bangkok' 
                })} เวลา ${new Date(issueData.reportDate).toLocaleTimeString('th-TH', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  timeZone: 'Asia/Bangkok' 
                })} น.</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>📊 สถานะปัจจุบัน:</strong></td>
                <td style="padding: 8px 0;"><span style="background-color: #2196f3; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 14px;">🔧 กำลังดำเนินการ</span></td>
              </tr>
            </table>
          </div>

          <!-- IT Admin ผู้รับผิดชอบ -->
          ${issueData.assignedAdmin ? `
          <div style="background-color: #e8f5e9; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 5px solid #4caf50;">
            <h2 style="color: #2e7d32; margin: 0 0 15px 0; font-size: 18px;">👨‍💻 IT Admin ผู้รับผิดชอบ</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; width: 180px;"><strong>ชื่อ:</strong></td>
                <td style="padding: 8px 0; color: #2e7d32; font-weight: bold;">${issueData.assignedAdmin.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>อีเมล:</strong></td>
                <td style="padding: 8px 0;"><a href="mailto:${issueData.assignedAdmin.email}" style="color: #2e7d32; text-decoration: none;">${issueData.assignedAdmin.email}</a></td>
              </tr>
            </table>
          </div>
          ` : ''}

          <!-- ข้อมูลผู้แจ้ง -->
          <div style="margin: 25px 0;">
            <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 15px;">👤 ข้อมูลผู้แจ้ง</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; width: 180px;"><strong>ชื่อ-นามสกุล:</strong></td>
                <td style="padding: 8px 0;">${issueData.firstName} ${issueData.lastName} (${issueData.nickname})</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>แผนก:</strong></td>
                <td style="padding: 8px 0;">${issueData.department}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>ออฟฟิศ/สาขา:</strong></td>
                <td style="padding: 8px 0;">${issueData.office}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>เบอร์โทร:</strong></td>
                <td style="padding: 8px 0;">${issueData.phone}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>อีเมล:</strong></td>
                <td style="padding: 8px 0;"><a href="mailto:${issueData.email}" style="color: #1976d2; text-decoration: none;">${issueData.email}</a></td>
              </tr>
            </table>
          </div>

          <!-- รายละเอียดปัญหา -->
          <div style="margin: 25px 0;">
            <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 15px;">🔧 รายละเอียดปัญหา</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; width: 180px;"><strong>ประเภทปัญหา:</strong></td>
                <td style="padding: 8px 0;">${issueTitle}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>ความเร่งด่วน:</strong></td>
                <td style="padding: 8px 0;">
                  ${issueData.urgency === 'very_urgent' 
                    ? '<span style="background-color: #f44336; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold;">🔴 ด่วนมาก</span>' 
                    : '<span style="background-color: #4caf50; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold;">🟢 ปกติ</span>'}
                </td>
              </tr>
            </table>
            
            <div style="margin-top: 15px;">
              <strong>รายละเอียด:</strong>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 8px; border-left: 4px solid #1976d2; white-space: normal; word-wrap: break-word;">
                ${issueData.description}
              </div>
            </div>

            ${issueData.notes ? `
            <div style="margin-top: 15px;">
              <strong>หมายเหตุ จาก Admin:</strong>
              <div style="background-color: #fff9c4; padding: 15px; border-radius: 8px; margin-top: 8px; border-left: 4px solid #fbc02d;">
                ${issueData.notes}
              </div>
            </div>
            ` : ''}
          </div>

          <!-- รูปภาพ -->
          ${issueData.images && issueData.images.length > 0 ? `
          <div style="margin: 25px 0;">
            <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 15px;">📷 รูปภาพประกอบ (${issueData.images.length} รูป)</h2>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
              ${issueData.images.map((img: string, index: number) => `
                <div style="margin: 20px 0; text-align: center;">
                  <p style="margin: 0 0 10px 0; font-weight: 600; color: #1976d2; font-size: 14px;">รูปที่ ${index + 1}</p>
                  <img src="cid:image${index}@issueLog" 
                       alt="รูปที่ ${index + 1}" 
                       style="max-width: 100%; max-height: 400px; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 2px solid #e3f2fd; display: block; margin: 0 auto;">
                  <p style="margin: 8px 0 0 0; font-size: 11px; color: #666; word-break: break-all;">${img}</p>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <!-- ปุ่มติดตามสถานะ -->
          <div style="background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); padding: 25px; margin: 30px 0; border-radius: 10px; text-align: center;">
            <p style="color: white; margin: 0 0 15px 0; font-size: 18px; font-weight: bold;">⏳ ขั้นตอนถัดไป</p>
            <p style="color: #f0f0f0; margin: 0 0 20px 0; font-size: 14px;">ทีม IT กำลังดำเนินการแก้ไขปัญหา คุณสามารถติดตามสถานะได้ที่:</p>
            <a href="${process.env.NEXTAUTH_URL}/it-tracking" 
               style="display: inline-block; background-color: #ffc107; color: #000; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
              📊 ติดตามสถานะ
            </a>
          </div>

        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; border: 1px solid #e0e0e0; border-top: none;">
          <p style="margin: 0; color: #666; font-size: 14px;">📧 อีเมลนี้ถูกส่งจากระบบ Inventory Management Dashboard</p>
        </div>
      </div>
    `
      };

      try {
        await transporter.sendMail(mailOptions);
        results.push({ success: true, email: recipientEmail });
        console.log(`✅ Job accepted email sent successfully to: ${recipientEmail}`);
      } catch (error) {
        results.push({ success: false, email: recipientEmail, error: error });
        console.error(`❌ Failed to send job accepted email to ${recipientEmail}:`, error);
      }
    }

    return { 
      success: results.some(r => r.success), 
      results: results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length
    };
  } catch (error) {
    console.error('❌ Job accepted email send error:', error);
    return { success: false, error: error };
  }
}

// 3. ส่งอีเมลแจ้งผู้แจ้งเมื่อ IT ส่งงาน (in_progress → completed)
export async function sendWorkCompletedNotification(issueData: any) {
  try {
    const itAdminEmails = await getITAdminEmails();
    const results = [];
    
    const urgencyText = issueData.urgency === 'very_urgent' ? 'ด่วน' : 'ปกติ';
    const issueTitle = issueData.issueCategory + (issueData.customCategory ? ` - ${issueData.customCategory}` : '');
    
    // เตรียม attachments สำหรับรูปภาพ
    const attachments = [];
    if (issueData.images && issueData.images.length > 0) {
      const path = require('path');
      const fs = require('fs');
      
      for (let i = 0; i < issueData.images.length; i++) {
        const img = issueData.images[i];
        const imagePath = path.join(process.cwd(), 'public', 'assets', 'IssueLog', img);
        
        if (fs.existsSync(imagePath)) {
          attachments.push({
            filename: img,
            path: imagePath,
            cid: `image${i}@issueLog`
          });
        }
      }
    }
    
    // รวมอีเมลผู้แจ้งและ IT Admin ทั้งหมด
    const allRecipients = [issueData.email, ...itAdminEmails];
    
    // ส่งอีเมลไปยังทุกคน
    for (const recipientEmail of allRecipients) {
      const mailOptions = {
        from: `VSQ IT Service Desk <${process.env.EMAIL_FROM || 'it@vsqclinic.com'}>`,
        to: recipientEmail,
        subject: `แจ้งงาน IT VSQ [${urgencyText}] จาก ${issueData.firstName} ${issueData.lastName} (${issueData.issueId}) - ${issueTitle} : 🎉 IT ส่งงานแล้ว - รอการตรวจสอบ`,
        attachments: attachments,
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; text-align: center;">🎉 ทีม IT ส่งงานเรียบร้อยแล้ว</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
            
            <!-- Issue ID และวันที่แจ้ง -->
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 5px solid #ff9800;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; width: 180px;"><strong>📋 Issue ID:</strong></td>
                  <td style="padding: 8px 0; color: #ff9800; font-weight: bold; font-size: 16px;">${issueData.issueId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>📅 วันที่แจ้ง:</strong></td>
                  <td style="padding: 8px 0;">${new Date(issueData.reportDate).toLocaleDateString('th-TH', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    timeZone: 'Asia/Bangkok' 
                  })} เวลา ${new Date(issueData.reportDate).toLocaleTimeString('th-TH', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: 'Asia/Bangkok' 
                  })} น.</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>🕐 ส่งงานเมื่อ:</strong></td>
                  <td style="padding: 8px 0;">${new Date().toLocaleDateString('th-TH', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    timeZone: 'Asia/Bangkok' 
                  })} เวลา ${new Date().toLocaleTimeString('th-TH', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: 'Asia/Bangkok' 
                  })} น.</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>📊 สถานะปัจจุบัน:</strong></td>
                  <td style="padding: 8px 0;"><span style="background-color: #ff9800; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 14px;">⏳ รอผู้ใช้ตรวจสอบ</span></td>
                </tr>
              </table>
            </div>

            <!-- IT Admin ผู้รับผิดชอบ -->
            ${issueData.assignedAdmin ? `
            <div style="background-color: #e8f5e9; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 5px solid #4caf50;">
              <h2 style="color: #2e7d32; margin: 0 0 15px 0; font-size: 18px;">👨‍💻 IT Admin ผู้รับผิดชอบ</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; width: 180px;"><strong>ชื่อ:</strong></td>
                  <td style="padding: 8px 0; color: #2e7d32; font-weight: bold;">${issueData.assignedAdmin.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>อีเมล:</strong></td>
                  <td style="padding: 8px 0;"><a href="mailto:${issueData.assignedAdmin.email}" style="color: #2e7d32; text-decoration: none;">${issueData.assignedAdmin.email}</a></td>
                </tr>
              </table>
            </div>
            ` : ''}

            <!-- ข้อมูลผู้แจ้ง -->
            <div style="margin: 25px 0;">
              <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 15px;">👤 ข้อมูลผู้แจ้ง</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; width: 180px;"><strong>ชื่อ-นามสกุล:</strong></td>
                  <td style="padding: 8px 0;">${issueData.firstName} ${issueData.lastName} (${issueData.nickname})</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>แผนก:</strong></td>
                  <td style="padding: 8px 0;">${issueData.department}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>ออฟฟิศ/สาขา:</strong></td>
                  <td style="padding: 8px 0;">${issueData.office}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>เบอร์โทร:</strong></td>
                  <td style="padding: 8px 0;">${issueData.phone}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>อีเมล:</strong></td>
                  <td style="padding: 8px 0;"><a href="mailto:${issueData.email}" style="color: #1976d2; text-decoration: none;">${issueData.email}</a></td>
                </tr>
              </table>
            </div>

            <!-- รายละเอียดปัญหา -->
            <div style="margin: 25px 0;">
              <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 15px;">🔧 รายละเอียดปัญหา</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; width: 180px;"><strong>ประเภทปัญหา:</strong></td>
                  <td style="padding: 8px 0;">${issueTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>ความเร่งด่วน:</strong></td>
                  <td style="padding: 8px 0;">
                    ${issueData.urgency === 'very_urgent' 
                      ? '<span style="background-color: #f44336; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold;">🔴 ด่วนมาก</span>' 
                      : '<span style="background-color: #4caf50; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold;">🟢 ปกติ</span>'}
                  </td>
                </tr>
              </table>
              
              <div style="margin-top: 15px;">
                <strong>รายละเอียด:</strong>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 8px; border-left: 4px solid #1976d2; white-space: normal; word-wrap: break-word;">
                  ${issueData.description}
                </div>
              </div>

              ${issueData.notes ? `
              <div style="margin-top: 15px;">
                <strong>หมายเหตุ จาก Admin:</strong>
                <div style="background-color: #fff9c4; padding: 15px; border-radius: 8px; margin-top: 8px; border-left: 4px solid #fbc02d;">
                  ${issueData.notes}
                </div>
              </div>
              ` : ''}
            </div>

            <!-- รูปภาพ -->
            ${issueData.images && issueData.images.length > 0 ? `
            <div style="margin: 25px 0;">
              <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 15px;">📷 รูปภาพประกอบ (${issueData.images.length} รูป)</h2>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                ${issueData.images.map((img: string, index: number) => `
                  <div style="margin: 20px 0; text-align: center;">
                    <p style="margin: 0 0 10px 0; font-weight: 600; color: #1976d2; font-size: 14px;">รูปที่ ${index + 1}</p>
                    <img src="cid:image${index}@issueLog" 
                         alt="รูปที่ ${index + 1}" 
                         style="max-width: 100%; max-height: 400px; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 2px solid #e3f2fd; display: block; margin: 0 auto;">
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #666; word-break: break-all;">${img}</p>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

            <!-- ปุ่มติดตามสถานะ -->
            <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); padding: 25px; margin: 30px 0; border-radius: 10px; text-align: center;">
              <p style="color: white; margin: 0 0 15px 0; font-size: 18px; font-weight: bold;">🔍 ต้องการตรวจสอบผลงาน</p>
              <p style="color: #f0f0f0; margin: 0 0 20px 0; font-size: 14px;">กรุณาคลิกปุ่มด้านล่างเพื่อตรวจสอบและยืนยันผลงาน</p>
              <a href="${process.env.NEXTAUTH_URL}/it-tracking" 
                 style="display: inline-block; background-color: #ffffff; color: #ff9800; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                🔗 ตรวจสอบและยืนยันผลงาน
              </a>
            </div>

          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; border: 1px solid #e0e0e0; border-top: none;">
            <p style="margin: 0; color: #666; font-size: 14px;">📧 อีเมลนี้ถูกส่งจากระบบ Inventory Management Dashboard</p>
          </div>
        </div>
      `
      };

      try {
        await transporter.sendMail(mailOptions);
        results.push({ success: true, email: recipientEmail });
        console.log(`✅ Work completed email sent successfully to: ${recipientEmail}`);
      } catch (error) {
        results.push({ success: false, email: recipientEmail, error: error });
        console.error(`❌ Failed to send work completed email to ${recipientEmail}:`, error);
      }
    }

    return { 
      success: results.some(r => r.success), 
      results: results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length
    };
  } catch (error) {
    console.error('❌ Work completed email send error:', error);
    return { success: false, error: error };
  }
}

// 4. ส่งอีเมลแจ้ง IT และผู้แจ้งเมื่อผู้ใช้อนุมัติงาน (completed → closed) หรือส่งกลับ (completed → in_progress)
export async function sendUserApprovalNotification(issueData: any, userFeedback: any) {
  try {
    const itAdminEmails = await getITAdminEmails();
    const results = [];
    
    const isApproved = userFeedback.action === 'approved';
    const urgencyText = issueData.urgency === 'very_urgent' ? 'ด่วน' : 'ปกติ';
    const issueTitle = issueData.issueCategory + (issueData.customCategory ? ` - ${issueData.customCategory}` : '');
    
    // เตรียม attachments สำหรับรูปภาพ
    const attachments = [];
    if (issueData.images && issueData.images.length > 0) {
      const path = require('path');
      const fs = require('fs');
      
      for (let i = 0; i < issueData.images.length; i++) {
        const img = issueData.images[i];
        const imagePath = path.join(process.cwd(), 'public', 'assets', 'IssueLog', img);
        
        if (fs.existsSync(imagePath)) {
          attachments.push({
            filename: img,
            path: imagePath,
            cid: `image${i}@issueLog`
          });
        }
      }
    }
    
    // รวมอีเมลผู้แจ้งและ IT Admin ทั้งหมด
    const allRecipients = [issueData.email, ...itAdminEmails];
    
    // ส่งอีเมลไปยังทุกคน
    for (const recipientEmail of allRecipients) {
      const mailOptions = {
        from: `VSQ IT Service Desk <${process.env.EMAIL_FROM || 'it@vsqclinic.com'}>`,
        to: recipientEmail,
        subject: isApproved 
          ? `แจ้งงาน IT VSQ [${urgencyText}] จาก ${issueData.firstName} ${issueData.lastName} (${issueData.issueId}) - ${issueTitle} : ✅ IT อนุมัติงาน`
          : `แจ้งงาน IT VSQ [${urgencyText}] จาก ${issueData.firstName} ${issueData.lastName} (${issueData.issueId}) - ${issueTitle} : 🔄 ผู้แจ้งงาน IT ส่งงานกลับแก้ไข`,
        attachments: attachments,
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, ${isApproved ? '#4caf50 0%, #2e7d32' : '#f44336 0%, #c62828'} 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; text-align: center;">${isApproved ? '✅ ผู้ใช้อนุมัติงานเรียบร้อย' : '🔄 ผู้ใช้ส่งกลับให้แก้ไข'}</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
            
            <!-- Issue ID และวันที่แจ้ง -->
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 5px solid ${isApproved ? '#4caf50' : '#f44336'};">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; width: 180px;"><strong>📋 Issue ID:</strong></td>
                  <td style="padding: 8px 0; color: ${isApproved ? '#4caf50' : '#f44336'}; font-weight: bold; font-size: 16px;">${issueData.issueId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>📅 วันที่แจ้ง:</strong></td>
                  <td style="padding: 8px 0;">${new Date(issueData.reportDate).toLocaleDateString('th-TH', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    timeZone: 'Asia/Bangkok' 
                  })} เวลา ${new Date(issueData.reportDate).toLocaleTimeString('th-TH', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: 'Asia/Bangkok' 
                  })} น.</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>🕐 ตรวจสอบเมื่อ:</strong></td>
                  <td style="padding: 8px 0;">${new Date(userFeedback.submittedAt).toLocaleDateString('th-TH', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    timeZone: 'Asia/Bangkok' 
                  })} เวลา ${new Date(userFeedback.submittedAt).toLocaleTimeString('th-TH', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: 'Asia/Bangkok' 
                  })} น.</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>📊 สถานะปัจจุบัน:</strong></td>
                  <td style="padding: 8px 0;">
                    <span style="background-color: ${isApproved ? '#4caf50' : '#f44336'}; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 14px;">
                      ${isApproved ? '✅ ปิดงานเรียบร้อย' : '🔄 กำลังดำเนินการ'}
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- ผลการตรวจสอบ -->
            <div style="background-color: ${isApproved ? '#e8f5e9' : '#ffebee'}; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 5px solid ${isApproved ? '#4caf50' : '#f44336'};">
              <h2 style="color: ${isApproved ? '#2e7d32' : '#c62828'}; margin: 0 0 15px 0; font-size: 18px;">${isApproved ? '✅ ผลการตรวจสอบ: อนุมัติ' : '🔄 ผลการตรวจสอบ: ส่งกลับแก้ไข'}</h2>
              <div style="background-color: white; padding: 15px; border-radius: 8px;">
                <strong style="color: ${isApproved ? '#2e7d32' : '#c62828'};">${isApproved ? 'ข้อความจากผู้ใช้:' : 'เหตุผลที่ไม่อนุมัติ:'}</strong>
                <p style="margin: 10px 0 0 0; white-space: pre-wrap; word-wrap: break-word;">${userFeedback.reason}</p>
              </div>
            </div>

            <!-- IT Admin ผู้รับผิดชอบ -->
            ${issueData.assignedAdmin ? `
            <div style="background-color: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 5px solid #1976d2;">
              <h2 style="color: #1976d2; margin: 0 0 15px 0; font-size: 18px;">👨‍💻 IT Admin ผู้รับผิดชอบ</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; width: 180px;"><strong>ชื่อ:</strong></td>
                  <td style="padding: 8px 0; color: #1976d2; font-weight: bold;">${issueData.assignedAdmin.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>อีเมล:</strong></td>
                  <td style="padding: 8px 0;"><a href="mailto:${issueData.assignedAdmin.email}" style="color: #1976d2; text-decoration: none;">${issueData.assignedAdmin.email}</a></td>
                </tr>
              </table>
            </div>
            ` : ''}

            <!-- ข้อมูลผู้แจ้ง -->
            <div style="margin: 25px 0;">
              <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 15px;">👤 ข้อมูลผู้แจ้ง</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; width: 180px;"><strong>ชื่อ-นามสกุล:</strong></td>
                  <td style="padding: 8px 0;">${issueData.firstName} ${issueData.lastName} (${issueData.nickname})</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>แผนก:</strong></td>
                  <td style="padding: 8px 0;">${issueData.department}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>ออฟฟิศ/สาขา:</strong></td>
                  <td style="padding: 8px 0;">${issueData.office}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>เบอร์โทร:</strong></td>
                  <td style="padding: 8px 0;">${issueData.phone}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>อีเมล:</strong></td>
                  <td style="padding: 8px 0;"><a href="mailto:${issueData.email}" style="color: #667eea; text-decoration: none;">${issueData.email}</a></td>
                </tr>
              </table>
            </div>

            <!-- รายละเอียดปัญหา -->
            <div style="margin: 25px 0;">
              <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 15px;">🔧 รายละเอียดปัญหา</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; width: 180px;"><strong>ประเภทปัญหา:</strong></td>
                  <td style="padding: 8px 0;">${issueTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>ความเร่งด่วน:</strong></td>
                  <td style="padding: 8px 0;">
                    ${issueData.urgency === 'very_urgent' 
                      ? '<span style="background-color: #f44336; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold;">🔴 ด่วนมาก</span>' 
                      : '<span style="background-color: #4caf50; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold;">🟢 ปกติ</span>'}
                  </td>
                </tr>
              </table>
              
              <div style="margin-top: 15px;">
                <strong>รายละเอียด:</strong>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 8px; border-left: 4px solid #667eea; white-space: normal; word-wrap: break-word;">
                  ${issueData.description}
                </div>
              </div>

              ${issueData.notes ? `
              <div style="margin-top: 15px;">
                <strong>หมายเหตุ จาก Admin:</strong>
                <div style="background-color: #fff9c4; padding: 15px; border-radius: 8px; margin-top: 8px; border-left: 4px solid #fbc02d;">
                  ${issueData.notes}
                </div>
              </div>
              ` : ''}
            </div>

            <!-- รูปภาพ -->
            ${issueData.images && issueData.images.length > 0 ? `
            <div style="margin: 25px 0;">
              <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 15px;">📷 รูปภาพประกอบ (${issueData.images.length} รูป)</h2>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                ${issueData.images.map((img: string, index: number) => `
                  <div style="margin: 20px 0; text-align: center;">
                    <p style="margin: 0 0 10px 0; font-weight: 600; color: #667eea; font-size: 14px;">รูปที่ ${index + 1}</p>
                    <img src="cid:image${index}@issueLog" 
                         alt="รูปที่ ${index + 1}" 
                         style="max-width: 100%; max-height: 400px; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 2px solid #e8eaf6; display: block; margin: 0 auto;">
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #666; word-break: break-all;">${img}</p>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

            ${!isApproved ? `
            <!-- ปุ่มดำเนินการ (กรณีส่งกลับ) -->
            <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); padding: 25px; margin: 30px 0; border-radius: 10px; text-align: center;">
              <p style="color: white; margin: 0 0 15px 0; font-size: 18px; font-weight: bold;">🔧 ต้องการดำเนินการ</p>
              <p style="color: #f0f0f0; margin: 0 0 20px 0; font-size: 14px;">งานถูกส่งกลับให้แก้ไข กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ</p>
              <a href="${process.env.NEXTAUTH_URL}/admin/it-reports" 
                 style="display: inline-block; background-color: #ffffff; color: #ff9800; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                🔗 เข้าสู่ระบบ IT Admin
              </a>
            </div>
            ` : `
            <!-- ข้อความสำเร็จ (กรณีอนุมัติ) -->
            <div style="background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); padding: 25px; margin: 30px 0; border-radius: 10px; text-align: center;">
              <p style="color: white; margin: 0 0 15px 0; font-size: 18px; font-weight: bold;">🎉 งานเสร็จสิ้นเรียบร้อย</p>
              <p style="color: #f0f0f0; margin: 0; font-size: 14px;">ผู้ใช้อนุมัติงานแล้ว งานนี้ได้ปิดเรียบร้อยแล้ว</p>
            </div>
            `}

          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; border: 1px solid #e0e0e0; border-top: none;">
            <p style="margin: 0; color: #666; font-size: 14px;">📧 อีเมลนี้ถูกส่งจากระบบ Inventory Management Dashboard</p>
          </div>
        </div>
      `
      };

      try {
        await transporter.sendMail(mailOptions);
        results.push({ success: true, email: recipientEmail });
        console.log(`✅ User approval/rejection email sent successfully to: ${recipientEmail}`);
      } catch (error) {
        results.push({ success: false, email: recipientEmail, error: error });
        console.error(`❌ Failed to send user approval/rejection email to ${recipientEmail}:`, error);
      }
    }

    return { 
      success: results.some(r => r.success), 
      results: results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length
    };
  } catch (error) {
    console.error('User feedback email send error:', error);
    return { success: false, error: error };
  }
}

// 5. ส่งอีเมล Auto-Reply เมื่อมีคนตอบกลับอีเมลแจ้งงานใหม่
export async function sendAutoReplyForNewIssue(originalSender: string) {
  const mailOptions = {
    from: `IT Support System <${process.env.EMAIL_FROM || 'it@vsqclinic.com'}>`,
    to: originalSender,
    subject: `🚫 ไม่สามารถตอบกลับอีเมลนี้ได้ - โปรดใช้ระบบ`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #d32f2f;">🚫 ไม่สามารถตอบกลับอีเมลนี้ได้</h2>
        
        <div style="background-color: #ffebee; padding: 15px; margin: 10px 0; border-radius: 5px; border: 2px solid #d32f2f;">
          <p style="margin: 0; color: #d32f2f; font-weight: bold;">⚠️ อีเมลนี้เป็นการแจ้งเตือนอัตโนมัติ</p>
          <p style="margin: 5px 0 0 0; color: #666;">กรุณาเข้าระบบเพื่อรับงานแทน</p>
        </div>

        <div style="margin: 15px 0;">
          <p><strong>📋 วิธีการรับงาน:</strong></p>
          <ol style="color: #666; padding-left: 20px;">
            <li>เข้าสู่ระบบ IT Admin</li>
            <li>ไปที่หน้า "รายงานแจ้งงาน IT"</li>
            <li>กดปุ่ม "รับงาน" ที่งานที่ต้องการ</li>
            <li>ระบบจะเชื่อมต่อคุณกับผู้แจ้งโดยอัตโนมัติ</li>
          </ol>
        </div>

        <div style="background-color: #fff3e0; padding: 15px; margin: 20px 0; border-radius: 5px; border: 2px solid #ff9800;">
          <p><strong>🔗 เข้าสู่ระบบ IT Admin:</strong></p>
          <p style="margin: 10px 0;">
            <a href="${process.env.NEXTAUTH_URL}/admin/it-reports" 
               style="background-color: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
               เข้าระบบ IT Admin
            </a>
          </p>
        </div>

        <div style="background-color: #e3f2fd; padding: 10px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0; color: #1976d2;"><strong>📧 อีเมลอัตโนมัติจากระบบ Inventory Management</strong></p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Auto-reply email send error:', error);
    return { success: false, error: error };
  }
}

// 5. ส่งอีเมลแจ้ง Admin เมื่อมี User สมัครสมาชิกใหม่ผ่าน Google
export async function sendNewUserRegistrationNotification(userData: any) {
  try {
    const adminEmails = await getITAdminEmails(); // ใช้ IT Admin emails สำหรับตอนนี้
    const results = [];
    
    // ส่งเมลล์ไปยัง Admin ทุกคน
    for (const adminEmail of adminEmails) {
      const mailOptions = {
        from: `IT Support System <${process.env.EMAIL_FROM || 'it@vsqclinic.com'}>`,
        to: adminEmail,
        subject: `🔔 [สมัครสมาชิกใหม่] ${userData.firstName} ${userData.lastName}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #2563eb;">🔔 มีสมาชิกใหม่รอการอนุมัติ</h2>
            
            <div style="background-color: #f8fafc; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #2563eb;">
              <p><strong>👤 ชื่อ:</strong> ${userData.firstName} ${userData.lastName}${userData.nickname ? ` (${userData.nickname})` : ''}</p>
              <p><strong>📧 อีเมล:</strong> ${userData.email}</p>
              <p><strong>🏢 สาขา:</strong> ${userData.office}</p>
              <p><strong>📱 เบอร์โทร:</strong> ${userData.phone}</p>
              ${userData.department ? `<p><strong>🏷️ แผนก:</strong> ${userData.department}</p>` : ''}
              <p><strong>🔐 วิธีสมัคร:</strong> Google OAuth</p>
            </div>

            ${userData.requestMessage ? `
            <div style="background-color: #fffbeb; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #f59e0b;">
              <p><strong>💬 ข้อความจากผู้สมัคร:</strong></p>
              <p style="font-style: italic; color: #666;">"${userData.requestMessage}"</p>
            </div>
            ` : ''}

            <div style="background-color: #fff3e0; padding: 15px; margin: 20px 0; border-radius: 5px; border: 2px solid #ff9800;">
              <p><strong>🔧 ดำเนินการ:</strong></p>
              <p style="margin: 5px 0; color: #666; font-size: 0.9em;">คลิกลิงค์ด้านล่างเพื่อเข้าสู่ระบบและอนุมัติสมาชิกใหม่</p>
              <p style="margin: 10px 0;">
                <a href="${process.env.NEXTAUTH_URL}/admin/users?tab=pending" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                   🔗 อนุมัติสมาชิกใหม่
                </a>
              </p>
            </div>

            <div style="background-color: #e3f2fd; padding: 10px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 0; color: #1976d2;"><strong>📧 อีเมลนี้ถูกส่งจากระบบ Inventory Management Dashboard</strong></p>
              <p style="margin: 5px 0; color: #1976d2; font-size: 0.9em;">ส่งถึง: ${adminEmail}</p>
            </div>
          </div>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        results.push({ success: true, email: adminEmail });
        console.log(`New user registration email sent successfully to ${adminEmail}`);
      } catch (error) {
        results.push({ success: false, email: adminEmail, error: error });
        console.error(`Failed to send new user registration email to ${adminEmail}:`, error);
      }
    }

    return { 
      success: results.some(r => r.success), 
      results: results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length
    };
  } catch (error) {
    console.error('New user registration email send error:', error);
    return { success: false, error: error };
  }
}

// รวม function เดิมที่แก้ไขแล้ว
export async function sendIssueUpdateNotification(issueData: any) {
  // Determine status text and colors based on status
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'in_progress':
        return {
          text: 'กำลังดำเนินการ',
          color: '#1976d2',
          bgColor: '#e3f2fd'
        };
      case 'completed':
        return {
          text: 'ส่งงานเรียบร้อยแล้ว - รอการตรวจสอบ',
          color: '#2e7d32',
          bgColor: '#e8f5e8'
        };
      default:
        return {
          text: 'อัพเดตสถานะ',
          color: '#666',
          bgColor: '#f5f5f5'
        };
    }
  };

  const statusInfo = getStatusInfo(issueData.status);
  const isCompleted = issueData.status === 'completed';

  // เตรียม attachments สำหรับรูปภาพ
  const attachments = [];
  if (issueData.images && issueData.images.length > 0) {
    const path = require('path');
    const fs = require('fs');
    
    for (let i = 0; i < issueData.images.length; i++) {
      const img = issueData.images[i];
      const imagePath = path.join(process.cwd(), 'public', 'assets', 'IssueLog', img);
      
      if (fs.existsSync(imagePath)) {
        attachments.push({
          filename: img,
          path: imagePath,
          cid: `image${i}@issueLog`
        });
      }
    }
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'it@vsqclinic.com', // From: ทีมไอที
    to: issueData.email, // To: อีเมลผู้แจ้ง
    subject: `🔄 อัพเดต แจ้งปัญหา IT - ${issueData.issueId}`,
    attachments: attachments,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: ${statusInfo.color};">🔄 อัพเดตสถานะแจ้งปัญหา IT</h2>
        
        <div style="background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
          <p><strong>✳️ Issue ID:</strong> ${issueData.issueId}</p>
        </div>

        <div style="background-color: ${statusInfo.bgColor}; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid ${statusInfo.color};">
          <p style="margin: 0;"><strong>📍 สถานะปัจจุบัน:</strong> <span style="color: ${statusInfo.color}; font-weight: bold;">${statusInfo.text}</span></p>
          <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #666;">อัพเดตเมื่อ: ${new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })} เวลา ${new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}</p>
        </div>

        <div style="margin: 15px 0;">
          <p><strong>➢ วันที่แจ้ง:</strong> ${new Date(issueData.reportDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })} 
             <strong>เวลาที่แจ้ง:</strong> ${new Date(issueData.reportDate).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}</p>
        </div>

        <div style="margin: 15px 0;">
          <p><strong>➢ ผู้แจ้ง:</strong> ${issueData.firstName} ${issueData.lastName} (${issueData.nickname})</p>
          <p><strong>- แผนก:</strong> ${issueData.department}</p>
          <p><strong>- สาขา:</strong> ${issueData.office}</p>
          <p><strong>- เบอร์โทร:</strong> ${issueData.phone}</p>
          <p><strong>- อีเมลผู้แจ้ง:</strong> ${issueData.email}</p>
        </div>

        <div style="margin: 15px 0;">
          <p><strong>➢ ประเภทงาน:</strong> แจ้งงาน IT</p>
          <p><strong>- ความเร่งด่วน:</strong> ${issueData.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ'}</p>
          <p><strong>- หัวข้อ:</strong> ${issueData.issueCategory}${issueData.customCategory ? ' - ' + issueData.customCategory : ''}</p>
          <p><strong>- รายละเอียด:</strong></p>
          <div style="background-color: #f9f9f9; padding: 10px; border-left: 4px solid #2196f3; margin: 5px 0;">
            ${issueData.description}
          </div>
        </div>

        <div style="margin: 15px 0;">
          <p><strong>➢ หมายเหตุ จาก Admin:</strong> ${issueData.notes || '-'}</p>
        </div>

        ${issueData.images && issueData.images.length > 0 ? `
        <div style="margin: 15px 0;">
          <p><strong>➢ รูปภาพประกอบ (${issueData.images.length} รูป):</strong></p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 10px;">
            ${issueData.images.map((img: string, index: number) => `
              <div style="margin: 15px 0; text-align: center;">
                <p style="margin: 0 0 10px 0; font-weight: 600; color: #1976d2; font-size: 14px;">รูปที่ ${index + 1}</p>
                <img src="cid:image${index}@issueLog" 
                     alt="รูปที่ ${index + 1}" 
                     style="max-width: 100%; max-height: 400px; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 2px solid #e3f2fd; display: block; margin: 0 auto;">
                <p style="margin: 8px 0 0 0; font-size: 11px; color: #666; word-break: break-all;">${img}</p>
              </div>
            `).join('')}
          </div>
        </div>
        ` : '<div style="margin: 15px 0;"><p><strong>➢ รูปภาพ:</strong> ไม่มี</p></div>'}

        ${isCompleted ? `
        <div style="background-color: #fff3e0; padding: 15px; margin: 20px 0; border-radius: 5px; border: 2px solid #ff9800;">
          <p><strong>🔍 ต้องการตรวจสอบผลงาน:</strong></p>
          <p style="margin: 5px 0; color: #666; font-size: 0.9em;">กรุณาคลิกลิงค์ด้านล่างเพื่อตรวจสอบและยืนยันผลงาน</p>
          <p style="margin: 10px 0;">
            <a href="${process.env.NEXTAUTH_URL}/it-tracking" 
               style="background-color: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
               🔗 ตรวจสอบผลงาน
            </a>
          </p>
        </div>
        ` : `
        <div style="background-color: #e3f2fd; padding: 15px; margin: 20px 0; border-radius: 5px; border: 2px solid #2196f3;">
          <p><strong>⏳ ขั้นตอนถัดไป:</strong></p>
          <p style="margin: 5px 0; color: #666; font-size: 0.9em;">ทีม IT กำลังดำเนินการแก้ไขปัญหา คุณสามารถติดตามสถานะได้ที่:</p>
          <p style="margin: 10px 0;">
            <a href="${process.env.NEXTAUTH_URL}/it-tracking" 
               style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
               📊 ติดตามสถานะ
            </a>
          </p>
        </div>
        `}

        <div style="background-color: #e3f2fd; padding: 10px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0; color: #1976d2;"><strong>📧 อีเมลนี้ถูกส่งจากระบบ Inventory Management Dashboard</strong></p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error };
  }
}
