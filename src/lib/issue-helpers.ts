import User from '@/models/User';
import { getOfficeNameById } from '@/lib/office-helpers'; // 🆕 Import helper function

/**
 * Populate IT Admin information from User collection
 * - ถ้ามี assignedAdminId: Populate ข้อมูลล่าสุดจาก User
 * - ถ้าไม่มี assignedAdminId (ถูกลบแล้ว): ใช้ Snapshot
 */
export async function populateAdminInfo(issue: any) {
  if (!issue) return null;

  const issueObj = issue.toObject ? issue.toObject() : issue;

  // ถ้าไม่มี assignedAdminId = Admin ถูกลบแล้ว → ใช้ Snapshot
  if (!issue.assignedAdminId) {
    return issueObj;
  }

  // มี assignedAdminId = ยัง populate ได้
  try {
    const admin = await User.findOne({ user_id: issue.assignedAdminId }).select(
      'firstName lastName office officeId officeName email userType user_id'
    );

    if (!admin) {
      // ✅ Admin ไม่พบ → ค้นหาจาก DeletedUsers collection
      const DeletedUsers = (await import('@/models/DeletedUser')).default;
      const deletedAdmin = await DeletedUsers.findOne({ user_id: issue.assignedAdminId }).select(
        'firstName lastName office officeId officeName email userType user_id'
      );
      
      if (deletedAdmin) {
        // 🆕 Populate office name จาก officeId หรือ officeName
        let adminOffice = deletedAdmin.officeName || deletedAdmin.office || '';
        if (!adminOffice && deletedAdmin.officeId) {
          try {
            adminOffice = await getOfficeNameById(deletedAdmin.officeId);
          } catch (error) {
            console.error(`Error fetching office name for ${deletedAdmin.officeId}:`, error);
          }
        }
        if (!adminOffice) {
          adminOffice = 'ไม่ระบุสาขา';
        }
        
        // ✅ ใช้ข้อมูลจาก DeletedUsers snapshot
        return {
          ...issueObj,
          assignedAdmin: {
            userId: deletedAdmin.user_id,
            name: deletedAdmin.userType === 'individual'
              ? `${deletedAdmin.firstName} ${deletedAdmin.lastName}`.trim()
              : adminOffice,
            email: deletedAdmin.email || ''
          }
        };
      }
      
      // ✅ ถ้าไม่มีใน DeletedUsers → ใช้ข้อมูลที่เก็บไว้ใน IssueLog (assignedAdmin)
      return issueObj;
    }

    // 🆕 Populate office name จาก officeId หรือ officeName
    let adminOffice = admin.officeName || admin.office || '';
    if (!adminOffice && admin.officeId) {
      try {
        adminOffice = await getOfficeNameById(admin.officeId);
      } catch (error) {
        console.error(`Error fetching office name for ${admin.officeId}:`, error);
      }
    }
    if (!adminOffice) {
      adminOffice = 'ไม่ระบุสาขา';
    }
    
    // Populate ข้อมูล Admin ล่าสุด
    return {
      ...issueObj,
      assignedAdmin: {
        userId: admin.user_id,
        name: admin.userType === 'individual'
          ? `${admin.firstName} ${admin.lastName}`.trim()
          : adminOffice,
        email: admin.email
      }
    };
  } catch (error) {
    console.error('Error populating admin info:', error);
    return issueObj;
  }
}

/**
 * Populate requester information from User collection
 * 
 * **Individual User:**
 * - Populate ข้อมูลทั้งหมดจาก User collection (real-time)
 * - ถ้า User ถูกลบ → ใช้ snapshot ที่เก็บไว้
 * 
 * **Branch User:**
 * - Populate เฉพาะ office, phone, email จาก User collection (real-time)
 * - ข้อมูลส่วนตัว → ใช้ snapshot จากฟอร์มที่กรอก
 * - ⚠️ Snapshot จากฟอร์ม = ข้อมูลที่กรอกในแต่ละครั้ง (ไม่ใช่ข้อมูลล่าสุดก่อนลบ)
 * 
 * @param issue - IssueLog document
 * @returns Populated issue with requester info
 */
