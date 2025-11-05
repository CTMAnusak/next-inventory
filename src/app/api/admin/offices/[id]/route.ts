import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Office from '@/models/Office';
import { checkOfficeUsage, snapshotOfficeBeforeDelete, updateOfficeNameInAllReferences } from '@/lib/office-snapshot-helpers';
import { clearOfficeCache, clearOfficeCacheById } from '@/lib/office-helpers';

/**
 * GET - ดึงรายละเอียด Office
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const office = await Office.findOne({
      office_id: id,
      deletedAt: null
    }).lean();
    
    if (!office) {
      return NextResponse.json(
        { error: 'ไม่พบสาขาที่ต้องการ' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(office);
  } catch (error: any) {
    console.error('Error fetching office:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสาขา' },
      { status: 500 }
    );
  }
}

/**
 * PUT - แก้ไข Office
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const body = await request.json();
    const { name, description, isActive } = body;
    
    // หา Office ที่ต้องการแก้ไข
    const office = await Office.findOne({
      office_id: id,
      deletedAt: null
    });
    
    if (!office) {
      return NextResponse.json(
        { error: 'ไม่พบสาขาที่ต้องการ' },
        { status: 404 }
      );
    }
    
    // ถ้าแก้ไขชื่อ ต้องตรวจสอบว่าซ้ำหรือไม่ (case-insensitive)
    if (name && name.trim() !== office.name) {
      const existingOffice = await Office.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }, // case-insensitive match
        office_id: { $ne: id },
        deletedAt: null
      });
      
      if (existingOffice) {
        return NextResponse.json(
          { error: `มีชื่อสาขานี้อยู่แล้ว: "${existingOffice.name}" (${existingOffice.office_id})` },
          { status: 400 }
        );
      }
      
      // อัพเดตชื่อในทุกที่ที่อ้างอิง
      const updateResult = await updateOfficeNameInAllReferences(id, name.trim());
      if (!updateResult.success) {
        console.error('Failed to update office name in references:', updateResult.error);
      }
    }
    
    // อัพเดตข้อมูล
    if (name !== undefined) office.name = name.trim();
    if (description !== undefined) office.description = description?.trim() || '';
    if (isActive !== undefined) office.isActive = isActive;
    
    await office.save();
    
    // Clear cache
    clearOfficeCacheById(id);
    
    return NextResponse.json({
      success: true,
      message: 'แก้ไขสาขาสำเร็จ',
      office: office
    });
  } catch (error: any) {
    console.error('Error updating office:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไขสาขา' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - ลบ Office (Soft Delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    
    // หา Office ที่ต้องการลบ
    const office = await Office.findOne({
      office_id: id,
      deletedAt: null
    });
    
    if (!office) {
      return NextResponse.json(
        { error: 'ไม่พบสาขาที่ต้องการ' },
        { status: 404 }
      );
    }
    
    // 🛡️ ป้องกันการลบ System Office
    if (office.isSystemOffice) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบ System Office ได้' },
        { status: 400 }
      );
    }
    
    // ตรวจสอบว่ามีการใช้งานหรือไม่
    const usage = await checkOfficeUsage(id);
    
    if (usage.isUsed) {
      return NextResponse.json(
        { 
          error: 'ไม่สามารถลบสาขาได้ เนื่องจากมีการใช้งานอยู่',
          usage: usage.usage
        },
        { status: 400 }
      );
    }
    
    // Snapshot ก่อนลบ (ป้องกันกรณีที่อาจมีการใช้งานในอนาคต)
    const snapshotResult = await snapshotOfficeBeforeDelete(id);
    if (!snapshotResult.success) {
      console.warn('Failed to snapshot office before delete:', snapshotResult.error);
    }
    
    // 🆕 อัพเดตผู้ใช้ที่ใช้ Office นี้ให้ใช้ Default Office แทน
    const DEFAULT_OFFICE_ID = 'UNSPECIFIED_OFFICE';
    const { default: User } = await import('@/models/User');
    const { default: RequestLog } = await import('@/models/RequestLog');
    const { default: ReturnLog } = await import('@/models/ReturnLog');
    const { default: IssueLog } = await import('@/models/IssueLog');
    const { default: InventoryItem } = await import('@/models/InventoryItem');
    const { default: DeletedUser } = await import('@/models/DeletedUser');
    
    await Promise.all([
      User.updateMany({ officeId: id }, { $set: { officeId: DEFAULT_OFFICE_ID, office: 'ไม่ระบุสาขา', officeName: 'ไม่ระบุสาขา' } }),
      RequestLog.updateMany({ requesterOfficeId: id }, { $set: { requesterOfficeId: DEFAULT_OFFICE_ID, requesterOffice: 'ไม่ระบุสาขา', requesterOfficeName: 'ไม่ระบุสาขา' } }),
      ReturnLog.updateMany({ returnerOfficeId: id }, { $set: { returnerOfficeId: DEFAULT_OFFICE_ID, returnerOffice: 'ไม่ระบุสาขา', returnerOfficeName: 'ไม่ระบุสาขา' } }),
      IssueLog.updateMany({ officeId: id }, { $set: { officeId: DEFAULT_OFFICE_ID, office: 'ไม่ระบุสาขา', officeName: 'ไม่ระบุสาขา' } }),
      InventoryItem.updateMany({ 'requesterInfo.officeId': id }, { $set: { 'requesterInfo.officeId': DEFAULT_OFFICE_ID, 'requesterInfo.office': 'ไม่ระบุสาขา', 'requesterInfo.officeName': 'ไม่ระบุสาขา' } }),
      DeletedUser.updateMany({ officeId: id }, { $set: { officeId: DEFAULT_OFFICE_ID, office: 'ไม่ระบุสาขา', officeName: 'ไม่ระบุสาขา' } })
    ]);
    
    // Soft delete
    office.isActive = false;
    office.deletedAt = new Date();
    await office.save();
    
    // Clear cache
    clearOfficeCacheById(id);
    
    return NextResponse.json({
      success: true,
      message: 'ลบสาขาสำเร็จ'
    });
  } catch (error: any) {
    console.error('Error deleting office:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบสาขา' },
      { status: 500 }
    );
  }
}

