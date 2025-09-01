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
    const itAdminEmails = await getITAdminEmails();
    const results = [];
    
    // ส่งเมลล์ไปยังทีม IT ทุกคน
    for (const adminEmail of itAdminEmails) {
      const mailOptions = {
        from: `${issueData.firstName} ${issueData.lastName} <${issueData.email}>`, // From: ผู้แจ้งจริง
        to: adminEmail, // To: แต่ละคนในทีม IT
        subject: `⚠️ แจ้งปัญหาใหม่จากพนักงาน - ${issueData.issueId}`,
        replyTo: issueData.email, // Reply กลับไปยังผู้แจ้ง
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #d32f2f;">⚠️ แจ้งปัญหาใหม่จากพนักงาน ⚠️</h2>
            
            <div style="background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
              <p><strong>✳️ Issue ID:</strong> ${issueData.issueId}</p>
            </div>

            <div style="margin: 15px 0;">
              <p><strong>➢ วันที่แจ้ง:</strong> ${new Date(issueData.reportDate).toLocaleDateString('th-TH')} 
                 <strong>เวลาที่แจ้ง:</strong> ${new Date(issueData.reportDate).toLocaleTimeString('th-TH')}</p>
              <p><strong>➢ สถานะ:</strong> รอดำเนินการ</p>
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
              <p><strong>➢ หมายเหตุ:</strong> ${issueData.notes || '-'}</p>
            </div>

            ${issueData.images && issueData.images.length > 0 ? `
            <div style="margin: 15px 0;">
              <p><strong>➢ รูปภาพ (ใส่ลิงค์รูปแบบคลิกดูรูปได้):</strong></p>
              ${issueData.images.map((img: string) => `<p><a href="${process.env.NEXTAUTH_URL}/assets/IssueLog/${img}" target="_blank">คลิกดูรูป: ${img}</a></p>`).join('')}
            </div>
            ` : '<div style="margin: 15px 0;"><p><strong>➢ รูปภาพ:</strong> ไม่มี</p></div>'}

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
        console.log(`Email sent successfully to ${adminEmail}`);
      } catch (error) {
        results.push({ success: false, email: adminEmail, error: error });
        console.error(`Failed to send email to ${adminEmail}:`, error);
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

export async function sendIssueUpdateNotification(issueData: any) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'it@vsqclinic.com', // From: ทีมไอที
    to: issueData.email, // To: อีเมลผู้แจ้ง
    subject: `⚠️ อัพเดต แจ้งปัญหาจากพนักงาน - ${issueData.issueId}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #2e7d32;">⚠️ อัพเดต แจ้งปัญหาจากพนักงาน ⚠️</h2>
        
        <div style="background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
          <p><strong>✳️ Issue ID:</strong> ${issueData.issueId}</p>
        </div>

        <div style="margin: 15px 0;">
          <p><strong>➢ วันที่แจ้ง:</strong> ${new Date(issueData.reportDate).toLocaleDateString('th-TH')} 
             <strong>เวลาที่แจ้ง:</strong> ${new Date(issueData.reportDate).toLocaleTimeString('th-TH')}</p>
          <p><strong>➢ สถานะ:</strong> <span style="color: #2e7d32; font-weight: bold;">ดำเนินการแล้ว</span></p>
          <p><strong>- วันที่อัพเดตสถานะ:</strong> ${new Date().toLocaleDateString('th-TH')} 
             <strong>เวลาที่อัพเดตสถานะ:</strong> ${new Date().toLocaleTimeString('th-TH')}</p>
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
          <p><strong>➢ หมายเหตุ:</strong> ${issueData.notes || '-'}</p>
        </div>

        ${issueData.images && issueData.images.length > 0 ? `
        <div style="margin: 15px 0;">
          <p><strong>➢ รูปภาพ (ใส่ลิงค์รูปแบบคลิกดูรูปได้):</strong></p>
          ${issueData.images.map((img: string) => `<p><a href="${process.env.NEXTAUTH_URL}/assets/IssueLog/${img}" target="_blank">คลิกดูรูป: ${img}</a></p>`).join('')}
        </div>
        ` : '<div style="margin: 15px 0;"><p><strong>➢ รูปภาพ:</strong> ไม่มี</p></div>'}

        <div style="background-color: #fff3e0; padding: 15px; margin: 20px 0; border-radius: 5px; border: 2px solid #ff9800;">
          <p><strong>➢ คลิกลิงค์เพื่อต้องการปิดงาน หรือไม่ปิดงาน พร้อมหมายเหตุหากไม่ปิดงาน:</strong></p>
          <p style="margin: 10px 0;">
            <a href="${process.env.NEXTAUTH_URL}/close-issue/${issueData.issueId}" 
               style="background-color: #2196f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
               คลิกที่นี่เพื่อดำเนินการ
            </a>
          </p>
        </div>

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
