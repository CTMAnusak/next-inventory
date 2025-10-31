import dbConnect from '@/lib/mongodb';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import InventorySnapshot from '@/models/InventorySnapshot';

/**
 * Helper function สำหรับสร้าง snapshot สำหรับเดือน/ปีที่ระบุ
 * แยกออกมาเพื่อให้สามารถเรียกใช้ได้จากหลายที่
 */
export async function createSnapshotForMonth(thaiYear: number, month: number) {
  try {
    await dbConnect();

    // คำนวณวันแรกและวันสุดท้ายของเดือน
    const startDate = new Date(thaiYear - 543, month - 1, 1, 0, 0, 0);
    const endDate = new Date(thaiYear - 543, month, 0, 23, 59, 59);
    const snapshotDate = endDate;

    // ดึงข้อมูลจาก InventoryMaster ทั้งหมด
    const allMasters = await InventoryMaster.find({
      relatedItemIds: { $exists: true, $ne: [] }
    }).lean();

    // ดึงประวัติการเบิก-คืนที่อนุมัติแล้วในเดือนนั้น
    const requestLogs = await RequestLog.find({
      status: { $in: ['approved', 'completed'] },
      approvedAt: { $gte: startDate, $lte: endDate }
    }).sort({ approvedAt: 1 }).lean();

    const returnLogs = await ReturnLog.find({
      items: {
        $elemMatch: {
          approvalStatus: 'approved',
          approvedAt: { $gte: startDate, $lte: endDate }
        }
      }
    }).sort({ returnDate: 1 }).lean();

    // สร้าง map สำหรับเก็บข้อมูลแต่ละ item
    interface ItemState {
      itemName: string;
      categoryId: string;
      initialAvailableQty: number;
      initialTotalQty: number;
      initialUserOwnedQty: number;
      hasLowStockPeriod: boolean;
      minAvailableQty: number;
    }

    const itemStateMap = new Map<string, ItemState>();

    // คำนวณสถานะเริ่มต้นของเดือน (วันที่ 1 ของเดือน 00:00:00)
    const initialItems = await InventoryItem.find({
      deletedAt: { $exists: false },
      createdAt: { $lte: startDate },
      itemName: { $in: allMasters.map(m => m.itemName) },
      categoryId: { $in: allMasters.map(m => m.categoryId) }
    }).lean();

    // คำนวณจำนวนที่เบิกไปก่อนเดือนนี้ (อนุมัติแล้วและยังไม่คืน ณ วันที่เริ่มเดือน)
    const preMonthEndDate = new Date(thaiYear - 543, month - 1, 0, 23, 59, 59);
    
    const preMonthRequests = await RequestLog.aggregate([
      {
        $match: {
          status: { $in: ['approved', 'completed'] },
          approvedAt: { $lte: preMonthEndDate }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            masterId: '$items.masterId',
            itemName: '$items.itemName',
            categoryId: '$items.categoryId'
          },
          totalRequested: { $sum: '$items.quantity' }
        }
      }
    ]);

    const preMonthReturns = await ReturnLog.aggregate([
      {
        $match: {
          'items.approvalStatus': 'approved',
          'items.approvedAt': { $lte: preMonthEndDate }
        }
      },
      { $unwind: '$items' },
      {
        $match: {
          'items.approvalStatus': 'approved',
          'items.approvedAt': { $lte: preMonthEndDate }
        }
      },
      {
        $lookup: {
          from: 'inventoryitems',
          localField: 'items.itemId',
          foreignField: '_id',
          as: 'itemInfo'
        }
      },
      { $unwind: '$itemInfo' },
      {
        $group: {
          _id: {
            itemName: '$itemInfo.itemName',
            categoryId: '$itemInfo.categoryId'
          },
          totalReturned: { $sum: '$items.quantity' }
        }
      }
    ]);

    const preRequestMap = new Map<string, number>();
    const preReturnMap = new Map<string, number>();

    for (const req of preMonthRequests) {
      const key = `${req._id.itemName}||${req._id.categoryId}`;
      preRequestMap.set(key, req.totalRequested);
    }

    for (const ret of preMonthReturns) {
      const key = `${ret._id.itemName}||${ret._id.categoryId}`;
      preReturnMap.set(key, ret.totalReturned);
    }

    // คำนวณสถานะเริ่มต้นของแต่ละ master
    for (const master of allMasters) {
      const key = `${master.itemName}||${master.categoryId}`;
      
      const initialAvailableItems = initialItems.filter(item => 
        item.itemName === master.itemName &&
        item.categoryId === master.categoryId &&
        item.currentOwnership?.ownerType === 'admin_stock' &&
        item.statusId === 'status_available' &&
        item.conditionId === 'cond_working'
      );

      const initialTotalItems = initialItems.filter(item => 
        item.itemName === master.itemName &&
        item.categoryId === master.categoryId
      );

      const initialUserOwnedItems = initialItems.filter(item => 
        item.itemName === master.itemName &&
        item.categoryId === master.categoryId &&
        item.currentOwnership?.ownerType === 'user_owned'
      );

      const totalRequested = preRequestMap.get(key) || 0;
      const totalReturned = preReturnMap.get(key) || 0;
      const outstandingLoans = totalRequested - totalReturned;

      const initialAvailableQty = Math.max(0, initialAvailableItems.length - outstandingLoans);
      
      itemStateMap.set(key, {
        itemName: master.itemName,
        categoryId: master.categoryId,
        initialAvailableQty,
        initialTotalQty: initialTotalItems.length,
        initialUserOwnedQty: initialUserOwnedItems.length,
        hasLowStockPeriod: initialAvailableQty <= 2,
        minAvailableQty: initialAvailableQty
      });
    }

    // ประมวลผลการเบิก-คืนในเดือนนั้นตามลำดับเวลา
    const events: Array<{ date: Date; type: 'request' | 'return'; itemName: string; categoryId: string; quantity: number }> = [];

    for (const requestLog of requestLogs) {
      for (const item of requestLog.items || []) {
        const master = allMasters.find(m => m._id.toString() === item.masterId);
        if (master && requestLog.approvedAt) {
          events.push({
            date: new Date(requestLog.approvedAt),
            type: 'request',
            itemName: master.itemName,
            categoryId: master.categoryId,
            quantity: item.quantity || 0
          });
        }
      }
    }

    for (const returnLog of returnLogs) {
      for (const item of returnLog.items || []) {
        if (item.approvalStatus === 'approved' && item.approvedAt) {
          const master = allMasters.find(m => 
            m.relatedItemIds.includes(item.itemId) || 
            (item.itemName && m.itemName === item.itemName && m.categoryId === item.categoryId)
          );
          if (master) {
            events.push({
              date: new Date(item.approvedAt),
              type: 'return',
              itemName: master.itemName,
              categoryId: master.categoryId,
              quantity: item.quantity || 0
            });
          }
        }
      }
    }

    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const event of events) {
      const key = `${event.itemName}||${event.categoryId}`;
      const state = itemStateMap.get(key);
      
      if (state) {
        if (event.type === 'request') {
          state.initialAvailableQty = Math.max(0, state.initialAvailableQty - event.quantity);
        } else if (event.type === 'return') {
          state.initialAvailableQty = state.initialAvailableQty + event.quantity;
        }
        
        if (state.initialAvailableQty < state.minAvailableQty) {
          state.minAvailableQty = state.initialAvailableQty;
        }
        if (state.initialAvailableQty <= 2) {
          state.hasLowStockPeriod = true;
        }
      }
    }

    // คำนวณ totalQuantity จาก InventoryItem ที่มีอยู่ในวันสุดท้ายของเดือน
    const finalItems = await InventoryItem.find({
      deletedAt: { $exists: false },
      createdAt: { $lte: endDate },
      itemName: { $in: allMasters.map(m => m.itemName) },
      categoryId: { $in: allMasters.map(m => m.categoryId) }
    }).lean();

    let totalInventoryItems = 0;
    let totalInventoryCount = 0;
    let lowStockItems = 0;
    const itemDetails: Array<{
      itemName: string;
      categoryId: string;
      totalQuantity: number;
      availableQuantity: number;
      userOwnedQuantity: number;
      isLowStock: boolean;
    }> = [];

    for (const master of allMasters) {
      const key = `${master.itemName}||${master.categoryId}`;
      const state = itemStateMap.get(key);
      
      const finalTotalItems = finalItems.filter(item => 
        item.itemName === master.itemName &&
        item.categoryId === master.categoryId
      );

      const finalUserOwnedItems = finalItems.filter(item => 
        item.itemName === master.itemName &&
        item.categoryId === master.categoryId &&
        item.currentOwnership?.ownerType === 'user_owned'
      );
      
      totalInventoryItems++;
      totalInventoryCount += finalTotalItems.length;
      
      const finalAvailableQty = state ? state.initialAvailableQty : (master.availableQuantity || 0);
      const isLowStock = state ? state.hasLowStockPeriod : ((master.availableQuantity || 0) <= 2);
      
      if (isLowStock) {
        lowStockItems++;
      }

      itemDetails.push({
        itemName: master.itemName,
        categoryId: master.categoryId,
        totalQuantity: finalTotalItems.length,
        availableQuantity: finalAvailableQty,
        userOwnedQuantity: finalUserOwnedItems.length,
        isLowStock
      });
    }

    // สร้างหรืออัปเดต snapshot
    const snapshot = await InventorySnapshot.findOneAndUpdate(
      { year: thaiYear, month },
      {
        $set: {
          year: thaiYear,
          month,
          snapshotDate,
          totalInventoryItems,
          totalInventoryCount,
          lowStockItems,
          itemDetails,
          updatedAt: new Date()
        }
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    return {
      success: true,
      snapshot: {
        year: snapshot.year,
        month: snapshot.month,
        snapshotDate: snapshot.snapshotDate,
        totalInventoryItems: snapshot.totalInventoryItems,
        totalInventoryCount: snapshot.totalInventoryCount,
        lowStockItems: snapshot.lowStockItems,
        updatedAt: snapshot.updatedAt
      }
    };
  } catch (error: any) {
    console.error('Error creating snapshot:', error);
    return {
      success: false,
      error: error.message || 'เกิดข้อผิดพลาดในการสร้าง snapshot'
    };
  }
}
