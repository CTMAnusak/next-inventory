# 📸 คู่มือระบบ Snapshot ฉบับสมบูรณ์

> **เอกสารรวม**: ระบบ Snapshot สำหรับทุก Logs ในระบบจัดการอุปกรณ์  
> **รุ่น**: v4.0 - Complete System (รวมทุกเอกสาร)  
> **อัปเดทล่าสุด**: มกราคม 2568  
> **สถานะ**: ✅ พร้อมใช้งาน

---

## 📋 **สารบัญ**

### [ส่วนที่ 1: ภาพรวมระบบ](#ส่วนที่-1-ภาพรวมระบบ)
- วัตถุประสงค์และปัญหาที่แก้ไข
- สถาปัตยกรรมระบบ
- หลักการ Hybrid Approach

### [ส่วนที่ 2: ระบบผู้ใช้และแอดมิน](#ส่วนที่-2-ระบบผู้ใช้และแอดมิน)
- DeletedUsers Collection
- ผู้ใช้บุคคล vs ผู้ใช้สาขา
- การจัดการแอดมิน

### [ส่วนที่ 3: Equipment Tracking Snapshot](#ส่วนที่-3-equipment-tracking-snapshot)
- โครงสร้างข้อมูล RequestLog/ReturnLog
- ลำดับการทำงาน (เบิก/คืน/ลบ)
- Equipment Tracking Display

### [ส่วนที่ 4: Issue Log Snapshot](#ส่วนที่-4-issue-log-snapshot)
- ระบบผู้แจ้งงาน (Requester)
- ระบบ IT Admin
- การจัดการ Status & Condition

### [ส่วนที่ 5: Config Management](#ส่วนที่-5-config-management)
- Category, Status, Condition Configs
- การ Snapshot ก่อนลบ/แก้ไข
- Bulk Update Operations

### [ส่วนที่ 6: Populate Functions](#ส่วนที่-6-populate-functions)
- Equipment Populate Helpers
- Issue Populate Helpers
- Priority และ Fallback Logic

### [ส่วนที่ 7: การทดสอบ](#ส่วนที่-7-การทดสอบ)
- Test Scenarios ทั้ง 7 กรณี
- Expected Results
- การตรวจสอบ Database

### [ส่วนที่ 8: การใช้งานและ Best Practices](#ส่วนที่-8-การใช้งานและ-best-practices)
- API Endpoints
- Helper Functions
- ข้อควรระวัง

---

# ส่วนที่ 1: ภาพรวมระบบ

## 🎯 **วัตถุประสงค์**

ระบบ Snapshot ออกแบบมาเพื่อแก้ปัญหาการสูญหายของข้อมูลประวัติ:

### ปัญหาเดิม:
```
❌ ผู้ใช้ U004 ถูกลบ
   → ข้อมูลในตาราง /admin/equipment-reports แสดงเป็น "-"
   → ข้อมูลในตาราง /admin/it-reports แสดงเป็น "-"
   → ข้อมูลในตาราง /it-tracking แสดงเป็น "-"

❌ อุปกรณ์ถูกลบ
   → ประวัติการเบิก/คืนแสดง "Unknown"
   → ลบ InventoryMaster → หา masterId ไม่เจอ

❌ Config ถูกลบ/แก้ไข
   → ลบ Status Config → ไม่รู้สถานะเดิม
   → แก้ไขชื่อ → ประวัติไม่ตรง
```

### วิธีแก้ไข:
```
✅ ผู้ใช้ U004 ถูกลบ
   → สร้าง Snapshot ข้อมูลล่าสุดก่อนลบ
   → เก็บใน DeletedUsers collection
   → Populate ข้อมูลจาก DeletedUsers เมื่อแสดงผล
   → ตารางแสดงข้อมูลได้อย่างถูกต้อง ✅

✅ อุปกรณ์ถูกลบ
   → Snapshot itemName, category ลงใน RequestLog
   → แสดงผลจาก Snapshot แทน real-time lookup

✅ Config ถูกลบ/แก้ไข
   → Snapshot ชื่อล่าสุดลงใน Equipment Logs
   → ประวัติแสดงชื่อถูกต้อง
```

---

## 🏗️ **สถาปัตยกรรม**

### **Database Collections**

```
Users (หลัก)
  ↓ (ลบ)
DeletedUsers (snapshot)

InventoryMaster (หลัก)
  ↓ (ลบ)
RequestLog.items[].itemName (snapshot)

InventoryConfig (หลัก)
  ↓ (ลบ/แก้ไข)
RequestLog.items[].categoryName (snapshot)
RequestLog.items[].statusOnRequestName (snapshot)
RequestLog.items[].conditionOnRequestName (snapshot)

Collections ที่มี Snapshot:
├── RequestLog (+ snapshot)  ← เก็บประวัติการเบิก
├── ReturnLog (+ snapshot)   ← เก็บประวัติการคืน
├── TransferLog (+ snapshot) ← เก็บประวัติการโอนย้าย
├── IssueLog (+ snapshot)    ← เก็บประวัติแจ้งงาน IT
└── DeletedUsers (snapshot)  ← เก็บข้อมูลผู้ใช้ที่ถูกลบ
```

---

## 💡 **หลักการ Hybrid Approach**

### **แนวคิด: Snapshot 2 ครั้ง**

#### **1. ครั้งที่ 1: เมื่อเบิก/คืน/แจ้งงาน** 📦
```
เก็บข้อมูล "ณ ตอนนั้น" → Historical Accuracy
```

**เหตุผล:**
- ข้อมูล historical ต้องถูกต้อง
- แสดงสภาพอุปกรณ์ตอนเบิก/คืน

#### **2. ครั้งที่ 2: ก่อนลบ** 🗑️
```
อัปเดตเป็น "ข้อมูลล่าสุด" → ป้องกันข้อมูลหาย
```

**เหตุผล:**
- ถ้าไม่ลบจะไม่มี snapshot (ใช้ real-time)
- เมื่อลบแล้ว snapshot จะเป็นข้อมูลล่าสุด

