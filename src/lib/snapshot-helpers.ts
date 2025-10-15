import User from '@/models/User';
import IssueLog from '@/models/IssueLog';
import {
  snapshotEquipmentLogsBeforeUserDelete,
  checkUserRelatedEquipmentLogs
} from '@/lib/equipment-snapshot-helpers';

/**
 * Snapshot ข้อมูลล่าสุดก่อนลบ User (Requester)
 * ใช้เมื่อต้องการลบ User ออกจากระบบ
 */
export async function snapshotRequesterBeforeDelete(userId: string) {
  try {
    // 1. ดึงข้อมูลล่าสุดจาก User Collection
    const user = await User.findOne({ user_id: userId });
    
    if (!user) {
      console.warn(`User ${userId} not found for snapshot`);
      return { success: false, error: 'User not found' };
    }

    // 2. เตรียมข้อมูล Snapshot ตามประเภทผู้ใช้
    const snapshotData: any = {
      office: user.office, // ทั้ง individual และ branch มี office
    };

    if (user.userType === 'individual') {
      snapshotData.firstName = user.firstName;
      snapshotData.lastName = user.lastName;
      snapshotData.nickname = user.nickname;
      snapshotData.department = user.department;
      snapshotData.phone = user.phone;
      snapshotData.email = user.email;
    }
    // สำหรับ branch user: firstName, lastName ฯลฯ ใช้ที่กรอกในฟอร์มอยู่แล้ว
    // แต่ office ต้องอัพเดทเป็นล่าสุด

    // 3. อัพเดท Snapshot ในทุก Issue ที่ user เป็นผู้แจ้ง
    const updateResult = await IssueLog.updateMany(
      { requesterId: userId },
      { $set: snapshotData }
    );

    console.log(`✅ Snapshot ${updateResult.modifiedCount} issues for user ${userId}`);

    // 4. ลบ requesterId และ officeId (ไม่ populate อีกต่อไป)
    await IssueLog.updateMany(
      { requesterId: userId },
      { 
        $unset: { 
          requesterId: "",
          officeId: ""
        }
      }
    );

    return { 
      success: true, 
      modifiedCount: updateResult.modifiedCount,
      userData: snapshotData
    };
  } catch (error) {
    console.error('Error snapshotting requester:', error);
    return { success: false, error };
  }
}

/**
 * Snapshot ข้อมูลล่าสุดก่อนลบ IT Admin
 * ใช้เมื่อต้องการลบ IT Admin ออกจากระบบ
 */
export async function snapshotAdminBeforeDelete(adminId: string) {
  try {
    // 1. ดึงข้อมูลล่าสุดจาก User Collection
    const admin = await User.findOne({ user_id: adminId });
    
    if (!admin) {
      console.warn(`Admin ${adminId} not found for snapshot`);
      return { success: false, error: 'Admin not found' };
    }

    // 2. เตรียมข้อมูล Snapshot
    const adminName = admin.userType === 'individual'
      ? `${admin.firstName} ${admin.lastName}`.trim()
      : admin.office;

    // 3. อัพเดท Snapshot ในทุก Issue ที่ admin รับผิดชอบ
    const updateResult = await IssueLog.updateMany(
      { assignedAdminId: adminId },
      { 
        $set: {
          'assignedAdmin.name': adminName,
          'assignedAdmin.email': admin.email
        }
      }
    );

    console.log(`✅ Snapshot ${updateResult.modifiedCount} issues for admin ${adminId}`);

    // 4. ลบ assignedAdminId (ไม่ populate อีกต่อไป)
    await IssueLog.updateMany(
      { assignedAdminId: adminId },
      { $unset: { assignedAdminId: "" } }
    );

    return { 
      success: true, 
      modifiedCount: updateResult.modifiedCount,
      adminData: { name: adminName, email: admin.email }
    };
  } catch (error) {
    console.error('Error snapshotting admin:', error);
    return { success: false, error };
  }
}

/**
 * Snapshot ทั้ง Requester และ Admin ที่เกี่ยวข้องกับ User (IssueLog)
 * และ Equipment Logs (RequestLog, ReturnLog, TransferLog)
 * ใช้เมื่อลบ User ที่อาจเป็นทั้งผู้แจ้งและ Admin
 * 
 * ⚠️ NOTE: ฟังก์ชันนี้ Snapshot ทั้ง Requester และ Admin
 * เพราะ User อาจเป็นทั้งผู้แจ้งงานและ IT Admin
 */
export async function snapshotUserBeforeDelete(userId: string) {
  const results = {
    issueLog: {
      requester: { success: false, modifiedCount: 0 },
      admin: { success: false, modifiedCount: 0 }
    },
    equipmentLogs: {
      requestLogs: { success: false, modifiedCount: 0 },
      returnLogs: { success: false, modifiedCount: 0 },
      transferLogs: { success: false, modifiedCount: 0 }
    }
  };

  // 1. Snapshot IssueLog (ระบบแจ้งงาน IT)
  // Snapshot เป็น Requester
  const requesterResult = await snapshotRequesterBeforeDelete(userId);
  if (requesterResult.success) {
    results.issueLog.requester = {
      success: true,
      modifiedCount: requesterResult.modifiedCount || 0
    };
  }

  // Snapshot เป็น Admin (เฉพาะกรณีที่ User นี้เป็น Admin ด้วย)
  const adminResult = await snapshotAdminBeforeDelete(userId);
  if (adminResult.success) {
    results.issueLog.admin = {
      success: true,
      modifiedCount: adminResult.modifiedCount || 0
    };
  }

  // 2. Snapshot Equipment Logs (ระบบเบิก/คืน/โอนย้ายอุปกรณ์)
  const equipmentResult = await snapshotEquipmentLogsBeforeUserDelete(userId);
  if (equipmentResult.requestLogs.success) {
    results.equipmentLogs.requestLogs = {
      success: true,
      modifiedCount: equipmentResult.requestLogs.modifiedCount || 0
    };
  }
  if (equipmentResult.returnLogs.success) {
    results.equipmentLogs.returnLogs = {
      success: true,
      modifiedCount: equipmentResult.returnLogs.modifiedCount || 0
    };
  }
  if (equipmentResult.transferLogs.success) {
    results.equipmentLogs.transferLogs = {
      success: true,
      modifiedCount: equipmentResult.transferLogs.modifiedCount || 0
    };
  }

  return results;
}

/**
 * ตรวจสอบว่า User มีข้อมูลที่เกี่ยวข้องใน IssueLog และ Equipment Logs หรือไม่
 */
export async function checkUserRelatedIssues(userId: string) {
  // IssueLog (ระบบแจ้งงาน IT)
  const asRequester = await IssueLog.countDocuments({ requesterId: userId });
  const asAdmin = await IssueLog.countDocuments({ assignedAdminId: userId });
  
  // Equipment Logs (ระบบเบิก/คืน/โอนย้าย)
  const equipmentLogs = await checkUserRelatedEquipmentLogs(userId);
  
  return {
    issueLog: {
      asRequester,
      asAdmin,
      total: asRequester + asAdmin
    },
    equipmentLogs: {
      requestLogs: equipmentLogs.requestLogs,
      returnLogs: equipmentLogs.returnLogs,
      transferLogs: equipmentLogs.transferLogs,
      total: equipmentLogs.total
    },
    grandTotal: asRequester + asAdmin + equipmentLogs.total,
    hasRelatedIssues: (asRequester + asAdmin + equipmentLogs.total) > 0
  };
}

