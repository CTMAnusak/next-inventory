import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import DeletedUsers from '@/models/DeletedUser';
import { InventoryItem } from '@/models/InventoryItem';
import ReturnLog from '@/models/ReturnLog';
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

    // Check if user is admin or it_admin
    if (decoded.userRole !== 'admin' && decoded.userRole !== 'it_admin' && !decoded.isMainAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await dbConnect();
    
    const body = await request.json();
    const { 
      firstName, lastName, nickname, department, office, phone, email, password, userType, userRole,
      // Fields สำหรับยกเลิก pending deletion
      pendingDeletion, pendingDeletionReason, pendingDeletionRequestedBy, pendingDeletionRequestedAt
    } = body;
    const { id } = params;

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
      const updateData = {
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
      if (!firstName || !lastName || !nickname || !department || !office || !phone || !email) {
        return NextResponse.json(
          { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
          { status: 400 }
        );
      }
    } else {
      if (!office || !phone || !email) {
        return NextResponse.json(
          { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
          { status: 400 }
        );
      }
    }

    // Validate phone number (must be exactly 10 digits)
    if (phone && phone.length !== 10) {
      return NextResponse.json(
        { error: 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น' },
        { status: 400 }
      );
    }

    // ✅ Cross-validation: Check if phone number exists in SIM Card inventory
    if (phone) {
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
    const duplicateErrors = [];

    // Check email
    const existingUserByEmail = await User.findOne({ 
      email, 
      _id: { $ne: id } 
    });
    if (existingUserByEmail) {
      duplicateErrors.push('อีเมลล์นี้มีอยู่ในระบบแล้ว');
    }

    // Check phone number
    const existingUserByPhone = await User.findOne({ 
      phone, 
      _id: { $ne: id } 
    });
    if (existingUserByPhone) {
      duplicateErrors.push('เบอร์โทรศัพท์นี้มีผู้ใช้งานในระบบแล้ว');
    }

    // Check full name for individual users
    if (userType === 'individual' && firstName && lastName) {
      const existingUserByName = await User.findOne({ 
        firstName,
        lastName,
        _id: { $ne: id }
      });
      if (existingUserByName) {
        duplicateErrors.push(`ชื่อ-นามสกุล "${firstName} ${lastName}" มีผู้ใช้งานในระบบแล้ว`);
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

    // Prepare update data
    const updateData: any = {
      firstName: userType === 'individual' ? firstName : undefined,
      lastName: userType === 'individual' ? lastName : undefined,
      nickname: userType === 'individual' ? nickname : undefined,
      department: userType === 'individual' ? department : undefined,
      office,
      phone,
      email,
      userRole: userRole || 'user',
      updatedAt: new Date()
    };

    // Only update password if provided
    if (password && password.trim()) {
      updateData.password = await hashPassword(password);
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

    // Check if user is admin or it_admin
    if (decoded.userRole !== 'admin' && decoded.userRole !== 'it_admin' && !decoded.isMainAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await dbConnect();
    
    const { id } = await params;

    // ค้นหา user ที่จะลบ
    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      return NextResponse.json(
        { error: 'ไม่พบผู้ใช้ที่ต้องการลบ' },
        { status: 404 }
      );
    }

    // ป้องกันการลบ Main Admin
    if (userToDelete.isMainAdmin) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบ Admin หลักได้' },
        { status: 403 }
      );
    }

    // ตรวจสอบอุปกรณ์ที่ user เป็นเจ้าของ
    const userOwnedItems = await InventoryItem.find({
      'currentOwnership.ownerType': 'user_owned',
      'currentOwnership.userId': userToDelete.user_id
    });


    // หากมีอุปกรณ์ที่ user เป็นเจ้าของ - ไม่สามารถลบได้
    if (userOwnedItems.length > 0) {
      
      // สร้างรายการอุปกรณ์ที่ต้องคืน
      const equipmentList = userOwnedItems.map(item => {
        const displayName = item.itemName;
        const sn = item.serialNumber ? ` (S/N: ${item.serialNumber})` : '';
        const phone = item.numberPhone ? ` (เบอร์: ${item.numberPhone})` : '';
        return `${displayName}${sn}${phone}`;
      });
      
      // เตรียมข้อมูลผู้ติดต่อ
      const userContact = {
        name: userToDelete.userType === 'individual' 
          ? `${userToDelete.firstName || ''} ${userToDelete.lastName || ''}`.trim()
          : userToDelete.office,
        phone: userToDelete.phone || 'ไม่ระบุ',
        email: userToDelete.email || 'ไม่ระบุ',
        office: userToDelete.office || 'ไม่ระบุ'
      };

      return NextResponse.json({ 
        error: 'ไม่สามารถลบผู้ใช้ได้',
        message: `ผู้ใช้มีอุปกรณ์ ${userOwnedItems.length} รายการที่ต้องคืนก่อน กรุณาแจ้งให้ผู้ใช้คืนอุปกรณ์ผ่านหน้า "คืนอุปกรณ์" หรือติดต่อผู้ใช้โดยตรง`,
        equipmentCount: userOwnedItems.length,
        equipmentList: equipmentList,
        userContact: userContact,
        hasEquipment: true,
        requiresUserAction: true // 🆕 Flag บอกว่าต้องให้ User ดำเนินการเอง
      }, { status: 400 });
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
            office: userToDelete.office,
            phone: userToDelete.phone,
            email: userToDelete.email,
          } : {
            // ผู้ใช้บุคคล snapshot ข้อมูลทั้งหมด
            firstName: userToDelete.firstName,
            lastName: userToDelete.lastName,
            nickname: userToDelete.nickname,
            department: userToDelete.department,
            office: userToDelete.office,
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
