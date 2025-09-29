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
        from: `IT Support System <${process.env.EMAIL_FROM || 'it@vsqclinic.com'}>`, // From: ระบบ IT
        to: adminEmail, // To: แต่ละคนในทีม IT
        subject: `🚨 [งานใหม่] แจ้งปัญหาจาก ${issueData.firstName} ${issueData.lastName} - ${issueData.issueId}`,
        // ไม่ใส่ replyTo เพื่อป้องกันการ reply โดยตรง
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #d32f2f;">🚨 แจ้งปัญหาใหม่จากพนักงาน</h2>
            
            <div style="background-color: #ffebee; padding: 15px; margin: 10px 0; border-radius: 5px; border: 2px solid #d32f2f;">
              <p style="margin: 0; color: #d32f2f; font-weight: bold;">⚠️ หมายเหตุสำคัญ: ห้าม Reply อีเมลนี้</p>
              <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9em;">กรุณาเข้าระบบเพื่อรับงาน</p>
            </div>
            
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

            <div style="background-color: #fff3e0; padding: 15px; margin: 20px 0; border-radius: 5px; border: 2px solid #ff9800;">
              <p><strong>🔧 ดำเนินการ:</strong></p>
              <p style="margin: 5px 0; color: #666; font-size: 0.9em;">คลิกลิงค์ด้านล่างเพื่อเข้าสู่ระบบ IT Admin และรับงานนี้</p>
              <p style="margin: 10px 0;">
                <a href="${process.env.NEXTAUTH_URL}/admin/it-reports" 
                   style="background-color: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                   🔗 เข้าสู่ระบบ IT Admin
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

// 2. ส่งอีเมลแจ้งผู้แจ้งเมื่อ IT รับงาน (pending → in_progress)
export async function sendJobAcceptedNotification(issueData: any) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'it@vsqclinic.com',
    to: issueData.email,
    subject: `✅ IT รับงานแล้ว - ${issueData.issueId}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #1976d2;">✅ ทีม IT รับงานเรียบร้อยแล้ว</h2>
        
        <div style="background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
          <p><strong>✳️ Issue ID:</strong> ${issueData.issueId}</p>
        </div>

        <div style="background-color: #e3f2fd; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #1976d2;">
          <p style="margin: 0;"><strong>📍 สถานะปัจจุบัน:</strong> <span style="color: #1976d2; font-weight: bold;">กำลังดำเนินการ</span></p>
          <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #666;">รับงานเมื่อ: ${new Date().toLocaleDateString('th-TH')} เวลา ${new Date().toLocaleTimeString('th-TH')}</p>
        </div>

        ${issueData.assignedAdmin ? `
        <div style="background-color: #e8f5e8; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #2e7d32;">
          <p><strong>👨‍💻 IT Admin ผู้รับผิดชอบ:</strong></p>
          <p style="margin: 5px 0; font-weight: bold; color: #2e7d32;">${issueData.assignedAdmin.name}</p>
          <p style="margin: 0; color: #666; font-size: 0.9em;">${issueData.assignedAdmin.email}</p>
        </div>
        ` : ''}

        <div style="margin: 15px 0;">
          <p><strong>➢ ประเภทปัญหา:</strong> ${issueData.issueCategory}${issueData.customCategory ? ' - ' + issueData.customCategory : ''}</p>
          <p><strong>➢ ความเร่งด่วน:</strong> ${issueData.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ'}</p>
        </div>

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

        <div style="background-color: #e3f2fd; padding: 10px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0; color: #1976d2;"><strong>📧 อีเมลนี้ถูกส่งจากระบบ Inventory Management Dashboard</strong></p>
        </div>
      </div>
    `
  };

  try {
    
    const result = await transporter.sendMail(mailOptions);
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Job accepted email send error:', error);
    console.error('📧 Failed email details:', {
      to: issueData.email,
      subject: mailOptions.subject,
      error: error.message
    });
    return { success: false, error: error };
  }
}