### **ตัวอย่างการทำงาน:**

```typescript
// วันที่ 1: เบิก Mouse
Admin อนุมัติ → สร้าง snapshot {
  itemName: "Mouse",
  statusName: "ใช้งานได้",
  conditionName: "ดี"
}

// วันที่ 5: แก้ไขอุปกรณ์
Admin แก้ไข Mouse → "ใช้งานได้" → "ชำรุด"
→ ⏸️ Snapshot ไม่เปลี่ยน (ยังคงเป็น "ใช้งานได้")

// วันที่ 10: ลบอุปกรณ์
Admin กดลบ Mouse
→ 📸 อัปเดต snapshot เป็น "ชำรุด" (ข้อมูลล่าสุด)
→ ลบ InventoryItem

// วันที่ 15: ดูประวัติเบิก
Equipment Tracking
→ ✅ แสดง "Mouse - ชำรุด" (จาก snapshot ล่าสุด)
```

---

# ส่วนที่ 2: ระบบผู้ใช้และแอดมิน

## 🗂️ **DeletedUsers Collection**

### **วัตถุประสงค์**
เก็บ Snapshot ข้อมูลผู้ใช้ล่าสุดก่อนลบ

### **โครงสร้างข้อมูล**
```typescript
interface IDeletedUser extends Document {
  userMongoId: string;     // ObjectId ใน MongoDB
  user_id?: string;        // ID ในระบบ (เช่น "U004")
  userType?: 'individual' | 'branch';
  firstName?: string;
  lastName?: string;
  nickname?: string;
  department?: string;
  office?: string;         // สำคัญสำหรับ Branch User
  phone?: string;
  email?: string;
  deletedAt: Date;         // วันที่ลบ
  createdAt: Date;
  updatedAt: Date;
}
```

### **การสร้าง Snapshot**
```typescript
// ใน API DELETE /api/admin/users/[id]
try {
  const snapData = {
    userMongoId: userToDelete._id.toString(),
    user_id: userToDelete.user_id,
    userType: userToDelete.userType,
    firstName: userToDelete.firstName,
    lastName: userToDelete.lastName,
    nickname: userToDelete.nickname,
    department: userToDelete.department,
    office: userToDelete.office,
    phone: userToDelete.phone,
    email: userToDelete.email,
    deletedAt: new Date()
  };
  
  await DeletedUsers.findOneAndUpdate(
    { userMongoId: snapData.userMongoId },
    snapData,
    { upsert: true, new: true }
  );
  
  console.log(`📸 Snapshot user data to DeletedUsers: ${userToDelete.userType} - ${snapData.user_id}`);
} catch (e) {
  console.error('Failed to snapshot user before delete:', e);
}
```

---

## 👤 **ผู้ใช้บุคคล (Individual User)**

### **หลักการ**
- **ยังมีอยู่:** แสดงข้อมูล Real-time ทุกฟิลด์
- **ถูกลบแล้ว:** แสดงข้อมูลจาก DeletedUsers ทุกฟิลด์

### **ตัวอย่าง**
```typescript
// ผู้ใช้บุคคล U001
{
  userType: 'individual',
  firstName: 'สมชาย',
  lastName: 'ใจดี',
  department: 'IT',
  office: 'กรุงเทพ'
}

// เมื่อถูกลบ → DeletedUsers
// เมื่อแสดงผล → ใช้ข้อมูลจาก DeletedUsers ทุกฟิลด์
```

---

## 🏢 **ผู้ใช้สาขา (Branch User)**

### **หลักการพิเศษ**
- **ข้อมูลส่วนตัว** (firstName, lastName, phone, email) → จากฟอร์มแต่ละครั้ง
- **ข้อมูลสาขา** (office) → จาก DeletedUsers (ล่าสุดก่อนลบ)

### **เหตุผล**
ผู้ใช้สาขาอาจมีคนต่างกันมาเบิก/คืนอุปกรณ์ในแต่ละครั้ง แต่สาขาเป็นข้อมูลเดียวกัน

### **ตัวอย่าง**
```typescript
// กิจกรรมที่ 1: เบิกอุปกรณ์
{
  userId: 'BRANCH001',
  requesterFirstName: 'พนักงาน A',
  requesterLastName: 'สาขาภูเก็ต',
  requesterPhone: '081-111-1111',
  requesterEmail: 'a@branch.com'
}

// กิจกรรมที่ 2: แจ้งปัญหา IT
{
  requesterId: 'BRANCH001',
  firstName: 'พนักงาน B',
  lastName: 'สาขาภูเก็ต',
  phone: '082-222-2222',
  email: 'b@branch.com'
}

// เมื่อลบผู้ใช้สาขา → DeletedUsers
{
  user_id: 'BRANCH001',
  userType: 'branch',
  office: 'สาขาภูเก็ต (Central)' // ชื่อล่าสุดก่อนลบ
}

// การแสดงผล:
// กิจกรรมที่ 1: ชื่อ "พนักงาน A", สาขา "สาขาภูเก็ต (Central)"
// กิจกรรมที่ 2: ชื่อ "พนักงาน B", สาขา "สาขาภูเก็ต (Central)"
```

---

## 👨‍💼 **การจัดการแอดมิน**

### **หลักการ**
แอดมินใช้ระบบเดียวกับผู้ใช้ เพราะเป็น User ที่มี `userRole = 'admin'` หรือ `'it_admin'`

### **การ Populate**
```typescript
// populateAdminInfo() ใน issue-helpers.ts
const admin = await User.findOne({ user_id: adminId });

if (admin) {
  // Real-time
  return {
    userId: admin.user_id,
    name: admin.userType === 'individual'
      ? `${admin.firstName} ${admin.lastName}`.trim()
      : admin.office,
    email: admin.email
  };
} else {
  // ค้นหาจาก DeletedUsers
  const deletedAdmin = await DeletedUsers.findOne({ user_id: adminId });
  
  if (deletedAdmin) {
    return {
      userId: deletedAdmin.user_id,
      name: deletedAdmin.userType === 'individual'
        ? `${deletedAdmin.firstName} ${deletedAdmin.lastName}`.trim()
        : deletedAdmin.office || '',
      email: deletedAdmin.email || ''
    };
  }
}
```

