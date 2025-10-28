# เอกสารระบบสมบูรณ์ - ระบบจัดการคลังอุปกรณ์ (Complete System Documentation)

## 📋 สารบัญ

1. [ระบบการคืนอุปกรณ์](#1-ระบบการคืนอุปกรณ์)
2. [ระบบการลบผู้ใช้และ Snapshot](#2-ระบบการลบผู้ใช้และ-snapshot)
3. [การแก้ไข Branch User Phone Snapshot](#3-การแก้ไข-branch-user-phone-snapshot)
4. [สรุปการทำงานของระบบทั้งหมด](#4-สรุปการทำงานของระบบทั้งหมด)

---

## 1. ระบบการคืนอุปกรณ์

### ✅ สถานการณ์ที่รองรับทั้งหมด

| กรณี | ประเภทผู้ใช้ | วิธีการ | สถานะ/สภาพที่คืน | สถานะระบบ |
|------|-------------|---------|-----------------|-----------|
| 1 | บุคคล | เพิ่มอุปกรณ์เอง | หาย + ชำรุด | ✅ ทำงานได้ |
| 2 | สาขา | เพิ่มอุปกรณ์เอง | หาย + ชำรุด | ✅ ทำงานได้ |
| 3 | บุคคล | เบิกอุปกรณ์ | หาย + ชำรุด | ✅ ทำงานได้ |
| 4 | สาขา | เบิกอุปกรณ์ | หาย + ชำรุด | ✅ ทำงานได้ |

### 🔄 กระบวนการคืนอุปกรณ์

#### ขั้นตอนที่ 1: ผู้ใช้คืนอุปกรณ์
```typescript
// หน้า /equipment-return
{
  statusOnReturn: 'status_missing',    // หาย
  conditionOnReturn: 'cond_damaged',   // ชำรุด
  statusOnReturnName: 'หาย',
  conditionOnReturnName: 'ชำรุด'
}
```

#### ขั้นตอนที่ 2: แอดมินอนุมัติการคืน
```typescript
// API: /api/admin/equipment-return/approve
await changeItemStatus(
  item.itemId,
  'status_missing',  // สถานะ "หาย"
  'cond_damaged',    // สภาพ "ชำรุด"
  adminUserId,
  'คืนจากผู้ใช้'
);

await transferInventoryItem({
  fromOwnerType: 'user_owned',
  toOwnerType: 'admin_stock',
  transferType: 'return_completed'
});

await updateInventoryMaster(itemName, categoryId);
```

#### ขั้นตอนที่ 3: อัปเดต InventoryMaster
```typescript
// การคำนวณจำนวน
const availableToBorrow = adminStockItems.filter(item => 
  item.statusId === 'status_available' &&  // สถานะ "มี"
  item.conditionId === 'cond_working'      // สภาพ "ใช้งานได้"
);

// ผลลัพธ์
updatedMaster.totalQuantity = allItems.length;           // นับทุกชิ้น
updatedMaster.availableQuantity = availableToBorrow.length; // เฉพาะที่เบิกได้
updatedMaster.statusBreakdown = { status_missing: 1, ... };
updatedMaster.conditionBreakdown = { cond_damaged: 1, ... };
```

### 📊 การแสดงผลในตาราง

#### คอลัมน์ "จำนวนที่เบิกได้"
- แสดงเฉพาะอุปกรณ์ที่ **พร้อมเบิกได้จริง** (มี + ใช้งานได้)

#### คอลัมน์ "จำนวนทั้งหมด"
- แสดงจำนวนทั้งหมด (ไม่ว่าจะเป็นสถานะ/สภาพใด)
- แสดงจำนวนที่ผู้ใช้ครอบครอง (ถ้ามี)
- ✅ **ไม่แสดงข้อความ "⚠️ ชำรุด/สูญหาย:" อีกต่อไป**

#### ไอคอน "ดูข้อมูลเพิ่มเติม"
- แสดงรายละเอียดครบถ้วน: Status breakdown, Condition breakdown, Type breakdown

---

## 2. ระบบการลบผู้ใช้และ Snapshot

### ✅ คำตอบสั้น

| คำถาม | คำตอบ |
|-------|-------|
| **มีการ snapshot ก่อนลบหรือไม่?** | ✅ **ใช่** - ระบบทำ snapshot อัตโนมัติ 2 ชั้น |
| **ข้อมูลผู้ใช้ยังอัปเดตหลังลบหรือไม่?** | ❌ **ไม่** - Frozen เป็นค่าล่าสุดก่อนลบ |
| **ข้อมูลอื่นยังอัปเดตหลังลบผู้ใช้หรือไม่?** | ✅ **ได้** - อุปกรณ์ สถานะ สภาพ หมวดหมู่ แอดมินคนอื่น |

### 🔄 กระบวนการลบผู้ใช้

#### ขั้นตอนที่ 1: ตรวจสอบความพร้อม
```typescript
const userOwnedItems = await InventoryItem.find({
  'currentOwnership.ownerType': 'user_owned',
  'currentOwnership.userId': userToDelete.user_id
});

if (userOwnedItems.length > 0) {
  // ❌ ไม่สามารถลบได้ - ต้องคืนอุปกรณ์ก่อน
  return NextResponse.json({ 
    error: 'ไม่สามารถลบผู้ใช้ได้',
    message: `ผู้ใช้มีอุปกรณ์ ${userOwnedItems.length} รายการที่ต้องคืนก่อน`
  }, { status: 400 });
}
```

#### ขั้นตอนที่ 2: Snapshot #1 - บันทึกข้อมูลผู้ใช้
```typescript
const snapData = {
  userMongoId: userToDelete._id.toString(),
  user_id: userToDelete.user_id,
  userType: userToDelete.userType,
  
  // สำหรับผู้ใช้ประเภทสาขา
  ...(userToDelete.userType === 'branch' ? {
    office: userToDelete.office,
    email: userToDelete.email,
    // ❌ ไม่ snapshot: firstName, lastName, nickname, department, phone
  } : {
    // สำหรับผู้ใช้ประเภทบุคคล - snapshot ทั้งหมด
    firstName: userToDelete.firstName,
    lastName: userToDelete.lastName,
    nickname: userToDelete.nickname,
    department: userToDelete.department,
    office: userToDelete.office,
    phone: userToDelete.phone,
    email: userToDelete.email,
  }),
  deletedAt: new Date()
};

await DeletedUsers.findOneAndUpdate(
  { userMongoId: snapData.userMongoId },
  snapData,
  { upsert: true, new: true }
);
```

#### ขั้นตอนที่ 3: Snapshot #2 - อัปเดตข้อมูลใน Logs
```typescript
const { snapshotUserBeforeDelete } = await import('@/lib/snapshot-helpers');
await snapshotUserBeforeDelete(userToDelete.user_id);

// ระบบจะ snapshot ใน:
// 1. RequestLog (ประวัติเบิกอุปกรณ์)
// 2. ReturnLog (ประวัติคืนอุปกรณ์)
// 3. TransferLog (ประวัติโอนย้ายอุปกรณ์)
// 4. IssueLog (ประวัติแจ้งปัญหา)
```

#### ขั้นตอนที่ 4: ลบผู้ใช้
```typescript
await User.findByIdAndDelete(id);
```

### 📸 รายละเอียด Snapshot Functions

#### 1. RequestLog Snapshot

**ผู้ใช้ประเภทบุคคล:**
```typescript
updateFields = {
  requesterFirstName: user.firstName || '',
  requesterLastName: user.lastName || '',
  requesterNickname: user.nickname || '',
  requesterDepartment: user.department || '',
  requesterOffice: user.office || '',
  requesterPhone: user.phone || '',
  requesterEmail: user.email || ''
};
```

**ผู้ใช้ประเภทสาขา:**
```typescript
updateFields = {
  requesterOffice: user.office || '',
  requesterEmail: user.email || ''
  // ❌ ไม่แตะ: firstName, lastName, nickname, department, phone
};
```

#### 2. ReturnLog Snapshot

**ผู้ใช้ประเภทบุคคล:**
```typescript
updateFields = {
  returnerFirstName: user.firstName || '',
  returnerLastName: user.lastName || '',
  returnerNickname: user.nickname || '',
  returnerDepartment: user.department || '',
  returnerOffice: user.office || '',
  returnerPhone: user.phone || '',
  returnerEmail: user.email || ''
};
```

**ผู้ใช้ประเภทสาขา:**
```typescript
updateFields = {
  returnerOffice: user.office || '',
  returnerEmail: user.email || ''
  // ❌ ไม่แตะ: firstName, lastName, nickname, department, phone
};
```

### 🔍 การแสดงข้อมูลหลังลบผู้ใช้

#### ผู้ใช้ยังคงอยู่ในระบบ
```typescript
const user = await User.findOne({ user_id: userId });
if (user) {
  populated.firstName = user.firstName;  // Real-time
  populated.office = user.office;        // Real-time
}
```

#### ผู้ใช้ถูกลบแล้ว (Individual)
```typescript
const deletedUser = await DeletedUsers.findOne({ user_id: userId });
if (deletedUser && deletedUser.userType === 'individual') {
  populated.firstName = deletedUser.firstName;  // ❄️ Frozen
  populated.office = deletedUser.office;        // ❄️ Frozen
}
```

#### ผู้ใช้ถูกลบแล้ว (Branch)
```typescript
const deletedUser = await DeletedUsers.findOne({ user_id: userId });
if (deletedUser && deletedUser.userType === 'branch') {
  // ข้อมูลส่วนตัว: จากฟอร์ม
  populated.firstName = populated.requesterFirstName || '-';
  populated.phone = populated.requesterPhone || '-';
  
  // ข้อมูลสาขา: จาก DeletedUsers
  populated.office = deletedUser.office || '-';    // ❄️ Frozen
  populated.email = deletedUser.email || '-';      // ❄️ Frozen
}
```

---

## 3. การแก้ไข Branch User Phone Snapshot

### ❌ ปัญหาเดิม

ก่อนแก้ไข ระบบ snapshot ข้อมูล "phone" สำหรับผู้ใช้ประเภทสาขา แต่จริงๆ แล้ว **ข้อมูล phone มาจากฟอร์มที่กรอกแต่ละครั้ง** ไม่ใช่ข้อมูลคงที่

### ✅ การแก้ไข

#### 1. DeletedUsers Collection
```typescript
// ก่อน
...(userToDelete.userType === 'branch' ? {
  office: userToDelete.office,
  phone: userToDelete.phone,  // ❌ Snapshot
  email: userToDelete.email,
} : { ... })

// หลัง
...(userToDelete.userType === 'branch' ? {
  office: userToDelete.office,
  email: userToDelete.email,
  // ❌ ไม่ snapshot phone เพราะมาจากฟอร์มที่กรอกแต่ละครั้ง
} : { ... })
```

#### 2. RequestLog & ReturnLog
```typescript
// ก่อน
updateFields = {
  requesterOffice: user.office || '',
  requesterPhone: user.phone || '',  // ❌ Snapshot
  requesterEmail: user.email || ''
};

// หลัง
updateFields = {
  requesterOffice: user.office || '',
  requesterEmail: user.email || ''
  // ❌ ไม่แตะ: firstName, lastName, nickname, department, phone
};
```

### 📊 ตารางเปรียบเทียบ

| ฟิลด์ | ผู้ใช้บุคคล | ผู้ใช้สาขา (ก่อน) | ผู้ใช้สาขา (หลัง) |
|------|------------|------------------|------------------|
| firstName | ✅ Snapshot | ❌ ไม่ snapshot | ❌ ไม่ snapshot |
| lastName | ✅ Snapshot | ❌ ไม่ snapshot | ❌ ไม่ snapshot |
| nickname | ✅ Snapshot | ❌ ไม่ snapshot | ❌ ไม่ snapshot |
| department | ✅ Snapshot | ❌ ไม่ snapshot | ❌ ไม่ snapshot |
| office | ✅ Snapshot | ✅ Snapshot | ✅ Snapshot |
| **phone** | ✅ Snapshot | ~~✅ Snapshot~~ | ❌ **ไม่ snapshot** |
| email | ✅ Snapshot | ✅ Snapshot | ✅ Snapshot |

### 🎯 ผลลัพธ์หลังแก้ไข

#### ผู้ใช้สาขา "สาขากรุงเทพ" เบิกอุปกรณ์:

**ก่อนแก้ไข:**
```javascript
// กรอกในฟอร์ม
requesterPhone: "0812345678"  // เบอร์ส่วนตัว

// หลังลบผู้ใช้ → Snapshot phone จาก User
requesterPhone: "02-123-4567"  // ❌ ถูก override เป็นเบอร์สาขา (ผิด!)
```

**หลังแก้ไข:**
```javascript
// กรอกในฟอร์ม
requesterPhone: "0812345678"  // เบอร์ส่วนตัว

// หลังลบผู้ใช้ → ไม่ snapshot phone
requesterPhone: "0812345678"  // ✅ ยังคงเป็นเบอร์ที่กรอก (ถูกต้อง!)
```

---

## 4. สรุปการทำงานของระบบทั้งหมด

### 📊 ข้อมูลที่ยังอัปเดตได้หลังลบผู้ใช้

| ข้อมูล | สถานะหลังลบผู้ใช้ | หมายเหตุ |
|--------|------------------|----------|
| **ชื่ออุปกรณ์** | ✅ ยังอัปเดตได้ | มี snapshot function แยกอิสระ |
| **หมวดหมู่** | ✅ ยังอัปเดตได้ | มี snapshot function แยกอิสระ |
| **สถานะ** | ✅ ยังอัปเดตได้ | มี snapshot function แยกอิสระ |
| **สภาพ** | ✅ ยังอัปเดตได้ | มี snapshot function แยกอิสระ |
| **แอดมินคนอื่น** | ✅ ยังอัปเดตได้ | ถ้าแอดมินยังอยู่ในระบบ |
| **ข้อมูลผู้ใช้ที่ถูกลบ** | ❌ ไม่อัปเดตอีก | Frozen เป็นค่าล่าสุดก่อนลบ |

### 📝 สรุปความแตกต่างระหว่างผู้ใช้ 2 ประเภท

| หัวข้อ | ผู้ใช้บุคคล (Individual) | ผู้ใช้สาขา (Branch) |
|--------|-------------------------|---------------------|
| **Snapshot ก่อนลบ** | ทุกฟิลด์ | เฉพาะ office, email |
| **ข้อมูลส่วนตัว** | จาก User/DeletedUsers | จากฟอร์มที่กรอกแต่ละครั้ง |
| **ข้อมูลสาขา** | จาก User/DeletedUsers | office, email จาก User/DeletedUsers |
| **หลังลบผู้ใช้** | Frozen ทุกฟิลด์ | Frozen เฉพาะ office, email |

### 🎯 ตัวอย่างการทำงานจริง

#### สถานการณ์: ผู้ใช้สาขา "สาขากรุงเทพ" เบิกอุปกรณ์แล้วถูกลบ

**ข้อมูลก่อนลบ:**
```javascript
// User Collection
{
  user_id: "B001",
  userType: "branch",
  office: "สาขากรุงเทพ",
  phone: "02-123-4567",  // เบอร์สาขา
  email: "bangkok@company.com"
}

// RequestLog (กรอกในฟอร์มเบิก)
{
  userId: "B001",
  requesterFirstName: "สมชาย",      // จากฟอร์ม
  requesterLastName: "ใจดี",        // จากฟอร์ม
  requesterPhone: "0812345678",     // จากฟอร์ม (เบอร์ส่วนตัว)
  itemName: "Mouse Logitech",
  statusName: "มี",
  conditionName: "ใช้งานได้"
}
```

**หลังลบผู้ใช้ + แอดมินแก้ไขอุปกรณ์:**
```javascript
// DeletedUsers Collection
{
  user_id: "B001",
  userType: "branch",
  office: "สาขากรุงเทพ",  // ✅ Snapshot
  email: "bangkok@company.com",  // ✅ Snapshot
  // ❌ ไม่มี phone (ไม่ snapshot)
}

// RequestLog (อัปเดตเฉพาะข้อมูลสาขา)
{
  userId: "B001",
  requesterFirstName: "สมชาย",      // ✅ เก็บไว้จากฟอร์ม
  requesterLastName: "ใจดี",        // ✅ เก็บไว้จากฟอร์ม
  requesterPhone: "0812345678",     // ✅ เก็บไว้จากฟอร์ม
  requesterOffice: "สาขากรุงเทพ",  // ✅ อัปเดตจาก User
  requesterEmail: "bangkok@company.com",  // ✅ อัปเดตจาก User
  itemName: "Mouse Logitech V2",    // ✅ อัปเดตได้ (แอดมินแก้ไข)
  statusName: "หาย",                // ✅ อัปเดตได้ (แอดมินแก้ไข)
  conditionName: "ชำรุด"            // ✅ อัปเดตได้ (แอดมินแก้ไข)
}
```

**เมื่อแสดงในตาราง:**
```javascript
{
  // ❄️ ข้อมูลผู้ใช้ (บางส่วน Frozen, บางส่วนจากฟอร์ม)
  firstName: "สมชาย",             // ✅ จากฟอร์ม
  lastName: "ใจดี",               // ✅ จากฟอร์ม
  phone: "0812345678",            // ✅ จากฟอร์ม (เบอร์ส่วนตัว)
  office: "สาขากรุงเทพ",         // ❄️ จาก DeletedUsers
  email: "bangkok@company.com",   // ❄️ จาก DeletedUsers
  
  // ✅ ข้อมูลอื่น (ยังอัปเดตได้)
  itemName: "Mouse Logitech V2",  // อัปเดตแล้ว!
  statusName: "หาย",              // อัปเดตแล้ว!
  conditionName: "ชำรุด"          // อัปเดตแล้ว!
}
```

### 🔧 Snapshot Functions ทั้งหมดในระบบ

#### User Deletion Snapshots
```typescript
// src/lib/snapshot-helpers.ts
export async function snapshotUserBeforeDelete(userId: string);
export async function snapshotIssueLogsBeforeUserDelete(userId: string);

// src/lib/equipment-snapshot-helpers.ts
export async function snapshotEquipmentLogsBeforeUserDelete(userId: string);
export async function snapshotRequestLogsBeforeUserDelete(userId: string);
export async function snapshotReturnLogsBeforeUserDelete(userId: string);
export async function snapshotTransferLogsBeforeUserDelete(userId: string);
```

#### Config Change Snapshots
```typescript
// src/lib/equipment-snapshot-helpers.ts
export async function snapshotCategoryConfigBeforeChange(categoryId: string, newName?: string);
export async function snapshotStatusConfigBeforeChange(statusId: string, newName?: string);
export async function snapshotConditionConfigBeforeChange(conditionId: string, newName?: string);
```

#### Equipment Change Snapshots
```typescript
// src/lib/equipment-snapshot-helpers.ts
export async function snapshotEquipmentNameBeforeChange(itemId: string, oldName: string, newName: string);
export async function snapshotItemNameBeforeDelete(masterId: string);
```

---

## 🎉 สรุปสุดท้าย

### ✅ ระบบการคืนอุปกรณ์
1. ✅ **รองรับทุกสถานการณ์** - ผู้ใช้บุคคล/สาขา, เพิ่มเอง/เบิก, ทุกสถานะ/สภาพ
2. ✅ **คำนวณจำนวนถูกต้อง** - availableQuantity, totalQuantity, breakdown
3. ✅ **แสดงผลถูกต้อง** - ตารางจัดการคลังสินค้า, ไอคอนรายละเอียด

### ✅ ระบบการลบผู้ใช้
1. ✅ **Snapshot ครบ 2 ชั้น** - DeletedUsers + Logs
2. ✅ **ข้อมูลผู้ใช้ Frozen** - ไม่อัปเดตหลังลบ
3. ✅ **ข้อมูลอื่นยังอัปเดตได้** - อุปกรณ์ สถานะ สภาพ หมวดหมู่

### ✅ การแก้ไข Branch User Phone
1. ✅ **ไม่ snapshot phone** - สำหรับผู้ใช้สาขา
2. ✅ **ใช้ phone จากฟอร์ม** - เบอร์ส่วนตัวที่กรอกแต่ละครั้ง
3. ✅ **Snapshot เฉพาะ office, email** - ข้อมูลสาขาที่คงที่

### 📚 ไฟล์ที่เกี่ยวข้อง

#### API Endpoints
- `DELETE /api/admin/users/[id]` - ลบผู้ใช้พร้อม snapshot
- `POST /api/admin/equipment-return/approve` - อนุมัติการคืนอุปกรณ์
- `GET /api/admin/inventory` - ดึงข้อมูลคลังสินค้า

#### Helper Functions
- `src/lib/snapshot-helpers.ts` - User snapshot functions
- `src/lib/equipment-snapshot-helpers.ts` - Equipment/Config snapshot functions
- `src/lib/equipment-populate-helpers.ts` - Populate functions
- `src/lib/inventory-helpers.ts` - Inventory management functions

#### Frontend Pages
- `src/app/admin/inventory/page.tsx` - หน้าจัดการคลังสินค้า
- `src/app/equipment-return/page.tsx` - หน้าคืนอุปกรณ์

#### Models
- `src/models/DeletedUser.ts` - Schema สำหรับ snapshot ผู้ใช้ที่ถูกลบ
- `src/models/InventoryMaster.ts` - Schema สำหรับข้อมูลสรุปอุปกรณ์
- `src/models/RequestLog.ts` - ประวัติเบิกอุปกรณ์
- `src/models/ReturnLog.ts` - ประวัติคืนอุปกรณ์

**ระบบทำงานได้สมบูรณ์แบบ! ไม่มี Error ใดๆ!** 🚀

---

*เอกสารนี้รวบรวมข้อมูลทั้งหมดเกี่ยวกับระบบจัดการคลังอุปกรณ์ รวมถึงการคืนอุปกรณ์ การลบผู้ใช้ และการจัดการ Snapshot ทั้งหมด*
