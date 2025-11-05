import { getStatusName, getConditionName, getUserName, getCategoryName } from '@/lib/equipment-snapshot-helpers';
import { getItemNameAndCategory, getCategoryNameById } from '@/lib/item-name-resolver';
import { getOfficeNameById } from '@/lib/office-helpers'; // 🆕 Import helper function
import InventoryMaster from '@/models/InventoryMaster';
import User from '@/models/User';
import DeletedUser from '@/models/DeletedUser';

/**
 * =========================================
 * OPTIMIZED POPULATE FUNCTIONS
 * =========================================
 * 
 * แก้ปัญหา N+1 Query โดยการ batch query ข้อมูลที่ซ้ำกัน
 */

/**
 * Batch populate RequestLog items แบบ optimized
 * แก้ปัญหา N+1 query โดยการ batch query ข้อมูลที่ซ้ำกัน
 */
export async function populateRequestLogItemsBatchOptimized(requestLogs: any[]) {
  if (!requestLogs || requestLogs.length === 0) return requestLogs;
  
  // Collect all unique IDs that need to be populated
  const masterIds = new Set<string>();
  const categoryIds = new Set<string>();
  const statusIds = new Set<string>();
  const conditionIds = new Set<string>();
  const userIds = new Set<string>();
  
  // Extract all IDs from all logs
  requestLogs.forEach(log => {
    if (log.items) {
      log.items.forEach((item: any) => {
        if (item.masterId) masterIds.add(item.masterId);
        if (item.categoryId) categoryIds.add(item.categoryId);
        if (item.statusOnRequest) statusIds.add(item.statusOnRequest);
        if (item.conditionOnRequest) conditionIds.add(item.conditionOnRequest);
      });
    }
    if (log.approvedBy) userIds.add(log.approvedBy);
    if (log.rejectedBy) userIds.add(log.rejectedBy);
  });
  
  // Batch fetch all data in parallel
  const [
    masterDataMap,
    categoryDataMap,
    statusDataMap,
    conditionDataMap,
    userDataMap
  ] = await Promise.all([
    // Batch fetch InventoryMaster data
    masterIds.size > 0 ? InventoryMaster.find({ _id: { $in: Array.from(masterIds) } })
      .lean()
      .then(items => new Map(items.map(item => [item._id.toString(), item]))) : Promise.resolve(new Map()),
    
    // Batch fetch category names
    categoryIds.size > 0 ? Promise.all(Array.from(categoryIds).map(id => getCategoryName(id)))
      .then(names => new Map(Array.from(categoryIds).map((id, i) => [id, names[i]]))) : Promise.resolve(new Map()),
    
    // Batch fetch status names
    statusIds.size > 0 ? Promise.all(Array.from(statusIds).map(id => getStatusName(id)))
      .then(names => new Map(Array.from(statusIds).map((id, i) => [id, names[i]]))) : Promise.resolve(new Map()),
    
    // Batch fetch condition names
    conditionIds.size > 0 ? Promise.all(Array.from(conditionIds).map(id => getConditionName(id)))
      .then(names => new Map(Array.from(conditionIds).map((id, i) => [id, names[i]]))) : Promise.resolve(new Map()),
    
    // Batch fetch user names
    userIds.size > 0 ? Promise.all(Array.from(userIds).map(id => getUserName(id)))
      .then(names => new Map(Array.from(userIds).map((id, i) => [id, names[i]]))) : Promise.resolve(new Map())
  ]);
  
  // Populate all logs using the cached data
  return requestLogs.map(log => {
    const populated = log.toObject ? log.toObject() : JSON.parse(JSON.stringify(log));
    
    // Populate items
    if (populated.items) {
      populated.items.forEach((item: any) => {
        // Populate item name and category from master data
        if (item.masterId && masterDataMap.has(item.masterId)) {
          const masterData = masterDataMap.get(item.masterId);
          if (!item.itemName) item.itemName = masterData.itemName;
          if (!item.category) item.category = masterData.categoryId;
          if (!item.categoryId) item.categoryId = masterData.categoryId;
        }
        
        // Populate category name
        if (item.categoryId && categoryDataMap.has(item.categoryId)) {
          item.category = categoryDataMap.get(item.categoryId);
        }
        
        // Populate status name
        if (item.statusOnRequest && statusDataMap.has(item.statusOnRequest)) {
          item.statusOnRequestName = statusDataMap.get(item.statusOnRequest);
        }
        
        // Populate condition name
        if (item.conditionOnRequest && conditionDataMap.has(item.conditionOnRequest)) {
          item.conditionOnRequestName = conditionDataMap.get(item.conditionOnRequest);
        }
      });
    }
    
    // Populate approved by name
    if (populated.approvedBy && userDataMap.has(populated.approvedBy)) {
      populated.approvedByName = userDataMap.get(populated.approvedBy);
    }
    
    // Populate rejected by name
    if (populated.rejectedBy && userDataMap.has(populated.rejectedBy)) {
      populated.rejectedByName = userDataMap.get(populated.rejectedBy);
    }
    
    return populated;
  });
}

