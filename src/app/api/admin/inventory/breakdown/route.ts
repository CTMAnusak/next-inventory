import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import { verifyTokenFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Verify admin authentication
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get('itemName');
    const categoryId = searchParams.get('categoryId');
    
    if (!itemName || !categoryId) {
      return NextResponse.json(
        { error: 'กรุณาระบุ itemName และ categoryId' },
        { status: 400 }
      );
    }
    
    
    // Debug: ตรวจสอบข้อมูลที่ส่งมา
    
    // ดึงข้อมูล items ทั้งหมดเพื่อใช้คำนวณ (รวมสถานะ 'หาย' ด้วย)
    const allItems = await InventoryItem.find({
      itemName,
      categoryId,
      deletedAt: { $exists: false } // ไม่รวมที่ถูกลบ
    }).lean();
    
    // คำนวณ status breakdown สำหรับทั้งหมด
    const statusBreakdown = await InventoryItem.aggregate([
      { 
        $match: { 
          itemName, 
          categoryId, 
          deletedAt: { $exists: false } // 🆕 FIXED: ใช้ deletedAt เพื่อกรองรายการที่ถูกลบ
        } 
      },
      { 
        $group: { 
          _id: '$statusId', 
          count: { $sum: 1 } 
        } 
      }
    ]);
    
    // คำนวณ condition breakdown สำหรับทั้งหมด
    const conditionBreakdown = await InventoryItem.aggregate([
      { 
        $match: { 
          itemName, 
          categoryId, 
          deletedAt: { $exists: false } // 🆕 FIXED: ใช้ deletedAt เพื่อกรองรายการที่ถูกลบ
        } 
      },
      { 
        $group: { 
          _id: '$conditionId', 
          count: { $sum: 1 } 
        } 
      }
    ]);

    // 🆕 Owner-specific breakdowns (admin stock vs user owned)
    const adminStatusAgg = await InventoryItem.aggregate([
      {
        $match: {
          itemName,
          categoryId,
          deletedAt: { $exists: false },
          'currentOwnership.ownerType': 'admin_stock'
        }
      },
      {
        $group: {
          _id: '$statusId',
          count: { $sum: 1 }
        }
      }
    ]);

    const userStatusAgg = await InventoryItem.aggregate([
      {
        $match: {
          itemName,
          categoryId,
          deletedAt: { $exists: false },
          'currentOwnership.ownerType': 'user_owned'
        }
      },
      {
        $group: {
          _id: '$statusId',
          count: { $sum: 1 }
        }
      }
    ]);

    const adminConditionAgg = await InventoryItem.aggregate([
      {
        $match: {
          itemName,
          categoryId,
          deletedAt: { $exists: false },
          'currentOwnership.ownerType': 'admin_stock'
        }
      },
      {
        $group: {
          _id: '$conditionId',
          count: { $sum: 1 }
        }
      }
    ]);

    const userConditionAgg = await InventoryItem.aggregate([
      {
        $match: {
          itemName,
          categoryId,
          deletedAt: { $exists: false },
          'currentOwnership.ownerType': 'user_owned'
        }
      },
      {
        $group: {
          _id: '$conditionId',
          count: { $sum: 1 }
        }
      }
    ]);

    // คำนวณ status breakdown เฉพาะอุปกรณ์ที่ไม่มี SN และอยู่กับแอดมิน (คงเหลือในคลัง)
    const nonSNStatusBreakdown = await InventoryItem.aggregate([
      { 
        $match: { 
          itemName, 
          categoryId, 
          deletedAt: { $exists: false }, // 🆕 FIXED: ใช้ deletedAt เพื่อกรองรายการที่ถูกลบ
          'currentOwnership.ownerType': 'admin_stock',
          $and: [
            { $or: [{ serialNumber: { $exists: false } }, { serialNumber: '' }] },
            { $or: [{ numberPhone: { $exists: false } }, { numberPhone: '' }] }
          ]
        } 
      },
      { 
        $group: { 
          _id: '$statusId', 
          count: { $sum: 1 } 
        } 
      }
    ]);
    
    // คำนวณ condition breakdown เฉพาะอุปกรณ์ที่ไม่มี SN และอยู่กับแอดมิน (คงเหลือในคลัง)
    const nonSNConditionBreakdown = await InventoryItem.aggregate([
      { 
        $match: { 
          itemName, 
          categoryId, 
          deletedAt: { $exists: false }, // 🆕 FIXED: ใช้ deletedAt เพื่อกรองรายการที่ถูกลบ
          'currentOwnership.ownerType': 'admin_stock',
          $and: [
            { $or: [{ serialNumber: { $exists: false } }, { serialNumber: '' }] },
            { $or: [{ numberPhone: { $exists: false } }, { numberPhone: '' }] }
          ]
        } 
      },
      { 
        $group: { 
          _id: '$conditionId', 
          count: { $sum: 1 } 
        } 
      }
    ]);
    
    // คำนวณ type breakdown สำหรับทั้งหมด (admin + user)
    const withSNAll = allItems.filter(item => item.serialNumber && item.serialNumber.trim() !== '');
    const withPhoneAll = allItems.filter(item => item.numberPhone && item.numberPhone.trim() !== '');
    const withoutSNAll = allItems.filter(item =>
      (!item.serialNumber || item.serialNumber.trim() === '') &&
      (!item.numberPhone || item.numberPhone.trim() === '')
    );

    const typeAllResult = {
      withoutSN: withoutSNAll.length,
      withSN: withSNAll.length,
      withPhone: withPhoneAll.length
    };

    // 🆕 Per-owner type breakdowns
    const adminItems = allItems.filter(item => item.currentOwnership?.ownerType === 'admin_stock');
    const userItems = allItems.filter(item => item.currentOwnership?.ownerType === 'user_owned');

    const adminTypeBreakdown = {
      withoutSN: adminItems.filter(item => (!item.serialNumber || item.serialNumber.trim() === '') && (!item.numberPhone || item.numberPhone.trim() === '')).length,
      withSN: adminItems.filter(item => item.serialNumber && item.serialNumber.trim() !== '').length,
      withPhone: adminItems.filter(item => item.numberPhone && item.numberPhone.trim() !== '').length
    };

    const userTypeBreakdown = {
      withoutSN: userItems.filter(item => (!item.serialNumber || item.serialNumber.trim() === '') && (!item.numberPhone || item.numberPhone.trim() === '')).length,
      withSN: userItems.filter(item => item.serialNumber && item.serialNumber.trim() !== '').length,
      withPhone: userItems.filter(item => item.numberPhone && item.numberPhone.trim() !== '').length
    };

    // คำนวณจำนวนสำหรับเฉพาะที่อยู่กับแอดมิน (ใช้ในข้อจำกัดการเปลี่ยนสถานะ/สภาพ)
    const adminItemsOnly = allItems.filter(item => item.currentOwnership?.ownerType === 'admin_stock');
    const nonSNAdminOnly = adminItemsOnly.filter(item =>
      (!item.serialNumber || item.serialNumber.trim() === '') &&
      (!item.numberPhone || item.numberPhone.trim() === '')
    );
    
    // แปลงผลลัพธ์เป็น object - ใช้ชื่อเดียวกับในจัดการ Stock
    const statusResult = statusBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);
    
    const conditionResult = conditionBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const adminStatusResult = adminStatusAgg.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const userStatusResult = userStatusAgg.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const adminConditionResult = adminConditionAgg.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const userConditionResult = userConditionAgg.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    // แปลงผลลัพธ์สำหรับอุปกรณ์ที่ไม่มี SN
    const nonSNStatusResult = nonSNStatusBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);
    
    const nonSNConditionResult = nonSNConditionBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);
    
    // คำนวณจำนวนอุปกรณ์ที่ไม่มี SN ที่มีสถานะ "มี" และสภาพ "ใช้งานได้" พร้อมกัน
    // และต้องเป็นอุปกรณ์ที่อยู่กับแอดมิน (คงเหลือในคลัง) เท่านั้น
    const availableWorkingCount = await InventoryItem.countDocuments({
      itemName, 
      categoryId, 
      deletedAt: { $exists: false }, // ไม่รวมที่ถูกลบ
      statusId: 'status_available',
      conditionId: 'cond_working',
      'currentOwnership.ownerType': 'admin_stock',
      $and: [
        { $or: [{ serialNumber: { $exists: false } }, { serialNumber: '' }] },
        { $or: [{ numberPhone: { $exists: false } }, { numberPhone: '' }] }
      ]
    });
    
    
    // Debug: แสดงข้อมูลที่พบ
    if (availableWorkingCount === 0) {
      const debugItems = await InventoryItem.find({
        itemName, 
        categoryId, 
        deletedAt: { $exists: false }
      }).lean();
      console.log(`  Total items found: ${debugItems.length}`);
      console.log(`  Items with statusId 'status_available': ${debugItems.filter(i => i.statusId === 'status_available').length}`);
      console.log(`  Items with conditionId 'cond_working': ${debugItems.filter(i => i.conditionId === 'cond_working').length}`);
      console.log(`  Non-SN items: ${debugItems.filter(i => (!i.serialNumber || i.serialNumber.trim() === '') && (!i.numberPhone || i.numberPhone.trim() === '')).length}`);
    }
    
    return NextResponse.json({
      statusBreakdown: statusResult,
      conditionBreakdown: conditionResult,
      typeBreakdown: typeAllResult,
      // 🆕 Owner-specific breakdowns
      adminStatusBreakdown: adminStatusResult,
      userStatusBreakdown: userStatusResult,
      adminConditionBreakdown: adminConditionResult,
      userConditionBreakdown: userConditionResult,
      adminTypeBreakdown,
      userTypeBreakdown,
      // เพิ่มข้อมูลใหม่สำหรับอุปกรณ์ที่ไม่มี SN เท่านั้น
      nonSNStatusBreakdown: nonSNStatusResult,
      nonSNConditionBreakdown: nonSNConditionResult,
      // จำนวนอุปกรณ์ที่ไม่มี SN ที่สามารถปรับได้ (สถานะ "มี" + สภาพ "ใช้งานได้")
      adjustableCount: availableWorkingCount,
      // รวมจำนวนอุปกรณ์ที่ไม่มี SN ที่อยู่กับแอดมิน (คงเหลือในคลัง)
      nonSNAdminTotal: nonSNAdminOnly.length,
      // 🆕 FIXED: เพิ่มจำนวนรวมทั้งหมดจากข้อมูลจริงใน database
      totalQuantity: allItems.length
    });
    
  } catch (error) {
    console.error('Error fetching breakdown:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