---

# ส่วนที่ 3: Equipment Tracking Snapshot

## 📊 **โครงสร้างข้อมูล**

### **RequestLog**

```typescript
interface IAssignedItemSnapshot {
  itemId: string;           // InventoryItem._id
  itemName: string;         // "Mouse Logitech"
  categoryId: string;       // "cat_accessories"
  categoryName: string;     // "อุปกรณ์เสริม"
  serialNumber?: string;    // "SN123"
  numberPhone?: string;     // "0812345678"
  statusId?: string;        // "status_available"
  statusName?: string;      // "มี"
  conditionId?: string;     // "cond_working"
  conditionName?: string;   // "ใช้งานได้"
}

interface IRequestLog {
  userId: string;
  status: 'approved' | 'pending' | 'rejected';
  items: [{
    masterId: string;                           // InventoryMaster._id
    itemName?: string;                          // Snapshot
    categoryId?: string;                        // Snapshot
    assignedItemIds?: string[];                 // [itemId1, itemId2]
    assignedItemSnapshots?: IAssignedItemSnapshot[];  // 🆕
    statusOnRequest?: string;                   // ID
    statusOnRequestName?: string;               // Snapshot
    conditionOnRequest?: string;                // ID
    conditionOnRequestName?: string;            // Snapshot
  }];
  approvedBy?: string;                          // ID
  approvedByName?: string;                      // Snapshot
  rejectedBy?: string;                          // ID
  rejectedByName?: string;                      // Snapshot
}
```

### **ReturnLog**

```typescript
interface IReturnLog {
  userId: string;
  items: [{
    itemId: string;                   // InventoryItem._id
    itemName?: string;                // 🆕 Snapshot
    category?: string;                // 🆕 Snapshot
    categoryId?: string;              // 🆕 Snapshot
    serialNumber?: string;            // 🆕 Snapshot
    numberPhone?: string;             // 🆕 Snapshot
    statusOnReturn?: string;          // ID
    statusOnReturnName?: string;      // Snapshot
    conditionOnReturn?: string;       // ID
    conditionOnReturnName?: string;   // Snapshot
    approvedBy?: string;              // ID
    approvedByName?: string;          // Snapshot
  }];
}
```

---

## 🔄 **ลำดับการทำงาน**

### **Scenario 1: เบิกอุปกรณ์**

```
1. User ส่งคำขอเบิก
   → สร้าง RequestLog (status: pending)

2. Admin อนุมัติ
   → transferInventoryItem()
   → 📸 createInventoryItemSnapshotsBatch()
   → บันทึก assignedItemSnapshots[]
   → RequestLog (status: approved)

3. Admin ลบอุปกรณ์
   → 📸 updateSnapshotsBeforeDelete()
   → อัปเดต assignedItemSnapshots[] เป็นข้อมูลล่าสุด
   → ลบ InventoryItem
```

**API:**
- `POST /api/admin/equipment-reports/requests/[id]/approve-with-selection`

**Code:**
```typescript
// เมื่ออนุมัติ
const { createInventoryItemSnapshotsBatch } = await import('@/lib/snapshot-helpers');
const snapshots = await createInventoryItemSnapshotsBatch(itemIds);
requestLog.items[0].assignedItemSnapshots = snapshots;
```

### **Scenario 2: คืนอุปกรณ์**

```
1. User ส่งคำขอคืน
   → 📸 createInventoryItemSnapshotsBatch()
   → สร้าง ReturnLog พร้อม snapshot

2. Admin อนุมัติ
   → transferInventoryItem() กลับ admin_stock
```

**API:**
- `POST /api/equipment-return`

**Code:**
```typescript
const { createInventoryItemSnapshotsBatch } = await import('@/lib/snapshot-helpers');
const snapshots = await createInventoryItemSnapshotsBatch(itemIds);

const cleanItems = returnData.items.map((item) => {
  const snapshot = snapshotMap.get(item.itemId);
  return {
    itemId: item.itemId,
    itemName: snapshot?.itemName,        // 🆕
    category: snapshot?.categoryName,    // 🆕
    categoryId: snapshot?.categoryId,    // 🆕
    serialNumber: snapshot?.serialNumber // 🆕
  };
});
```

### **Scenario 3: ลบอุปกรณ์**

```
1. Admin กดลบ
   → 📸 updateSnapshotsBeforeDelete(itemId)
   → หา RequestLog ทั้งหมดที่มี itemId
   → อัปเดต snapshot เป็นข้อมูลล่าสุด
   → ลบ InventoryItem
```

**API:**
- `DELETE /api/admin/inventory`
- `POST /api/admin/inventory/edit-item` (action: delete)

**Code:**
```typescript
const { updateSnapshotsBeforeDelete } = await import('@/lib/snapshot-helpers');
await updateSnapshotsBeforeDelete(itemId);
// อัปเดต assignedItemSnapshots[] ใน RequestLog อัตโนมัติ
```

### **Scenario 4: Equipment Tracking**

```
1. ดึง InventoryItems (user_owned)
2. ดึง RequestLogs (approved)
3. สร้าง itemToRequestMap พร้อม snapshot
4. แสดงผล:
   - มี snapshot → ใช้ snapshot 📸
   - ไม่มี snapshot → ใช้ real-time
```

**API:**
- `GET /api/admin/equipment-tracking`

**Code:**
```typescript
// สร้าง map พร้อม snapshot
itemToRequestMap.set(snapshot.itemId, {
  snapshot: snapshot, // 🆕
  requestDate: req.requestDate
});

// แสดงผล (Priority)
const finalItemName = 
  itemSnapshot?.itemName ||        // 1. Snapshot
  item.itemName ||                 // 2. Real-time
  'ไม่ระบุ';                       // 3. Fallback
```

