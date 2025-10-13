# คู่มือระบบ Snapshot (Snapshot System Guide)

> **เอกสารรวม**: ระบบ Snapshot สำหรับทุก Logs ในระบบ  
> **รุ่น**: v2.0

---

## 📋 สารบัญ

### ส่วนที่ 1: ระบบแจ้งงาน IT (IssueLog)
1. [ภาพรวม IssueLog](#1-ภาพรวม-issuelog)
2. [ระบบผู้แจ้งงาน (Requester)](#2-ระบบผู้แจ้งงาน-requester)
3. [ระบบมอบหมาย IT Admin](#3-ระบบมอบหมาย-it-admin)
4. [Snapshot IssueLog](#4-snapshot-issuelog)

### ส่วนที่ 2: ระบบจัดการอุปกรณ์ (Equipment Logs)
5. [ภาพรวม Equipment Logs](#5-ภาพรวม-equipment-logs)
6. [Snapshot Status & Condition](#6-snapshot-status--condition)
7. [Snapshot User Names](#7-snapshot-user-names)

### ส่วนที่ 3: ระบบรวม
8. [โครงสร้างข้อมูล](#8-โครงสร้างข้อมูล)
9. [ไฟล์ที่เกี่ยวข้อง](#9-ไฟล์ที่เกี่ยวข้อง)
10. [การทดสอบ](#10-การทดสอบ)
11. [หมายเหตุสำหรับ Developer](#11-หมายเหตุสำหรับ-developer)

---

# ส่วนที่ 1: ระบบแจ้งงาน IT (IssueLog)

## 1. ภาพรวม IssueLog

ระบบแจ้งงาน IT ใช้ระบบ **ID-based + Snapshot** เพื่อให้:
- ✅ ข้อมูลเป็นปัจจุบันเสมอ (populate จาก User ID)
- ✅ ปลอดภัยเมื่อลบ User (snapshot ข้อมูลล่าสุดก่อนลบ)
- ✅ ประหยัดพื้นที่ (ไม่ซ้ำซ้อน)

### หลักการสำคัญ

**ผู้แจ้งงาน (Requester)**:
- Individual User: เก็บ `requesterId` → Populate ทุกฟิลด์จาก User
- Branch User: เก็บ `requesterId` + `officeId` → Populate เฉพาะ office

**IT Admin**:
- เก็บ `assignedAdminId` → Populate ข้อมูลล่าสุดจาก User

**Snapshot ก่อนลบ**:
- Individual: Snapshot ทุกฟิลด์
- Branch: Snapshot เฉพาะ office
- Admin: Snapshot ชื่อและอีเมล

---

## 2. ระบบผู้แจ้งงาน (Requester)

### Individual User

**การบันทึก**:
```typescript
{
  requesterType: 'individual',
  requesterId: 'USER123',
  // ข้อมูลอื่นเป็น Snapshot
  firstName: 'สมชาย',
  lastName: 'ใจดี',
  // ...
}
```

**การแสดงผล**:
```typescript
// Populate ข้อมูลล่าสุดจาก User
const user = await User.findOne({ user_id: requesterId });
// แสดงชื่อ, แผนก, สาขาล่าสุด
```

**ตัวอย่าง**:
```
วันที่ 1: User A แจ้งงาน (ชื่อ: สมชาย ใจดี)
วันที่ 5: User A เปลี่ยนชื่อ → "สมชาย มีสุข"
วันที่ 10: แสดงผล → "สมชาย มีสุข" ✅ (อัพเดตอัตโนมัติ)
```

### Branch User

**การบันทึก**:
```typescript
{
  requesterType: 'branch',
  requesterId: 'BRANCH001',
  officeId: '001',
  // ข้อมูลที่กรอกในฟอร์ม (Snapshot)
  firstName: 'นางสาว A',
  lastName: 'B',
  office: 'สยาม',
  // ...
}
```

**การแสดงผล**:
```typescript
// Populate เฉพาะ office
const user = await User.findOne({ user_id: requesterId });
issue.office = user.office; // อัพเดตชื่อสาขาล่าสุด
// firstName, lastName ใช้ Snapshot
```

**ตัวอย่าง**:
```
วันที่ 1: Branch User แจ้งงาน (สาขา: สยาม)
วันที่ 5: Admin เปลี่ยนชื่อสาขา → "สยามสแควร์"
วันที่ 10: แสดงผล → สาขา: "สยามสแควร์" ✅ (อัพเดตอัตโนมัติ)
```

---

## 3. ระบบมอบหมาย IT Admin

### การมอบหมายงาน

**การบันทึก**:
```typescript
{
  assignedAdminId: 'ADMIN001',
  assignedAdmin: {  // backward compatibility
    name: 'สมชาย ใจดี',
    email: 'somchai@example.com'
  }
}
```

**การแสดงผล**:
```typescript
// Populate ข้อมูลล่าสุดจาก User
const admin = await User.findOne({ user_id: assignedAdminId });
displayName = admin.userType === 'individual'
  ? `${admin.firstName} ${admin.lastName}`
  : admin.office;
```

**ตัวอย่าง**:
```
วันที่ 1: Admin A รับงาน (ชื่อ: สมชาย ใจดี)
วันที่ 5: Admin A เปลี่ยนชื่อ → "สมชาย มีสุข"
วันที่ 10: แสดงผล → "สมชาย มีสุข" ✅ (อัพเดตอัตโนมัติ)
วันที่ 15: ลบ Admin A → Snapshot "สมชาย มีสุข"
วันที่ 20: แสดงผล → "สมชาย มีสุข" ✅ (Snapshot)
```

---

## 4. Snapshot IssueLog

### กลไกการทำงาน

```typescript
// ก่อนลบ User
const relatedIssues = await checkUserRelatedIssues(userId);

if (relatedIssues.hasRelatedIssues) {
  await snapshotUserBeforeDelete(userId);
}

await User.deleteOne({ user_id: userId });
```

### Snapshot Individual User

```typescript
// ดึงข้อมูลล่าสุด
const user = await User.findOne({ user_id });

// Snapshot ทุกฟิลด์
await IssueLog.updateMany(
  { requesterId: userId },
  { 
    $set: {
      firstName: user.firstName,
      lastName: user.lastName,
      nickname: user.nickname,
      department: user.department,
      office: user.office,
      phone: user.phone,
      email: user.email
    },
    $unset: { requesterId: "", officeId: "" }
  }
);
```

### Snapshot Branch User

```typescript
// Snapshot เฉพาะ office
await IssueLog.updateMany(
  { requesterId: userId },
  { 
    $set: { office: user.office },
    $unset: { requesterId: "", officeId: "" }
  }
);
```

### Snapshot IT Admin

```typescript
// Snapshot ชื่อและอีเมล
await IssueLog.updateMany(
  { assignedAdminId: adminId },
  { 
    $set: {
      'assignedAdmin.name': `${admin.firstName} ${admin.lastName}`,
      'assignedAdmin.email': admin.email
    },
    $unset: { assignedAdminId: "" }
  }
);
```

---

# ส่วนที่ 2: ระบบจัดการอุปกรณ์ (Equipment Logs)

## 5. ภาพรวม Equipment Logs

ระบบจัดการอุปกรณ์มี 3 Log หลัก:
- **RequestLog** - การเบิกอุปกรณ์
- **ReturnLog** - การคืนอุปกรณ์
- **TransferLog** - การโอนย้ายอุปกรณ์

### ปัญหาที่แก้ไข

**1. Status & Condition Configs อาจถูกลบ/แก้ไข**

```typescript
// ปัญหา
statusOnRequest: "status_available"  // ถ้าลบ config → ไม่รู้ว่าสถานะคืออะไร

// วิธีแก้
statusOnRequest: "status_available"      // ID
statusOnRequestName: "มี"                // Snapshot ชื่อ
```

**2. User อาจถูกลบ**

```typescript
// ปัญหา
approvedBy: "USER001"  // ถ้าลบ User → ไม่รู้ว่าใครอนุมัติ

// วิธีแก้
approvedBy: "USER001"           // ID
approvedByName: "สมชาย ใจดี"    // Snapshot ชื่อ
```

### กลไกการทำงาน

1. **ตอนบันทึก**: เก็บ ID (statusId, userId)
2. **ตอนแสดงผล**: Populate ชื่อล่าสุด (ถ้ายังมี ID)
3. **ตอนลบ**: Snapshot ชื่อล่าสุด แล้วลบ ID
4. **หลังลบ**: ใช้ Snapshot แสดงผล

---

## 6. Snapshot Status & Condition

### RequestLog

**การบันทึก**:
```typescript
// Admin อนุมัติการเบิก
requestLog.items[0] = {
  statusOnRequest: 'status_available',      // ID
  conditionOnRequest: 'cond_working',       // ID
  statusOnRequestName: undefined,           // Populate ตอนแสดงผล
  conditionOnRequestName: undefined
}

requestLog.approvedBy = 'ADMIN001';         // ID
requestLog.approvedByName = undefined;      // Populate ตอนแสดงผล
```

**การแสดงผล**:
```typescript
import { populateRequestLogItems } from '@/lib/equipment-populate-helpers';

const populated = await populateRequestLogItems(requestLog);
// populated.items[0].statusOnRequestName = "มี"
// populated.items[0].conditionOnRequestName = "ใช้งานได้"
// populated.approvedByName = "สมชาย ใจดี"
```

**การลบ Config**:
```typescript
import { snapshotStatusConfigBeforeChange } from '@/lib/equipment-snapshot-helpers';

// Snapshot ก่อนลบ/แก้ไข
await snapshotStatusConfigBeforeChange('status_available', 'พร้อมใช้');

// ผลลัพธ์:
// - RequestLog ทุกรายการจะมี statusOnRequestName = "พร้อมใช้"
// - ลบ statusOnRequest (ไม่ populate อีกต่อไป)
```

### ReturnLog

**การบันทึก**:
```typescript
returnLog.items[0] = {
  statusOnReturn: 'status_available',       // ID
  conditionOnReturn: 'cond_damaged',        // ID
  statusOnReturnName: undefined,
  conditionOnReturnName: undefined,
  approvedBy: 'ADMIN001',
  approvedByName: undefined
}
```

**การแสดงผล**:
```typescript
import { populateReturnLogItems } from '@/lib/equipment-populate-helpers';

const populated = await populateReturnLogItems(returnLog);
// populated.items[0].statusOnReturnName = "มี"
// populated.items[0].conditionOnReturnName = "ชำรุด"
// populated.items[0].approvedByName = "สมชาย ใจดี"
```

---

## 7. Snapshot User Names

### TransferLog

**การบันทึก (Snapshot ตั้งแต่สร้าง)**:
```typescript
const transferLog = new TransferLog({
  fromOwnership: {
    ownerType: 'user_owned',
    userId: 'USER001',
    userName: await getUserName('USER001')  // Snapshot ทันที
  },
  toOwnership: {
    ownerType: 'admin_stock'
  },
  processedBy: 'ADMIN001',
  processedByName: await getUserName('ADMIN001'),
  approvedBy: 'ADMIN002',
  approvedByName: await getUserName('ADMIN002')
});
```

**การแสดงผล**:
```typescript
import { populateTransferLog } from '@/lib/equipment-populate-helpers';

// Populate ถ้ายังไม่มี userName (ข้อมูลเก่า)
const populated = await populateTransferLog(transferLog);
```

**การลบ User**:
```typescript
import { snapshotEquipmentLogsBeforeUserDelete } from '@/lib/equipment-snapshot-helpers';

await snapshotEquipmentLogsBeforeUserDelete('USER001');

// ผลลัพธ์:
// - RequestLog: approvedBy, rejectedBy → Snapshot ชื่อ
// - ReturnLog: items[].approvedBy → Snapshot ชื่อ
// - TransferLog: fromOwnership, toOwnership, processedBy, approvedBy → Snapshot ชื่อ
```

---

# ส่วนที่ 3: ระบบรวม

## 8. โครงสร้างข้อมูล

### IssueLog Model

```typescript
interface IIssueLog {
  issueId: string;
  
  // Requester
  requesterType?: 'individual' | 'branch';
  requesterId?: string;
  officeId?: string;
  
  // Requester Info (Snapshot)
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  email: string;
  department: string;
  office: string;
  
  // Issue Details
  issueCategory: string;
  urgency: 'very_urgent' | 'normal';
  description: string;
  images?: string[];
  
  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'closed';
  
  // IT Admin
  assignedAdminId?: string;
  assignedAdmin?: {
    name: string;
    email: string;
  };
}
```

### RequestLog Model

```typescript
interface IRequestItem {
  masterId: string;
  quantity: number;
  statusOnRequest?: string;           // ID
  conditionOnRequest?: string;        // ID
  statusOnRequestName?: string;       // Snapshot
  conditionOnRequestName?: string;    // Snapshot
}

interface IRequestLog {
  userId: string;
  items: IRequestItem[];
  approvedBy?: string;                // ID
  approvedByName?: string;            // Snapshot
  rejectedBy?: string;                // ID
  rejectedByName?: string;            // Snapshot
}
```

### ReturnLog Model

```typescript
interface IReturnItem {
  itemId: string;
  statusOnReturn?: string;            // ID
  conditionOnReturn?: string;         // ID
  statusOnReturnName?: string;        // Snapshot
  conditionOnReturnName?: string;     // Snapshot
  approvedBy?: string;                // ID
  approvedByName?: string;            // Snapshot
}

interface IReturnLog {
  userId: string;
  items: IReturnItem[];
}
```

### TransferLog Model

```typescript
interface ITransferLog {
  fromOwnership: {
    ownerType: 'admin_stock' | 'user_owned' | 'new_item';
    userId?: string;                  // ID
    userName?: string;                // Snapshot
  };
  
  toOwnership: {
    ownerType: 'admin_stock' | 'user_owned';
    userId?: string;                  // ID
    userName?: string;                // Snapshot
  };
  
  processedBy?: string;               // ID
  processedByName?: string;           // Snapshot
  approvedBy?: string;                // ID
  approvedByName?: string;            // Snapshot
}
```

---

## 9. ไฟล์ที่เกี่ยวข้อง

### Models
- ✅ `src/models/IssueLog.ts`
- ✅ `src/models/RequestLog.ts`
- ✅ `src/models/ReturnLog.ts`
- ✅ `src/models/TransferLog.ts`

### Helper Functions

**Issue Helpers** (`src/lib/issue-helpers.ts`):
- ✅ `populateRequesterInfo()` - Populate ผู้แจ้งงาน
- ✅ `populateAdminInfo()` - Populate IT Admin
- ✅ `populateIssueInfo()` - Populate ทั้งคู่
- ✅ `formatIssueForEmail()` - สำหรับส่งอีเมล

**Equipment Snapshot Helpers** (`src/lib/equipment-snapshot-helpers.ts`):
- ✅ `getUserName()` - ดึงชื่อ User
- ✅ `getStatusName()` - ดึงชื่อสถานะ
- ✅ `getConditionName()` - ดึงชื่อสภาพ
- ✅ `snapshotRequestLogsBeforeUserDelete()` - Snapshot RequestLog
- ✅ `snapshotReturnLogsBeforeUserDelete()` - Snapshot ReturnLog
- ✅ `snapshotTransferLogsBeforeUserDelete()` - Snapshot TransferLog
- ✅ `snapshotStatusConfigBeforeChange()` - Snapshot Status Config
- ✅ `snapshotConditionConfigBeforeChange()` - Snapshot Condition Config

**Equipment Populate Helpers** (`src/lib/equipment-populate-helpers.ts`):
- ✅ `populateRequestLogItems()` - Populate RequestLog
- ✅ `populateReturnLogItems()` - Populate ReturnLog
- ✅ `populateTransferLog()` - Populate TransferLog

**Main Snapshot Helpers** (`src/lib/snapshot-helpers.ts`):
- ✅ `snapshotRequesterBeforeDelete()` - Snapshot Requester (IssueLog)
- ✅ `snapshotAdminBeforeDelete()` - Snapshot Admin (IssueLog)
- ✅ `snapshotUserBeforeDelete()` - Snapshot ทุก Logs
- ✅ `checkUserRelatedIssues()` - ตรวจสอบข้อมูลที่เกี่ยวข้อง

### API Routes

**สำหรับลบ User**:
- ✅ `src/app/api/admin/users/[id]/delete-with-snapshot/route.ts`

---

## 10. การทดสอบ

### A. IssueLog

**Individual User**:
- [ ] แจ้งงาน IT
- [ ] เปลี่ยนชื่อ → ตรวจสอบว่าอัพเดตตาม
- [ ] ลบ User → ตรวจสอบ Snapshot

**Branch User**:
- [ ] แจ้งงาน IT
- [ ] เปลี่ยนชื่อสาขา → ตรวจสอบว่าอัพเดตตาม
- [ ] ลบ User → ตรวจสอบ Snapshot office

**IT Admin**:
- [ ] รับงาน
- [ ] เปลี่ยนชื่อ → ตรวจสอบว่าอัพเดตตาม
- [ ] ลบ Admin → ตรวจสอบ Snapshot

### B. Equipment Logs

**RequestLog**:
- [ ] อนุมัติการเบิก → ตรวจสอบ status, condition, approvedBy
- [ ] Populate → ตรวจสอบชื่อทั้งหมด
- [ ] ลบ Config → ตรวจสอบ Snapshot
- [ ] ลบ Admin → ตรวจสอบ Snapshot

**ReturnLog**:
- [ ] คืนอุปกรณ์ → ตรวจสอบ status, condition
- [ ] อนุมัติ → ตรวจสอบ approvedBy
- [ ] Populate → ตรวจสอบชื่อทั้งหมด
- [ ] ลบ Admin → ตรวจสอบ Snapshot

**TransferLog**:
- [ ] โอนย้าย → ตรวจสอบ userName, processedByName
- [ ] Populate → ตรวจสอบชื่อทั้งหมด
- [ ] ลบ User → ตรวจสอบ Snapshot

---

## 11. หมายเหตุสำหรับ Developer

### การใช้ Populate Functions

**IssueLog**:
```typescript
import { populateIssueInfo, formatIssueForEmail } from '@/lib/issue-helpers';

// สำหรับแสดงผล
const populated = await populateIssueInfo(issue);

// สำหรับส่งอีเมล
const emailData = await formatIssueForEmail(issue);
```

**Equipment Logs**:
```typescript
import { 
  populateRequestLogItems,
  populateReturnLogItems,
  populateTransferLog 
} from '@/lib/equipment-populate-helpers';

// Populate แต่ละประเภท
const requestLog = await populateRequestLogItems(requestLog);
const returnLog = await populateReturnLogItems(returnLog);
const transferLog = await populateTransferLog(transferLog);
```

### การลบ User

```typescript
// ใช้ API ที่มีให้
DELETE /api/admin/users/[id]/delete-with-snapshot

// Snapshot ทุก Logs อัตโนมัติ:
// - IssueLog (requester, admin)
// - RequestLog (approvedBy, rejectedBy)
// - ReturnLog (items[].approvedBy)
// - TransferLog (fromOwnership, toOwnership, processedBy, approvedBy)
```

### การลบ/แก้ไข Config

```typescript
import { 
  snapshotStatusConfigBeforeChange,
  snapshotConditionConfigBeforeChange 
} from '@/lib/equipment-snapshot-helpers';

// ก่อนลบ/แก้ไข → Snapshot
await snapshotStatusConfigBeforeChange(statusId, newName);
await snapshotConditionConfigBeforeChange(conditionId, newName);
```

### ข้อควรระวัง

1. **ห้ามลบ User โดยตรง** - ต้องใช้ API `/delete-with-snapshot`
2. **ห้ามลบ Config โดยตรง** - ต้อง Snapshot ก่อน
3. **ใช้ populate functions เสมอ** - ก่อนส่งข้อมูลไป Frontend/Email
4. **TransferLog ควร Snapshot ตั้งแต่สร้าง** - เพราะ User อาจถูกลบเร็ว

---

## สรุป

### IssueLog
- ✅ Individual: เก็บ ID → Populate ทุกฟิลด์
- ✅ Branch: เก็บ ID → Populate เฉพาะ office
- ✅ Admin: เก็บ ID → Populate ชื่อและอีเมล
- ✅ Snapshot ก่อนลบ User

### Equipment Logs
- ✅ Status/Condition: เก็บ ID → Populate ชื่อ → Snapshot ก่อนลบ Config
- ✅ User Names: เก็บ ID → Populate ชื่อ → Snapshot ก่อนลบ User
- ✅ TransferLog: Snapshot ตั้งแต่สร้าง

### ประโยชน์
- ✅ ข้อมูลเป็นปัจจุบันเสมอ (populate)
- ✅ ปลอดภัยเมื่อลบ Config/User (snapshot)
- ✅ ข้อมูลประวัติครบถ้วน
- ✅ Backward Compatible 100%

### 🔒 ความปลอดภัย
- ✅ ลบ User/Config ไม่กระทบข้อมูลประวัติ
- ✅ Snapshot อัตโนมัติก่อนลบ
- ✅ แสดงผลได้ปกติแม้ถูกลบแล้ว

---

**สถานะ**: ✅ พร้อมใช้งาน

**รุ่น**: v2.0

**อัพเดทล่าสุด**: ตุลาคม 2568

