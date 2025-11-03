import dbConnect from '@/lib/mongodb';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import InventorySnapshot from '@/models/InventorySnapshot';
import InventoryConfig, { ICategoryConfig, IStatusConfig, IConditionConfig } from '@/models/InventoryConfig';
import { getCategoryNameById } from '@/lib/category-helpers';
import IssueLog from '@/models/IssueLog';
import User from '@/models/User';
import { snapshotEquipmentLogsBeforeUserDelete } from '@/lib/equipment-snapshot-helpers';

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

/**
 * สร้าง snapshots สำหรับ inventory items หลายรายการพร้อมกัน
 * ใช้สำหรับบันทึกสถานะของ items เมื่อมีการ assign หรือ return
 * 
 * @param itemIds - Array of item IDs to create snapshots for
 * @returns Array of snapshot objects with item details
 */
export async function createInventoryItemSnapshotsBatch(itemIds: string[]): Promise<Array<{
  itemId: string;
  itemName: string;
  categoryId: string;
  categoryName: string;
  serialNumber?: string;
  numberPhone?: string;
  statusId: string;
  statusName: string;
  conditionId?: string;
  conditionName?: string;
}>> {
  try {
    await dbConnect();

    if (!itemIds || itemIds.length === 0) {
      return [];
    }

    // ดึงข้อมูล inventory items
    const items = await InventoryItem.find({
      _id: { $in: itemIds },
      deletedAt: { $exists: false }
    }).lean();

    if (items.length === 0) {
      return [];
    }

    // ดึงข้อมูล configs สำหรับ lookup ชื่อ
    const config = await InventoryConfig.findOne({}).lean() as any;
    const categoryConfigs: ICategoryConfig[] = config?.categoryConfigs || [];
    const statusConfigs: IStatusConfig[] = config?.statusConfigs || [];
    const conditionConfigs: IConditionConfig[] = config?.conditionConfigs || [];

    // สร้าง lookup maps
    const categoryMap = new Map<string, string>();
    categoryConfigs.forEach(cat => {
      categoryMap.set(cat.id, cat.name);
    });

    const statusMap = new Map<string, string>();
    statusConfigs.forEach(status => {
      statusMap.set(status.id, status.name);
    });

    const conditionMap = new Map<string, string>();
    conditionConfigs.forEach(cond => {
      conditionMap.set(cond.id, cond.name);
    });

    // สร้าง snapshots พร้อม lookup ชื่อจาก maps
    const snapshots = await Promise.all(
      items.map(async (item) => {
        const itemId = item._id?.toString() || '';
        const categoryName = categoryMap.get(item.categoryId) || await getCategoryNameById(item.categoryId).catch(() => 'ไม่ระบุ');
        const statusName = statusMap.get(item.statusId) || item.statusId;
        const conditionName = item.conditionId ? (conditionMap.get(item.conditionId) || item.conditionId) : undefined;

        return {
          itemId,
          itemName: item.itemName,
          categoryId: item.categoryId,
          categoryName: typeof categoryName === 'string' ? categoryName : 'ไม่ระบุ',
          serialNumber: item.serialNumber,
          numberPhone: item.numberPhone,
          statusId: item.statusId,
          statusName,
          conditionId: item.conditionId,
          conditionName
        };
      })
    );

    return snapshots;
  } catch (error: any) {
    console.error('Error creating inventory item snapshots batch:', error);
    // Return empty array on error to prevent breaking the calling code
    return [];
  }
}

/**
 * ตรวจสอบว่าผู้ใช้มีข้อมูลที่เกี่ยวข้องใน IssueLog หรือไม่
 */
export async function checkUserRelatedIssues(userId: string): Promise<{
  hasRelatedIssues: boolean;
  total: number;
  asRequester: number;
  asAdmin: number;
}> {
  try {
    await dbConnect();

    const asRequester = await IssueLog.countDocuments({
      requesterId: userId
    });

    const asAdmin = await IssueLog.countDocuments({
      assignedAdminId: userId
    });

    const total = asRequester + asAdmin;

    return {
      hasRelatedIssues: total > 0,
      total,
      asRequester,
      asAdmin
    };
  } catch (error: any) {
    console.error('Error checking user related issues:', error);
    return {
      hasRelatedIssues: false,
      total: 0,
      asRequester: 0,
      asAdmin: 0
    };
  }
}

/**
 * Snapshot IssueLog ก่อนลบ User
 * - Snapshot ข้อมูลผู้แจ้ง (requester) ในทุก IssueLog ที่ requesterId ตรงกัน
 * - Snapshot ข้อมูลผู้รับงาน (assignedAdmin) ในทุก IssueLog ที่ assignedAdminId ตรงกัน
 */