---

# ส่วนที่ 4: Issue Log Snapshot

## 📋 **ระบบผู้แจ้งงาน (Requester)**

### **Individual User**

**บันทึก:**
```typescript
{
  requesterType: 'individual',
  requesterId: 'USER123',  // populate ทุกฟิลด์
  firstName: 'สมชาย',      // snapshot
  lastName: 'ใจดี',
  // ...
}
```

**แสดงผล:** Populate จาก User collection
**ลบ:** Snapshot ทุกฟิลด์

### **Branch User**

**บันทึก:**
```typescript
{
  requesterType: 'branch',
  requesterId: 'BRANCH001',
  officeId: '001',         // populate เฉพาะ office
  firstName: 'นางสาว A',   // snapshot
  office: 'สยาม',          // populate
  // ...
}
```

**แสดงผล:** Populate เฉพาะ office
**ลบ:** Snapshot เฉพาะ office

---

## 👨‍💼 **ระบบ IT Admin**

**บันทึก:**
```typescript
{
  assignedAdminId: 'ADMIN001',  // populate
  assignedAdmin: {              // snapshot
    name: 'สมชาย ใจดี',
    email: 'somchai@example.com'
  }
}
```

**ลบ Admin:** Snapshot ชื่อและอีเมล

---

## ⚙️ **Status & Condition Configs**

### **RequestLog / ReturnLog**

**บันทึก:**
```typescript
statusOnRequest: 'status_available',    // ID
statusOnRequestName: undefined,         // populate ตอนแสดงผล

conditionOnRequest: 'cond_working',     // ID
conditionOnRequestName: undefined,      // populate ตอนแสดงผล
```

**ลบ Config:**
```typescript
// Snapshot ก่อนลบ
await snapshotStatusConfigBeforeChange('status_available', 'พร้อมใช้');
// → RequestLog.statusOnRequestName = "พร้อมใช้"
// → RequestLog.statusOnRequest = null
```

---

# ส่วนที่ 5: Config Management

## 📁 **Category Config**

### **การลบ/แก้ไข**
```typescript
// API: PUT/DELETE /api/admin/inventory-config/categories/[id]

// ก่อนแก้ไข/ลบ
await snapshotCategoryConfigBeforeChange(id, newName);

// ผลลัพธ์:
// - RequestLog.items[].category = newName
// - ReturnLog.items[].category = newName  
// - TransferLog.categoryName = newName
```

### **Collections ที่ได้รับ Snapshot**
- RequestLog: `items[].category`
- ReturnLog: `items[].category`
- TransferLog: `categoryName`

---

## 📊 **Status Config**

### **การลบ/แก้ไข**
```typescript
// API: PUT/DELETE /api/admin/inventory-config/statuses/[id]

// ก่อนแก้ไข/ลบ
await snapshotStatusConfigBeforeChange(id, newName);

// ผลลัพธ์:
// - RequestLog.items[].statusOnRequestName = newName
// - ReturnLog.items[].statusOnReturnName = newName
```

### **Collections ที่ได้รับ Snapshot**
- RequestLog: `items[].statusOnRequestName`
- ReturnLog: `items[].statusOnReturnName`

---

## 🏷️ **Condition Config**

### **การลบ/แก้ไข**
```typescript
// API: PUT/DELETE /api/admin/inventory-config/conditions/[id]

// ก่อนแก้ไข/ลบ
await snapshotConditionConfigBeforeChange(id, newName);

// ผลลัพธ์:
// - RequestLog.items[].conditionOnRequestName = newName
// - ReturnLog.items[].conditionOnReturnName = newName
```

### **Collections ที่ได้รับ Snapshot**
- RequestLog: `items[].conditionOnRequestName`
- ReturnLog: `items[].conditionOnReturnName`

---

## 🔄 **Bulk Update Operations**

### **API Endpoints**
- `POST /api/admin/inventory-config` (Bulk Update)
- `PUT /api/admin/inventory/config` (Bulk Update)

### **การทำงาน**
```typescript
// ก่อน Bulk Update
try {
  const { snapshotConfigChangesBeforeBulkUpdate } = await import('@/lib/equipment-snapshot-helpers');
  const snapshotResult = await snapshotConfigChangesBeforeBulkUpdate(config, {
    categoryConfigs: categories,
    statusConfigs: statuses,
    conditionConfigs: conditions
  });
  console.log('📸 Bulk snapshot result:', snapshotResult);
} catch (snapshotError) {
  console.warn('Failed to snapshot config changes:', snapshotError);
  // Continue with update even if snapshot fails
}
```

---

# ส่วนที่ 6: Populate Functions

## 🔧 **Equipment Populate Helpers**

### **populateRequestLogUser()**
```typescript
// หาผู้ใช้จาก User collection
const user = await User.findOne({ user_id: requestLog.userId });

if (user) {
  if (user.userType === 'individual') {
    // บุคคล: ใช้ข้อมูลจาก User ทั้งหมด
    return { ...requestLog, firstName: user.firstName, ... };
  } else {
    // สาขา: ใช้เฉพาะข้อมูลสาขาจาก User
    return { 
      ...requestLog, 
      office: user.office,
      // firstName, lastName, etc. ใช้จากฟอร์ม (requesterFirstName)
    };
  }
} else {
  // ไม่เจอ User → ค้นหาจาก DeletedUsers
  const deletedUser = await DeletedUsers.findOne({ user_id: requestLog.userId });
  
  if (deletedUser) {
    if (deletedUser.userType === 'branch') {
      // สาขา: ข้อมูลส่วนตัวจากฟอร์ม, สาขาจาก DeletedUsers
      return {
        ...requestLog,
        firstName: requestLog.requesterFirstName,  // จากฟอร์ม
        office: deletedUser.office                 // จาก DeletedUsers
      };
    } else {
      // บุคคล: ใช้ข้อมูลจาก DeletedUsers ทั้งหมด
      return {
        ...requestLog,
        firstName: deletedUser.firstName,
        office: deletedUser.office,
        ...
      };
    }
  }
}
```

