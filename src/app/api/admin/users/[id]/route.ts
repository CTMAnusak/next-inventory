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

    // Check if email already exists (excluding current user)
    const existingUser = await User.findOne({ 
      email, 
      _id: { $ne: id } 
    });
    if (existingUser) {
      return NextResponse.json(
        { error: 'อีเมลล์นี้มีอยู่ในระบบแล้ว' },
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


    // หากมีอุปกรณ์ที่ user เป็นเจ้าของ - ไม่ลบ user แต่ทำเครื่องหมายรอลบ
    if (userOwnedItems.length > 0) {
      
      // จัดกลุ่มอุปกรณ์ตามชนิด
      const itemGroups = new Map();
      for (const item of userOwnedItems) {
        const key = `${item.itemName}-${item.category}`;
        if (!itemGroups.has(key)) {
          itemGroups.set(key, []);
        }
        itemGroups.get(key).push(item);
      }

      // สร้าง ReturnLog อัตโนมัติ
      const returnLogData = {
        userId: userToDelete.user_id, // เพิ่ม userId สำหรับการอ้างอิง
        firstName: userToDelete.firstName || 'ผู้ใช้ที่ถูกลบ',
        lastName: userToDelete.lastName || '',
        nickname: userToDelete.nickname || '',
        department: userToDelete.department || 'ไม่ระบุ',
        office: userToDelete.office || 'ไม่ระบุ',
        email: userToDelete.email || '',
        phoneNumber: userToDelete.phoneNumber || '',
        returnDate: new Date(),
        items: Array.from(itemGroups.entries()).flatMap(([key, items]) => {
          const firstItem = items[0];
          
          // ถ้ามี SN หลายตัว ให้แยกเป็นรายการย่อย
          const itemsWithSN = items.filter(item => item.serialNumber);
          const itemsWithoutSN = items.filter(item => !item.serialNumber);
          
          const result = [];
          
          // เพิ่มรายการที่มี SN แต่ละตัว
          for (const item of itemsWithSN) {
            result.push({
              itemId: item._id.toString(),
              itemName: item.itemName,
              category: item.category,
              quantity: 1,
              serialNumber: item.serialNumber, // ใช้ singular
              reason: 'อุปกรณ์คืนอัตโนมัติเนื่องจากบัญชีผู้ใช้ถูกลบ'
            });
          }
          
          // เพิ่มรายการที่ไม่มี SN (ถ้ามี)
          if (itemsWithoutSN.length > 0) {
            result.push({
              itemId: firstItem._id.toString(),
              itemName: firstItem.itemName,
              category: firstItem.category,
              quantity: itemsWithoutSN.length,
              reason: 'อุปกรณ์คืนอัตโนมัติเนื่องจากบัญชีผู้ใช้ถูกลบ'
            });
          }
          
          return result;
        }),
        status: 'pending', // รอการอนุมัติ
        isAutoReturn: true, // flag พิเศษสำหรับการคืนอัตโนมัติ
        autoReturnReason: `บัญชีผู้ใช้ ${userToDelete.firstName} ${userToDelete.lastName} (${userToDelete.user_id}) ถูกร้องขอลบโดย admin`,
        submittedAt: new Date(),
        notes: `การคืนอุปกรณ์อัตโนมัติ: บัญชีผู้ใช้ถูกร้องขอลบโดย admin ${decoded.firstName || decoded.user_id} เมื่อ ${new Date().toLocaleString('th-TH')}`
      };

      const returnLog = new ReturnLog(returnLogData);
      await returnLog.save();

      // ทำเครื่องหมาย user ว่ารอลบ แทนการลบทันที
      userToDelete.pendingDeletion = true;
      userToDelete.pendingDeletionReason = `มีอุปกรณ์ ${userOwnedItems.length} รายการที่ต้องคืนก่อน`;
      userToDelete.pendingDeletionRequestedBy = decoded.userId;
      userToDelete.pendingDeletionRequestedAt = new Date();
      await userToDelete.save();

      // ส่งสัญญาณให้ user รอลบ logout ทันที (ไม่ต้องรอ 10 วินาที)
      try {
        await fetch(new URL('/api/admin/force-logout-user', request.url).toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || ''
          },
          body: JSON.stringify({ userId: userToDelete.user_id })
        });
      } catch (logoutError) {
        console.error('Error sending immediate logout signal:', logoutError);
      }

      // บังคับให้ user login ใหม่โดยการ invalidate JWT token
      // โดยการเพิ่ม field ที่ทำให้ JWT token เก่าใช้ไม่ได้
      userToDelete.jwtInvalidatedAt = new Date();
      await userToDelete.save();


      return NextResponse.json({ 
        message: `ผู้ใช้ถูกทำเครื่องหมายรอลบ และสร้างรายการคืนอุปกรณ์อัตโนมัติ ${userOwnedItems.length} รายการ กรุณาตรวจสอบที่ "ประวัติคืน" เพื่ออนุมัติการคืนอุปกรณ์`,
        equipmentCount: userOwnedItems.length,
        hasEquipment: true,
        pendingDeletion: true
      });
    } else {
      // ไม่มีอุปกรณ์ - ลบ user ได้ทันที (snapshot ก่อน)
      try {
        const snapData = {
          userMongoId: userToDelete._id.toString(),
          user_id: userToDelete.user_id,
          firstName: userToDelete.firstName,
          lastName: userToDelete.lastName,
          nickname: userToDelete.nickname,
          department: userToDelete.department,
          office: userToDelete.office,
          phone: userToDelete.phone,
          email: userToDelete.email,
          deletedAt: new Date()
        } as any;
        await DeletedUsers.findOneAndUpdate(
          { userMongoId: snapData.userMongoId },
          snapData,
          { upsert: true, new: true }
        );
      } catch (e) {
        console.error('Failed to snapshot user before delete:', e);
      }
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
