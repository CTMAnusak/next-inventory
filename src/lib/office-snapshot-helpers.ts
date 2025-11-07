import dbConnect from '@/lib/mongodb';
import Office from '@/models/Office';
import User from '@/models/User';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import IssueLog from '@/models/IssueLog';
import InventoryItem from '@/models/InventoryItem';
import DeletedUser from '@/models/DeletedUser';
import TransferLog from '@/models/TransferLog';
import { getOfficeNameById } from './office-helpers';

/**
 * =========================================
 * OFFICE SNAPSHOT HELPERS
 * =========================================
 */

/**
 * Snapshot Office Name ก่อนลบ Office
 * - อัพเดตชื่อ office ในทุกที่ที่อ้างอิง
 * - ใช้เมื่อลบ office เพื่อให้ข้อมูลประวัติยังคงแสดงชื่อ office ได้
 */
export async function snapshotOfficeBeforeDelete(officeId: string): Promise<{
  success: boolean;
  updated: {
    users: number;
    requestLogs: number;
    returnLogs: number;
    issueLogs: number;
    inventoryItems: number;
    deletedUsers: number;
  };
  error?: string;
}> {
  try {
    await dbConnect();
    
    // ดึงข้อมูล office ก่อนลบ
    const office = await Office.findOne({ office_id: officeId });
    if (!office) {
      return {
        success: false,
        updated: {
          users: 0,
          requestLogs: 0,
          returnLogs: 0,
          issueLogs: 0,
          inventoryItems: 0,
          deletedUsers: 0
        },
        error: 'Office not found'
      };
    }
    
    const officeName = office.name;
    let updatedCounts = {
      users: 0,
      requestLogs: 0,
      returnLogs: 0,
      issueLogs: 0,
      inventoryItems: 0,
      deletedUsers: 0
    };
    
    // 1. Snapshot ใน User Collection
    const userResult = await User.updateMany(
      { officeId: officeId },
      {
        $set: {
          office: officeName,
          officeName: officeName
        }
      }
    );
    updatedCounts.users = userResult.modifiedCount;
    
    // 🆕 หา userId ทั้งหมดที่ใช้สาขานี้ (เพื่อ snapshot ประวัติทั้งหมดของผู้ใช้)
    const usersWithOffice = await User.find({ officeId: officeId }).select('user_id');
    const userIds = usersWithOffice.map((u: any) => u.user_id);
    
    console.log(`📸 Found ${userIds.length} users with office "${officeName}"`);
    
    // 2. Snapshot ใน RequestLog
    // ⚠️ สำคัญ: Snapshot ทั้งประวัติที่มี requesterOfficeId = officeId 
    // และประวัติทั้งหมดของผู้ใช้ที่อยู่สาขานี้ (ไม่ว่า requesterOfficeId จะเป็นอะไร)
    let requestLogResult;
    if (userIds.length > 0) {
      requestLogResult = await RequestLog.updateMany(
        {
          $or: [
            { requesterOfficeId: officeId },
            { userId: { $in: userIds } }
          ]
        },
        {
          $set: {
            requesterOffice: officeName,
            requesterOfficeName: officeName
          }
        }
      );
    } else {
      // ถ้าไม่มี user ให้ snapshot เฉพาะที่มี requesterOfficeId = officeId
      requestLogResult = await RequestLog.updateMany(
        { requesterOfficeId: officeId },
        {
          $set: {
            requesterOffice: officeName,
            requesterOfficeName: officeName
          }
        }
      );
    }
    updatedCounts.requestLogs = requestLogResult.modifiedCount;
    
    // 3. Snapshot ใน ReturnLog
    // ⚠️ สำคัญ: Snapshot ทั้งประวัติที่มี returnerOfficeId = officeId 
    // และประวัติทั้งหมดของผู้ใช้ที่อยู่สาขานี้ (ไม่ว่า returnerOfficeId จะเป็นอะไร)
    let returnLogResult;
    if (userIds.length > 0) {
      returnLogResult = await ReturnLog.updateMany(
        {
          $or: [
            { returnerOfficeId: officeId },
            { userId: { $in: userIds } }
          ]
        },
        {
          $set: {
            returnerOffice: officeName,
            returnerOfficeName: officeName
          }
        }
      );
    } else {
      // ถ้าไม่มี user ให้ snapshot เฉพาะที่มี returnerOfficeId = officeId
      returnLogResult = await ReturnLog.updateMany(
        { returnerOfficeId: officeId },
        {
          $set: {
            returnerOffice: officeName,
            returnerOfficeName: officeName
          }
        }
      );
    }
    updatedCounts.returnLogs = returnLogResult.modifiedCount;
    
    // 4. Snapshot ใน IssueLog
    // ⚠️ สำคัญ: Snapshot ทั้งประวัติที่มี officeId = officeId 
    // และประวัติทั้งหมดของผู้ใช้ที่อยู่สาขานี้ (ไม่ว่า officeId จะเป็นอะไร)
    let issueLogResult;
    if (userIds.length > 0) {
      issueLogResult = await IssueLog.updateMany(
        {
          $or: [
            { officeId: officeId },
            { userId: { $in: userIds } }
          ]
        },
        {
          $set: {
            office: officeName,
            officeName: officeName
          }
        }
      );
    } else {
      // ถ้าไม่มี user ให้ snapshot เฉพาะที่มี officeId = officeId
      issueLogResult = await IssueLog.updateMany(
        { officeId: officeId },
        {
          $set: {
            office: officeName,
            officeName: officeName
          }
        }
      );
    }
    updatedCounts.issueLogs = issueLogResult.modifiedCount;
    
    // 5. Snapshot ใน InventoryItem (requesterInfo)
    // ⚠️ สำคัญ: Snapshot ทั้งอุปกรณ์ที่มี requesterInfo.officeId = officeId 
    // และอุปกรณ์ทั้งหมดของผู้ใช้ที่อยู่สาขานี้ (ไม่ว่า requesterInfo.officeId จะเป็นอะไร)
    let inventoryItemResult;
    if (userIds.length > 0) {
      inventoryItemResult = await InventoryItem.updateMany(
        {
          $or: [
            { 'requesterInfo.officeId': officeId },
            { 'currentOwnership.userId': { $in: userIds } }
          ]
        },
        {
          $set: {
            'requesterInfo.office': officeName,
            'requesterInfo.officeName': officeName
          }
        }
      );
    } else {
      // ถ้าไม่มี user ให้ snapshot เฉพาะที่มี requesterInfo.officeId = officeId
      inventoryItemResult = await InventoryItem.updateMany(
        { 'requesterInfo.officeId': officeId },
        {
          $set: {
            'requesterInfo.office': officeName,
            'requesterInfo.officeName': officeName
          }
        }
      );
    }
    updatedCounts.inventoryItems = inventoryItemResult.modifiedCount;
    
    // 6. Snapshot ใน DeletedUser
    const deletedUserResult = await DeletedUser.updateMany(
      { officeId: officeId },
      {
        $set: {
          office: officeName,
          officeName: officeName
        }
      }
    );
    updatedCounts.deletedUsers = deletedUserResult.modifiedCount;
    
    console.log(`📸 Snapshot Office "${officeName}" (${officeId}) completed:`, updatedCounts);
    
    return {
      success: true,
      updated: updatedCounts
    };
  } catch (error: any) {
    console.error('Error snapshotting office before delete:', error);
    return {
      success: false,
      updated: {
        users: 0,
        requestLogs: 0,
        returnLogs: 0,
        issueLogs: 0,
        inventoryItems: 0,
        deletedUsers: 0
      },
      error: error.message || 'เกิดข้อผิดพลาดในการ snapshot office'
    };
  }
}

