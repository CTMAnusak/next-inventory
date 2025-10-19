import User from '@/models/User';

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
      'firstName lastName office email userType user_id'
    );

    if (!admin) {
      // ✅ Admin ไม่พบ → ค้นหาจาก DeletedUsers collection
      const DeletedUsers = (await import('@/models/DeletedUser')).default;
      const deletedAdmin = await DeletedUsers.findOne({ user_id: issue.assignedAdminId }).select(
        'firstName lastName office email userType user_id'
      );
      
      if (deletedAdmin) {
        // ✅ ใช้ข้อมูลจาก DeletedUsers snapshot
        return {
          ...issueObj,
          assignedAdmin: {
            userId: deletedAdmin.user_id,
            name: deletedAdmin.userType === 'individual'
              ? `${deletedAdmin.firstName} ${deletedAdmin.lastName}`.trim()
              : deletedAdmin.office || '',
            email: deletedAdmin.email || ''
          }
        };
      }
      
      // ✅ ถ้าไม่มีใน DeletedUsers → ใช้ข้อมูลที่เก็บไว้ใน IssueLog (assignedAdmin)
      return issueObj;
    }

    // Populate ข้อมูล Admin ล่าสุด
    return {
      ...issueObj,
      assignedAdmin: {
        userId: admin.user_id,
        name: admin.userType === 'individual'
          ? `${admin.firstName} ${admin.lastName}`.trim()
          : admin.office,
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
  
  console.log(`🔍 Populating requester info for issue ${issueObj.issueId}:`);
  console.log(`  - Requester ID: ${issueObj.requesterId}`);
  console.log(`  - Requester Type: ${issueObj.requesterType}`);
  console.log(`  - Original firstName: ${issueObj.firstName}`);
  console.log(`  - Original lastName: ${issueObj.lastName}`);
  console.log(`  - Original phone: ${issueObj.phone}`);

  // ถ้าไม่มี requesterId = User ถูกลบแล้ว → ใช้ Snapshot
  if (!issue.requesterId) {
    console.log(`  - No requesterId, using original data`);
    return issueObj;
  }

  // มี requesterId = ยัง populate ได้
  try {
    const user = await User.findOne({ user_id: issue.requesterId }).select(
      'firstName lastName nickname department office phone email userType'
    );

    if (!user) {
      console.log(`  - User not found in User collection, checking DeletedUsers...`);
      // ✅ User ไม่พบ → ค้นหาจาก DeletedUsers collection
      const DeletedUsers = (await import('@/models/DeletedUser')).default;
      const deletedUser = await DeletedUsers.findOne({ user_id: issue.requesterId }).select(
        'firstName lastName nickname department office phone email userType'
      );
      
      if (deletedUser) {
        console.log(`  - Found in DeletedUsers, userType: ${deletedUser.userType}`);
        // ✅ แยกการจัดการตามประเภทผู้ใช้
        if (deletedUser.userType === 'branch') {
          console.log(`  - Branch user: Using form data (firstName: ${issueObj.firstName})`);
          // ผู้ใช้สาขา: ข้อมูลส่วนตัวจากฟอร์ม, เฉพาะสาขาจาก DeletedUsers
          return {
            ...issueObj,
            firstName: issueObj.firstName || '-', // ใช้จากฟอร์มแจ้งงาน
            lastName: issueObj.lastName || '-',   // ใช้จากฟอร์มแจ้งงาน
            nickname: issueObj.nickname || '-',   // ใช้จากฟอร์มแจ้งงาน
            department: issueObj.department || '-', // ใช้จากฟอร์มแจ้งงาน
            phone: issueObj.phone || '-',         // ใช้จากฟอร์มแจ้งงาน
            email: issueObj.email || '-',         // ใช้จากฟอร์มแจ้งงาน
            // เฉพาะสาขาใช้จาก DeletedUsers (ข้อมูลล่าสุดก่อนลบ)
            office: deletedUser.office || issueObj.office || '-',
          };
        } else {
          console.log(`  - Individual user: Using DeletedUsers data (firstName: ${deletedUser.firstName})`);
          // ผู้ใช้บุคคล: ใช้ข้อมูลจาก DeletedUsers เป็นหลัก (ข้อมูลล่าสุดก่อนลบ)
          return {
            ...issueObj,
            firstName: deletedUser.firstName || issueObj.firstName,
            lastName: deletedUser.lastName || issueObj.lastName,
            nickname: deletedUser.nickname || issueObj.nickname,
            department: deletedUser.department || issueObj.department,
            office: deletedUser.office || issueObj.office,
            phone: deletedUser.phone || issueObj.phone,
            email: deletedUser.email || issueObj.email,
          };
        }
      }
      
      console.log(`  - Not found in DeletedUsers, using original data`);
      // ✅ ถ้าไม่มีใน DeletedUsers → ใช้ข้อมูลที่เก็บไว้ใน IssueLog
      return issueObj;
    }

    console.log(`  - User found in User collection, userType: ${user.userType}`);
    
    // ✅ ตรวจสอบประเภทผู้ใช้จาก User collection ก่อน (ข้อมูลล่าสุด)
    // Branch User: Populate เฉพาะข้อมูลสาขา (ข้อมูลส่วนตัวใช้จากฟอร์ม)
    if (user.userType === 'branch') {
      console.log(`  - Branch user: Using form data (firstName: ${issueObj.firstName})`);
      return {
        ...issueObj,
        office: user.office || issueObj.office, // อัพเดทชื่อสาขาล่าสุด
        // ✅ firstName, lastName, nickname, department, phone, email → ใช้จากฟอร์มที่กรอก (issueObj)
        // ⚠️ ไม่ populate จาก User collection เพราะเป็นข้อมูลส่วนตัวที่เปลี่ยนไปตามคนที่มาแจ้งงาน
      };
    }
    
    // Individual User: Populate ทุกฟิลด์จาก User collection (ข้อมูลล่าสุด)
    if (user.userType === 'individual') {
      console.log(`  - Individual user: Using User collection data (firstName: ${user.firstName})`);
      return {
        ...issueObj,
        firstName: user.firstName || issueObj.firstName,
        lastName: user.lastName || issueObj.lastName,
        nickname: user.nickname || issueObj.nickname,
        department: user.department || issueObj.department,
        office: user.office || issueObj.office,
        phone: user.phone || issueObj.phone,
        email: user.email || issueObj.email,
      };
    }

    // ถ้าไม่รู้ว่าเป็นประเภทไหน ให้ใช้ข้อมูลจากฟอร์ม (สำหรับกรณีที่ userType ไม่ถูกตั้งค่า)
    console.log(`  - Unknown user type, using form data (firstName: ${issueObj.firstName})`);
    return {
      ...issueObj,
      office: user.office || issueObj.office, // อัพเดทชื่อสาขาล่าสุด
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