export async function populateRequesterInfo(issue: any) {
  if (!issue) return null;

  const issueObj = issue.toObject ? issue.toObject() : issue;
  
  // ถ้าไม่มี requesterId = User ถูกลบแล้ว → ใช้ Snapshot
  if (!issue.requesterId) {
    return issueObj;
  }

  // มี requesterId = ยัง populate ได้
  try {
    const user = await User.findOne({ user_id: issue.requesterId }).select(
      'firstName lastName nickname department office officeId officeName phone email userType'
    );

    if (!user) {
      // ✅ User ไม่พบ → ค้นหาจาก DeletedUsers collection
      const DeletedUsers = (await import('@/models/DeletedUser')).default;
      const deletedUser = await DeletedUsers.findOne({ user_id: issue.requesterId }).select(
        'firstName lastName nickname department office officeId officeName phone email userType'
      );
      
      if (deletedUser) {
        // ✅ แยกการจัดการตามประเภทผู้ใช้
        // 🆕 Populate office name จาก officeId หรือ officeName
        let deletedUserOffice = deletedUser.officeName || deletedUser.office || '';
        if (!deletedUserOffice && deletedUser.officeId) {
          try {
            deletedUserOffice = await getOfficeNameById(deletedUser.officeId);
          } catch (error) {
            console.error(`Error fetching office name for ${deletedUser.officeId}:`, error);
          }
        }
        if (!deletedUserOffice) {
          deletedUserOffice = 'ไม่ระบุสาขา';
        }
        
        if (deletedUser.userType === 'branch') {
          // ผู้ใช้สาขา: ข้อมูลส่วนตัวจากฟอร์ม, เฉพาะสาขาจาก snapshot
          // 🆕 Populate office: ใช้ snapshot จากฟอร์มก่อน (office/officeName)
          // แล้วค่อย fallback ไป DeletedUsers แล้วค่อย lookup จาก Office collection
          let finalOffice = issueObj.officeName || issueObj.office || '';
          if (!finalOffice) {
            finalOffice = deletedUserOffice;
          }
          if (!finalOffice) {
            finalOffice = 'ไม่ระบุสาขา';
          }
          return {
            ...issueObj,
            firstName: issueObj.firstName || '-', // ใช้จากฟอร์มแจ้งงาน
            lastName: issueObj.lastName || '-',   // ใช้จากฟอร์มแจ้งงาน
            nickname: issueObj.nickname || '-',   // ใช้จากฟอร์มแจ้งงาน
            department: issueObj.department || '-', // ใช้จากฟอร์มแจ้งงาน
            phone: issueObj.phone || '-',         // ใช้จากฟอร์มแจ้งงาน
            email: issueObj.email || '-',         // ใช้จากฟอร์มแจ้งงาน
            // เฉพาะสาขาใช้จาก snapshot (ข้อมูลล่าสุดก่อนลบ)
            office: finalOffice,
            officeName: finalOffice,
            userType: deletedUser.userType, // เพิ่มประเภทผู้ใช้
          };
        } else {
          // ผู้ใช้บุคคล: ใช้ข้อมูลจาก DeletedUsers เป็นหลัก (ข้อมูลล่าสุดก่อนลบ)
          // 🆕 Populate office: ใช้ snapshot จากฟอร์มก่อน (office/officeName)
          // แล้วค่อย fallback ไป DeletedUsers แล้วค่อย lookup จาก Office collection
          let finalOffice = issueObj.officeName || issueObj.office || '';
          if (!finalOffice) {
            finalOffice = deletedUserOffice;
          }
          if (!finalOffice) {
            finalOffice = 'ไม่ระบุสาขา';
          }
          return {
            ...issueObj,
            firstName: deletedUser.firstName || issueObj.firstName,
            lastName: deletedUser.lastName || issueObj.lastName,
            nickname: deletedUser.nickname || issueObj.nickname,
            department: deletedUser.department || issueObj.department,
            office: finalOffice,
            officeName: finalOffice,
            phone: deletedUser.phone || issueObj.phone,
            email: deletedUser.email || issueObj.email,
            userType: deletedUser.userType, // เพิ่มประเภทผู้ใช้
          };
        }
      }
      
      // ✅ ถ้าไม่มีใน DeletedUsers → ใช้ข้อมูลที่เก็บไว้ใน IssueLog
      return issueObj;
    }
    
    // 🆕 Populate office name จาก officeId หรือ officeName
    let userOffice = user.officeName || user.office || '';
    if (!userOffice && user.officeId) {
      try {
        userOffice = await getOfficeNameById(user.officeId);
      } catch (error) {
        console.error(`Error fetching office name for ${user.officeId}:`, error);
      }
    }
    if (!userOffice) {
      userOffice = 'ไม่ระบุสาขา';
    }
    
    // ✅ ตรวจสอบประเภทผู้ใช้จาก User collection ก่อน (ข้อมูลล่าสุด)
    // Branch User: แสดงสาขาปัจจุบันของผู้ใช้ (ไม่ใช่สาขาตอนแจ้งงาน)
    if (user.userType === 'branch') {
      // 🆕 Populate office: สำหรับผู้ใช้สาขา แสดงสาขาปัจจุบัน (real-time)
      // ⚠️ สำคัญ: ผู้ใช้สาขา = แสดงสาขาปัจจุบันที่ผู้ใช้อยู่ (ไม่ใช่สาขาตอนแจ้งงาน)
      // เพราะ User สาขาเดียวกันมีหลายคนใช้ ต้องแสดงสาขาปัจจุบันเสมอ
      let finalOffice = '';
      
      // ✅ Priority 1: ใช้สาขาปัจจุบันจาก User collection (real-time)
      if (user.officeId && user.officeId !== 'UNSPECIFIED_OFFICE') {
        try {
          finalOffice = await getOfficeNameById(user.officeId);
        } catch (error) {
          console.error('Error fetching office name from user.officeId:', error);
        }
      }
      
      // ✅ Priority 2: ถ้าไม่เจอจาก officeId ให้ใช้ officeName/office จาก User
      if (!finalOffice) {
        finalOffice = user.officeName || user.office || '';
      }
      
      // ✅ Priority 3: Fallback ไป snapshot (กรณีสาขาถูกลบแล้ว)
      if (!finalOffice) {
        finalOffice = issueObj.officeName || issueObj.office || 'ไม่ระบุสาขา';
      }
      
      return {
        ...issueObj,
        office: finalOffice,
        officeName: finalOffice,
        userType: user.userType, // เพิ่มประเภทผู้ใช้
        // ✅ firstName, lastName, nickname, department, phone, email → ใช้จากฟอร์มที่กรอก (issueObj)
        // ⚠️ ไม่ populate จาก User collection เพราะเป็นข้อมูลส่วนตัวที่เปลี่ยนไปตามคนที่มาแจ้งงาน
      };
    }
    
    // Individual User: Populate ทุกฟิลด์จาก User collection (ข้อมูลล่าสุด)
    if (user.userType === 'individual') {
      // 🆕 Populate office: สำหรับประวัติ (IssueLog) ต้องตรวจสอบ officeId ใน IssueLog ก่อน
      // ⚠️ สำคัญ: ถ้า officeId ใน IssueLog เป็น UNSPECIFIED_OFFICE → สาขาถูกลบแล้ว ต้องใช้ snapshot
      // ถ้า officeId ไม่ใช่ UNSPECIFIED_OFFICE → ใช้ officeId เพื่อดึงชื่อสาขาล่าสุด
      let finalOffice = '';
      
      // ✅ Priority 1: ตรวจสอบ officeId ใน IssueLog ก่อน
      // ถ้าเป็น UNSPECIFIED_OFFICE แสดงว่าสาขาถูกลบแล้ว → ใช้ snapshot
      if (issueObj.officeId === 'UNSPECIFIED_OFFICE') {
        // สาขาถูกลบแล้ว → ใช้ snapshot จากฟอร์ม
        finalOffice = issueObj.officeName || issueObj.office || '';
      }
      
      // ✅ Priority 2: ถ้า officeId ไม่ใช่ UNSPECIFIED_OFFICE → ใช้ officeId เพื่อดึงชื่อสาขาล่าสุด
      if (!finalOffice && issueObj.officeId && issueObj.officeId !== 'UNSPECIFIED_OFFICE') {
        try {
          finalOffice = await getOfficeNameById(issueObj.officeId);
        } catch (error) {
          console.error('Error fetching office name from issueObj.officeId:', error);
        }
      }
      
      // ✅ Priority 3: ถ้าไม่มี officeId ใน IssueLog ให้ใช้ officeId จาก User collection (ข้อมูลล่าสุด)
      if (!finalOffice && user.officeId && user.officeId !== 'UNSPECIFIED_OFFICE') {
        try {
          finalOffice = await getOfficeNameById(user.officeId);
        } catch (error) {
          console.error('Error fetching office name from user.officeId:', error);
        }
      }
      
      // ✅ Priority 4: Fallback ไป User collection
      if (!finalOffice) {
        finalOffice = userOffice;
      }
      
      // ✅ Priority 5: Fallback สุดท้าย ไป snapshot
      if (!finalOffice) {
        finalOffice = issueObj.officeName || issueObj.office || '';
      }
      
      if (!finalOffice) {
        finalOffice = 'ไม่ระบุสาขา';
      }
      
      return {
        ...issueObj,
        firstName: user.firstName || issueObj.firstName,
        lastName: user.lastName || issueObj.lastName,
        nickname: user.nickname || issueObj.nickname,
        department: user.department || issueObj.department,
        office: finalOffice, // 🆕 ใช้ข้อมูลล่าสุดจาก User collection
        phone: user.phone || issueObj.phone,
        email: user.email || issueObj.email,
        userType: user.userType, // เพิ่มประเภทผู้ใช้
      };
    }

    // ถ้าไม่รู้ว่าเป็นประเภทไหน ให้ใช้ข้อมูลจากฟอร์ม (สำหรับกรณีที่ userType ไม่ถูกตั้งค่า)
    return {
      ...issueObj,
      office: userOffice || issueObj.office || '-', // 🆕 ใช้ officeName ที่ populate แล้ว
      userType: user.userType || 'individual', // เพิ่มประเภทผู้ใช้ (default เป็น individual)
      // ใช้ข้อมูลจากฟอร์มเพื่อความปลอดภัย
    };
  } catch (error) {
    console.error('Error populating requester info:', error);
    return issueObj;
  }
}