/**
 * ตรวจสอบว่ามีการใช้งาน Office อยู่หรือไม่
 * @param officeId - Office ID ที่ต้องการตรวจสอบ
 * @returns Object ที่บอกว่ามีการใช้งานในที่ไหนบ้าง
 */
export async function checkOfficeUsage(officeId: string): Promise<{
  isUsed: boolean;
  usage: {
    users: number;
    requestLogs: number;
    returnLogs: number;
    issueLogs: number;
    inventoryItems: number;
  };
}> {
  try {
    await dbConnect();
    
    const [users, requestLogs, returnLogs, issueLogs, inventoryItems] = await Promise.all([
      User.countDocuments({ officeId: officeId }),
      RequestLog.countDocuments({ requesterOfficeId: officeId }),
      ReturnLog.countDocuments({ returnerOfficeId: officeId }),
      IssueLog.countDocuments({ officeId: officeId }),
      InventoryItem.countDocuments({ 'requesterInfo.officeId': officeId })
    ]);
    
    const totalUsage = users + requestLogs + returnLogs + issueLogs + inventoryItems;
    
    return {
      isUsed: totalUsage > 0,
      usage: {
        users,
        requestLogs,
        returnLogs,
        issueLogs,
        inventoryItems
      }
    };
  } catch (error: any) {
    console.error('Error checking office usage:', error);
    return {
      isUsed: false,
      usage: {
        users: 0,
        requestLogs: 0,
        returnLogs: 0,
        issueLogs: 0,
        inventoryItems: 0
      }
    };
  }
}