### **populateRequestLogItems()**
```typescript
// Populate ชื่อ Item, Category, Status, Condition
for (const item of requestLog.items) {
  // ถ้ามี masterId → ดึงชื่อจาก InventoryMaster (Real-time)
  if (item.masterId) {
    const master = await InventoryMaster.findById(item.masterId);
    item.itemName = master?.itemName || item.itemName;
  }
  
  // ถ้ามี categoryId → ดึงชื่อจาก CategoryConfig (Real-time)
  if (item.categoryId) {
    const config = await InventoryConfig.findOne();
    const category = config.categoryConfigs.find(c => c.id === item.categoryId);
    item.category = category?.name || item.category;
  }
  
  // เหมือนกันกับ Status และ Condition
}
```

---

## 🎯 **Issue Populate Helpers**

### **populateRequesterInfo()**
```typescript
// หาผู้ใช้จาก User collection
const user = await User.findOne({ user_id: issue.requesterId });

if (user) {
  if (user.userType === 'individual') {
    // บุคคล: ใช้ข้อมูลจาก User ทั้งหมด
    return { ...issue, firstName: user.firstName, ... };
  } else {
    // สาขา: ใช้เฉพาะสาขาจาก User, ข้อมูลส่วนตัวจากฟอร์ม
    return { 
      ...issue, 
      office: user.office,
      firstName: issue.firstName  // จากฟอร์มแจ้งปัญหา
    };
  }
} else {
  // ไม่เจอ User → ค้นหาจาก DeletedUsers
  const deletedUser = await DeletedUsers.findOne({ user_id: issue.requesterId });
  
  if (deletedUser) {
    if (deletedUser.userType === 'branch') {
      // สาขา: ข้อมูลส่วนตัวจากฟอร์ม, สาขาจาก DeletedUsers
      return {
        ...issue,
        firstName: issue.firstName,    // จากฟอร์ม
        office: deletedUser.office     // จาก DeletedUsers
      };
    } else {
      // บุคคล: ใช้ข้อมูลจาก DeletedUsers ทั้งหมด
      return {
        ...issue,
        firstName: deletedUser.firstName,
        office: deletedUser.office,
        ...
      };
    }
  }
}
```

### **populateAdminInfo()**
```typescript
// หาแอดมินจาก User collection
const admin = await User.findOne({ user_id: issue.assignedAdmin?.userId });

if (admin) {
  // Real-time
  return {
    ...issue,
    assignedAdmin: {
      userId: admin.user_id,
      name: admin.firstName + ' ' + admin.lastName,
      email: admin.email
    }
  };
} else {
  // ค้นหาจาก DeletedUsers
  const deletedAdmin = await DeletedUsers.findOne({ user_id: issue.assignedAdmin?.userId });
  
  if (deletedAdmin) {
    return {
      ...issue,
      assignedAdmin: {
        userId: deletedAdmin.user_id,
        name: deletedAdmin.firstName + ' ' + deletedAdmin.lastName,
        email: deletedAdmin.email
      }
    };
  }
}
```

---

## 🎯 **Priority และ Fallback Logic**

### **ลำดับความสำคัญ**
```
1. Snapshot (ถ้ามี)
2. Real-time (ถ้ายังมี ID)
3. Config Lookup (ถ้ามี configId)
4. "ไม่ระบุ" (fallback สุดท้าย)
```

### **ตัวอย่าง**
```typescript
// สำหรับ Status Name
const finalStatusName = 
  item.statusOnRequestName ||           // 1. Snapshot
  (await getStatusName(item.statusOnRequest)) ||  // 2. Real-time
  'ไม่ระบุ';                            // 3. Fallback
```

---

# ส่วนที่ 7: การทดสอบ

## 🧪 **Test Scenario: ครบทั้ง 7 กรณี**

### **กรณี 1: ลบแอดมิน**

**สถานการณ์:**
1. แอดมิน ADMIN_IT อนุมัติการเบิกอุปกรณ์
2. แอดมิน ADMIN_IT อัพเดตข้อมูลเป็น "Super Admin"
3. แอดมิน ADMIN_IT ถูกลบ
4. ผู้ใช้, อุปกรณ์, หมวดหมู่, สถานะ, สภาพ → อัพเดตข้อมูลทั้งหมด

**Expected Result:**
| ข้อมูล | แสดงผล | เหตุผล |
|--------|---------|--------|
| **แอดมิน** | "Super Admin IT" | 📸 Snapshot ก่อนลบ |
| ผู้ใช้ | ข้อมูลล่าสุด | ✅ ยังมีอยู่ในระบบ |
| อุปกรณ์ | ชื่อล่าสุด | ✅ ยังมีอยู่ในระบบ |
| หมวดหมู่ | ชื่อล่าสุด | ✅ ยังมีอยู่ในระบบ |
| สถานะ | ชื่อล่าสุด | ✅ ยังมีอยู่ในระบบ |
| สภาพ | ชื่อล่าสุด | ✅ ยังมีอยู่ในระบบ |

### **กรณี 2: ลบผู้ใช้บุคคล**

**สถานการณ์:**
1. ผู้ใช้ U001 (บุคคล) เบิกอุปกรณ์
2. ผู้ใช้ U001 อัพเดตข้อมูลเป็น "สมชาย (Updated)"
3. ผู้ใช้ U001 ถูกลบ
4. แอดมิน, อุปกรณ์, หมวดหมู่, สถานะ, สภาพ → อัพเดตข้อมูลทั้งหมด