// 3. ส่งอีเมลแจ้งผู้แจ้งเมื่อ IT ส่งงาน (in_progress → completed)
export async function sendWorkCompletedNotification(issueData: any) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'it@vsqclinic.com',
    to: issueData.email,
    subject: `🎉 IT ส่งงานแล้ว - รอการตรวจสอบ ${issueData.issueId}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #2e7d32;">🎉 ทีม IT ส่งงานเรียบร้อยแล้ว</h2>
        
        <div style="background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
          <p><strong>✳️ Issue ID:</strong> ${issueData.issueId}</p>
        </div>

        <div style="background-color: #e8f5e8; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #2e7d32;">
          <p style="margin: 0;"><strong>📍 สถานะปัจจุบัน:</strong> <span style="color: #2e7d32; font-weight: bold;">ส่งงานเรียบร้อยแล้ว - รอการตรวจสอบ</span></p>
          <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #666;">ส่งงานเมื่อ: ${new Date().toLocaleDateString('th-TH')} เวลา ${new Date().toLocaleTimeString('th-TH')}</p>
        </div>

        ${issueData.assignedAdmin ? `
        <div style="background-color: #e3f2fd; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #1976d2;">
          <p><strong>👨‍💻 IT Admin ผู้รับผิดชอบ:</strong></p>
          <p style="margin: 5px 0; font-weight: bold; color: #1976d2;">${issueData.assignedAdmin.name}</p>
          <p style="margin: 0; color: #666; font-size: 0.9em;">${issueData.assignedAdmin.email}</p>
        </div>
        ` : ''}

        <div style="margin: 15px 0;">
          <p><strong>➢ ประเภทปัญหา:</strong> ${issueData.issueCategory}${issueData.customCategory ? ' - ' + issueData.customCategory : ''}</p>
          <p><strong>➢ ความเร่งด่วน:</strong> ${issueData.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ'}</p>
        </div>

        <div style="background-color: #fff3e0; padding: 15px; margin: 20px 0; border-radius: 5px; border: 2px solid #ff9800;">
          <p><strong>🔍 ต้องการตรวจสอบผลงาน:</strong></p>
          <p style="margin: 5px 0; color: #666; font-size: 0.9em;">กรุณาคลิกลิงค์ด้านล่างเพื่อตรวจสอบและยืนยันผลงาน</p>
          <p style="margin: 10px 0;">
            <a href="${process.env.NEXTAUTH_URL}/it-tracking" 
               style="background-color: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
               🔗 ตรวจสอบและยืนยันผลงาน
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
    
    const result = await transporter.sendMail(mailOptions);
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Work completed email send error:', error);
    console.error('📧 Failed email details:', {
      to: issueData.email,
      subject: mailOptions.subject,
      error: error.message
    });
    return { success: false, error: error };
  }
}

// 4. ส่งอีเมลแจ้ง IT เมื่อผู้ใช้อนุมัติงาน (completed → closed)
export async function sendUserApprovalNotification(issueData: any, userFeedback: any) {
  try {
    const itAdminEmails = await getITAdminEmails();
    const results = [];
    
    const isApproved = userFeedback.action === 'approved';
    const statusColor = isApproved ? '#2e7d32' : '#d32f2f';
    const statusBg = isApproved ? '#e8f5e8' : '#ffebee';
    const statusText = isApproved ? '✅ ผู้ใช้อนุมัติงาน' : '❌ ผู้ใช้ส่งกลับให้แก้ไข';
    
    for (const adminEmail of itAdminEmails) {
      const mailOptions = {
        from: `IT Support System <${process.env.EMAIL_FROM || 'it@vsqclinic.com'}>`,
        to: adminEmail,
        subject: `${isApproved ? '✅' : '❌'} ${isApproved ? 'อนุมัติงาน' : 'ส่งกลับแก้ไข'} จาก ${issueData.firstName} ${issueData.lastName} - ${issueData.issueId}`,
        replyTo: `${issueData.firstName} ${issueData.lastName} <${issueData.email}>`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: ${statusColor};">${statusText}</h2>
            
            <div style="background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
              <p><strong>✳️ Issue ID:</strong> ${issueData.issueId}</p>
            </div>

            <div style="background-color: ${statusBg}; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid ${statusColor};">
              <p style="margin: 0;"><strong>📍 ผลการตรวจสอบ:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>
              <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #666;">ตรวจสอบเมื่อ: ${new Date(userFeedback.submittedAt).toLocaleDateString('th-TH')} เวลา ${new Date(userFeedback.submittedAt).toLocaleTimeString('th-TH')}</p>
            </div>

            <div style="margin: 15px 0;">
              <p><strong>➢ ผู้แจ้ง:</strong> ${issueData.firstName} ${issueData.lastName} (${issueData.nickname})</p>
              <p><strong>- แผนก:</strong> ${issueData.department}</p>
              <p><strong>- สาขา:</strong> ${issueData.office}</p>
              <p><strong>- เบอร์โทร:</strong> ${issueData.phone}</p>
              <p><strong>- อีเมลผู้แจ้ง:</strong> ${issueData.email}</p>
            </div>

            <div style="margin: 15px 0;">
              <p><strong>➢ ประเภทปัญหา:</strong> ${issueData.issueCategory}${issueData.customCategory ? ' - ' + issueData.customCategory : ''}</p>
              <p><strong>➢ ความเร่งด่วน:</strong> ${issueData.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ'}</p>
            </div>

            ${issueData.assignedAdmin ? `
            <div style="background-color: #e3f2fd; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #1976d2;">
              <p><strong>👨‍💻 IT Admin ผู้รับผิดชอบ:</strong></p>
              <p style="margin: 5px 0; font-weight: bold; color: #1976d2;">${issueData.assignedAdmin.name}</p>
              <p style="margin: 0; color: #666; font-size: 0.9em;">${issueData.assignedAdmin.email}</p>
            </div>
            ` : ''}

            <div style="background-color: ${statusBg}; padding: 15px; margin: 15px 0; border-radius: 5px; border: 2px solid ${statusColor};">
              <p><strong>💬 ${isApproved ? 'ข้อความจากผู้ใช้:' : 'เหตุผลที่ไม่อนุมัติ:'}</strong></p>
              <div style="background-color: white; padding: 10px; border-radius: 5px; margin: 5px 0;">
                ${userFeedback.reason}
              </div>
            </div>

            ${!isApproved ? `
            <div style="background-color: #fff3e0; padding: 15px; margin: 20px 0; border-radius: 5px; border: 2px solid #ff9800;">
              <p><strong>🔧 ต้องการดำเนินการ:</strong></p>
              <p style="margin: 5px 0; color: #666; font-size: 0.9em;">งานถูกส่งกลับให้แก้ไข กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ</p>
              <p style="margin: 10px 0;">
                <a href="${process.env.NEXTAUTH_URL}/admin/it-reports" 
                   style="background-color: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                   🔗 เข้าสู่ระบบ IT Admin
                </a>
              </p>
            </div>
            ` : `
            <div style="background-color: #e8f5e8; padding: 15px; margin: 20px 0; border-radius: 5px; border: 2px solid #2e7d32;">
              <p><strong>🎉 งานเสร็จสิ้น:</strong></p>
              <p style="margin: 5px 0; color: #666; font-size: 0.9em;">ผู้ใช้อนุมัติงานแล้ว งานนี้ได้ปิดเรียบร้อยแล้ว</p>
            </div>
            `}

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
        console.log(`User feedback email sent successfully to ${adminEmail}`);
      } catch (error) {
        results.push({ success: false, email: adminEmail, error: error });
        console.error(`Failed to send user feedback email to ${adminEmail}:`, error);
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
              ${userData.profilePicture ? `<p><strong>📸 รูปโปรไฟล์:</strong> <a href="${userData.profilePicture}" target="_blank">ดูรูปโปรไฟล์</a></p>` : ''}
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

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'it@vsqclinic.com', // From: ทีมไอที
    to: issueData.email, // To: อีเมลผู้แจ้ง
    subject: `🔄 อัพเดต แจ้งปัญหา IT - ${issueData.issueId}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: ${statusInfo.color};">🔄 อัพเดตสถานะแจ้งปัญหา IT</h2>
        
        <div style="background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
          <p><strong>✳️ Issue ID:</strong> ${issueData.issueId}</p>
        </div>

        <div style="background-color: ${statusInfo.bgColor}; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid ${statusInfo.color};">
          <p style="margin: 0;"><strong>📍 สถานะปัจจุบัน:</strong> <span style="color: ${statusInfo.color}; font-weight: bold;">${statusInfo.text}</span></p>
          <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #666;">อัพเดตเมื่อ: ${new Date().toLocaleDateString('th-TH')} เวลา ${new Date().toLocaleTimeString('th-TH')}</p>
        </div>

        <div style="margin: 15px 0;">
          <p><strong>➢ วันที่แจ้ง:</strong> ${new Date(issueData.reportDate).toLocaleDateString('th-TH')} 
             <strong>เวลาที่แจ้ง:</strong> ${new Date(issueData.reportDate).toLocaleTimeString('th-TH')}</p>
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