/**
 * อัพเดต Office Name ในทุกที่ที่อ้างอิง (เมื่อแก้ไขชื่อ office)
 * @param officeId - Office ID
 * @param newName - ชื่อใหม่
 */
export async function updateOfficeNameInAllReferences(
  officeId: string,
  newName: string
): Promise<{
  success: boolean;
  updated: {
    users: number;
    requestLogs: number;
    returnLogs: number;
    issueLogs: number;
    inventoryItems: number;
    deletedUsers: number;
  };
  error?: string;
}> {
  try {
    await dbConnect();
    
    let updatedCounts = {
      users: 0,
      requestLogs: 0,
      returnLogs: 0,
      issueLogs: 0,
      inventoryItems: 0,
      deletedUsers: 0
    };
    
    // 1. อัพเดตใน User Collection
    const userResult = await User.updateMany(
      { officeId: officeId },
      {
        $set: {
          office: newName,
          officeName: newName
        }
      }
    );
    updatedCounts.users = userResult.modifiedCount;
    
    // 2. อัพเดตใน RequestLog
    const requestLogResult = await RequestLog.updateMany(
      { requesterOfficeId: officeId },
      {
        $set: {
          requesterOffice: newName,
          requesterOfficeName: newName
        }
      }
    );
    updatedCounts.requestLogs = requestLogResult.modifiedCount;
    
    // 3. อัพเดตใน ReturnLog
    const returnLogResult = await ReturnLog.updateMany(
      { returnerOfficeId: officeId },
      {
        $set: {
          returnerOffice: newName,
          returnerOfficeName: newName
        }
      }
    );
    updatedCounts.returnLogs = returnLogResult.modifiedCount;
    
    // 4. อัพเดตใน IssueLog
    const issueLogResult = await IssueLog.updateMany(
      { officeId: officeId },
      {
        $set: {
          office: newName,
          officeName: newName
        }
      }
    );
    updatedCounts.issueLogs = issueLogResult.modifiedCount;
    
    // 5. อัพเดตใน InventoryItem (requesterInfo)
    const inventoryItemResult = await InventoryItem.updateMany(
      { 'requesterInfo.officeId': officeId },
      {
        $set: {
          'requesterInfo.office': newName,
          'requesterInfo.officeName': newName
        }
      }
    );
    updatedCounts.inventoryItems = inventoryItemResult.modifiedCount;
    
    // 6. อัพเดตใน DeletedUser
    const deletedUserResult = await DeletedUser.updateMany(
      { officeId: officeId },
      {
        $set: {
          office: newName,
          officeName: newName
        }
      }
    );
    updatedCounts.deletedUsers = deletedUserResult.modifiedCount;
    
    console.log(`✅ Updated Office Name "${newName}" (${officeId}) in all references:`, updatedCounts);
    
    return {
      success: true,
      updated: updatedCounts
    };
  } catch (error: any) {
    console.error('Error updating office name in all references:', error);
    return {
      success: false,
      updated: {
        users: 0,
        requestLogs: 0,
        returnLogs: 0,
        issueLogs: 0,
        inventoryItems: 0,
        deletedUsers: 0
      },
      error: error.message || 'เกิดข้อผิดพลาดในการอัพเดตชื่อ office'
    };
  }
}