**Expected Result:**
| ข้อมูล | แสดงผล | เหตุผล |
|--------|---------|--------|
| **ผู้ใช้** | "สมชาย (Updated)" | 📸 Snapshot ก่อนลบ |
| แอดมิน | ชื่อล่าสุด | ✅ ยังมีอยู่ในระบบ |
| อุปกรณ์ | ชื่อล่าสุด | ✅ ยังมีอยู่ในระบบ |
| หมวดหมู่ | ชื่อล่าสุด | ✅ ยังมีอยู่ในระบบ |
| สถานะ | ชื่อล่าสุด | ✅ ยังมีอยู่ในระบบ |
| สภาพ | ชื่อล่าสุด | ✅ ยังมีอยู่ในระบบ |

### **กรณี 3: ลบผู้ใช้สาขา**

**สถานการณ์:**
1. ผู้ใช้สาขา U002 เบิกอุปกรณ์ (กรอกฟอร์ม: ชื่อ "พนักงาน A", โทร "081-111", สาขา "ภูเก็ต")
2. ผู้ใช้สาขา U002 แจ้งปัญหา IT (กรอกฟอร์ม: ชื่อ "พนักงาน B", โทร "082-222")
3. ผู้ใช้สาขา U002 อัพเดตสาขาเป็น "ภูเก็ต (Central)"
4. ผู้ใช้สาขา U002 ถูกลบ

**Expected Result:**

**การเบิกอุปกรณ์:**
| ฟิลด์ | แสดงผล | เหตุผล |
|------|---------|--------|
| ชื่อ-นามสกุล | "พนักงาน A" | 📋 จากฟอร์มเบิก |
| โทรศัพท์ | "081-111" | 📋 จากฟอร์มเบิก |
| อีเมล | (ตามฟอร์ม) | 📋 จากฟอร์มเบิก |
| **สาขา** | "ภูเก็ต (Central)" | 📸 Snapshot ล่าสุดก่อนลบ |

**การแจ้งปัญหา IT:**
| ฟิลด์ | แสดงผล | เหตุผล |
|------|---------|--------|
| ชื่อ-นามสกุล | "พนักงาน B" | 📋 จากฟอร์มแจ้งปัญหา |
| โทรศัพท์ | "082-222" | 📋 จากฟอร์มแจ้งปัญหา |
| **สาขา** | "ภูเก็ต (Central)" | 📸 Snapshot ล่าสุดก่อนลบ |

### **กรณี 4-7: ลบอุปกรณ์, หมวดหมู่, สถานะ, สภาพ**

**หลักการเดียวกัน:**
- ข้อมูลที่ถูกลบ → แสดง Snapshot
- ข้อมูลที่ยังอยู่ → แสดง Real-time

---

## ✅ **Expected Results Summary**

| กรณี | ผลลัพธ์ที่คาดหวัง |
|------|------------------|
| **เบิกอุปกรณ์** | ✅ สร้าง snapshot ใน RequestLog |
| **คืนอุปกรณ์** | ✅ สร้าง snapshot ใน ReturnLog |
| **แก้ไขอุปกรณ์** | ⏸️ Snapshot ไม่เปลี่ยน |
| **ลบอุปกรณ์** | ✅ อัปเดต snapshot เป็นข้อมูลล่าสุด |
| **ตารางประวัติเบิก** | ✅ แสดงสภาพล่าสุดก่อนลบ (ไม่มี Unknown) |
| **ตารางประวัติคืน** | ✅ แสดงสภาพตอนคืน (จาก snapshot) |
| **Equipment Tracking** | ✅ อุปกรณ์ที่ลบไม่แสดง, ที่เหลือแสดงปกติ |
| **กู้คืนอุปกรณ์** | ✅ ได้ ID ใหม่ แต่ snapshot เก่ายังคงอยู่ |

---

## 🔍 **การตรวจสอบ Database**

### **ตรวจสอบ DeletedUsers**
```javascript
// MongoDB Shell
db.deletedusers.find({ user_id: "U001" }).pretty()
```

### **ตรวจสอบ Snapshot ใน Logs**
```javascript
// RequestLog
db.requestlogs.find({ userId: "U001" }).pretty()

// IssueLog
db.issuelogs.find({ requesterId: "U001" }).pretty()

// ReturnLog
db.returnlogs.find({ userId: "U001" }).pretty()
```

### **ตรวจสอบ Config Snapshots**
```javascript
// Status Snapshot
db.requestlogs.find(
  { "items.statusOnRequestName": { $exists: true } },
  { "items.statusOnRequestName": 1 }
).pretty()

// Category Snapshot
db.requestlogs.find(
  { "items.category": { $exists: true } },
  { "items.category": 1 }
).pretty()
```

---

# ส่วนที่ 8: การใช้งานและ Best Practices

## 📁 **ไฟล์สำคัญ**

### **Models:**
- ✅ `src/models/DeletedUser.ts` - Model สำหรับ DeletedUsers collection
- ✅ `src/models/RequestLog.ts` - Model สำหรับ RequestLog
- ✅ `src/models/ReturnLog.ts` - Model สำหรับ ReturnLog
- ✅ `src/models/IssueLog.ts` - Model สำหรับ IssueLog
- ✅ `src/models/TransferLog.ts` - Model สำหรับ TransferLog

### **Helpers:**
- ✅ `src/lib/equipment-populate-helpers.ts` - Populate functions สำหรับ Equipment Logs
- ✅ `src/lib/issue-helpers.ts` - Populate functions สำหรับ Issue Logs
- ✅ `src/lib/equipment-snapshot-helpers.ts` - Snapshot functions สำหรับ Config, Item
- ✅ `src/lib/snapshot-helpers.ts` - Snapshot functions สำหรับ User, Admin