/**
 * Batch populate RequestLog users แบบ optimized
 */
export async function populateRequestLogUsersBatchOptimized(requestLogs: any[]) {
  if (!requestLogs || requestLogs.length === 0) return requestLogs;
  
  // Collect all unique user IDs
  const userIds = new Set<string>();
  requestLogs.forEach(log => {
    if (log.userId) userIds.add(log.userId);
  });
  
  if (userIds.size === 0) return requestLogs;
  
  // Batch fetch users from both User and DeletedUser collections
  // Convert userIds to proper format for MongoDB queries
  const userIdArray = Array.from(userIds);
  
  const [activeUsers, deletedUsers] = await Promise.all([
    User.find({ user_id: { $in: userIdArray } }).lean(), // Use user_id field instead of _id
    DeletedUser.find({ originalUserId: { $in: userIdArray } }).lean()
  ]);
  
  // Create lookup maps
  const activeUserMap = new Map(activeUsers.map(user => [(user as any).user_id, user]));
  const deletedUserMap = new Map(deletedUsers.map(user => [(user as any).originalUserId, user]));
  
  // 🆕 Batch fetch office names for all users that have officeId
  const officeIds = new Set<string>();
  activeUsers.forEach((user: any) => {
    if (user.officeId) officeIds.add(user.officeId);
  });
  deletedUsers.forEach((user: any) => {
    if (user.officeId) officeIds.add(user.officeId);
  });
  
  // Batch populate office names
  const officeNameMap = new Map<string, string>();
  if (officeIds.size > 0) {
    await Promise.all(Array.from(officeIds).map(async (officeId) => {
      try {
        const officeName = await getOfficeNameById(officeId);
        officeNameMap.set(officeId, officeName);
      } catch (error) {
        console.error(`Error fetching office name for ${officeId}:`, error);
      }
    }));
  }
  
  // Populate all logs
  return requestLogs.map(log => {
    const populated = log.toObject ? log.toObject() : JSON.parse(JSON.stringify(log));
    
    if (populated.userId) {
      const userId = populated.userId;
      
      if (activeUserMap.has(userId)) {
        // User is still active
        const user = activeUserMap.get(userId);
        if (user) {
          const userType = (user as any).userType;
          
          // 🆕 Populate office name จาก officeId หรือ officeName
          let userOffice = (user as any).officeName || (user as any).office || '';
          if (!userOffice && (user as any).officeId) {
            userOffice = officeNameMap.get((user as any).officeId) || '';
          }
          if (!userOffice) {
            userOffice = 'ไม่ระบุสาขา';
          }
          
          if (userType === 'individual') {
            // ✅ ผู้ใช้บุคคล: Populate ทุกข้อมูลจาก User collection (ข้อมูลล่าสุด)
            populated.firstName = (user as any).firstName || '';
            populated.lastName = (user as any).lastName || '';
            populated.nickname = (user as any).nickname || '';
            populated.department = (user as any).department || '';
            populated.phone = (user as any).phone || '';
            populated.office = userOffice; // 🆕 ใช้ officeName ที่ populate แล้ว
            populated.email = (user as any).email || '';
          } else if (userType === 'branch') {
            // ✅ ผู้ใช้สาขา: Populate เฉพาะข้อมูลสาขา + ใช้ข้อมูลส่วนตัวจาก snapshot ในฟอร์ม
            populated.office = userOffice; // 🆕 ใช้ officeName ที่ populate แล้ว
            populated.email = (user as any).email || '';
            // ข้อมูลส่วนตัวใช้จาก snapshot ในฟอร์ม (requesterFirstName, etc.)
            populated.firstName = populated.requesterFirstName || '';
            populated.lastName = populated.requesterLastName || '';
            populated.nickname = populated.requesterNickname || '';
            populated.department = populated.requesterDepartment || '';
            populated.phone = populated.requesterPhone || '';
          }
          
          // เก็บ userInfo สำหรับการ debug
          populated.userInfo = {
            firstName: (user as any).firstName,
            lastName: (user as any).lastName,
            nickname: (user as any).nickname,
            department: (user as any).department,
            phone: (user as any).phone,
            office: userOffice, // 🆕 ใช้ officeName ที่ populate แล้ว
            email: (user as any).email,
            userType: userType,
            isActive: true
          };
        }
      } else if (deletedUserMap.has(userId)) {
        // User was deleted, use snapshot
        const deletedUser = deletedUserMap.get(userId);
        if (deletedUser) {
          const userType = (deletedUser as any).userType;
          
          // 🆕 Populate office name จาก officeId หรือ officeName
          let deletedUserOffice = (deletedUser as any).officeName || (deletedUser as any).office || '';
          if (!deletedUserOffice && (deletedUser as any).officeId) {
            deletedUserOffice = officeNameMap.get((deletedUser as any).officeId) || '';
          }
          if (!deletedUserOffice) {
            deletedUserOffice = 'ไม่ระบุสาขา';
          }
          
          if (userType === 'individual') {
            // ✅ ผู้ใช้บุคคล: ใช้ข้อมูลจาก snapshot (ข้อมูลล่าสุดก่อนลบ)
            populated.firstName = (deletedUser as any).firstName || '';
            populated.lastName = (deletedUser as any).lastName || '';
            populated.nickname = (deletedUser as any).nickname || '';
            populated.department = (deletedUser as any).department || '';
            populated.phone = (deletedUser as any).phone || '';
            populated.office = deletedUserOffice; // 🆕 ใช้ officeName ที่ populate แล้ว
            populated.email = (deletedUser as any).email || '';
          } else if (userType === 'branch') {
            // ✅ ผู้ใช้สาขา: ใช้ข้อมูลสาขาจาก snapshot + ข้อมูลส่วนตัวจากฟอร์ม
            populated.office = deletedUserOffice; // 🆕 ใช้ officeName ที่ populate แล้ว
            populated.email = (deletedUser as any).email || '';
            // ข้อมูลส่วนตัวใช้จาก snapshot ในฟอร์ม (requesterFirstName, etc.)
            populated.firstName = populated.requesterFirstName || '';
            populated.lastName = populated.requesterLastName || '';
            populated.nickname = populated.requesterNickname || '';
            populated.department = populated.requesterDepartment || '';
            populated.phone = populated.requesterPhone || '';
          }
          
          // เก็บ userInfo สำหรับการ debug
          populated.userInfo = {
            firstName: (deletedUser as any).firstName,
            lastName: (deletedUser as any).lastName,
            nickname: (deletedUser as any).nickname,
            department: (deletedUser as any).department,
            phone: (deletedUser as any).phone,
            office: deletedUserOffice, // 🆕 ใช้ officeName ที่ populate แล้ว
            email: (deletedUser as any).email,
            userType: userType,
            isActive: false
          };
        }
      } else {
        // User not found - ใช้ข้อมูลจาก snapshot ใน RequestLog (ถ้ามี)
        // 🆕 Populate office name จาก requesterOfficeId หรือ requesterOfficeName
        let requesterOffice = populated.requesterOfficeName || populated.requesterOffice || '';
        if (!requesterOffice && populated.requesterOfficeId) {
          requesterOffice = officeNameMap.get(populated.requesterOfficeId) || '';
        }
        if (!requesterOffice) {
          requesterOffice = 'ไม่ระบุสาขา';
        }
        
        populated.firstName = populated.requesterFirstName || 'Unknown';
        populated.lastName = populated.requesterLastName || 'User';
        populated.nickname = populated.requesterNickname || '';
        populated.department = populated.requesterDepartment || '';
        populated.phone = populated.requesterPhone || '';
        populated.office = requesterOffice; // 🆕 ใช้ officeName ที่ populate แล้ว
        populated.email = populated.requesterEmail || '';
        
        // เก็บ userInfo สำหรับการ debug
        populated.userInfo = {
          firstName: 'Unknown',
          lastName: 'User',
          nickname: 'Unknown',
          department: 'Unknown',
          phone: 'Unknown',
          office: requesterOffice, // 🆕 ใช้ officeName ที่ populate แล้ว
          email: 'Unknown',
          userType: 'unknown',
          isActive: false
        };
      }
    }
    
    return populated;
  });
}

/**
 * Complete optimized populate for RequestLogs
 */
export async function populateRequestLogCompleteBatchOptimized(requestLogs: any[]) {
  // First populate users
  const userPopulated = await populateRequestLogUsersBatchOptimized(requestLogs);
  
  // Then populate items
  const fullyPopulated = await populateRequestLogItemsBatchOptimized(userPopulated);
  
  return fullyPopulated;
}

/**
 * Batch populate ReturnLog items แบบ optimized
 */
export async function populateReturnLogItemsBatchOptimized(returnLogs: any[]) {
  if (!returnLogs || returnLogs.length === 0) return returnLogs;
  
  // Similar implementation for ReturnLogs
  // ... (implementation similar to RequestLog but for return logs)
  
  return returnLogs;
}

/**
 * Complete optimized populate for ReturnLogs
 */
export async function populateReturnLogCompleteBatchOptimized(returnLogs: any[]) {
  // Similar implementation for ReturnLogs
  // ... (implementation similar to RequestLog but for return logs)
  
  return returnLogs;
}