export async function snapshotIssueLogsBeforeUserDelete(userId: string): Promise<{
  requester: { modifiedCount: number };
  admin: { modifiedCount: number };
}> {
  try {
    await dbConnect();

    // ดึงข้อมูลผู้ใช้เพื่อ snapshot
    const user = await User.findOne({ user_id: userId }).select('userType firstName lastName nickname department office phone email');
    
    if (!user) {
      console.warn(`User ${userId} not found for snapshot`);
      return {
        requester: { modifiedCount: 0 },
        admin: { modifiedCount: 0 }
      };
    }

    let requesterModified = 0;
    let adminModified = 0;

    // Snapshot ข้อมูลผู้แจ้ง (requester) ในทุก IssueLog ที่ requesterId ตรงกัน
    // สำหรับ IssueLog ข้อมูลผู้แจ้งจะถูก snapshot ใน firstName, lastName, nickname, department, office, phone, email
    // ข้อมูลเหล่านี้จะถูก populate จาก User ตอนแสดงผล แต่ตอนลบ User ต้อง snapshot ไว้ก่อน
    if (user.userType === 'individual') {
      // ผู้ใช้บุคคล: Snapshot ทุกข้อมูล
      const requesterResult = await IssueLog.updateMany(
        { requesterId: userId },
        {
          $set: {
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            nickname: user.nickname || '',
            department: user.department || '',
            office: user.office || '',
            phone: user.phone || '',
            email: user.email || ''
          }
        }
      );
      requesterModified = requesterResult.modifiedCount;
    } else if (user.userType === 'branch') {
      // ผู้ใช้สาขา: Snapshot เฉพาะข้อมูลสาขา (office, email)
      // ❌ ไม่แตะ: firstName, lastName, nickname, department, phone
      // เพราะข้อมูลเหล่านี้มาจากฟอร์มที่กรอกแต่ละครั้ง
      const requesterResult = await IssueLog.updateMany(
        { requesterId: userId },
        {
          $set: {
            office: user.office || '',
            email: user.email || ''
          }
        }
      );
      requesterModified = requesterResult.modifiedCount;
    }

    // Snapshot ข้อมูลผู้รับงาน (assignedAdmin) ในทุก IssueLog ที่ assignedAdminId ตรงกัน
    const adminName = user.userType === 'individual' 
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.nickname || ''
      : user.office || '';
    
    const adminEmail = user.email || '';

    const adminResult = await IssueLog.updateMany(
      { assignedAdminId: userId },
      {
        $set: {
          'assignedAdmin.name': adminName,
          'assignedAdmin.email': adminEmail
        }
      }
    );
    adminModified = adminResult.modifiedCount;

    // Snapshot ใน notesHistory ด้วย (ถ้ามี adminId ที่ตรงกัน)
    const notesHistoryResult = await IssueLog.updateMany(
      { 'notesHistory.adminId': userId },
      {
        $set: {
          'notesHistory.$[elem].adminName': adminName
        }
      },
      {
        arrayFilters: [{ 'elem.adminId': userId }]
      }
    );
    adminModified += notesHistoryResult.modifiedCount;

    console.log(`📸 Snapshot IssueLogs for user ${userId}:`);
    console.log(`   - Requester: ${requesterModified} issues`);
    console.log(`   - Admin: ${adminModified} issues`);

    return {
      requester: { modifiedCount: requesterModified },
      admin: { modifiedCount: adminModified }
    };
  } catch (error: any) {
    console.error('Error snapshotting IssueLogs before user delete:', error);
    return {
      requester: { modifiedCount: 0 },
      admin: { modifiedCount: 0 }
    };
  }
}

/**
 * Snapshot ทุก Logs ก่อนลบ User
 * - Snapshot Equipment Logs (RequestLog, ReturnLog, TransferLog)
 * - Snapshot IssueLog (Requester และ Admin)
 */
export async function snapshotUserBeforeDelete(userId: string): Promise<{
  success: boolean;
  equipment?: {
    requestLogs: any;
    returnLogs: any;
    transferLogs: any;
  };
  issues?: {
    requester: { modifiedCount: number };
    admin: { modifiedCount: number };
  };
}> {
  try {
    await dbConnect();

    console.log(`📸 Starting snapshot for user ${userId}...`);

    // Snapshot Equipment Logs (RequestLog, ReturnLog, TransferLog)
    const equipmentResults = await snapshotEquipmentLogsBeforeUserDelete(userId);

    // Snapshot IssueLog
    const issueResults = await snapshotIssueLogsBeforeUserDelete(userId);

    console.log(`✅ Snapshot completed for user ${userId}:`);
    console.log(`   - RequestLogs: ${equipmentResults.requestLogs.modifiedCount || 0}`);
    console.log(`   - ReturnLogs: ${equipmentResults.returnLogs.modifiedCount || 0}`);
    console.log(`   - TransferLogs: ${equipmentResults.transferLogs.modifiedCount || 0}`);
    console.log(`   - IssueLogs (Requester): ${issueResults.requester.modifiedCount}`);
    console.log(`   - IssueLogs (Admin): ${issueResults.admin.modifiedCount}`);

    return {
      success: true,
      equipment: equipmentResults,
      issues: issueResults
    };
  } catch (error: any) {
    console.error('Error snapshotting user before delete:', error);
    return {
      success: false,
      equipment: {
        requestLogs: { modifiedCount: 0 },
        returnLogs: { modifiedCount: 0 },
        transferLogs: { modifiedCount: 0 }
      },
      issues: {
        requester: { modifiedCount: 0 },
        admin: { modifiedCount: 0 }
      }
    };
  }
}