### **API Endpoints:**
- ✅ `src/app/api/admin/users/[id]/route.ts` - ลบ User (สร้าง DeletedUsers)
- ✅ `src/app/api/admin/inventory/route.ts` - ลบ InventoryMaster (Snapshot)
- ✅ `src/app/api/admin/inventory-config/categories/[id]/route.ts` - ลบ/แก้ไข Category (Snapshot)
- ✅ `src/app/api/admin/inventory-config/statuses/[id]/route.ts` - ลบ/แก้ไข Status (Snapshot)
- ✅ `src/app/api/admin/inventory-config/conditions/[id]/route.ts` - ลบ/แก้ไข Condition (Snapshot)
- ✅ `src/app/api/admin/equipment-reports/requests/route.ts` - ดึงข้อมูล RequestLog (Populate)
- ✅ `src/app/api/admin/equipment-reports/returns/route.ts` - ดึงข้อมูล ReturnLog (Populate)
- ✅ `src/app/api/admin/it-reports/route.ts` - ดึงข้อมูล IssueLog (Populate)
- ✅ `src/app/api/user/issues/route.ts` - ดึงข้อมูล IssueLog ของ User (Populate)

---

## 🛠️ **Helper Functions**

### **Equipment Snapshot Helpers** (`src/lib/equipment-snapshot-helpers.ts`)

| Function | หน้าที่ | Collection ที่เกี่ยวข้อง |
|----------|---------|-------------------------|
| `getUserName()` | ดึงชื่อ User จาก user_id | User |
| `getStatusName()` | ดึงชื่อ Status จาก status_id | InventoryConfig |
| `getConditionName()` | ดึงชื่อ Condition จาก condition_id | InventoryConfig |
| `getCategoryName()` | ดึงชื่อ Category จาก category_id | InventoryConfig |
| `snapshotRequestLogsBeforeUserDelete()` | Snapshot User ใน RequestLog | RequestLog |
| `snapshotReturnLogsBeforeUserDelete()` | Snapshot User ใน ReturnLog | ReturnLog |
| `snapshotTransferLogsBeforeUserDelete()` | Snapshot User ใน TransferLog | TransferLog |
| `snapshotEquipmentLogsBeforeUserDelete()` | Snapshot User ทั้งหมด | RequestLog, ReturnLog, TransferLog |
| `snapshotStatusConfigBeforeChange()` | Snapshot Status Config | RequestLog, ReturnLog |
| `snapshotConditionConfigBeforeChange()` | Snapshot Condition Config | RequestLog, ReturnLog |
| `snapshotCategoryConfigBeforeChange()` | Snapshot Category Config | RequestLog, ReturnLog, TransferLog |
| `snapshotItemNameBeforeDelete()` | Snapshot Item Name | RequestLog |
| `snapshotConfigChangesBeforeBulkUpdate()` | Bulk Snapshot Configs | RequestLog, ReturnLog, TransferLog |

### **Equipment Populate Helpers** (`src/lib/equipment-populate-helpers.ts`)

| Function | หน้าที่ | รองรับ DeletedUsers |
|----------|---------|---------------------|
| `populateRequestLogItems()` | Populate items ใน RequestLog | N/A (สำหรับ item data) |
| `populateReturnLogItems()` | Populate items ใน ReturnLog | N/A (สำหรับ item data) |
| `populateRequestLogUser()` | Populate user ใน RequestLog | ✅ |
| `populateReturnLogUser()` | Populate user ใน ReturnLog | ✅ |
| `populateRequestLogComplete()` | Populate ทั้ง user + items | ✅ |
| `populateReturnLogComplete()` | Populate ทั้ง user + items | ✅ |
| `populateTransferLog()` | Populate user ใน TransferLog | N/A |
| `populateRequestLogCompleteBatch()` | Batch populate RequestLog | ✅ |
| `populateReturnLogCompleteBatch()` | Batch populate ReturnLog | ✅ |

### **Issue Helpers** (`src/lib/issue-helpers.ts`)

| Function | หน้าที่ | รองรับ DeletedUsers |
|----------|---------|---------------------|
| `populateAdminInfo()` | Populate admin ใน IssueLog | ✅ |
| `populateRequesterInfo()` | Populate requester ใน IssueLog | ✅ |
| `populateIssueInfo()` | Populate ทั้ง requester + admin | ✅ |
| `populateIssueInfoBatch()` | Batch populate IssueLog | ✅ |

### **Main Snapshot Helpers** (`src/lib/snapshot-helpers.ts`)

| Function | หน้าที่ |
|----------|---------|
| `snapshotUserBeforeDelete()` | Snapshot User ใน IssueLog |
| `checkUserRelatedIssues()` | ตรวจสอบ IssueLog ที่เกี่ยวข้อง |
| `updateSnapshotsBeforeDelete()` | Update snapshot ก่อนลบ InventoryItem |

---

## 📝 **Best Practices**

### **1. เมื่อสร้าง RequestLog/ReturnLog:**
```typescript
✅ ใช้ createInventoryItemSnapshotsBatch() ทันที
✅ เก็บทั้ง assignedItemIds และ assignedItemSnapshots
✅ เก็บทั้ง ID และ Name สำหรับ status/condition
```

### **2. เมื่อแสดงผล:**
```typescript
✅ เช็ค snapshot ก่อนเสมอ
✅ Fallback ไป real-time ถ้าไม่มี snapshot
✅ แสดง "ไม่ระบุ" เป็นค่าสุดท้าย
```

### **3. เมื่อลบอุปกรณ์:**
```typescript
✅ ใช้ updateSnapshotsBeforeDelete() อัตโนมัติ
✅ ระบบจะอัปเดต snapshot ให้เอง
✅ ไม่ต้อง manual update
```

### **4. Priority Order:**
```
Snapshot > Real-time > Config Lookup > "ไม่ระบุ"
```

---

## ⚠️ **ข้อควรระวัง**

### **1. ผู้ใช้สาขา (Branch User)**
```
✅ ถูกต้อง:
- ข้อมูลส่วนตัว (ชื่อ, นามสกุล, โทร, อีเมล) → จากฟอร์มแต่ละครั้ง
- ข้อมูลสาขา (office) → จาก DeletedUsers (ล่าสุดก่อนลบ)

❌ ผิด:
- ใช้ข้อมูลสาขาจากฟอร์ม (จะได้สาขาเก่าที่ไม่ตรงกับความเป็นจริง)
```

