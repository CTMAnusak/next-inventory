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
      // Admin ไม่พบ (อาจถูกลบโดยไม่ผ่าน snapshot) → ใช้ Snapshot
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

  // ถ้าไม่มี requesterId = User ถูกลบแล้ว → ใช้ Snapshot
  if (!issue.requesterId) {
    return issueObj;
  }

  // มี requesterId = ยัง populate ได้
  try {
    const user = await User.findOne({ user_id: issue.requesterId }).select(
      'firstName lastName nickname department office phone email userType'
    );

    if (!user) {
      // User ไม่พบ (อาจถูกลบโดยไม่ผ่าน snapshot) → ใช้ Snapshot
      return issueObj;
    }

    // Individual User: Populate ทุกฟิลด์จาก User collection
    if (issue.requesterType === 'individual' || user.userType === 'individual') {
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

    // Branch User: Populate เฉพาะข้อมูลสาขา (ข้อมูลส่วนตัวใช้จากฟอร์ม)
    if (issue.requesterType === 'branch' || user.userType === 'branch') {
      return {
        ...issueObj,
        office: user.office || issueObj.office, // อัพเดทชื่อสาขาล่าสุด
        phone: user.phone || issueObj.phone, // อัพเดทเบอร์โทรล่าสุด
        email: user.email || issueObj.email, // อัพเดทอีเมลล่าสุด
        // firstName, lastName, etc. → ใช้จาก snapshot ในฟอร์ม
      };
    }

    return issueObj;
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

