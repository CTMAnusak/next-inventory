import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import User from '@/models/User';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import InventorySnapshot from '@/models/InventorySnapshot';
import DeletedUser from '@/models/DeletedUser';
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
    const yearStartDate = new Date(year, 0, 1);
    const yearEndDate = new Date(year, 11, 31, 23, 59, 59);

    // Helper: resolve user IDs (user_id) for filtering when userType selection is applied
    let userIdsForFilter: string[] | null = null;
    let individualUserIds: string[] = [];
    let branchUserIds: string[] = [];

    if (userTypeParam !== 'all') {
      const [activeUsers, deletedUsers] = await Promise.all([
        User.find({
          pendingDeletion: { $ne: true },
          userType: { $in: ['individual', 'branch'] }
        })
          .select('user_id userType')
          .lean(),
        DeletedUser.find({ userType: { $in: ['individual', 'branch'] } })
          .select('user_id userType')
          .lean()
      ]);

      const combined = [...activeUsers, ...deletedUsers].filter(user => !!user.user_id);
      const collectIds = (type: 'individual' | 'branch') =>
        Array.from(new Set(combined.filter(u => u.userType === type).map(u => u.user_id as string)));

      individualUserIds = collectIds('individual');
      branchUserIds = collectIds('branch');

      userIdsForFilter = userTypeParam === 'individual' ? individualUserIds : branchUserIds;
    }

    const buildIssueUserFilter = () => {
      if (userTypeParam === 'all') return {};
      const ids = userTypeParam === 'individual' ? individualUserIds : branchUserIds;
      const orConditions: any[] = [];
      if (ids.length) {
        orConditions.push({ requesterId: { $in: ids } });
      }
      orConditions.push({ requesterType: userTypeParam });
      if (userTypeParam === 'individual' && branchUserIds.length) {
        orConditions.push({ requesterId: { $nin: branchUserIds } });
      }
      return orConditions.length > 0 ? { $or: orConditions } : {};
    };

    const applyUserTypeFilter = (
      match: any,
      field: string,
      includeUnknownAsIndividual: boolean = false
    ) => {
      if (userTypeParam === 'all') {
        return match;
      }

      // Logic ตรงกับหน้าตารางรายงาน:
      // - ถ้า userInfo?.userType เป็น undefined/null/'unknown' → ถือว่าเป็น 'individual'
      // - ถ้า userInfo?.userType เป็น 'branch' → ถือว่าเป็น 'branch'
      
      if (userTypeParam === 'branch') {
        // สาขา: นับเฉพาะ userId ที่อยู่ใน branchUserIds เท่านั้น
        const ids = branchUserIds.length ? branchUserIds : ['__no_branch_user__'];
        match[field] = { $in: ids };
        return match;
      }

      // บุคคล: นับ userId ที่ไม่อยู่ใน branchUserIds (รวมทั้ง individual และ unknown)
      const orConditions: any[] = [];
      
      if (includeUnknownAsIndividual) {
        if (branchUserIds.length) {
          // ถ้ามี branchUserIds: นับ userId ที่ไม่อยู่ใน branchUserIds
          // (ครอบคลุมทั้ง individualUserIds และ unknown)
          orConditions.push({ [field]: { $nin: branchUserIds } });
        } else {
          // ไม่มี branchUserIds เลย → ทุก userId ถือว่าเป็น individual
          orConditions.push({ [field]: { $exists: true } });
        }
        // รวม userId ที่ไม่มีค่า (null, empty, ไม่มี field) → ถือว่าเป็น individual
        orConditions.push({ [field]: { $exists: false } });
        orConditions.push({ [field]: null });
        orConditions.push({ [field]: '' });
      } else {
        // ถ้าไม่ include unknown → นับเฉพาะ individualUserIds
        if (individualUserIds.length) {
          orConditions.push({ [field]: { $in: individualUserIds } });
        } else {
          match[field] = { $in: ['__no_individual_user__'] };
          return match;
        }
      }

      if (orConditions.length === 0) {
        match[field] = { $in: ['__no_individual_user__'] };
        return match;
      }

      match.$and = match.$and || [];
      match.$and.push({ $or: orConditions });
      return match;
    };

    // 🆕 ฟังก์ชันกรอง RequestLog/ReturnLog ตาม userType field (Priority 1) และ userId (Priority 2 - fallback)
    const applyEquipmentUserTypeFilter = (match: any, isRequestLog: boolean = true) => {
      if (userTypeParam === 'all') {
        return match;
      }

      const orConditions: any[] = [];

      if (userTypeParam === 'branch') {
        // สาขา: ใช้ userType === 'branch' หรือ fallback ไป userId ที่อยู่ใน branchUserIds
        const branchIds = branchUserIds.length ? branchUserIds : ['__no_branch_user__'];
        
        // ✅ Priority 1: userType field === 'branch' (มีค่าและเป็น 'branch')
        orConditions.push({
          $and: [
            { userType: { $exists: true } },
            { userType: { $ne: null } },
            { userType: 'branch' }
          ]
        });
        
        // ✅ Priority 2: ไม่มี userType field หรือเป็น null/unknown → fallback ไป userId
        orConditions.push({
          $and: [
            {
              $or: [
                { userType: { $exists: false } },
                { userType: null },
                { userType: 'unknown' }
              ]
            },
            { userId: { $in: branchIds } }
          ]
        });
      } else {
        // บุคคล: ใช้ userType === 'individual' หรือไม่มี userType/เป็น null/unknown (ถือว่าเป็น individual)
        // หรือ fallback ไป userId ที่ไม่อยู่ใน branchUserIds
        
        // ✅ Priority 1: userType field === 'individual'
        orConditions.push({ userType: 'individual' });
        
        // ✅ Priority 2: ไม่มี userType field หรือเป็น null/unknown → fallback ไป userId
        // ถ้า userId ไม่อยู่ใน branchUserIds → ถือว่าเป็น individual
        if (branchUserIds.length > 0) {
          // ถ้า userType ไม่มีค่า หรือเป็น null/unknown และ userId ไม่อยู่ใน branchUserIds → ถือว่าเป็น individual
          orConditions.push({
            $and: [
              {
                $or: [
                  { userType: { $exists: false } },
                  { userType: null },
                  { userType: 'unknown' }
                ]
              },
              { userId: { $nin: branchUserIds } }
            ]
          });
          // ถ้า userType ไม่มีค่า และ userId ก็ไม่มีค่า → ถือว่าเป็น individual
          orConditions.push({
            $and: [
              {
                $or: [
                  { userType: { $exists: false } },
                  { userType: null },
                  { userType: 'unknown' }
                ]
              },
              {
                $or: [
                  { userId: { $exists: false } },
                  { userId: null },
                  { userId: '' }
                ]
              }
            ]
          });
        } else {
          // ไม่มี branchUserIds → ทุก userType ที่ไม่มีค่า หรือเป็น null/unknown ถือว่าเป็น individual
          orConditions.push({
            $or: [
              { userType: { $exists: false } },
              { userType: null },
              { userType: 'unknown' }
            ]
          });
        }
      }

      if (orConditions.length > 0) {
        match.$and = match.$and || [];
        match.$and.push({ $or: orConditions });
      }

      // 🔍 Debug: Log match condition when userType filter is active
      if (userTypeParam !== 'all' && process.env.NODE_ENV === 'development') {
        console.log(`🔍 Equipment UserType Filter (${isRequestLog ? 'Request' : 'Return'}):`, {
          userTypeParam,
          matchCondition: JSON.stringify(match, null, 2)
        });
      }

      return match;
    };

    // DB-side aggregations and counts with optimized queries
    const issueYearFilter = {
      ...buildIssueUserFilter(),
      reportDate: { $gte: yearStartDate, $lte: yearEndDate }
    };

    const requestYearMatch = applyEquipmentUserTypeFilter({
      status: { $in: ['approved', 'completed'] },
      requestDate: { $gte: yearStartDate, $lte: yearEndDate }
    }, true);

    const requestYearMatchForCards = applyEquipmentUserTypeFilter({
      requestDate: { $gte: yearStartDate, $lte: yearEndDate }
    }, true);

    const returnYearMatch = applyEquipmentUserTypeFilter({
      returnDate: { $gte: yearStartDate, $lte: yearEndDate }
    }, false);

    const returnYearMatchForCards = applyEquipmentUserTypeFilter({
      returnDate: { $gte: yearStartDate, $lte: yearEndDate }
    }, false);

    const issueStatusFilter = (status: string) => ({
      ...buildIssueUserFilter(),
      status,
      reportDate: { $gte: yearStartDate, $lte: yearEndDate }
    });

    const issueUrgencyFilter = (urgency: 'very_urgent' | 'normal') => ({
      ...buildIssueUserFilter(),
      urgency,
      reportDate: { $gte: yearStartDate, $lte: yearEndDate }
    });

    const issuePeriodFilter = (extra: any = {}) => ({
      ...buildIssueUserFilter(),
      ...extra,
      reportDate: { $gte: startDate, $lte: endDate }
    });

    const requestPeriodMatch = applyEquipmentUserTypeFilter({
      status: { $in: ['approved', 'completed'] },
      requestDate: { $gte: startDate, $lte: endDate }
    }, true);

    const returnPeriodMatch = applyEquipmentUserTypeFilter({
      returnDate: { $gte: startDate, $lte: endDate }
    }, false);

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
      // การ์ดด้านบน: นับทั้งหมด (อิงปีและประเภทผู้ใช้)
      IssueLog.countDocuments(issueYearFilter).lean(),
      IssueLog.countDocuments(issueStatusFilter('pending')).lean(),
      IssueLog.countDocuments(issueStatusFilter('in_progress')).lean(),
      IssueLog.countDocuments(issueStatusFilter('completed')).lean(),
      IssueLog.countDocuments(issueUrgencyFilter('very_urgent')).lean(),
      IssueLog.countDocuments(issueUrgencyFilter('normal')).lean(),

      // นับจำนวนรายการอุปกรณ์ทั้งหมดที่เบิก (นับ items ที่อนุมัติแล้วเท่านั้น)
      RequestLog.aggregate([
        { $match: requestYearMatchForCards },
        { $unwind: '$items' },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),
      // นับจำนวนรายการอุปกรณ์ทั้งหมดที่คืน (นับ items ที่อนุมัติแล้วเท่านั้น)
      ReturnLog.aggregate([
        { $match: returnYearMatchForCards },
        { $unwind: '$items' },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),
      User.countDocuments(userTypeParam !== 'all' ? { 
        pendingDeletion: { $ne: true },
        userType: userTypeParam,
        createdAt: { $gte: yearStartDate, $lte: yearEndDate }
      } : { pendingDeletion: { $ne: true }, createdAt: { $gte: yearStartDate, $lte: yearEndDate } }).lean(),
      // 🔧 FIX: คำนวณ totalInventoryItems จาก sum ของ totalQuantity จาก InventoryMaster แทนการนับ InventoryItem
      InventoryMaster.aggregate([
        {
          $match: {
            relatedItemIds: { $exists: true, $ne: [] },
            createdAt: { $gte: yearStartDate, $lte: yearEndDate }
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
        {
          $addFields: {
            effectiveDate: {
              $ifNull: ['$sourceInfo.dateAdded', '$createdAt']
            }
          }
        },
        {
          $match: {
            effectiveDate: { $gte: yearStartDate, $lte: yearEndDate }
          }
        },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0),
      // นับแถวสินค้าใกล้หมด (availableQuantity <= 2) ภายในปีที่เลือก
      InventoryMaster.countDocuments({ 
        availableQuantity: { $lte: 2, $gte: 0 },
        createdAt: { $gte: yearStartDate, $lte: yearEndDate }
      }).lean(),

      // กล่อง "สถานะแจ้งงาน IT" (อิงช่วงเวลา) - กรองตาม userType
      IssueLog.countDocuments(issuePeriodFilter({ status: 'pending' })).lean(),
      IssueLog.countDocuments(issuePeriodFilter({ status: 'in_progress' })).lean(),
      IssueLog.countDocuments(issuePeriodFilter({ status: 'completed' })).lean(),
      IssueLog.countDocuments(issuePeriodFilter({ status: 'closed' })).lean(),
      IssueLog.countDocuments(issuePeriodFilter({ urgency: 'very_urgent' })).lean(),
      IssueLog.countDocuments(issuePeriodFilter({ urgency: 'normal' })).lean(),

      // กล่อง "สถานะคลังสินค้า" (อิงช่วงเวลา)
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
              { createdAt: { $gte: startDate, $lte: endDate } },
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
        { $match: issuePeriodFilter() },
        { $group: { _id: { y: { $year: '$reportDate' }, m: { $month: '$reportDate' } }, count: { $sum: 1 } } },
        { $project: { _id: 0, month: { $concat: [ { $toString: '$_id.y' }, '-', { $toString: { $cond: [ { $lt: ['$_id.m', 10] }, { $concat: ['0', { $toString: '$_id.m' }] }, { $toString: '$_id.m' } ] } } ] }, count: 1 } },
        { $sort: { month: 1 } }
      ]),
      // monthlyRequests (นับจำนวน items ที่เบิก - เฉพาะที่อนุมัติแล้ว) - กรองตาม userType
      RequestLog.aggregate([
        { $match: requestPeriodMatch },
        { $unwind: '$items' },
        { $group: { _id: { y: { $year: '$requestDate' }, m: { $month: '$requestDate' } }, count: { $sum: 1 } } },
        { $project: { _id: 0, month: { $concat: [ { $toString: '$_id.y' }, '-', { $toString: { $cond: [ { $lt: ['$_id.m', 10] }, { $concat: ['0', { $toString: '$_id.m' }] }, { $toString: '$_id.m' } ] } } ] }, count: 1 } },
        { $sort: { month: 1 } }
      ]).then(result => {
        if (userTypeParam !== 'all' && process.env.NODE_ENV === 'development') {
          console.log(`🔍 monthlyRequests result (userType: ${userTypeParam}):`, result);
        }
        return result;
      }),
      // monthlyReturns (นับเฉพาะ items ที่อนุมัติแล้ว) - กรองตาม userType
      ReturnLog.aggregate([
        { $match: returnPeriodMatch },
        { $unwind: '$items' },
        { $match: { 'items.approvalStatus': 'approved' }},
        { $group: { _id: { y: { $year: '$returnDate' }, m: { $month: '$returnDate' } }, count: { $sum: 1 } } },
        { $project: { _id: 0, month: { $concat: [ { $toString: '$_id.y' }, '-', { $toString: { $cond: [ { $lt: ['$_id.m', 10] }, { $concat: ['0', { $toString: '$_id.m' }] }, { $toString: '$_id.m' } ] } } ] }, count: 1 } },
        { $sort: { month: 1 } }
      ]).then(result => {
        if (userTypeParam !== 'all' && process.env.NODE_ENV === 'development') {
          console.log(`🔍 monthlyReturns result (userType: ${userTypeParam}):`, result);
        }
        return result;
      }),
      // issuesByCategory in selected period - กรองตาม userType
      IssueLog.aggregate([
        { $match: issuePeriodFilter() },
        { $group: { _id: '$issueCategory', count: { $sum: 1 } } },
        { $project: { _id: 0, category: { $ifNull: ['$_id', 'อื่นๆ'] }, count: 1 } },
        { $sort: { count: -1 } }
      ]),
      // requestsByUrgency in selected period (นับจำนวน items ที่อนุมัติแล้วเท่านั้น) - กรองตาม userType
      RequestLog.aggregate([
        { $match: requestPeriodMatch },
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