/**
 * Populate requester information for an array of issues
 */
export async function populateRequesterInfoBatch(issues: any[]) {
  const results = await Promise.all(
    issues.map(issue => populateRequesterInfo(issue))
  );
  return results;
}

/**
 * Get display name for requester based on type
 */
export function getRequesterDisplayName(issue: any) {
  return `${issue.firstName} ${issue.lastName}${issue.nickname ? ` (${issue.nickname})` : ''}`;
}

/**
 * Populate both requester and admin information
 */
export async function populateIssueInfo(issue: any) {
  let result = await populateRequesterInfo(issue);
  result = await populateAdminInfo(result);
  return result;
}

/**
 * Populate both requester and admin information for an array of issues
 */
export async function populateIssueInfoBatch(issues: any[]) {
  const results = await Promise.all(
    issues.map(issue => populateIssueInfo(issue))
  );
  return results;
}

/**
 * Format issue data for email
 * This ensures we have the latest user information for individual users
 */
export async function formatIssueForEmail(issue: any) {
  // Populate both requester and admin info
  const populatedIssue = await populateIssueInfo(issue);
  
  return {
    ...populatedIssue,
    displayName: getRequesterDisplayName(populatedIssue),
    requesterInfo: {
      firstName: populatedIssue.firstName,
      lastName: populatedIssue.lastName,
      nickname: populatedIssue.nickname,
      department: populatedIssue.department,
      office: populatedIssue.office,
      phone: populatedIssue.phone,
      email: populatedIssue.email,
    }
  };
}

