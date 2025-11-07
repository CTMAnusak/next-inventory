import User from '@/models/User';
import { getOfficeNameById } from '@/lib/office-helpers';

/**
 * 🚀 OPTIMIZED: Batch populate issues with minimal database queries
 * 
 * แทนที่จะ query ทีละ issue (N+1 problem)
 * เราจะ:
 * 1. รวบรวม user IDs ทั้งหมดก่อน
 * 2. Query users ทั้งหมดพร้อมกัน (1-2 queries)
 * 3. Query deleted users ทั้งหมดพร้อมกัน (1-2 queries)
 * 4. Cache office names
 * 5. Map ข้อมูลกลับไปหา issues
 * 
 * Performance: 100 issues จาก 200+ queries → 4-6 queries
 */
export async function populateIssueInfoBatchOptimized(issues: any[]) {
  if (!issues || issues.length === 0) return [];

  const startTime = Date.now();
  console.log(`🚀 Optimized batch populate: ${issues.length} issues`);

  // Convert to plain objects
  const issueObjects = issues.map(issue => 
    issue.toObject ? issue.toObject() : issue
  );

  // 1️⃣ Collect all unique user IDs
  const requesterIds = new Set<string>();
  const adminIds = new Set<string>();
  const officeIds = new Set<string>();

  issueObjects.forEach(issue => {
    if (issue.requesterId) requesterIds.add(issue.requesterId);
    if (issue.assignedAdminId) adminIds.add(issue.assignedAdminId);
    if (issue.officeId) officeIds.add(issue.officeId);
  });

  console.log(`  - Unique requester IDs: ${requesterIds.size}`);
  console.log(`  - Unique admin IDs: ${adminIds.size}`);
  console.log(`  - Unique office IDs: ${officeIds.size}`);

  // 2️⃣ Batch query all users at once (2 queries total)
  const allUserIds = [...requesterIds, ...adminIds];
  const [users, deletedUsers] = await Promise.all([
    User.find({ user_id: { $in: allUserIds } }).select(
      'firstName lastName nickname department office officeId officeName phone email userType user_id'
    ).lean(),
    (async () => {
      const DeletedUsers = (await import('@/models/DeletedUser')).default;
      return DeletedUsers.find({ user_id: { $in: allUserIds } }).select(
        'firstName lastName nickname department office officeId officeName phone email userType user_id'
      ).lean();
    })()
  ]);

  console.log(`  - Found ${users.length} active users`);
  console.log(`  - Found ${deletedUsers.length} deleted users`);

  // 3️⃣ Create lookup maps for O(1) access
  const userMap = new Map(users.map(u => [u.user_id, u]));
  const deletedUserMap = new Map(deletedUsers.map(u => [u.user_id, u]));

  // 4️⃣ Cache office names (batch query)
  const officeCache = new Map<string, string>();
  
  // Collect all office IDs from users too
  users.forEach(u => {
    if (u.officeId) officeIds.add(u.officeId);
  });
  deletedUsers.forEach(u => {
    if (u.officeId) officeIds.add(u.officeId);
  });

  // Batch fetch office names
  if (officeIds.size > 0) {
    try {
      const Office = (await import('@/models/Office')).default;
      const offices = await Office.find({ 
        office_id: { $in: Array.from(officeIds) } 
      }).select('office_id officeName').lean();
      
      offices.forEach((office: any) => {
        officeCache.set(office.office_id, office.officeName);
      });
      
      console.log(`  - Cached ${officeCache.size} office names`);
    } catch (error) {
      console.error('Error fetching offices:', error);
    }
  }

  // 5️⃣ Helper function to get office name with cache
  const getOfficeName = (officeId: string | undefined, fallback: string = '') => {
    if (!officeId || officeId === 'UNSPECIFIED_OFFICE') return fallback;
    return officeCache.get(officeId) || fallback;
  };

  // 6️⃣ Map data back to issues
  const populatedIssues = issueObjects.map(issue => {
    let result = { ...issue };

    // Populate requester
    if (issue.requesterId) {
      const user = userMap.get(issue.requesterId) || deletedUserMap.get(issue.requesterId);
      
      if (user) {
        const userOffice = user.officeName || user.office || getOfficeName(user.officeId);
        
        if (user.userType === 'branch') {
          // Branch user: use form data, only office from user
          const finalOffice = 
            (user.officeId && user.officeId !== 'UNSPECIFIED_OFFICE') 
              ? getOfficeName(user.officeId, userOffice)
              : (issue.officeName || issue.office || userOffice || 'ไม่ระบุสาขา');
          
          result = {
            ...result,
            office: finalOffice,
            officeName: finalOffice,
          };
        } else if (user.userType === 'individual') {
          // Individual user: populate all from user collection
          const finalOffice = userOffice || issue.officeName || issue.office || 'ไม่ระบุสาขา';
          
          result = {
            ...result,
            firstName: user.firstName || issue.firstName,
            lastName: user.lastName || issue.lastName,
            nickname: user.nickname || issue.nickname,
            department: user.department || issue.department,
            office: finalOffice,
            officeName: finalOffice,
            phone: user.phone || issue.phone,
            email: user.email || issue.email,
          };
        }
      }
    }

    // Populate admin
    if (issue.assignedAdminId) {
      const admin = userMap.get(issue.assignedAdminId) || deletedUserMap.get(issue.assignedAdminId);
      
      if (admin) {
        const adminOffice = admin.officeName || admin.office || getOfficeName(admin.officeId) || 'ไม่ระบุสาขา';
        
        result.assignedAdmin = {
          userId: admin.user_id,
          name: admin.userType === 'individual'
            ? `${admin.firstName} ${admin.lastName}`.trim()
            : adminOffice,
          email: admin.email || ''
        };
      }
    }

    return result;
  });

  const endTime = Date.now();
  console.log(`✅ Optimized batch populate completed in ${endTime - startTime}ms`);
  
  return populatedIssues;
}

/**
 * 🔄 Backward compatibility: use optimized version
 */
export async function populateIssueInfoBatch(issues: any[]) {
  return populateIssueInfoBatchOptimized(issues);
}

