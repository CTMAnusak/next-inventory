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
    
    // คำนวณ type breakdown - แยกแยะ serialNumber และ numberPhone
    const typeBreakdown = await InventoryItem.aggregate([
      { 
        $match: { 
          itemName, 
          categoryId, 
          status: { $ne: 'deleted' } 
        } 
      },
      {
        $group: {
          _id: null,
          withoutSN: { 
            $sum: { 
              $cond: [
                { $and: [
                  { $or: [
                    { $eq: ['$serialNumber', null] },
                    { $eq: ['$serialNumber', ''] },
                    { $eq: [{ $type: '$serialNumber' }, 'missing'] }
                  ]},
                  { $or: [
                    { $eq: ['$numberPhone', null] },
                    { $eq: ['$numberPhone', ''] },
                    { $eq: [{ $type: '$numberPhone' }, 'missing'] }
                  ]}
                ]}, 
                1, 
                0
              ] 
            } 
          },
          withSN: { 
            $sum: { 
              $cond: [
                { $and: [
                  { $ne: [{ $type: '$serialNumber' }, 'missing'] },
                  { $ne: [{ $type: '$serialNumber' }, 'null'] },
                  { $ne: [{ $type: '$serialNumber' }, 'undefined'] },
                  { $gt: [{ $ifNull: ['$serialNumber', ''] }, ''] }
                ]}, 
                1, 
                0
              ] 
            } 
          },
          withPhone: { 
            $sum: { 
              $cond: [
                { $and: [
                  { $ne: [{ $type: '$numberPhone' }, 'missing'] },
                  { $ne: [{ $type: '$numberPhone' }, 'null'] },
                  { $ne: [{ $type: '$numberPhone' }, 'undefined'] },
                  { $gt: [{ $ifNull: ['$numberPhone', ''] }, ''] }
                ]}, 
                1, 
                0
              ] 
            } 
          }
        }
      }
    ]);
    
    // แปลงผลลัพธ์เป็น object - ใช้ชื่อเดียวกับในจัดการ Stock
    const statusResult = statusBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);
    
    const conditionResult = conditionBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);
    
    const typeResult = typeBreakdown[0] || { withoutSN: 0, withSN: 0, withPhone: 0 };
    
    console.log(`📊 Breakdown results:`, {
      status: statusResult,
      condition: conditionResult,
      type: typeResult
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
