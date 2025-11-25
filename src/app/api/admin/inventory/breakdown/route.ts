import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import { verifyTokenFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('📥 Breakdown API called');
    await dbConnect();
    console.log('✅ Database connected');
    
    // Verify admin authentication
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      console.log('❌ Authentication failed');
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    console.log('✅ Authentication successful');
    
    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get('itemName');
    const categoryId = searchParams.get('categoryId');
    
    if (!itemName || !categoryId) {
      console.log('❌ Missing parameters:', { itemName, categoryId });
      return NextResponse.json(
        { error: 'กรุณาระบุ itemName และ categoryId' },
        { status: 400 }
      );
    }
    
    console.log(`📊 Processing breakdown for: ${itemName} (${categoryId})`);
    
    // 🆕 Debug: ตรวจสอบว่ามีข้อมูลใน database หรือไม่
    const itemCount = await InventoryItem.countDocuments({
      itemName,
      categoryId,
      deletedAt: { $exists: false }
    });
    console.log(`📦 Found ${itemCount} items matching itemName="${itemName}" and categoryId="${categoryId}"`);
    
    if (itemCount === 0) {
      // ลองหาโดยใช้แค่ itemName
      const itemNameOnlyCount = await InventoryItem.countDocuments({
        itemName,
        deletedAt: { $exists: false }
      });
      console.log(`⚠️ No items found with categoryId="${categoryId}", but found ${itemNameOnlyCount} items with itemName="${itemName}"`);
      
      if (itemNameOnlyCount > 0) {
        // ลองดู categoryId ที่มีจริงๆ
        const actualCategories = await InventoryItem.distinct('categoryId', {
          itemName,
          deletedAt: { $exists: false }
        });
        console.log(`📋 Actual categoryIds for "${itemName}":`, actualCategories);
      }
    }
    
    // ดึงข้อมูล items ทั้งหมดเพื่อใช้คำนวณ (รวมสถานะ 'หาย' ด้วย)
    const allItems = await InventoryItem.find({
      itemName,
      categoryId,
      deletedAt: { $exists: false } // ไม่รวมที่ถูกลบ
    }).lean();
    
    console.log(`✅ Loaded ${allItems.length} items from database`);
    
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
    const itemsWithoutOwnerType: any[] = [];
    const adminItems = allItems.filter(item => {
      const ownerType = item.currentOwnership?.ownerType;
      if (!ownerType) {
        itemsWithoutOwnerType.push(item._id);
        // ถ้าไม่มี ownerType แต่มี currentOwnership object ให้ถือว่าเป็น admin_stock (default)
        if (item.currentOwnership) {
          console.warn(`⚠️ Item ${item._id} has currentOwnership but no ownerType, treating as admin_stock`);
          return true;
        }
        // ถ้าไม่มี currentOwnership เลย ให้ถือว่าเป็น admin_stock (default)
        console.warn(`⚠️ Item ${item._id} has no currentOwnership, treating as admin_stock`);
        return true;
      }
      return ownerType === 'admin_stock';
    });
    const userItems = allItems.filter(item => {
      const ownerType = item.currentOwnership?.ownerType;
      return ownerType === 'user_owned';
    });
    
    if (itemsWithoutOwnerType.length > 0) {
      console.warn(`⚠️ Found ${itemsWithoutOwnerType.length} items without ownerType:`, itemsWithoutOwnerType.slice(0, 5));
    }
    
    const unknownCount = allItems.length - adminItems.length - userItems.length;
    console.log(`👥 Ownership breakdown: ${adminItems.length} admin_stock, ${userItems.length} user_owned, ${unknownCount} unknown`);
    
    if (unknownCount > 0) {
      console.warn(`⚠️ ${unknownCount} items could not be categorized by ownership`);
    }

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
    
    // 🆕 Grouped breakdown by (statusId, conditionId, type) for Admin Stock
    const adminGroupedBreakdown: Array<{
      statusId: string;
      conditionId: string;
      type: 'withoutSN' | 'withSN' | 'withPhone';
      count: number;
    }> = [];
    
    const adminGroupedMap = new Map<string, number>();
    
    // Debug: ตรวจสอบข้อมูล adminItems
    if (adminItems.length > 0) {
      console.log(`📊 Admin Items for ${itemName}: ${adminItems.length} items`);
      adminItems.forEach((item, idx) => {
        if (idx < 3) { // Log first 3 items for debugging
          console.log(`  Item ${idx + 1}: statusId=${item.statusId}, conditionId=${item.conditionId}, serialNumber=${item.serialNumber}, numberPhone=${item.numberPhone}`);
        }
      });
    } else {
      console.log(`⚠️ No admin items found for ${itemName} (total items: ${allItems.length})`);
    }
    
    adminItems.forEach((item, idx) => {
      // กำหนด type - ตรวจสอบ numberPhone ก่อน (เพราะ priority สูงกว่า)
      let type: 'withoutSN' | 'withSN' | 'withPhone' = 'withoutSN';
      if (item.numberPhone && item.numberPhone.trim() !== '') {
        type = 'withPhone';
      } else if (item.serialNumber && item.serialNumber.trim() !== '') {
        type = 'withSN';
      }
      
      // ใช้ค่า default ถ้า statusId หรือ conditionId เป็น null/undefined
      const statusId = item.statusId || 'status_unknown';
      const conditionId = item.conditionId || 'cond_unknown';
      
      // Debug: log items ที่ไม่มี statusId หรือ conditionId
      if (idx < 3) { // Log first 3 items for debugging
        console.log(`  Admin Item ${idx + 1}: statusId=${statusId}, conditionId=${conditionId}, type=${type}, serialNumber="${item.serialNumber}", numberPhone="${item.numberPhone}"`);
      }
      
      // สร้าง key จาก statusId + conditionId + type
      const key = `${statusId}|${conditionId}|${type}`;
      adminGroupedMap.set(key, (adminGroupedMap.get(key) || 0) + 1);
    });
    
    // แปลง Map เป็น Array
    adminGroupedMap.forEach((count, key) => {
      const [statusId, conditionId, typeStr] = key.split('|');
      adminGroupedBreakdown.push({
        statusId,
        conditionId,
        type: typeStr as 'withoutSN' | 'withSN' | 'withPhone',
        count
      });
    });
    
    // เรียงลำดับ: statusId -> conditionId -> type
    adminGroupedBreakdown.sort((a, b) => {
      if (a.statusId !== b.statusId) return a.statusId.localeCompare(b.statusId);
      if (a.conditionId !== b.conditionId) return a.conditionId.localeCompare(b.conditionId);
      const typeOrder = { withoutSN: 0, withSN: 1, withPhone: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    });
    
    // Debug: ตรวจสอบผลลัพธ์สำหรับ Admin
    console.log(`📊 Breakdown for ${itemName}:`);
    console.log(`  adminItems.length: ${adminItems.length}`);
    console.log(`  adminGroupedBreakdown.length: ${adminGroupedBreakdown.length}`);
    console.log(`  userItems.length: ${userItems.length}`);
    
    if (adminGroupedBreakdown.length === 0 && adminItems.length > 0) {
      console.log(`⚠️ Warning: adminGroupedBreakdown is empty but adminItems.length = ${adminItems.length}`);
      console.log(`  adminStatusResult:`, adminStatusResult);
      console.log(`  adminConditionResult:`, adminConditionResult);
      console.log(`  adminTypeBreakdown:`, adminTypeBreakdown);
      console.log(`  adminGroupedMap size: ${adminGroupedMap.size}`);
    }
    
    if (adminGroupedBreakdown.length > 0) {
      console.log(`  adminGroupedBreakdown:`, adminGroupedBreakdown.slice(0, 3)); // Show first 3 items
    }
    
    // 🆕 Grouped breakdown by (statusId, conditionId, type) for User Owned
    const userGroupedBreakdown: Array<{
      statusId: string;
      conditionId: string;
      type: 'withoutSN' | 'withSN' | 'withPhone';
      count: number;
    }> = [];
    
    const userGroupedMap = new Map<string, number>();
    
    userItems.forEach((item, idx) => {
      // กำหนด type - ตรวจสอบ numberPhone ก่อน (เพราะ priority สูงกว่า)
      let type: 'withoutSN' | 'withSN' | 'withPhone' = 'withoutSN';
      if (item.numberPhone && item.numberPhone.trim() !== '') {
        type = 'withPhone';
      } else if (item.serialNumber && item.serialNumber.trim() !== '') {
        type = 'withSN';
      }
      
      // ใช้ค่า default ถ้า statusId หรือ conditionId เป็น null/undefined
      const statusId = item.statusId || 'status_unknown';
      const conditionId = item.conditionId || 'cond_unknown';
      
      // Debug: log items ที่ไม่มี statusId หรือ conditionId
      if (idx < 3) { // Log first 3 items for debugging
        console.log(`  User Item ${idx + 1}: statusId=${statusId}, conditionId=${conditionId}, type=${type}, serialNumber="${item.serialNumber}", numberPhone="${item.numberPhone}"`);
      }
      
      // สร้าง key จาก statusId + conditionId + type
      const key = `${statusId}|${conditionId}|${type}`;
      userGroupedMap.set(key, (userGroupedMap.get(key) || 0) + 1);
    });
    
    // แปลง Map เป็น Array
    userGroupedMap.forEach((count, key) => {
      const [statusId, conditionId, typeStr] = key.split('|');
      userGroupedBreakdown.push({
        statusId,
        conditionId,
        type: typeStr as 'withoutSN' | 'withSN' | 'withPhone',
        count
      });
    });
    
    // เรียงลำดับ: statusId -> conditionId -> type
    userGroupedBreakdown.sort((a, b) => {
      if (a.statusId !== b.statusId) return a.statusId.localeCompare(b.statusId);
      if (a.conditionId !== b.conditionId) return a.conditionId.localeCompare(b.conditionId);
      const typeOrder = { withoutSN: 0, withSN: 1, withPhone: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    });
    
    // Debug: ตรวจสอบผลลัพธ์สำหรับ User (หลังจากประกาศ userGroupedBreakdown แล้ว)
    console.log(`  userGroupedBreakdown.length: ${userGroupedBreakdown.length}`);
    if (userGroupedBreakdown.length > 0) {
      console.log(`  userGroupedBreakdown:`, userGroupedBreakdown.slice(0, 3)); // Show first 3 items
    }
    
    console.log(`✅ Preparing response for ${itemName}...`);
    const responseData = {
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
      // 🆕 Grouped breakdowns (status + condition + type combined)
      adminGroupedBreakdown,
      userGroupedBreakdown,
      // เพิ่มข้อมูลใหม่สำหรับอุปกรณ์ที่ไม่มี SN เท่านั้น
      nonSNStatusBreakdown: nonSNStatusResult,
      nonSNConditionBreakdown: nonSNConditionResult,
      // จำนวนอุปกรณ์ที่ไม่มี SN ที่สามารถปรับได้ (สถานะ "มี" + สภาพ "ใช้งานได้")
      adjustableCount: availableWorkingCount,
      // รวมจำนวนอุปกรณ์ที่ไม่มี SN ที่อยู่กับแอดมิน (คงเหลือในคลัง)
      nonSNAdminTotal: nonSNAdminOnly.length,
      // 🆕 FIXED: เพิ่มจำนวนรวมทั้งหมดจากข้อมูลจริงใน database
      totalQuantity: allItems.length
    };
    
    console.log(`📤 Sending response for ${itemName} with ${adminGroupedBreakdown.length} admin groups and ${userGroupedBreakdown.length} user groups`);
    
    return NextResponse.json(responseData);
    
  } catch (error: any) {
    console.error('❌ Error fetching breakdown:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    const duration = Date.now() - startTime;
    console.log(`⏱️ Breakdown API completed in ${duration}ms`);
  }
}
