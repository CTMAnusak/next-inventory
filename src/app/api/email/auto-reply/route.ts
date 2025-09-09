import { NextRequest, NextResponse } from 'next/server';
import { sendAutoReplyForNewIssue } from '@/lib/email';

/**
 * API สำหรับจัดการ Auto-Reply เมื่อมี IT Admin พยายาม Reply อีเมลแจ้งงานใหม่
 * ใช้สำหรับ Email Webhook หรือ IMAP Monitoring
 */
export async function POST(request: NextRequest) {
  try {
    const { senderEmail, originalSubject } = await request.json();
    
    // ตรวจสอบว่าเป็นการ Reply อีเมลแจ้งงานใหม่หรือไม่
    if (!originalSubject || !originalSubject.includes('[งานใหม่]')) {
      return NextResponse.json(
        { error: 'ไม่ใช่การ Reply อีเมลแจ้งงานใหม่' },
        { status: 400 }
      );
    }

    // ส่งอีเมล Auto-Reply
    const result = await sendAutoReplyForNewIssue(senderEmail);
    
    if (result.success) {
      console.log(`Auto-reply sent to ${senderEmail} successfully`);
      return NextResponse.json({
        message: 'ส่งอีเมล Auto-Reply เรียบร้อยแล้ว',
        recipient: senderEmail
      });
    } else {
      console.error('Failed to send auto-reply:', result.error);
      return NextResponse.json(
        { error: 'ไม่สามารถส่งอีเมล Auto-Reply ได้' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Auto-reply API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * API สำหรับทดสอบการส่ง Auto-Reply
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testEmail = searchParams.get('email');
  
  if (!testEmail) {
    return NextResponse.json(
      { error: 'กรุณาระบุ email parameter' },
      { status: 400 }
    );
  }

  try {
    const result = await sendAutoReplyForNewIssue(testEmail);
    
    if (result.success) {
      return NextResponse.json({
        message: 'ทดสอบส่งอีเมล Auto-Reply เรียบร้อยแล้ว',
        recipient: testEmail
      });
    } else {
      return NextResponse.json(
        { error: 'ไม่สามารถส่งอีเมลทดสอบได้', details: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการทดสอบ', details: error },
      { status: 500 }
    );
  }
}
