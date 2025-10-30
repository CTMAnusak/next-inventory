import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';

/**
 * GET /api/admin/inventory/combinations
 * ดึงข้อมูล status+condition combinations สำหรับอุปกรณ์ที่ไม่มี SN
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get('itemName');
    const categoryId = searchParams.get('categoryId');

    if (!itemName || !categoryId) {
      return NextResponse.json(
        { error: 'ต้องระบุ itemName และ categoryId' },
        { status: 400 }
      );
    }

    // หา InventoryMaster ที่ตรงกับ itemName และ categoryId
    const inventoryMaster = await InventoryMaster.findOne({
      itemName,
      categoryId
    });

    if (!inventoryMaster) {
      return NextResponse.json(
        { error: 'ไม่พบอุปกรณ์ที่ระบุ' },
        { status: 404 }
      );
    }

    // ดึงอุปกรณ์ที่ไม่มี SN, เป็น admin_stock, และไม่ถูกลบ
    // ใช้เกณฑ์เดียวกับ endpoint อื่น ๆ: กรองด้วย itemName + categoryId ที่แท้จริง
    const actualCategoryId = inventoryMaster.categoryId;

    // ถ้ามีรายการ itemIds ของกลุ่ม "อื่น ๆ" ใน master ให้ใช้เป็นแหล่งอ้างอิงหลัก (คือ non-SN)
    const nonSNItemIds: string[] = (inventoryMaster as any)?.itemDetails?.other?.itemIds || [];

    let items;
    if (Array.isArray(nonSNItemIds) && nonSNItemIds.length > 0) {
      items = await InventoryItem.find({
        _id: { $in: nonSNItemIds },
        'currentOwnership.ownerType': 'admin_stock',
        deletedAt: { $exists: false }
      }).select('statusId conditionId _id');
    } else {
      // fallback กรณี master ยังไม่มีการ sync itemIds
      items = await InventoryItem.find({
        itemName,
        categoryId: actualCategoryId,
        serialNumber: { $in: [null, ''] },
        numberPhone: { $in: [null, ''] },
        'currentOwnership.ownerType': 'admin_stock',
        deletedAt: { $exists: false }
      }).select('statusId conditionId _id');
    }

    console.log(`📊 Found ${items.length} non-SN items for ${itemName}`);

    // จัดกลุ่มตาม statusId + conditionId
    const combinationsMap = new Map<string, {
      statusId: string;
      conditionId: string;
      quantity: number;
      itemIds: string[];
    }>();

    items.forEach((item) => {
      // ใช้ค่าเริ่มต้นถ้าไม่มี statusId หรือ conditionId
      const statusId = item.statusId || 'status_available';
      const conditionId = item.conditionId || 'cond_working';
      const key = `${statusId}_${conditionId}`;

      if (!combinationsMap.has(key)) {
        combinationsMap.set(key, {
          statusId,
          conditionId,
          quantity: 0,
          itemIds: []
        });
      }

      const combo = combinationsMap.get(key)!;
      combo.quantity += 1;
      combo.itemIds.push((item._id as any).toString());
    });

    console.log(`📊 Combinations found:`, Array.from(combinationsMap.entries()).map(([key, data]) => ({
      key,
      statusId: data.statusId,
      conditionId: data.conditionId,
      quantity: data.quantity
    })));

    // แปลงเป็น array และกรองเฉพาะที่มีจำนวน > 0
    const combinations = Array.from(combinationsMap.values())
      .filter(combo => combo.quantity > 0)
      .map(combo => ({
        statusId: combo.statusId,
        conditionId: combo.conditionId,
        quantity: combo.quantity,
        key: `${combo.statusId}_${combo.conditionId}`
      }))
      .sort((a, b) => {
        // เรียงตาม statusId ก่อน แล้วตาม conditionId
        if (a.statusId !== b.statusId) {
          return a.statusId.localeCompare(b.statusId);
        }
        return a.conditionId.localeCompare(b.conditionId);
      });

    return NextResponse.json({ combinations });

  } catch (error) {
    console.error('Error fetching combinations:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}