### **2. การลบ Config**
```
⚠️ ไม่สามารถลบ Config ที่มีการใช้งานใน InventoryItem
- ระบบจะตรวจสอบและแจ้งเตือนก่อน
- ต้องย้ายหรือลบ InventoryItem ก่อน

✅ สามารถลบได้:
- Config ที่ไม่มี InventoryItem ใช้งาน
- ระบบจะ snapshot ลงใน RequestLog, ReturnLog, TransferLog
```

### **3. Populate Order**
```
ลำดับการ Populate:
1. ดึงจาก Collection หลัก (User, InventoryMaster, Config)
2. ถ้าไม่เจอ → ดึงจาก DeletedUsers
3. ถ้ายังไม่เจอ → ใช้ข้อมูลที่เก็บในฟิลด์ของ Log
```

### **4. การใช้ API**
```typescript
// ✅ ถูกต้อง: ใช้ API ที่มี Snapshot
DELETE /api/admin/users/[id]  // มี snapshot อัตโนมัติ

// ❌ ผิด: ลบโดยตรงใน Database
await User.deleteOne({ user_id });  // ไม่มี snapshot
```

---

## 📈 **Performance**

### **การ Optimize:**
1. **Batch Populate:**
   ```typescript
   // ✅ ดี: Populate ทั้งหมดพร้อมกัน
   await populateRequestLogCompleteBatch(requests);
   
   // ❌ ไม่ดี: Populate ทีละรายการ
   for (const request of requests) {
     await populateRequestLogComplete(request);
   }
   ```

2. **Index:**
   ```typescript
   // DeletedUsers collection
   { userMongoId: 1 }        // unique index
   { user_id: 1 }            // index สำหรับค้นหา
   { deletedAt: 1 }          // index สำหรับเรียงลำดับ
   ```

3. **Select Fields:**
   ```typescript
   // เลือกเฉพาะฟิลด์ที่ต้องการ
   await User.findOne({ user_id }).select('firstName lastName office');
   ```

---

## ❓ **FAQ**

### **Q1: Snapshot จะ auto-update เมื่อแก้ไขข้อมูลหรือไม่?**
```
A: ⚠️ Update เฉพาะตอนลบเท่านั้น
   - ✅ เมื่อลบ → auto-update เป็นข้อมูลล่าสุด
   - ❌ เมื่อแก้ไข → ไม่ update (เก็บข้อมูล ณ ตอนเบิก/คืน)
```

### **Q2: RequestLog เก่าที่ไม่มี snapshot จะทำยังไง?**
```
A: ✅ ระบบจัดการเอง
   - เมื่อลบอุปกรณ์ → สร้าง snapshot อัตโนมัติ
   - ถ้ายังไม่ลบ → ใช้ real-time lookup (backward compatible)
```

### **Q3: ถ้าลบ InventoryMaster แล้ว masterId หาย?**
```
A: ✅ ไม่มีปัญหา
   - RequestLog มี assignedItemSnapshots[]
   - ไม่ต้องพึ่ง masterId อีกต่อไป
```

### **Q4: กู้คืนแล้วได้ ID ใหม่จะทำยังไง?**
```
A: ✅ Snapshot เก่ายังคงอยู่
   - ประวัติเก่าใช้ snapshot (item_id เก่า)
   - ประวัติใหม่ใช้ real-time (item_id ใหม่)
```

---

## 🎉 **สรุป**

### **ระบบ Snapshot = Hybrid Approach**

1. ✅ **Snapshot เมื่อเบิก/คืน** - เก็บข้อมูล historical
2. ✅ **Snapshot เมื่อลบ** - อัปเดตเป็นข้อมูลล่าสุด
3. ✅ **Backward Compatible** - RequestLog เก่ายังใช้งานได้
4. ✅ **ไม่ต้อง run script** - ระบบทำอัตโนมัติ
5. ✅ **Performance ดี** - ไม่ update ทุกครั้งที่แก้ไข

### **ประโยชน์:**
- ✅ ข้อมูลไม่สูญหายเมื่อลบ
- ✅ แสดงข้อมูล historical ถูกต้อง
- ✅ แก้ปัญหา masterId หายเมื่อกู้คืน
- ✅ ไม่มี "Unknown" ในตาราง
- ✅ รองรับผู้ใช้สาขาได้อย่างถูกต้อง
- ✅ จัดการ Config deletion ได้สมบูรณ์

### **ตารางที่ใช้ระบบ Snapshot**

| หน้าตาราง | URL | ข้อมูลที่แสดง |
|-----------|-----|--------------|
| รายงานเบิก/คืนอุปกรณ์ | `/admin/equipment-reports` | User, Admin, Item, Category, Status, Condition |
| รายงานแจ้งปัญหา IT | `/admin/it-reports` | User (Requester), Admin |
| ติดตามงาน IT | `/it-tracking` | User (Requester), Admin |
| ติดตามอุปกรณ์ | `/admin/equipment-tracking` | User, Item, Category, Status, Condition |
| Dashboard | `/dashboard` | User, Item (ถ้ามี) |

---

## 📚 **เอกสารเพิ่มเติม**

เอกสารนี้รวมเนื้อหาจาก:
- `SNAPSHOT_SYSTEM_VERIFICATION.md` - รายละเอียดเทคนิคและโค้ด
- `SNAPSHOT_SYSTEM_TESTING_GUIDE.md` - คู่มือทดสอบแบบละเอียด
- `SNAPSHOT_SYSTEM_SUMMARY.md` - ตารางเปรียบเทียบ 7 กรณี
- `SNAPSHOT_SYSTEM_README_TH.md` - คู่มือฉบับสมบูรณ์
- `SNAPSHOT_FINAL_SUMMARY.md` - สรุปสุดท้าย

---

**สถานะ:** ✅ พร้อมใช้งาน  
**รุ่น:** v4.0  
**อัปเดทล่าสุด:** มกราคม 2568

🎉 **Happy Tracking!**