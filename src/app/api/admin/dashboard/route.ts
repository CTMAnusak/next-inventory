import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import User from '@/models/User';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import InventorySnapshot from '@/models/InventorySnapshot';
import { getCachedData, setCachedData, clearDashboardCache } from '@/lib/cache-utils';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const monthNumber = monthParam && monthParam !== 'all' ? parseInt(monthParam) : undefined;
    const forceRefresh = searchParams.get('forceRefresh') === 'true';
    const userTypeParam = searchParams.get('userType') || 'all'; // 'all' | 'individual' | 'branch'

    // Cache key based on query params
    const cacheKey = `dashboard_${year}_${monthParam || 'all'}_${userTypeParam}`;
    
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

    // Helper function: สร้าง user IDs array จาก userType filter
    let userIdsForFilter: string[] | null = null;
    if (userTypeParam !== 'all') {
      const usersWithType = await User.find({ 
        userType: userTypeParam,
        pendingDeletion: { $ne: true }
      }).select('user_id').lean();
      userIdsForFilter = usersWithType.map(u => u.user_id);
    }

    // DB-side aggregations and counts with optimized queries
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
      inventoryStatsResult,
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
      // การ์ดด้านบน: นับทั้งหมด (ไม่อิงเดือน/ปี) - กรองตาม userType
      IssueLog.countDocuments(userIdsForFilter ? { requesterId: { $in: userIdsForFilter } } : {}).lean(),
      IssueLog.countDocuments(userIdsForFilter ? { status: 'pending', requesterId: { $in: userIdsForFilter } } : { status: 'pending' }).lean(),
      IssueLog.countDocuments(userIdsForFilter ? { status: 'in_progress', requesterId: { $in: userIdsForFilter } } : { status: 'in_progress' }).lean(),
      IssueLog.countDocuments(userIdsForFilter ? { status: 'completed', requesterId: { $in: userIdsForFilter } } : { status: 'completed' }).lean(),
      IssueLog.countDocuments(userIdsForFilter ? { urgency: 'very_urgent', requesterId: { $in: userIdsForFilter } } : { urgency: 'very_urgent' }).lean(),
      IssueLog.countDocuments(userIdsForFilter ? { urgency: 'normal', requesterId: { $in: userIdsForFilter } } : { urgency: 'normal' }).lean(),

      // นับจำนวนรายการอุปกรณ์ทั้งหมดที่เบิก (นับ items ที่อนุมัติแล้วเท่านั้น)
      RequestLog.aggregate([
        { $match: userIdsForFilter ? { 
          status: { $in: ['approved', 'completed'] },
          userId: { $in: userIdsForFilter }
        } : { status: { $in: ['approved', 'completed'] } } },
        { $unwind: '$items' },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),
      // นับจำนวนรายการอุปกรณ์ทั้งหมดที่คืน (นับ items ที่อนุมัติแล้วเท่านั้น)
      ReturnLog.aggregate([
        { $match: userIdsForFilter ? { userId: { $in: userIdsForFilter } } : {} },
        { $unwind: '$items' },
        { $match: { 'items.approvalStatus': 'approved' } },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),
      User.countDocuments(userIdsForFilter ? { 
        pendingDeletion: { $ne: true },
        user_id: { $in: userIdsForFilter }
      } : { pendingDeletion: { $ne: true } }).lean(),
      // 🔧 FIX: คำนวณ totalInventoryItems จาก sum ของ totalQuantity จาก InventoryMaster แทนการนับ InventoryItem
      InventoryMaster.aggregate([
        {
          $match: {
            relatedItemIds: { $exists: true, $ne: [] }
          }
        },
        {
          $group: {
            _id: null,
            totalInventoryItems: { $sum: 1 },  // จำนวนรายการทั้งหมด (จำนวนชื่ออุปกรณ์)
            totalInventoryCount: { $sum: '$totalQuantity' }  // จำนวนชิ้นทั้งหมด
          }
        }
      ]).then(result => {
        if (result.length > 0) {
          return { totalInventoryItems: result[0].totalInventoryItems, totalInventoryCount: result[0].totalInventoryCount };
        }
        return { totalInventoryItems: 0, totalInventoryCount: 0 };
      }),
      // นับจำนวนอุปกรณ์ที่ User เพิ่มเอง (self_reported) - กรองตาม userType
      InventoryItem.aggregate([
        {
          $match: {
            'sourceInfo.acquisitionMethod': 'self_reported',
            'currentOwnership.ownerType': 'user_owned',
            deletedAt: { $exists: false },
            ...(userIdsForFilter ? { 'currentOwnership.userId': { $in: userIdsForFilter } } : {})
          }
        },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),
      // นับแถวสินค้าใกล้หมด (availableQuantity <= 2 และไม่มี serial number) - นับจำนวนแถว ไม่ใช่จำนวน items
      // นับจำนวนชื่ออุปกรณ์ที่มีจำนวนเบิกได้ปัจจุบัน ≤ 2 (รวม 0) ไม่ตัด SN/เบอร์ออก เพื่อให้ตรงกับหน้า Inventory
      InventoryMaster.countDocuments({ 
        availableQuantity: { $lte: 2, $gte: 0 }
      }).lean(),

      // กล่อง "สถานะแจ้งงาน IT" (อิงช่วงเวลา) - กรองตาม userType
      IssueLog.countDocuments(userIdsForFilter ? { 
        status: 'pending', 
        reportDate: { $gte: startDate, $lte: endDate },
        requesterId: { $in: userIdsForFilter }
      } : { status: 'pending', reportDate: { $gte: startDate, $lte: endDate } }).lean(),
      IssueLog.countDocuments(userIdsForFilter ? { 
        status: 'in_progress', 
        reportDate: { $gte: startDate, $lte: endDate },
        requesterId: { $in: userIdsForFilter }
      } : { status: 'in_progress', reportDate: { $gte: startDate, $lte: endDate } }).lean(),
      IssueLog.countDocuments(userIdsForFilter ? { 
        status: 'completed', 
        reportDate: { $gte: startDate, $lte: endDate },
        requesterId: { $in: userIdsForFilter }
      } : { status: 'completed', reportDate: { $gte: startDate, $lte: endDate } }).lean(),
      IssueLog.countDocuments(userIdsForFilter ? { 
        status: 'closed', 
        reportDate: { $gte: startDate, $lte: endDate },
        requesterId: { $in: userIdsForFilter }
      } : { status: 'closed', reportDate: { $gte: startDate, $lte: endDate } }).lean(),
      IssueLog.countDocuments(userIdsForFilter ? { 
        urgency: 'very_urgent', 
        reportDate: { $gte: startDate, $lte: endDate },
        requesterId: { $in: userIdsForFilter }
      } : { urgency: 'very_urgent', reportDate: { $gte: startDate, $lte: endDate } }).lean(),
      IssueLog.countDocuments(userIdsForFilter ? { 
        urgency: 'normal', 
        reportDate: { $gte: startDate, $lte: endDate },
        requesterId: { $in: userIdsForFilter }
      } : { urgency: 'normal', reportDate: { $gte: startDate, $lte: endDate } }).lean(),

      // กล่อง "สถานะคลังสินค้า" (อิงช่วงเวลา) – จำนวนทั้งหมดของ items ที่เข้าสต็อกแอดมินในช่วงเวลา (แอดมินเพิ่ม หรือผู้ใช้คืน)
      InventoryItem.aggregate([
        {
          $match: {
            deletedAt: { $exists: false },
            'currentOwnership.ownerType': 'admin_stock'
          }
        },
        {
          $addFields: {
            entryDate: {
              $ifNull: [
                '$transferInfo.transferDate',
                '$currentOwnership.ownedSince',
                '$sourceInfo.dateAdded',
                '$createdAt'
              ]
            }
          }
        },
        {
          $match: {
            entryDate: { $gte: startDate, $lte: endDate }
          }
        },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),
      // คำนวณ "ใกล้หมด (≤ 2) ตามช่วงเวลา" ให้สอดคล้องกับหน้า Inventory:
      // เลือกเฉพาะชื่ออุปกรณ์ที่ปัจจุบัน availableQuantity ≤ 2 และ:
      // 1. InventoryMaster ถูกสร้างในช่วงเวลาที่เลือก (createdAt) หรือ
      // 2. มี InventoryItem ที่เข้าสต็อกแอดมินในช่วงเวลาที่เลือก (เพิ่มใหม่/คืนของ)
      // โดย InventoryItem ต้องมี: admin_stock + status_available + cond_working (ตรงกับ availableQuantity)
      InventoryMaster.aggregate([
        {
          $match: {
            availableQuantity: { $lte: 2, $gte: 0 }
          }
        },
        {
          $lookup: {
            from: 'inventoryitems',
            let: { itemName: '$itemName', categoryId: '$categoryId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$itemName', '$$itemName'] },
                      { $eq: ['$categoryId', '$$categoryId'] },
                      // ตรวจสอบว่าเป็น admin_stock และมี status + condition ที่ถูกต้อง (ตรงกับ availableQuantity)
                      { $eq: ['$currentOwnership.ownerType', 'admin_stock'] },
                      { $eq: ['$statusId', 'status_available'] },
                      { $eq: ['$conditionId', 'cond_working'] }
                    ]
                  }
                }
              },
              {
                $addFields: {
                  entryDate: {
                    $ifNull: [
                      '$transferInfo.transferDate',
                      '$currentOwnership.ownedSince',
                      '$sourceInfo.dateAdded',
                      '$createdAt'
                    ]
                  }
                }
              },
              {
                $match: {
                  entryDate: { $gte: startDate, $lte: endDate }
                }
              },
              { $limit: 1 }
            ],
            as: 'enteredInPeriod'
          }
        },
        {
          $match: {
            $or: [
              // ถ้า InventoryMaster ถูกสร้างในช่วงเวลาที่เลือก ให้นับ (รองรับกรณีอุปกรณ์ถูกเพิ่มในเดือนนั้น)
              { createdAt: { $gte: startDate, $lte: endDate } },
              // หรือมี InventoryItem ที่เข้าสต็อกแอดมินในช่วงเวลาที่เลือก (ต้องเป็น admin_stock + status_available + cond_working)
              { enteredInPeriod: { $ne: [] } }
            ]
          }
        },
        { $count: 'lowStockNames' }
      ]).then(x => x?.[0]?.lowStockNames || 0),
      
      // สำหรับกล่อง "สรุป" - User เพิ่มเองในช่วงเวลา - กรองตาม userType
      InventoryItem.aggregate([
        {
          $match: {
            'sourceInfo.acquisitionMethod': 'self_reported',
            'currentOwnership.ownerType': 'user_owned',
            'sourceInfo.dateAdded': { $gte: startDate, $lte: endDate },
            deletedAt: { $exists: false },
            ...(userIdsForFilter ? { 'currentOwnership.userId': { $in: userIdsForFilter } } : {})
          }
        },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),

      // monthlyIssues - กรองตาม userType
      IssueLog.aggregate([
        { $match: userIdsForFilter ? { 
          reportDate: { $gte: startDate, $lte: endDate },
          requesterId: { $in: userIdsForFilter }
        } : { reportDate: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: { y: { $year: '$reportDate' }, m: { $month: '$reportDate' } }, count: { $sum: 1 } } },
        { $project: { _id: 0, month: { $concat: [ { $toString: '$_id.y' }, '-', { $toString: { $cond: [ { $lt: ['$_id.m', 10] }, { $concat: ['0', { $toString: '$_id.m' }] }, { $toString: '$_id.m' } ] } } ] }, count: 1 } },
        { $sort: { month: 1 } }
      ]),
      // monthlyRequests (นับจำนวน items ที่เบิก - เฉพาะที่อนุมัติแล้ว) - กรองตาม userType
      RequestLog.aggregate([
        { $match: userIdsForFilter ? { 
          requestDate: { $gte: startDate, $lte: endDate },
          status: { $in: ['approved', 'completed'] },
          userId: { $in: userIdsForFilter }
        } : { 
          requestDate: { $gte: startDate, $lte: endDate },
          status: { $in: ['approved', 'completed'] }
        }},
        { $unwind: '$items' },
        { $group: { _id: { y: { $year: '$requestDate' }, m: { $month: '$requestDate' } }, count: { $sum: 1 } } },
        { $project: { _id: 0, month: { $concat: [ { $toString: '$_id.y' }, '-', { $toString: { $cond: [ { $lt: ['$_id.m', 10] }, { $concat: ['0', { $toString: '$_id.m' }] }, { $toString: '$_id.m' } ] } } ] }, count: 1 } },
        { $sort: { month: 1 } }
      ]),
      // monthlyReturns (นับเฉพาะ items ที่อนุมัติแล้ว) - กรองตาม userType
      ReturnLog.aggregate([
        { $match: userIdsForFilter ? { 
          returnDate: { $gte: startDate, $lte: endDate },
          userId: { $in: userIdsForFilter }
        } : { returnDate: { $gte: startDate, $lte: endDate } }},
        { $unwind: '$items' },
        { $match: { 'items.approvalStatus': 'approved' }},
        { $group: { _id: { y: { $year: '$returnDate' }, m: { $month: '$returnDate' } }, count: { $sum: 1 } } },
        { $project: { _id: 0, month: { $concat: [ { $toString: '$_id.y' }, '-', { $toString: { $cond: [ { $lt: ['$_id.m', 10] }, { $concat: ['0', { $toString: '$_id.m' }] }, { $toString: '$_id.m' } ] } } ] }, count: 1 } },
        { $sort: { month: 1 } }
      ]),
      // issuesByCategory in selected period - กรองตาม userType
      IssueLog.aggregate([
        { $match: userIdsForFilter ? { 
          reportDate: { $gte: startDate, $lte: endDate },
          requesterId: { $in: userIdsForFilter }
        } : { reportDate: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$issueCategory', count: { $sum: 1 } } },
        { $project: { _id: 0, category: { $ifNull: ['$_id', 'อื่นๆ'] }, count: 1 } },
        { $sort: { count: -1 } }
      ]),
      // requestsByUrgency in selected period (นับจำนวน items ที่อนุมัติแล้วเท่านั้น) - กรองตาม userType
      RequestLog.aggregate([
        { $match: userIdsForFilter ? { 
          requestDate: { $gte: startDate, $lte: endDate },
          status: { $in: ['approved', 'completed'] },
          userId: { $in: userIdsForFilter }
        } : { 
          requestDate: { $gte: startDate, $lte: endDate },
          status: { $in: ['approved', 'completed'] }
        }},
        { $unwind: '$items' },
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

    // 🔧 FIX: แยกข้อมูล inventory stats
    const inventoryStats = inventoryStatsResult || { totalInventoryItems: 0, totalInventoryCount: 0 };
    const totalInventoryItems = inventoryStats.totalInventoryItems;
    const totalInventoryCount = inventoryStats.totalInventoryCount;

    // 🔧 NEW: ใช้ snapshot เมื่อเลือกช่วงเวลา (ไม่ใช่ "ทั้งหมด")
    let snapshotData: any = null;
    if (monthNumber) {
      const thaiYear = year + 543;
      snapshotData = await InventorySnapshot.findOne({ year: thaiYear, month: monthNumber }).lean();
    }

    // 🔧 FIX: คำนวณ totalInventoryItemsInPeriod และ lowStockItemsInPeriod จาก snapshot หรือคำนวณใหม่
    let calculatedTotalInventoryItemsInPeriod = totalInventoryItemsInPeriod;
    let calculatedLowStockItemsInPeriod = lowStockItemsInPeriod;

    if (snapshotData && snapshotData.totalInventoryCount !== undefined) {
      // ใช้ข้อมูลจาก snapshot
      calculatedTotalInventoryItemsInPeriod = snapshotData.totalInventoryCount; // จำนวนชิ้นทั้งหมด
      calculatedLowStockItemsInPeriod = snapshotData.lowStockItems || 0;
    } else if (monthNumber) {
      // ถ้าไม่มี snapshot แต่เลือกเดือน ให้คำนวณใหม่ (fallback)
      // คำนวณจำนวนชิ้นทั้งหมดจาก InventoryMaster ที่มีในเดือนนั้น
      const masterStats = await InventoryMaster.aggregate([
        {
          $match: {
            relatedItemIds: { $exists: true, $ne: [] },
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalCount: { $sum: '$totalQuantity' }
          }
        }
      ]);
      if (masterStats.length > 0) {
        calculatedTotalInventoryItemsInPeriod = masterStats[0].totalCount;
      }
    } else {
      // เลือก "ทั้งหมด" ใช้ข้อมูลปัจจุบัน
      calculatedTotalInventoryItemsInPeriod = totalInventoryCount;
      calculatedLowStockItemsInPeriod = lowStockItems;
    }

    const stats = {
      // การ์ดด้านบน (ทั้งหมด - ไม่อิงเดือน/ปี)
      totalIssues,
      totalRequests,
      totalReturns,
      totalUsers,
      totalInventoryItems, // จำนวนรายการทั้งหมด (จำนวนชื่ออุปกรณ์)
      totalInventoryCount, // จำนวนชิ้นทั้งหมด (sum of totalQuantity)
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
      totalInventoryItemsInPeriod: calculatedTotalInventoryItemsInPeriod,
      lowStockItemsInPeriod: calculatedLowStockItemsInPeriod,
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
