import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import { verifyTokenFromRequest } from '@/lib/auth';

// DELETE - ลบรายการอุปกรณ์ทีละรายการจากคำขอ
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemIndex: string }> }
) {
  try {
    await dbConnect();

    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const { id, itemIndex } = await params;
    const idx = Number(itemIndex);
    if (!Number.isInteger(idx) || idx < 0) {
      return NextResponse.json({ error: 'itemIndex ไม่ถูกต้อง' }, { status: 400 });
    }

    const reqLog = await RequestLog.findById(id);
    if (!reqLog) {
      return NextResponse.json({ error: 'ไม่พบคำขอ' }, { status: 404 });
    }

    if (reqLog.status === 'completed') {
      return NextResponse.json({ error: 'คำขอที่อนุมัติแล้วไม่สามารถลบได้' }, { status: 400 });
    }

    if (idx >= reqLog.items.length) {
      return NextResponse.json({ error: 'itemIndex เกินจำนวนรายการ' }, { status: 400 });
    }

    // ตรวจสอบว่าถ้าลบรายการนี้แล้วจะเหลือรายการหรือไม่
    const willDeleteRequest = reqLog.items.length === 1;

    // ถ้าจะลบคำขอทั้งหมด - เก็บข้อมูลและเตรียมส่งอีเมลก่อน
    let emailData: any = null;
    if (willDeleteRequest) {
      // Get admin name - ใช้ getUserName() เพื่อรองรับทั้ง ObjectId และ custom user_id
      const { getUserName } = await import('@/lib/equipment-snapshot-helpers');
      const adminName = await getUserName(payload.userId) || 'Admin';

      // เก็บข้อมูลคำขอไว้ก่อนลบ (สำหรับส่งอีเมล)
      const requestDataBeforeDelete = reqLog.toObject();
      
      // Update request log with cancellation info before deleting
      reqLog.cancelledAt = new Date();
      reqLog.cancelledBy = payload.userId;
      reqLog.cancelledByName = adminName;
      reqLog.cancellationReason = 'ลบรายการสุดท้ายออกจากคำขอ';
      reqLog.status = 'rejected';
      await reqLog.save();

      // เตรียมข้อมูลสำหรับส่งอีเมล
      emailData = {
        ...requestDataBeforeDelete,
        cancellationReason: 'ลบรายการสุดท้ายออกจากคำขอ',
        cancelledByName: adminName,
        cancelledAt: new Date()
      };
    }

    // ลบรายการตาม index
    reqLog.items.splice(idx, 1);

    // ถ้าลบรายการสุดท้ายจนคำขอถูกลบทั้งหมด - ส่งอีเมลแจ้งเตือน
    if (reqLog.items.length === 0) {
      // ส่งอีเมลแจ้งเตือนก่อนลบ
      if (emailData) {
        try {
          // ✅ Populate category names for items before sending email
          const { getCategoryNameById } = await import('@/lib/item-name-resolver');
          if (emailData.items && Array.isArray(emailData.items)) {
            const itemsWithCategory = await Promise.all(
              emailData.items.map(async (item: any) => {
                let category = item.category;
                if (!category && item.categoryId) {
                  const categoryName = await getCategoryNameById(item.categoryId);
                  if (categoryName) {
                    category = categoryName;
                  }
                }
                return {
                  ...item,
                  category: category || 'ไม่ระบุ'
                };
              })
            );
            emailData.items = itemsWithCategory;
          }
          
          const { sendEquipmentRequestCancellationNotification } = await import('@/lib/email');
          await sendEquipmentRequestCancellationNotification(emailData);
        } catch (emailError) {
          console.error('Email notification error:', emailError);
          // ไม่ให้ email error ทำให้การลบล้มเหลว
        }
      }

      // ลบคำขอออกจากฐานข้อมูล
      await RequestLog.findByIdAndDelete(id);
      return NextResponse.json({ message: 'ลบรายการและคำขอเรียบร้อยแล้ว', deletedRequest: true, remainingItems: 0 });
    }

    await reqLog.save();
    return NextResponse.json({ message: 'ลบรายการเรียบร้อยแล้ว', deletedRequest: false, remainingItems: reqLog.items.length });
  } catch (error) {
    console.error('Error deleting request item:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบรายการ' }, { status: 500 });
  }
}


