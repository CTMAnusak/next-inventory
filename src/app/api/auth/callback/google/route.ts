import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode, getUserProfile, sendEmailViaGmail } from '@/lib/google-auth';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';
import { getITAdminEmails } from '@/lib/admin-emails';

/**
 * Google OAuth Callback
 * จัดการหลังจากผู้ใช้ล็อกอิน Google สำเร็จ
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL('/it-report?error=google_auth_cancelled', request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/it-report?error=missing_auth_code', request.url)
      );
    }

    // แลกเปลี่ยน code เป็น tokens
    const tokens = await getTokensFromCode(code);
    
    if (!tokens.access_token) {
      return NextResponse.redirect(
        new URL('/it-report?error=token_exchange_failed', request.url)
      );
    }

    // ดึงข้อมูล user profile
    const userProfile = await getUserProfile(tokens.access_token);
    
    if (!userProfile || !userProfile.email) {
      return NextResponse.redirect(
        new URL('/it-report?error=profile_fetch_failed', request.url)
      );
    }

    // Parse state เพื่อดึง issueId
    let issueId = null;
    if (state) {
      try {
        const stateData = JSON.parse(state);
        issueId = stateData.issueId;
      } catch (e) {
        console.error('State parse error:', e);
      }
    }

    // ถ้ามี issueId ให้ส่งอีเมลทันที
    if (issueId) {
      await dbConnect();
      
      // ดึงข้อมูล issue จาก database
      const issue = await IssueLog.findOne({ issueId });
      
      if (issue) {
        // ดึงอีเมลทีม IT
        const itAdminEmails = await getITAdminEmails();
        
        // สร้าง HTML สำหรับอีเมล
        const htmlBody = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #d32f2f;">⚠️ แจ้งปัญหาใหม่จากพนักงาน ⚠️</h2>
            
            <div style="background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px;">
              <p><strong>✳️ Issue ID:</strong> ${issue.issueId}</p>
            </div>

            <div style="margin: 15px 0;">
              <p><strong>➢ วันที่แจ้ง:</strong> ${issue.reportDate.toLocaleDateString('th-TH')} 
                 <strong>เวลาที่แจ้ง:</strong> ${issue.reportDate.toLocaleTimeString('th-TH')}</p>
              <p><strong>➢ สถานะ:</strong> รอดำเนินการ</p>
            </div>

            <div style="margin: 15px 0;">
              <p><strong>➢ ผู้แจ้ง:</strong> ${issue.firstName} ${issue.lastName} (${issue.nickname})</p>
              <p><strong>- แผนก:</strong> ${issue.department}</p>
              <p><strong>- สาขา:</strong> ${issue.office}</p>
              <p><strong>- เบอร์โทร:</strong> ${issue.phone}</p>
              <p><strong>- อีเมลผู้แจ้ง:</strong> ${issue.email}</p>
            </div>

            <div style="margin: 15px 0;">
              <p><strong>➢ ประเภทงาน:</strong> แจ้งงาน IT</p>
              <p><strong>- ความเร่งด่วน:</strong> ${issue.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ'}</p>
              <p><strong>- หัวข้อ:</strong> ${issue.issueCategory}${issue.customCategory ? ' - ' + issue.customCategory : ''}</p>
              <p><strong>- รายละเอียด:</strong></p>
              <div style="background-color: #f9f9f9; padding: 10px; border-left: 4px solid #2196f3; margin: 5px 0;">
                ${issue.description}
              </div>
            </div>

            <div style="margin: 15px 0;">
              <p><strong>➢ หมายเหตุ:</strong> ${issue.notes || '-'}</p>
            </div>

            ${issue.images && issue.images.length > 0 ? `
            <div style="margin: 15px 0;">
              <p><strong>➢ รูปภาพ:</strong></p>
              ${issue.images.map((img: string) => `<p><a href="${process.env.NEXTAUTH_URL}/assets/IssueLog/${img}" target="_blank">คลิกดูรูป: ${img}</a></p>`).join('')}
            </div>
            ` : '<div style="margin: 15px 0;"><p><strong>➢ รูปภาพ:</strong> ไม่มี</p></div>'}

            <div style="background-color: #e3f2fd; padding: 10px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 0; color: #1976d2;"><strong>📧 อีเมลนี้ถูกส่งจากระบบ Inventory Management Dashboard</strong></p>
              <p style="margin: 5px 0; color: #1976d2; font-size: 0.9em;">ส่งโดย: ${userProfile.name} (${userProfile.email})</p>
            </div>
          </div>
        `;

        // ส่งอีเมลผ่าน Gmail API
        const emailResult = await sendEmailViaGmail(tokens.access_token, {
          to: itAdminEmails,
          subject: `⚠️ แจ้งปัญหาใหม่จากพนักงาน - ${issue.issueId}`,
          htmlBody,
          fromName: userProfile.name || `${issue.firstName} ${issue.lastName}`,
          fromEmail: userProfile.email
        });

        if (emailResult.success) {
          return NextResponse.redirect(
            new URL('/it-report?success=email_sent', request.url)
          );
        } else {
          return NextResponse.redirect(
            new URL('/it-report?error=email_send_failed', request.url)
          );
        }
      }
    }

    // ถ้าไม่มี issueId หรือไม่พบ issue
    return NextResponse.redirect(
      new URL('/it-report?success=auth_completed', request.url)
    );

  } catch (error) {
    console.error('Google callback error:', error);
    return NextResponse.redirect(
      new URL('/it-report?error=callback_failed', request.url)
    );
  }
}
