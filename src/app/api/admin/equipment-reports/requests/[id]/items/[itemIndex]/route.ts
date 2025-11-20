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

    // อ่าน cancellationReason จาก body (ถ้ามี)
    let cancellationReason = 'ลบรายการออกจากคำขอ';
    try {
      const contentType = request.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const body = await request.json().catch(() => ({}));
        if (body?.cancellationReason && typeof body.cancellationReason === 'string' && body.cancellationReason.trim() !== '') {
          cancellationReason = body.cancellationReason.trim();
        }
      }
    } catch (e) {
      // ถ้าไม่มี body หรือ parse ไม่ได้ ให้ใช้ค่าเริ่มต้น
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

    // Get admin name - ใช้ getUserName() เพื่อรองรับทั้ง ObjectId และ custom user_id
    const { getUserName } = await import('@/lib/equipment-snapshot-helpers');
    const adminName = await getUserName(payload.userId) || 'Admin';

    // เก็บข้อมูลรายการที่จะถูกลบไว้ก่อน (สำหรับส่งอีเมล)
    // ✅ แปลง deletedItem เป็น plain object เพื่อให้แน่ใจว่าข้อมูลครบถ้วน
    const deletedItemRaw = reqLog.items[idx];
    const deletedItem = deletedItemRaw.toObject ? deletedItemRaw.toObject() : JSON.parse(JSON.stringify(deletedItemRaw));
    const requestDataBeforeDelete = reqLog.toObject();

    // ถ้าจะลบคำขอทั้งหมด - อัปเดตข้อมูลคำขอ
    if (willDeleteRequest) {
      reqLog.cancelledAt = new Date();
      reqLog.cancelledBy = payload.userId;
      reqLog.cancelledByName = adminName;
      reqLog.cancellationReason = cancellationReason;
      reqLog.status = 'rejected';
      await reqLog.save();
    }

    // ลบรายการตาม index
    reqLog.items.splice(idx, 1);

    // ✅ ส่งอีเมลทุกครั้งที่ลบรายการ (ไม่ว่าจะเหลือรายการอื่นหรือไม่)
    try {
      // ✅ Populate ข้อมูลรายการที่ถูกลบให้ครบถ้วน
      const { getItemNameAndCategory, getCategoryNameById } = await import('@/lib/item-name-resolver');
      
      // Populate itemName และ category จาก InventoryMaster ถ้าไม่มี
      if (!deletedItem.itemName || !deletedItem.category) {
        if (deletedItem.masterId) {
          const itemInfo = await getItemNameAndCategory(deletedItem.masterId);
          if (itemInfo) {
            if (!deletedItem.itemName) deletedItem.itemName = itemInfo.itemName;
            if (!deletedItem.category) deletedItem.category = itemInfo.category;
            if (!deletedItem.categoryId) deletedItem.categoryId = itemInfo.categoryId;
          }
        }
      }

      // ✅ Populate category name จาก categoryId ถ้าไม่มี category name
      if (deletedItem.categoryId && !deletedItem.category) {
        const categoryName = await getCategoryNameById(deletedItem.categoryId);
        if (categoryName) {
          deletedItem.category = categoryName;
        }
      }

      // ✅ ตรวจสอบให้แน่ใจว่ามี quantity (ถ้าไม่มีให้ใช้ 1)
      if (deletedItem.quantity === undefined || deletedItem.quantity === null) {
        deletedItem.quantity = 1;
      }

      // ✅ ตรวจสอบให้แน่ใจว่ามี itemNotes (ถ้าไม่มีให้ใช้ '-')
      if (deletedItem.itemNotes === undefined || deletedItem.itemNotes === null) {
        deletedItem.itemNotes = '-';
      }

      // ✅ Debug: ตรวจสอบข้อมูลที่เตรียมส่งอีเมล
      console.log('📧 Preparing email for deleted item:', {
        itemName: deletedItem.itemName,
        category: deletedItem.category,
        categoryId: deletedItem.categoryId,
        quantity: deletedItem.quantity,
        itemNotes: deletedItem.itemNotes,
        serialNumbers: deletedItem.serialNumbers,
        requestedPhoneNumbers: deletedItem.requestedPhoneNumbers,
        assignedSerialNumbers: deletedItem.assignedSerialNumbers,
        assignedPhoneNumbers: deletedItem.assignedPhoneNumbers,
        image: deletedItem.image,
        masterId: deletedItem.masterId
      });

      // เตรียมข้อมูลอีเมล - แสดงเฉพาะรายการที่ถูกลบ
      const emailData: any = {
        ...requestDataBeforeDelete,
        items: [deletedItem], // แสดงเฉพาะรายการที่ถูกลบพร้อมข้อมูลที่ populate แล้ว
        cancellationReason: cancellationReason,
        cancelledByName: adminName,
        cancelledAt: new Date()
      };
      
      const { sendEquipmentRequestCancellationNotification } = await import('@/lib/email');
      await sendEquipmentRequestCancellationNotification(emailData);
    } catch (emailError) {
      console.error('Email notification error:', emailError);
      // ไม่ให้ email error ทำให้การลบล้มเหลว
    }

    // ถ้าลบรายการสุดท้ายจนคำขอถูกลบทั้งหมด - ลบคำขอออกจากฐานข้อมูล
    if (reqLog.items.length === 0) {
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


