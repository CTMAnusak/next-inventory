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
    
    console.log(`🔍 Fetching breakdown for: ${itemName} (${categoryId})`);
    
    // ดึงข้อมูล items ทั้งหมดเพื่อใช้คำนวณ
    const allItems = await InventoryItem.find({
      itemName,
      categoryId,
      status: { $ne: 'deleted' }
    }).lean();
    
    // คำนวณ status breakdown - ใช้ชื่อเดียวกับในจัดการ Stock
    const statusBreakdown = await InventoryItem.aggregate([
      { 
        $match: { 
          itemName, 
          categoryId, 
          status: { $ne: 'deleted' } 
        } 
      },
      { 
        $group: { 
          _id: '$statusId', 
          count: { $sum: 1 } 
        } 
      }
    ]);
    
    // คำนวณ condition breakdown - ใช้ชื่อเดียวกับในจัดการ Stock
    const conditionBreakdown = await InventoryItem.aggregate([
      { 
        $match: { 
          itemName, 
          categoryId, 
          status: { $ne: 'deleted' } 
        } 
      },
      { 
        $group: { 
          _id: '$conditionId', 
          count: { $sum: 1 } 
        } 
      }
    ]);
    
    // คำนวณ type breakdown - ใช้ JavaScript แทน aggregation เพื่อความแม่นยำ
    const withSN = allItems.filter(item => 
      item.serialNumber && item.serialNumber.trim() !== ''
    );
    const withPhone = allItems.filter(item => 
      item.numberPhone && item.numberPhone.trim() !== ''
    );
    const withoutSN = allItems.filter(item => 
      (!item.serialNumber || item.serialNumber.trim() === '') && 
      (!item.numberPhone || item.numberPhone.trim() === '')
    );
    
    const typeResult = {
      withoutSN: withoutSN.length,
      withSN: withSN.length,
      withPhone: withPhone.length
    };
    
    // แปลงผลลัพธ์เป็น object - ใช้ชื่อเดียวกับในจัดการ Stock
    const statusResult = statusBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);
    
    const conditionResult = conditionBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`📊 Breakdown results for ${itemName}:`, {
      totalItems: allItems.length,
      type: typeResult,
      status: statusResult,
      condition: conditionResult
    });
    
    // Debug: แสดงรายละเอียด items ที่ถูกจัดหมวดหมู่
    console.log(`🔍 Items categorization:`, {
      withSN: withSN.map(item => ({ id: item._id.toString(), sn: item.serialNumber })),
      withPhone: withPhone.map(item => ({ id: item._id.toString(), phone: item.numberPhone })),
      withoutSN: withoutSN.map(item => ({ id: item._id.toString(), sn: item.serialNumber, phone: item.numberPhone }))
    });
    
    return NextResponse.json({
      statusBreakdown: statusResult,
      conditionBreakdown: conditionResult,
      typeBreakdown: typeResult
    });
    
  } catch (error) {
    console.error('Error fetching breakdown:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
