import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import User from '@/models/User';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import { getCachedData, setCachedData, clearDashboardCache } from '@/lib/cache-utils';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const monthNumber = monthParam && monthParam !== 'all' ? parseInt(monthParam) : undefined;
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    // Cache key based on query params
    const cacheKey = `dashboard_${year}_${monthParam || 'all'}`;
    
    // Clear cache if forceRefresh is requested
    if (forceRefresh) {
      clearDashboardCache();
    }
    
    const cached = getCachedData(cacheKey);
    if (cached && !forceRefresh) {
      return NextResponse.json(cached);
    }

    // Create date range
    const startDate = monthNumber ? new Date(year, monthNumber - 1, 1) : new Date(year, 0, 1);
    const endDate = monthNumber ? new Date(year, monthNumber, 0, 23, 59, 59) : new Date(year, 11, 31, 23, 59, 59);

    // DB-side aggregations and counts
    const [
      totalIssues,
      pendingIssues,
      inProgressIssues,
      completedIssues,
      urgentIssues,
      normalIssues,
      totalRequests,
      totalReturns,
      totalUsers,
      totalInventoryItems,
      userAddedItems,
      lowStockItems,
      // สำหรับกล่อง "สถานะแจ้งงาน IT" (อิงช่วงเวลา)
      pendingIssuesInPeriod,
      inProgressIssuesInPeriod,
      completedIssuesInPeriod,
      closedIssuesInPeriod,
      urgentIssuesInPeriod,
      normalIssuesInPeriod,
      // สำหรับกล่อง "สถานะคลังสินค้า" (อิงช่วงเวลา)
      totalInventoryItemsInPeriod,
      lowStockItemsInPeriod,
      // สำหรับกล่อง "สรุป" (อิงช่วงเวลา)
      userAddedItemsInPeriod,
      monthlyIssues,
      monthlyRequests,
      monthlyReturns,
      issuesByCategory,
      requestsByUrgency
    ] = await Promise.all([
      // การ์ดด้านบน: นับทั้งหมด (ไม่อิงเดือน/ปี)
      IssueLog.estimatedDocumentCount(),
      IssueLog.countDocuments({ status: 'pending' }),
      IssueLog.countDocuments({ status: 'in_progress' }),
      IssueLog.countDocuments({ status: 'completed' }),
      IssueLog.countDocuments({ urgency: 'very_urgent' }),
      IssueLog.countDocuments({ urgency: 'normal' }),

      // นับจำนวนรายการอุปกรณ์ทั้งหมดที่เบิก (นับ items ที่อนุมัติแล้วเท่านั้น)
      RequestLog.aggregate([
        { $match: { status: { $in: ['approved', 'completed'] } } }, // เฉพาะที่อนุมัติแล้ว
        { $unwind: '$items' },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),
      // นับจำนวนรายการอุปกรณ์ทั้งหมดที่คืน (นับ items ที่อนุมัติแล้วเท่านั้น)
      ReturnLog.aggregate([
        { $unwind: '$items' },
        { $match: { 'items.approvalStatus': 'approved' } }, // เฉพาะ items ที่อนุมัติแล้ว
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),
      User.countDocuments({ pendingDeletion: { $ne: true } }),
      InventoryItem.estimatedDocumentCount(),
      // นับจำนวนอุปกรณ์ที่ User เพิ่มเอง (self_reported)
      InventoryItem.countDocuments({ 
        'sourceInfo.acquisitionMethod': 'self_reported',
        'currentOwnership.ownerType': 'user_owned',
        deletedAt: { $exists: false }
      }),
      // นับแถวสินค้าใกล้หมด (availableQuantity <= 2 และไม่มี serial number) - นับจำนวนแถว ไม่ใช่จำนวน items
      InventoryMaster.countDocuments({ 
        availableQuantity: { $lte: 2, $gte: 0 }, // มีจำนวนคงเหลือ 0-2 ชิ้น
        'itemDetails.withSerialNumber.count': 0, // ไม่มี Serial Number
        'itemDetails.withPhoneNumber.count': 0   // ไม่มีเบอร์โทรศัพท์
      }),

      // กล่อง "สถานะแจ้งงาน IT" (อิงช่วงเวลา)
      IssueLog.countDocuments({ status: 'pending', reportDate: { $gte: startDate, $lte: endDate } }),
      IssueLog.countDocuments({ status: 'in_progress', reportDate: { $gte: startDate, $lte: endDate } }),
      IssueLog.countDocuments({ status: 'completed', reportDate: { $gte: startDate, $lte: endDate } }),
      IssueLog.countDocuments({ status: 'closed', reportDate: { $gte: startDate, $lte: endDate } }),
      IssueLog.countDocuments({ urgency: 'very_urgent', reportDate: { $gte: startDate, $lte: endDate } }),
      IssueLog.countDocuments({ urgency: 'normal', reportDate: { $gte: startDate, $lte: endDate } }),

      // กล่อง "สถานะคลังสินค้า" (อิงช่วงเวลา - สำหรับรายการที่เพิ่มในช่วงเวลานั้น)
      InventoryItem.countDocuments({ 
        'sourceInfo.dateAdded': { $gte: startDate, $lte: endDate },
        deletedAt: { $exists: false }
      }),
      InventoryMaster.countDocuments({ 
        availableQuantity: { $lte: 2, $gte: 0 }, // มีจำนวนคงเหลือ 0-2 ชิ้น
        'itemDetails.withSerialNumber.count': 0, // ไม่มี Serial Number
        'itemDetails.withPhoneNumber.count': 0,   // ไม่มีเบอร์โทรศัพท์
        createdAt: { $gte: startDate, $lte: endDate } // อิงตามช่วงเวลาที่เพิ่มอุปกรณ์เข้ามาครั้งแรก
      }),
      
      // สำหรับกล่อง "สรุป" - User เพิ่มเองในช่วงเวลา
      InventoryItem.countDocuments({ 
        'sourceInfo.acquisitionMethod': 'self_reported',
        'currentOwnership.ownerType': 'user_owned',
        'sourceInfo.dateAdded': { $gte: startDate, $lte: endDate },
        deletedAt: { $exists: false }
      }),

      // monthlyIssues
      IssueLog.aggregate([
        { $match: { reportDate: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: { y: { $year: '$reportDate' }, m: { $month: '$reportDate' } }, count: { $sum: 1 } } },
        { $project: { _id: 0, month: { $concat: [ { $toString: '$_id.y' }, '-', { $toString: { $cond: [ { $lt: ['$_id.m', 10] }, { $concat: ['0', { $toString: '$_id.m' }] }, { $toString: '$_id.m' } ] } } ] }, count: 1 } },
        { $sort: { month: 1 } }
      ]),
      // monthlyRequests (นับจำนวน items ที่เบิก - เฉพาะที่อนุมัติแล้ว)
      RequestLog.aggregate([
        { $match: { 
          requestDate: { $gte: startDate, $lte: endDate },
          status: { $in: ['approved', 'completed'] } // เฉพาะที่อนุมัติแล้ว
        }},
        { $unwind: '$items' }, // ✅ Unwind items เพื่อนับจำนวนรายการอุปกรณ์
        { $group: { _id: { y: { $year: '$requestDate' }, m: { $month: '$requestDate' } }, count: { $sum: 1 } } },
        { $project: { _id: 0, month: { $concat: [ { $toString: '$_id.y' }, '-', { $toString: { $cond: [ { $lt: ['$_id.m', 10] }, { $concat: ['0', { $toString: '$_id.m' }] }, { $toString: '$_id.m' } ] } } ] }, count: 1 } },
        { $sort: { month: 1 } }
      ]),
      // monthlyReturns (นับเฉพาะ items ที่อนุมัติแล้ว)
      ReturnLog.aggregate([
        { $match: { returnDate: { $gte: startDate, $lte: endDate } }},
        { $unwind: '$items' },
        { $match: { 'items.approvalStatus': 'approved' }}, // เฉพาะ items ที่อนุมัติแล้ว
        { $group: { _id: { y: { $year: '$returnDate' }, m: { $month: '$returnDate' } }, count: { $sum: 1 } } },
        { $project: { _id: 0, month: { $concat: [ { $toString: '$_id.y' }, '-', { $toString: { $cond: [ { $lt: ['$_id.m', 10] }, { $concat: ['0', { $toString: '$_id.m' }] }, { $toString: '$_id.m' } ] } } ] }, count: 1 } },
        { $sort: { month: 1 } }
      ]),
      // issuesByCategory in selected period
      IssueLog.aggregate([
        { $match: { reportDate: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$issueCategory', count: { $sum: 1 } } },
        { $project: { _id: 0, category: { $ifNull: ['$_id', 'อื่นๆ'] }, count: 1 } },
        { $sort: { count: -1 } }
      ]),
      // requestsByUrgency in selected period (นับจำนวน items ที่อนุมัติแล้วเท่านั้น)
      RequestLog.aggregate([
        { $match: { 
          requestDate: { $gte: startDate, $lte: endDate },
          status: { $in: ['approved', 'completed'] } // เฉพาะที่อนุมัติแล้ว
        }},
        { $unwind: '$items' }, // ✅ Unwind items เพื่อนับจำนวนรายการอุปกรณ์
        { $group: { _id: { $cond: [{ $eq: ['$urgency', 'very_urgent'] }, 'ด่วนมาก', 'ปกติ'] }, count: { $sum: 1 } } },
        { $project: { _id: 0, urgency: '$_id', count: 1 } },
        { $sort: { urgency: 1 } }
      ])
    ]);

    // compute percentages for pie charts
    const issuesTotalInRange = issuesByCategory.reduce((s: number, x: any) => s + x.count, 0);
    const issuesByCategoryWithPct = issuesByCategory.map((x: any) => ({
      category: x.category,
      count: x.count,
      percentage: issuesTotalInRange > 0 ? (x.count / issuesTotalInRange) * 100 : 0
    }));

    const requestsTotalInRange = requestsByUrgency.reduce((s: number, x: any) => s + x.count, 0);
    const requestsByUrgencyWithPct = requestsByUrgency
      .map((x: any) => ({ urgency: x.urgency, count: x.count, percentage: requestsTotalInRange > 0 ? (x.count / requestsTotalInRange) * 100 : 0 }))
      .filter((x: any) => x.count > 0);

    const stats = {
      // การ์ดด้านบน (ทั้งหมด - ไม่อิงเดือน/ปี)
      totalIssues,
      totalRequests,
      totalReturns,
      totalUsers,
      totalInventoryItems,
      userAddedItems,
      lowStockItems,
      // กล่อง "สถานะแจ้งงาน IT" (อิงช่วงเวลา)
      pendingIssues: pendingIssuesInPeriod,
      inProgressIssues: inProgressIssuesInPeriod,
      completedIssues: completedIssuesInPeriod,
      closedIssues: closedIssuesInPeriod,
      urgentIssues: urgentIssuesInPeriod,
      normalIssues: normalIssuesInPeriod,
      // กล่อง "สถานะคลังสินค้า" (อิงช่วงเวลา)
      totalInventoryItemsInPeriod,
      lowStockItemsInPeriod,
      // กล่อง "สรุป" (อิงช่วงเวลา)
      userAddedItemsInPeriod,
      // Charts และ aggregations (อิงช่วงเวลา)
      monthlyIssues,
      monthlyRequests,
      monthlyReturns,
      issuesByCategory: issuesByCategoryWithPct,
      requestsByUrgency: requestsByUrgencyWithPct
    };

    // Cache the result for 30 seconds
    setCachedData(cacheKey, stats);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}

function generateMonthlyData(data: any[], dateField: string) {
  const monthlyCount: { [key: string]: number } = {};
  
  data.forEach(item => {
    const date = new Date(item[dateField]);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    monthlyCount[monthKey] = (monthlyCount[monthKey] || 0) + 1;
  });

  return Object.entries(monthlyCount).map(([month, count]) => ({
    month,
    count
  }));
}

function generateCategoryData(data: any[], categoryField: string) {
  const categoryCount: { [key: string]: number } = {};
  
  data.forEach(item => {
    const category = item[categoryField] || 'อื่นๆ';
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  });

  const total = data.length;
  
  return Object.entries(categoryCount)
    .map(([category, count]) => ({
      category,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count);
}

function generateUrgencyData(data: any[]) {
  const urgencyCount = {
    normal: 0,
    very_urgent: 0
  };
  
  data.forEach(item => {
    if (item.urgency === 'very_urgent') {
      urgencyCount.very_urgent++;
    } else {
      urgencyCount.normal++;
    }
  });

  const total = data.length;
  
  return [
    {
      urgency: 'ด่วนมาก',
      count: urgencyCount.very_urgent,
      percentage: total > 0 ? (urgencyCount.very_urgent / total) * 100 : 0
    },
    {
      urgency: 'ปกติ',
      count: urgencyCount.normal,
      percentage: total > 0 ? (urgencyCount.normal / total) * 100 : 0
    }
  ].filter(item => item.count > 0);
}