/**
 * อัพเดต snapshots ใน RequestLog ก่อนลบ InventoryItem
 * - อัพเดต assignedItemSnapshots ให้เป็นข้อมูลล่าสุดก่อนลบ item
 * - ใช้เมื่อลบ InventoryItem เพื่อให้ RequestLog ยังคงมีข้อมูล snapshot ที่ถูกต้อง
 */
export async function updateSnapshotsBeforeDelete(itemId: string): Promise<{
  success: boolean;
  updatedRequestLogs: number;
  error?: string;
}> {
  try {
    await dbConnect();

    // ดึงข้อมูล InventoryItem ที่จะลบ
    const item = await InventoryItem.findById(itemId).lean();
    if (!item) {
      return {
        success: false,
        updatedRequestLogs: 0,
        error: 'InventoryItem not found'
      };
    }

    // ดึงข้อมูล configs สำหรับ lookup ชื่อ
    const config = await InventoryConfig.findOne({}).lean() as any;
    const categoryConfigs: ICategoryConfig[] = config?.categoryConfigs || [];
    const statusConfigs: IStatusConfig[] = config?.statusConfigs || [];
    const conditionConfigs: IConditionConfig[] = config?.conditionConfigs || [];

    // สร้าง lookup maps
    const categoryMap = new Map<string, string>();
    categoryConfigs.forEach(cat => {
      categoryMap.set(cat.id, cat.name);
    });

    const statusMap = new Map<string, string>();
    statusConfigs.forEach(status => {
      statusMap.set(status.id, status.name);
    });

    const conditionMap = new Map<string, string>();
    conditionConfigs.forEach(cond => {
      conditionMap.set(cond.id, cond.name);
    });

    // สร้าง snapshot object
    let categoryName = categoryMap.get(item.categoryId);
    if (!categoryName) {
      categoryName = await getCategoryNameById(item.categoryId).catch(() => 'ไม่ระบุ');
    }
    const statusName = statusMap.get(item.statusId) || item.statusId;
    const conditionName = item.conditionId ? (conditionMap.get(item.conditionId) || item.conditionId) : undefined;

    const snapshot: {
      itemId: string;
      itemName: string;
      categoryId: string;
      categoryName: string;
      serialNumber?: string;
      numberPhone?: string;
      statusId?: string;
      statusName?: string;
      conditionId?: string;
      conditionName?: string;
    } = {
      itemId: String(item._id),
      itemName: item.itemName,
      categoryId: item.categoryId,
      categoryName: categoryName || 'ไม่ระบุ',
      serialNumber: item.serialNumber,
      numberPhone: item.numberPhone,
      statusId: item.statusId,
      statusName,
      conditionId: item.conditionId,
      conditionName
    };

    // อัพเดต assignedItemSnapshots ใน RequestLog ที่มี itemId ตรงกัน
    const requestLogs = await RequestLog.find({
      'items.assignedItemSnapshots.itemId': itemId
    });

    let updatedCount = 0;

    for (const requestLog of requestLogs) {
      let modified = false;
      
      // อัพเดต snapshot ในแต่ละ item
      for (const requestItem of requestLog.items) {
        if (requestItem.assignedItemSnapshots && Array.isArray(requestItem.assignedItemSnapshots)) {
          const snapshotIndex = requestItem.assignedItemSnapshots.findIndex(
            (s: any) => s.itemId === itemId
          );
          
          if (snapshotIndex !== -1) {
            // อัพเดต snapshot ที่มีอยู่แล้ว
            requestItem.assignedItemSnapshots[snapshotIndex] = snapshot;
            modified = true;
          }
        }
      }

      if (modified) {
        (requestLog as any).markModified('items');
        await requestLog.save();
        updatedCount++;
      }
    }

    console.log(`📸 Updated ${updatedCount} RequestLog(s) with snapshot for item ${itemId}`);

    return {
      success: true,
      updatedRequestLogs: updatedCount
    };
  } catch (error: any) {
    console.error('Error updating snapshots before delete:', error);
    return {
      success: false,
      updatedRequestLogs: 0,
      error: error.message || 'เกิดข้อผิดพลาดในการอัพเดต snapshots'
    };
  }
}
