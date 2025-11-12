import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import DeletedUsers from '@/models/DeletedUser';
import { InventoryItem } from '@/models/InventoryItem';
import ReturnLog from '@/models/ReturnLog';
import IssueLog from '@/models/IssueLog';
import RequestLog from '@/models/RequestLog';
import { hashPassword } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import { createAutoReturnForUser, checkUserEquipment } from '@/lib/user-deletion-helpers';

// PUT - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin token
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin or it_admin or super_admin
    if (decoded.userRole !== 'admin' && decoded.userRole !== 'it_admin' && decoded.userRole !== 'super_admin' && !decoded.isMainAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

  await dbConnect();
  
  const body = await request.json();
  const { 
    firstName, lastName, nickname, department, office, phone, email, password, userType, userRole,
    // Fields สำหรับยกเลิก pending deletion
    pendingDeletion, pendingDeletionReason, pendingDeletionRequestedBy, pendingDeletionRequestedAt
  } = body;
  let { officeId } = body; // เปลี่ยนเป็น let เพื่อให้สามารถกำหนดค่าใหม่ได้
  const { id } = await params;

  // 🐛 Debug: Log officeId ที่ได้รับ
  console.log('🔍 PUT /api/admin/users/[id] - Received officeId:', officeId, 'office:', office);

  // 🆕 ดึง office name จาก Office collection ถ้ามี officeId
  let officeName = office; // default fallback
  if (officeId && officeId.trim() !== '' && officeId !== 'UNSPECIFIED_OFFICE') {
    const Office = (await import('@/models/Office')).default;
    const officeDoc = await Office.findOne({ office_id: officeId, deletedAt: null });
    if (officeDoc) {
      officeName = officeDoc.name;
      console.log('✅ Found office:', officeDoc.name, 'for officeId:', officeId);
    } else {
      // ถ้าไม่เจอ office ให้ใช้ default
      console.log('⚠️ Office not found, using default. officeId:', officeId);
      officeId = 'UNSPECIFIED_OFFICE';
      officeName = 'ไม่ระบุสาขา';
    }
  } else if (!officeId || officeId.trim() === '') {
    // ถ้าไม่มี officeId ให้ใช้ default
    console.log('⚠️ No officeId provided, using default');
    officeId = 'UNSPECIFIED_OFFICE';
    officeName = 'ไม่ระบุสาขา';
  } else if (officeId === 'UNSPECIFIED_OFFICE') {
    officeName = 'ไม่ระบุสาขา';
  }

    // ตรวจสอบว่าเป็นการยกเลิก pending deletion หรือไม่
    if (pendingDeletion !== undefined) {
      
      // หา user ก่อนเพื่อเอา user_id
      const userToUpdate = await User.findById(id);
      if (!userToUpdate) {
        return NextResponse.json(
          { error: 'ไม่พบผู้ใช้ที่ต้องการอัพเดต' },
          { status: 404 }
        );
      }

      // ถ้าเป็นการยกเลิกการลบ (pendingDeletion = false) ให้ลบ ReturnLog เก่า
      if (pendingDeletion === false) {
        
        const ReturnLog = (await import('@/models/ReturnLog')).default;
        const deleteResult = await ReturnLog.deleteMany({
          userId: userToUpdate.user_id,
          isAutoReturn: true,
          status: 'pending'
        });
        
      }
      
      // อัพเดตเฉพาะ pending deletion fields
    const updateData: any = {
      pendingDeletion,
      pendingDeletionReason,
      pendingDeletionRequestedBy,
      pendingDeletionRequestedAt,
      updatedAt: new Date()
    };

    // ถ้าเป็นการยกเลิกการลบ ให้ลบ jwtInvalidatedAt ด้วย
    if (pendingDeletion === false) {
      updateData.jwtInvalidatedAt = undefined;
    }

      const updatedUser = await User.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      ).select('-password');

      if (!updatedUser) {
        return NextResponse.json(
          { error: 'ไม่พบผู้ใช้ที่ต้องการอัพเดต' },
          { status: 404 }
        );
      }

      return NextResponse.json(updatedUser);
    }

    // Validate required fields based on user type (สำหรับการแก้ไขข้อมูลปกติ)
    if (userType === 'individual') {
      if (!firstName || !lastName || !nickname || !department || (!officeId && !office) || !phone || !email) {
        return NextResponse.json(
          { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
          { status: 400 }
        );
      }
    } else {
      if ((!officeId && !office) || !phone || !email) {
        return NextResponse.json(
          { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
          { status: 400 }
        );
      }
    }

    // Validate phone number (must be exactly 10 digits, but allow 000-000-0000 for Super Admin)
    if (phone && phone.length !== 10) {
      return NextResponse.json(
        { error: 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น' },
        { status: 400 }
      );
    }

    // Allow 000-000-0000 for Super Admin (vexclusive.it@gmail.com)
    const isSuperAdmin = email === 'vexclusive.it@gmail.com';
    if (phone && phone !== '000-000-0000' && !isSuperAdmin) {
      // Validate phone number format (must be numeric)
      if (!/^[0-9]{10}$/.test(phone)) {
        return NextResponse.json(
          { error: 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น' },
          { status: 400 }
        );
      }
    }

    // ✅ Cross-validation: Check if phone number exists in SIM Card inventory
    // ✅ EXCEPTION: Allow 000-000-0000 for admin users (skip duplicate check)
    if (phone && phone !== '000-000-0000') {
      const existingSIMCard = await InventoryItem.findOne({ 
        numberPhone: phone,
        categoryId: 'cat_sim_card',
        status: { $ne: 'deleted' } // Exclude soft-deleted items
      });
      if (existingSIMCard) {
        return NextResponse.json(
          { error: `เบอร์โทรศัพท์นี้ถูกใช้โดย SIM Card: ${existingSIMCard.itemName}` },
          { status: 400 }
        );
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'รูปแบบอีเมลล์ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // ✅ Check for duplicate data - collect all errors first (excluding current user)
    // ตรวจสอบทั้ง user ที่อนุมัติแล้วและรอการอนุมัติ
    const duplicateErrors = [];

    // Check email (ตรวจสอบทั้ง approved และ pending users)
    const existingUserByEmail = await User.findOne({ 
      email, 
      _id: { $ne: id } 
    });
    if (existingUserByEmail) {
      const statusText = existingUserByEmail.isApproved === false 
        ? ' (รวมถึงที่รอการอนุมัติ)' 
        : '';
      duplicateErrors.push(`อีเมลล์นี้มีอยู่ในระบบแล้ว${statusText}`);
    }

    // Check phone number (ตรวจสอบทั้ง approved และ pending users)
    // ✅ EXCEPTION: Allow 000-000-0000 for admin users (skip duplicate check)
    if (phone !== '000-000-0000') {
      const existingUserByPhone = await User.findOne({ 
        phone, 
        _id: { $ne: id } 
      });
      if (existingUserByPhone) {
        const statusText = existingUserByPhone.isApproved === false 
          ? ' (รวมถึงที่รอการอนุมัติ)' 
          : '';
        duplicateErrors.push(`เบอร์โทรศัพท์นี้มีผู้ใช้งานในระบบแล้ว${statusText}`);
      }
    }

    // Check full name for individual users (ตรวจสอบทั้ง approved และ pending users)
    if (userType === 'individual' && firstName && lastName) {
      const existingUserByName = await User.findOne({ 
        firstName,
        lastName,
        _id: { $ne: id }
      });
      if (existingUserByName) {
        const statusText = existingUserByName.isApproved === false 
          ? ' (รวมถึงที่รอการอนุมัติ)' 
          : '';
        duplicateErrors.push(`ชื่อ-นามสกุล "${firstName} ${lastName}" มีผู้ใช้งานในระบบแล้ว${statusText}`);
      }
    }

    // If any duplicates found, return combined error message
    if (duplicateErrors.length > 0) {
      const errorMessage = duplicateErrors.length === 1 
        ? duplicateErrors[0]
        : `ไม่สามารถอัพเดตผู้ใช้ได้ เนื่องจาก: ${duplicateErrors.join(', ')}`;
      
      return NextResponse.json(
        { 
          error: errorMessage,
          duplicateFields: duplicateErrors,
          detailedError: 'ไม่สามารถอัพเดตผู้ใช้ได้ เนื่องจาก:\n• ' + duplicateErrors.join('\n• ')
        },
        { status: 400 }
      );
    }

    // 🔒 Security: Only Super Admin can assign super_admin role
    if (userRole === 'super_admin' && decoded.userRole !== 'super_admin' && !decoded.isMainAdmin) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์ในการมอบหมาย Super Admin Role - ต้องเป็น Super Admin เท่านั้น' },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: any = {
      firstName: userType === 'individual' ? firstName : undefined,
      lastName: userType === 'individual' ? lastName : undefined,
      nickname: userType === 'individual' ? nickname : undefined,
      department: userType === 'individual' ? department : undefined,
      phone,
      email,
      userRole: userRole || 'user',
      updatedAt: new Date()
    };
    
    // 🆕 อัพเดต officeId และ officeName แบบชัดเจน
    // เก็บแค่ officeName ใน DB (office เป็น virtual field)
    if (officeId && officeId.trim() !== '') {
      updateData.officeId = officeId.trim();
      updateData.officeName = officeName; // ใช้ officeName เป็นหลัก (เก็บแค่อันเดียวใน DB)
      console.log('✅ Setting officeId:', officeId, 'officeName:', officeName);
    } else {
      // ถ้าไม่มี officeId ให้ใช้ default
      updateData.officeId = 'UNSPECIFIED_OFFICE';
      updateData.officeName = 'ไม่ระบุสาขา';
      console.log('⚠️ No officeId, using default');
    }
    
    console.log('📝 Update data:', JSON.stringify(updateData, null, 2));

    // Only update password if provided
    if (password && password.trim()) {
      updateData.password = await hashPassword(password);
    }

    // 🆕 ลบ undefined values ออกก่อน update (เพื่อไม่ให้เกิดปัญหา)
    const cleanedUpdateData: any = {};
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        cleanedUpdateData[key] = updateData[key];
      }
    });

    console.log('📝 Cleaned update data:', JSON.stringify(cleanedUpdateData, null, 2));

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: cleanedUpdateData }, // 🆕 ใช้ $set กับ cleaned data
      { new: true, runValidators: false }
    ).select('-password').lean();

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'ไม่พบผู้ใช้ที่ต้องการอัพเดต' },
        { status: 404 }
      );
    }

    // Clear users cache
    const { clearAllCaches } = await import('@/lib/cache-utils');
    clearAllCaches(); // Clear all caches since user list changed

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัพเดตผู้ใช้' },
      { status: 500 }
    );
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin token
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin or it_admin or super_admin
    if (decoded.userRole !== 'admin' && decoded.userRole !== 'it_admin' && decoded.userRole !== 'super_admin' && !decoded.isMainAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await dbConnect();
    
    const { id } = await params;

    // ค้นหา user ที่จะลบ
    type LeanUser = {
      officeName?: string;
      officeId?: string;
      isMainAdmin?: boolean;
      user_id?: string;
      userType?: string;
      firstName?: string;
      lastName?: string;
      nickname?: string;
      department?: string;
      phone?: string;
      email?: string;
      _id?: mongoose.Types.ObjectId | string;
    };

    const userToDeleteRaw = await User.findById(id).lean<LeanUser>();

    if (!userToDeleteRaw) {
      return NextResponse.json(
        { error: 'ไม่พบผู้ใช้ที่ต้องการลบ' },
        { status: 404 }
      );
    }

    if (!userToDeleteRaw._id) {
      return NextResponse.json(
        { error: 'ข้อมูลผู้ใช้ไม่สมบูรณ์ ไม่พบรหัสผู้ใช้' },
        { status: 500 }
      );
    }

    const userToDelete = userToDeleteRaw as LeanUser & { _id: mongoose.Types.ObjectId | string };
    if (!userToDelete) {
      return NextResponse.json(
        { error: 'ไม่พบผู้ใช้ที่ต้องการลบ' },
        { status: 404 }
      );
    }

    // 🆕 Populate officeName จาก officeId ถ้ายังไม่มี
    let displayOfficeName = userToDelete.officeName || 'ไม่ระบุสาขา';
    if (userToDelete.officeId && !userToDelete.officeName) {
      try {
        const { getOfficeMap } = await import('@/lib/office-helpers');
        const officeMap = await getOfficeMap([userToDelete.officeId]);
        displayOfficeName = officeMap.get(userToDelete.officeId) || 'ไม่ระบุสาขา';
      } catch (err) {
        console.error('Error fetching office name:', err);
      }
    }

    // ป้องกันการลบ Main Admin
    if (userToDelete.isMainAdmin) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบ Admin หลักได้' },
        { status: 403 }
      );
    }

    // สร้างรายการรหัสผู้ใช้ที่อาจถูกอ้างใน IssueLog (รองรับข้อมูลเก่า)
    const identifierSet = new Set<string>();
    if (typeof userToDelete.user_id === 'string' && userToDelete.user_id.trim() !== '') {
      identifierSet.add(userToDelete.user_id.trim());
    }

    const mongoIdString =
      userToDelete._id instanceof mongoose.Types.ObjectId
        ? userToDelete._id.toHexString()
        : typeof userToDelete._id === 'string'
          ? userToDelete._id
          : undefined;

    if (mongoIdString && mongoIdString.trim() !== '') {
      identifierSet.add(mongoIdString.trim());
    }

    const userIdentifiers = Array.from(identifierSet);

    // ตรวจสอบงานแจ้ง IT ที่ยังไม่ปิด ซึ่งผู้ใช้รายนี้เกี่ยวข้อง
    const openIssueFilter = { status: { $ne: 'closed' } };

    type IssueSummary = { issueId: string; status: string; issueCategory?: string };

    const [requesterIssuesRaw, assignedIssuesRaw] = await Promise.all([
      IssueLog.find({
        requesterId: { $in: userIdentifiers },
        ...openIssueFilter
      })
        .select('issueId status issueCategory')
        .lean(),
      IssueLog.find({
        assignedAdminId: { $in: userIdentifiers },
        ...openIssueFilter
      })
        .select('issueId status issueCategory')
        .lean()
    ]);

    const normalizeIssues = (issues: unknown): IssueSummary[] => {
      if (!Array.isArray(issues)) {
        return [];
      }

      return issues
        .filter(
          (issue): issue is { issueId: unknown; status: unknown; issueCategory?: unknown } =>
            typeof issue === 'object' &&
            issue !== null &&
            'issueId' in issue &&
            'status' in issue
        )
        .map(issue => ({
          issueId: String((issue as { issueId: unknown }).issueId),
          status: String((issue as { status: unknown }).status),
          issueCategory:
            (issue as { issueCategory?: unknown }).issueCategory !== undefined
              ? String((issue as { issueCategory?: unknown }).issueCategory)
              : undefined
        }));
    };

    const requesterIssues = normalizeIssues(requesterIssuesRaw);
    const assignedIssues = normalizeIssues(assignedIssuesRaw);

    const totalOpenIssues = requesterIssues.length + assignedIssues.length;

    type IssueListSummary = {
      issueId: string;
      status: string;
      issueCategory?: string;
    };

    const formatIssues = (issues: IssueSummary[]): IssueListSummary[] =>
        issues.slice(0, 10).map(issue => ({
          issueId: issue.issueId,
          status: issue.status,
          issueCategory: issue.issueCategory
        }));

    let openIssuesInfo: {
      hasOpenIssues: boolean;
      openIssues: {
        total: number;
        asRequester: number;
        asAssignee: number;
        requesterIssues: IssueListSummary[];
        assigneeIssues: IssueListSummary[];
      };
      message: string;
    } | null = null;

    if (totalOpenIssues > 0) {
      const messageParts: string[] = [];
      if (requesterIssues.length > 0) {
        messageParts.push(`• ผู้ใช้นี้เป็นผู้แจ้งงานจำนวน ${requesterIssues.length} รายการ`);
      }
      if (assignedIssues.length > 0) {
        messageParts.push(`• ผู้ใช้นี้เป็นผู้รับผิดชอบงานจำนวน ${assignedIssues.length} รายการ`);
      }

      const detailedMessage = [
        'ไม่สามารถลบผู้ใช้ได้ เนื่องจากยังมีงานแจ้ง IT ที่สถานะยังไม่ถูกปิด',
        ...messageParts,
        'กรุณาปิดงานทั้งหมดให้เรียบร้อยก่อนดำเนินการลบอีกครั้ง'
      ].join('\n');

      openIssuesInfo = {
          hasOpenIssues: true,
          openIssues: {
            total: totalOpenIssues,
            asRequester: requesterIssues.length,
            asAssignee: assignedIssues.length,
            requesterIssues: formatIssues(requesterIssues),
            assigneeIssues: formatIssues(assignedIssues)
        },
        message: detailedMessage
      };
    }

    // ตรวจสอบคำขอเบิกอุปกรณ์ที่ยังรออนุมัติ
    const pendingRequests = await RequestLog.find({
      userId: { $in: userIdentifiers },
      status: 'pending',
      requestType: 'request'
    })
      .select(
        'requestDate items deliveryLocation requesterOfficeName requesterOfficeId requesterFirstName requesterLastName requesterNickname requesterDepartment requesterPhone requesterEmail'
      )
      .lean();

    type PendingRequestSummary = {
      requestId: string;
      requestDate?: string;
      itemCount: number;
      equipmentName?: string;
      categoryName?: string;
      deliveryLocation?: string;
      requesterDisplayName?: string;
      requesterFirstName?: string;
      requesterLastName?: string;
      requesterDepartment?: string;
      office?: string;
      officeId?: string;
      requesterPhone?: string;
      requesterEmail?: string;
    };

    let pendingRequestsInfo: {
      hasPendingEquipmentRequests: boolean;
      pendingEquipmentRequests: {
        total: number;
        summaries: PendingRequestSummary[];
      };
      message: string;
    } | null = null;

    if (pendingRequests.length > 0) {
      const formatRequestSummaries = pendingRequests.slice(0, 5).map((request: any) => {
        const requestDate =
          request.requestDate instanceof Date
            ? request.requestDate.toISOString()
            : request.requestDate
              ? String(request.requestDate)
              : undefined;

        const itemsArray = Array.isArray(request.items) ? request.items : [];
        const firstItem = itemsArray.length > 0 ? (itemsArray[0] as any) : undefined;
        const equipmentName =
          firstItem?.itemName || firstItem?.category || firstItem?.masterId || undefined;
        const categoryName = firstItem?.category || undefined;

        return {
          requestId: String(request._id),
          requestDate,
          itemCount: itemsArray.length,
          equipmentName,
          categoryName,
          deliveryLocation: request.deliveryLocation || undefined,
          requesterDisplayName:
            request.requesterNickname ||
            [request.requesterFirstName, request.requesterLastName].filter(Boolean).join(' ') ||
            undefined,
          office: request.requesterOfficeName || displayOfficeName,
          officeId: request.requesterOfficeId,
          requesterFirstName: request.requesterFirstName || userToDelete.firstName || undefined,
          requesterLastName: request.requesterLastName || userToDelete.lastName || undefined,
          requesterDepartment: request.requesterDepartment || userToDelete.department || undefined,
          requesterPhone: request.requesterPhone || userToDelete.phone || undefined,
          requesterEmail: request.requesterEmail || userToDelete.email || undefined
        };
      });

      const detailedMessage = [
        'ไม่สามารถลบผู้ใช้ได้ เนื่องจากยังมีคำขอเบิกอุปกรณ์ที่รอการอนุมัติ',
        `จำนวนคำขอที่รออนุมัติ: ${pendingRequests.length} รายการ`,
        'กรุณาอนุมัติหรือยกเลิกคำขอทั้งหมดก่อนจึงจะลบผู้ใช้ได้'
      ].join('\n');

      pendingRequestsInfo = {
        hasPendingEquipmentRequests: true,
        pendingEquipmentRequests: {
          total: pendingRequests.length,
          summaries: formatRequestSummaries
        },
        message: detailedMessage
      };
    }
    // ตรวจสอบอุปกรณ์ที่ user เป็นเจ้าของ
    const userOwnedItems = await InventoryItem.find({
      'currentOwnership.ownerType': 'user_owned',
      'currentOwnership.userId': { $in: userIdentifiers }
    });

    let equipmentInfo: {
      hasEquipment: boolean;
      equipmentCount: number;
      equipmentList: string[];
      equipmentListWithContact?: Array<{
        equipment: string;
        contact: {
          name?: string;
          firstName?: string;
          lastName?: string;
          nickname?: string;
          department?: string;
          office?: string;
          officeId?: string;
          phone?: string;
          email?: string;
        };
      }>;
      userContact: {
        name?: string;
        firstName?: string;
        lastName?: string;
        nickname?: string;
        department?: string;
        office?: string;
        officeId?: string;
        phone?: string;
        email?: string;
      };
      message: string;
    } | null = null;

    if (userOwnedItems.length > 0) {
      // สร้างรายการอุปกรณ์พร้อมข้อมูลติดต่อแยกตามแต่ละรายการ
      const equipmentListWithContact = userOwnedItems.map(item => {
        const displayName = item.itemName;
        const sn = item.serialNumber ? ` (S/N: ${item.serialNumber})` : '';
        const phoneNumber = item.numberPhone ? ` (เบอร์: ${item.numberPhone})` : '';
        const equipmentDisplay = `${displayName}${sn}${phoneNumber}`;
        
        // ดึงข้อมูลติดต่อจาก requesterInfo ของแต่ละรายการ
        const itemRequesterInfo = item.requesterInfo || {};
        const itemContact = {
          firstName: itemRequesterInfo.firstName || userToDelete.firstName?.trim() || undefined,
          lastName: itemRequesterInfo.lastName || userToDelete.lastName?.trim() || undefined,
          nickname: itemRequesterInfo.nickname || userToDelete.nickname?.trim() || undefined,
          department: itemRequesterInfo.department || userToDelete.department?.trim() || undefined,
          office: itemRequesterInfo.officeName || itemRequesterInfo.office || displayOfficeName,
          officeId: itemRequesterInfo.officeId || userToDelete.officeId || undefined,
          phone: itemRequesterInfo.phone || userToDelete.phone?.trim() || undefined,
          email: userToDelete.email?.trim() || undefined,
          name: itemRequesterInfo.firstName || itemRequesterInfo.lastName
            ? [itemRequesterInfo.firstName, itemRequesterInfo.lastName].filter(Boolean).join(' ').trim()
            : displayOfficeName
        };
        
        return {
          equipment: equipmentDisplay,
          contact: itemContact
        };
      });
      
      const equipmentList = equipmentListWithContact.map(item => item.equipment);

      const isBranchUser = userToDelete.userType === 'branch';

      const baseContact = {
        firstName: userToDelete.firstName?.trim() || undefined,
        lastName: userToDelete.lastName?.trim() || undefined,
        nickname: userToDelete.nickname?.trim() || undefined,
        department: userToDelete.department?.trim() || undefined,
        office: displayOfficeName,
        officeId: userToDelete.officeId || undefined,
        phone: userToDelete.phone?.trim() || undefined,
        email: userToDelete.email?.trim() || undefined
      };

      const candidateContacts: any[] = userOwnedItems
        .map(item => item.requesterInfo || {})
        .filter(info => info && typeof info === 'object');

      // รวมข้อมูลจาก pending requests ที่ดึงมาก่อนหน้า
      if (pendingRequests.length > 0) {
        (pendingRequests as Array<Record<string, any>>).forEach(request => {
          candidateContacts.push({
            firstName: request.requesterFirstName,
            lastName: request.requesterLastName,
            nickname: request.requesterNickname,
            department: request.requesterDepartment,
            officeName: request.requesterOfficeName,
            office: request.requesterOffice,
            officeId: request.requesterOfficeId,
            phone: request.requesterPhone,
            email: request.requesterEmail
          });
        });
      }

      // ดึงข้อมูลคำขอล่าสุด (approved หรือ completed) เผื่อผู้ใช้เคยเบิกแล้ว
      const latestRequestContact = await RequestLog.findOne({
        userId: { $in: userIdentifiers }
      })
        .sort({ requestDate: -1, createdAt: -1 })
        .select(
          'requesterFirstName requesterLastName requesterNickname requesterDepartment requesterOfficeName requesterOffice requesterOfficeId requesterPhone requesterEmail'
        )
        .lean();

      if (latestRequestContact) {
        const latestRequestContactAny = latestRequestContact as Record<string, any>;
        candidateContacts.push({
          firstName: latestRequestContactAny.requesterFirstName,
          lastName: latestRequestContactAny.requesterLastName,
          nickname: latestRequestContactAny.requesterNickname,
          department: latestRequestContactAny.requesterDepartment,
          officeName: latestRequestContactAny.requesterOfficeName,
          office: latestRequestContactAny.requesterOffice,
          officeId: latestRequestContactAny.requesterOfficeId,
          phone: latestRequestContactAny.requesterPhone,
          email: latestRequestContactAny.requesterEmail
        });
      }

      // ดึงข้อมูลการคืนล่าสุด (ถ้ามี) เพื่อใช้เป็น fallback
      const latestReturnContact = await ReturnLog.findOne({
        userId: { $in: userIdentifiers }
      })
        .sort({ returnDate: -1, createdAt: -1 })
        .select(
          'returnerFirstName returnerLastName returnerNickname returnerDepartment returnerOfficeName returnerOffice returnerOfficeId returnerPhone returnerEmail'
        )
        .lean();

      if (latestReturnContact) {
        const latestReturnContactAny = latestReturnContact as Record<string, any>;
        candidateContacts.push({
          firstName: latestReturnContactAny.returnerFirstName,
          lastName: latestReturnContactAny.returnerLastName,
          nickname: latestReturnContactAny.returnerNickname,
          department: latestReturnContactAny.returnerDepartment,
          officeName: latestReturnContactAny.returnerOfficeName,
          office: latestReturnContactAny.returnerOffice,
          officeId: latestReturnContactAny.returnerOfficeId,
          phone: latestReturnContactAny.returnerPhone,
          email: latestReturnContactAny.returnerEmail
        });
      }

      const getFromCandidates = (field: keyof typeof baseContact) => {
        for (const info of candidateContacts) {
          const value =
            field === 'office'
              ? (info.officeName || info.office)
              : (info as any)[field];
          if (typeof value === 'string' && value.trim() !== '') {
            return value.trim();
          }
        }
        return undefined;
      };

      const resolveField = <T extends keyof typeof baseContact>(
        field: T
      ): (typeof baseContact)[T] | undefined => {
        const baseValue =
          baseContact[field] && String(baseContact[field]).trim() !== ''
            ? baseContact[field]
            : undefined;

        if (isBranchUser) {
          const candidateValue = getFromCandidates(field);
          if (candidateValue !== undefined) {
            return candidateValue as (typeof baseContact)[T];
          }
          return baseValue;
        } else {
          if (baseValue !== undefined) {
            return baseValue;
          }
          const candidateValue = getFromCandidates(field);
          if (candidateValue !== undefined) {
            return candidateValue as (typeof baseContact)[T];
          }
          return baseValue;
        }
      };

      const contactFirstName = resolveField('firstName');
      const contactLastName = resolveField('lastName');
      const userContact = {
        firstName: contactFirstName,
        lastName: contactLastName,
        nickname: resolveField('nickname'),
        department: resolveField('department'),
        office: resolveField('office') || displayOfficeName,
        officeId: resolveField('officeId') || userToDelete.officeId || undefined,
        phone: resolveField('phone'),
        email: resolveField('email'),
        name:
          contactFirstName || contactLastName
            ? [contactFirstName, contactLastName].filter(Boolean).join(' ').trim()
            : displayOfficeName
      };

      const message = [
        `ผู้ใช้นี้ยังถือครองอุปกรณ์จำนวน ${userOwnedItems.length} รายการ`,
        'กรุณาให้ผู้ใช้คืนอุปกรณ์ผ่านหน้า "คืนอุปกรณ์" และรอการอนุมัติให้เรียบร้อยก่อนลบผู้ใช้งาน'
      ].join('\n');

      equipmentInfo = {
        hasEquipment: true,
        equipmentCount: userOwnedItems.length,
        equipmentList,
        equipmentListWithContact, // ส่งข้อมูลติดต่อแยกตามแต่ละรายการ
        userContact, // เก็บไว้เพื่อ backward compatibility
        message
      };
    }

    if (openIssuesInfo || pendingRequestsInfo || equipmentInfo) {
      const blockerMessages: string[] = [];
      if (openIssuesInfo?.message) {
        blockerMessages.push(openIssuesInfo.message);
      }
      if (pendingRequestsInfo?.message) {
        blockerMessages.push(pendingRequestsInfo.message);
      }
      if (equipmentInfo?.message) {
        blockerMessages.push(equipmentInfo.message);
      }

      return NextResponse.json(
        {
          error: 'ไม่สามารถลบผู้ใช้ได้',
          message: blockerMessages.join('\n\n'),
          ...(openIssuesInfo
            ? {
                hasOpenIssues: openIssuesInfo.hasOpenIssues,
                openIssues: openIssuesInfo.openIssues
              }
            : {}),
          ...(pendingRequestsInfo
            ? {
                hasPendingEquipmentRequests: pendingRequestsInfo.hasPendingEquipmentRequests,
                pendingEquipmentRequests: pendingRequestsInfo.pendingEquipmentRequests
              }
            : {}),
          ...(equipmentInfo
            ? {
                hasEquipment: equipmentInfo.hasEquipment,
                equipmentCount: equipmentInfo.equipmentCount,
                equipmentList: equipmentInfo.equipmentList,
                equipmentListWithContact: equipmentInfo.equipmentListWithContact,
                userContact: equipmentInfo.userContact,
                requiresUserAction: true
              }
            : {})
        },
        { status: 400 }
      );
    } else {
      // ไม่มีอุปกรณ์ - ลบ user ได้ทันที (snapshot ก่อน)
      
      // 1. Snapshot User record ใน DeletedUsers
      try {
        const snapData = {
          userMongoId: userToDelete._id.toString(),
          user_id: userToDelete.user_id,
          userType: userToDelete.userType, // 🆕 เพิ่ม userType
          // สำหรับผู้ใช้ประเภทสาขา ไม่ snapshot ข้อมูลส่วนตัว เพราะใช้ข้อมูลจากฟอร์ม
          ...(userToDelete.userType === 'branch' ? {
            // เฉพาะข้อมูลสาขา
            office: displayOfficeName, // 🆕 ใช้ displayOfficeName ที่ populate แล้ว
            officeId: userToDelete.officeId, // 🆕 Snapshot officeId
            officeName: displayOfficeName, // 🆕 ใช้ displayOfficeName ที่ populate แล้ว
            email: userToDelete.email,
            // ❌ ไม่ snapshot phone เพราะมาจากฟอร์มที่กรอกแต่ละครั้ง
          } : {
            // ผู้ใช้บุคคล snapshot ข้อมูลทั้งหมด
            firstName: userToDelete.firstName,
            lastName: userToDelete.lastName,
            nickname: userToDelete.nickname,
            department: userToDelete.department,
            office: displayOfficeName, // 🆕 ใช้ displayOfficeName ที่ populate แล้ว
            officeId: userToDelete.officeId, // 🆕 Snapshot officeId
            officeName: displayOfficeName, // 🆕 ใช้ displayOfficeName ที่ populate แล้ว
            phone: userToDelete.phone,
            email: userToDelete.email,
          }),
          deletedAt: new Date()
        } as any;
        await DeletedUsers.findOneAndUpdate(
          { userMongoId: snapData.userMongoId },
          snapData,
          { upsert: true, new: true }
        );
        console.log(`📸 Snapshot user data to DeletedUsers: ${userToDelete.userType} - ${snapData.user_id}`);
      } catch (e) {
        console.error('Failed to snapshot user before delete:', e);
      }
      
      // 🆕 2. Snapshot ข้อมูลใน IssueLog และ Equipment Logs
      try {
        const { snapshotUserBeforeDelete } = await import('@/lib/snapshot-helpers');
        if (!userToDelete.user_id) {
          throw new Error('ไม่พบรหัสผู้ใช้ (user_id) สำหรับการทำ snapshot');
        }

        const snapshotResult = await snapshotUserBeforeDelete(userToDelete.user_id);
        console.log('📸 Snapshot user data in logs:', snapshotResult);
      } catch (e) {
        console.error('Failed to snapshot user data in logs:', e);
      }
      
      // ตั้งค่า jwtInvalidatedAt เพื่อให้ JWT token หมดอายุทันที
      await User.findByIdAndUpdate(id, {
        jwtInvalidatedAt: new Date(),
        deletedAt: new Date(),
        isDeleted: true
      });

      // ลบผู้ใช้จากฐานข้อมูล
      const deletedUser = await User.findByIdAndDelete(id);

      // Clear users cache
      const { clearAllCaches } = await import('@/lib/cache-utils');
      clearAllCaches(); // Clear all caches since user list changed

      return NextResponse.json({ 
        message: 'ลบผู้ใช้เรียบร้อยแล้ว',
        equipmentCount: 0,
        hasEquipment: false,
        pendingDeletion: false
      });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบผู้ใช้' },
      { status: 500 }
    );
  }
}
