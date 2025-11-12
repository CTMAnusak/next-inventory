import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { hashPassword } from '@/lib/auth';
import jwt from 'jsonwebtoken';

// GET - Fetch all users
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
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

    // Check cache first
    const { getCachedData, setCachedData } = await import('@/lib/cache-utils');
    const cacheKey = 'admin_users_all';
    const cached = getCachedData(cacheKey);
    if (cached) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Users API - Cache hit (${Date.now() - startTime}ms)`);
      }
      return NextResponse.json(cached);
    }

    await dbConnect();
    
    // Use lean() for better performance and select only needed fields
    const users = await User.find({})
      .select('-password')
      .select('user_id firstName lastName nickname department office officeId officeName phone email userType userRole registrationMethod googleId profilePicture isApproved approvedBy approvedAt profileCompleted pendingDeletion pendingDeletionReason pendingDeletionRequestedBy pendingDeletionRequestedAt createdAt updatedAt isMainAdmin')
      .sort({ createdAt: -1 })
      .lean();
    
    // Batch populate office names if needed
    const officeIds = new Set<string>();
    users.forEach((user: any) => {
      if (user.officeId && !user.officeName) {
        officeIds.add(user.officeId);
      }
    });

    // Batch fetch office names
    if (officeIds.size > 0) {
      const { getOfficeMap } = await import('@/lib/office-helpers');
      const officeMap = await getOfficeMap(Array.from(officeIds));
      
      // Populate office names
      users.forEach((user: any) => {
        if (user.officeId) {
          // ⚠️ ถ้า officeId = UNSPECIFIED_OFFICE ให้แสดง "ไม่ระบุสาขา" เสมอ (ไม่ใช้ snapshot)
          if (user.officeId === 'UNSPECIFIED_OFFICE') {
            user.officeName = 'ไม่ระบุสาขา';
            user.office = 'ไม่ระบุสาขา';
          } else {
            user.officeName = user.officeName || officeMap.get(user.officeId) || user.office || 'ไม่ระบุสาขา';
            // Backward compatibility
            if (!user.office) {
              user.office = user.officeName;
            }
          }
        } else if (user.office && !user.officeName) {
          user.officeName = user.office;
        }
      });
    }
    
    // ⚠️ สำหรับ users ที่ไม่ได้อยู่ใน officeIds (มี officeName อยู่แล้ว) แต่ officeId = UNSPECIFIED_OFFICE
    users.forEach((user: any) => {
      if (user.officeId === 'UNSPECIFIED_OFFICE') {
        user.officeName = 'ไม่ระบุสาขา';
        user.office = 'ไม่ระบุสาขา';
      }
    });

    // Cache the result
    setCachedData(cacheKey, users);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Users API - Fetched ${users.length} users (${Date.now() - startTime}ms)`);
    }
    
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
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
    const { firstName, lastName, nickname, department, office, officeId, phone, email, password, userType, userRole } = body;

    // 🆕 ดึง office name จาก Office collection ถ้ามี officeId
    let officeName = office; // default fallback
    if (officeId) {
      const Office = (await import('@/models/Office')).default;
      const officeDoc = await Office.findOne({ office_id: officeId, isActive: true, deletedAt: null });
      if (officeDoc) {
        officeName = officeDoc.name;
      }
    }

    // Validate required fields based on user type
    if (userType === 'individual') {
      if (!firstName || !lastName || !nickname || !department || (!officeId && !office) || !phone || !email || !password) {
        return NextResponse.json(
          { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
          { status: 400 }
        );
      }
    } else {
      if ((!officeId && !office) || !phone || !email || !password) {
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
    // ✅ EXCEPTION: Allow 000-000-0000 for admin users (skip duplicate check)
    if (phone && phone !== '000-000-0000') {
      const { InventoryItem } = await import('@/models/InventoryItem');
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

    // ✅ Check for duplicate data - collect all errors first
    // ตรวจสอบทั้ง user ที่อนุมัติแล้วและรอการอนุมัติ
    const duplicateErrors = [];

    // Check email (ตรวจสอบทั้ง approved และ pending users)
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      const statusText = existingUserByEmail.isApproved === false 
        ? ' (รวมถึงที่รอการอนุมัติ)' 
        : '';
      duplicateErrors.push(`อีเมลล์นี้มีอยู่ในระบบแล้ว${statusText}`);
    }

    // Check phone number (ตรวจสอบทั้ง approved และ pending users)
    // ✅ EXCEPTION: Allow 000-000-0000 for admin users (skip duplicate check)
    if (phone !== '000-000-0000') {
      const existingUserByPhone = await User.findOne({ phone });
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
        lastName 
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
        : `ไม่สามารถสร้างผู้ใช้ได้ เนื่องจาก: ${duplicateErrors.join(', ')}`;
      
      return NextResponse.json(
        { 
          error: errorMessage,
          duplicateFields: duplicateErrors,
          detailedError: 'ไม่สามารถสร้างผู้ใช้ได้ เนื่องจาก:\n• ' + duplicateErrors.join('\n• ')
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

    // ใช้ MongoDB Native เพราะ Mongoose มีปัญหา select user_id
    const { MongoClient } = require('mongodb');
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory-management';
    const client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db();
    const collection = db.collection('users');

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate unique user_id
    let user_id;
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      user_id = 'USER' + Date.now() + Math.floor(Math.random() * 1000);
      const existingUser = await User.findOne({ user_id });
      if (!existingUser) {
        isUnique = true;
      }
      attempts++;
      // Small delay to ensure different timestamps
      if (!isUnique) await new Promise(resolve => setTimeout(resolve, 1));
    }

    if (!isUnique) {
      await client.close();
      return NextResponse.json(
        { error: 'ไม่สามารถสร้าง user_id ที่ไม่ซ้ำได้' },
        { status: 500 }
      );
    }

    // สร้าง user ด้วย MongoDB Native
    const newUserData = {
      user_id, // เพิ่ม user_id ที่สร้างขึ้น
      firstName: userType === 'individual' ? firstName : undefined,
      lastName: userType === 'individual' ? lastName : undefined,
      nickname: userType === 'individual' ? nickname : undefined,
      department: userType === 'individual' ? department : undefined,
      officeId: officeId && officeId.trim() !== '' ? officeId.trim() : 'UNSPECIFIED_OFFICE', // 🆕 เก็บ officeId (หรือ default)
      officeName: officeName, // 🆕 ใช้ officeName เป็นหลัก (เก็บแค่อันเดียวใน DB)
      // office เป็น virtual field - ไม่ต้องเก็บใน DB
      phone,
      email,
      password: hashedPassword,
      userType,
      userRole: userRole || 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const insertResult = await collection.insertOne(newUserData);
    const newUser = await collection.findOne({ _id: insertResult.insertedId });
    
    await client.close();
    
    console.log('Created user with user_id:', newUser.user_id);

    // Clear users cache
    const { clearAllCaches } = await import('@/lib/cache-utils');
    clearAllCaches(); // Clear all caches since user list changed

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser;
    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' },
      { status: 500 }
    );
  }
}
