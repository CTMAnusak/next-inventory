# คำอธิบาย: การ Snapshot และการอัพเดตข้อมูลหลังลบผู้ใช้ 📸

## คำถาม
> เมื่อลบผู้ใช้แล้ว หน้าตารางจะเป็นอย่างไร? จะมีการสร้าง snapshot ล่าสุดก่อนลบสมบูรณ์หรือไม่? 
> ถ้าหลังจากนั้นอัพเดตข้อมูล เช่น อุปกรณ์ หมวดหมู่ สถานะ สภาพ หรือแอดมิน 
> ในตารางที่รายการนั้นผู้ใช้โดนลบแล้วจะยังอัพเดตอยู่หรือไม่ ถึงแม้ข้อมูลผู้ใช้จะไม่ได้อัพเดตแล้ว?

---

## คำตอบสั้น ✅

1. **ใช่ ระบบจะสร้าง Snapshot อัตโนมัติก่อนลบผู้ใช้** 
2. **ข้อมูลผู้ใช้จะไม่อัพเดตอีก** (frozen เป็นค่าล่าสุดก่อนลบ)
3. **ข้อมูลอื่นๆ ยังอัพเดตได้ปกติ** (อุปกรณ์, หมวดหมู่, สถานะ, สภาพ, แอดมินคนอื่น)

---

## กระบวนการลบผู้ใช้ (User Deletion Flow)

### ขั้นตอนที่เกิดขึ้นอัตโนมัติ:

```
1. ผู้ดูแลระบบกดปุ่ม "ลบผู้ใช้"
   ↓
2. ตรวจสอบว่าผู้ใช้มีอุปกรณ์คงเหลือหรือไม่
   ↓
3. ถ้าไม่มี → เริ่มกระบวนการลบพร้อม Snapshot
   ↓
4. Snapshot #1: บันทึกข้อมูลผู้ใช้ไปยัง "DeletedUsers" Collection
   ↓
5. Snapshot #2: บันทึกชื่อผู้ใช้ล่าสุดไปยังทุก Logs ที่เกี่ยวข้อง
   - IssueLog (งานแจ้ง IT)
   - RequestLog (รายการเบิก)
   - ReturnLog (รายการคืน)
   - TransferLog (รายการโอนย้าย)
   ↓
6. ลบผู้ใช้จากระบบ
   ↓
7. เสร็จสิ้น ✅
```

---

## ไฟล์ที่เกี่ยวข้อง

### 1. API Endpoint สำหรับลบผู้ใช้
**ไฟล์:** `src/app/api/admin/users/[id]/route.ts` (บรรทัด 238-390)

```typescript
export async function DELETE(request, { params }) {
  // ... ตรวจสอบว่าผู้ใช้มีอุปกรณ์หรือไม่ ...
  
  if (userOwnedItems.length > 0) {
    // ❌ ไม่สามารถลบได้ - ต้องคืนอุปกรณ์ก่อน
    return NextResponse.json({ 
      error: 'ไม่สามารถลบผู้ใช้ได้',
      message: `ผู้ใช้มีอุปกรณ์ ${userOwnedItems.length} รายการที่ต้องคืนก่อน`
    });
  } else {
    // ✅ ลบได้ - เริ่ม Snapshot
    
    // 📸 Snapshot #1: เก็บข้อมูล User ใน DeletedUsers
    await DeletedUsers.findOneAndUpdate(
      { userMongoId: userToDelete._id.toString() },
      {
        user_id: userToDelete.user_id,
        firstName: userToDelete.firstName,
        lastName: userToDelete.lastName,
        nickname: userToDelete.nickname,
        department: userToDelete.department,
        office: userToDelete.office,
        phone: userToDelete.phone,
        email: userToDelete.email,
        deletedAt: new Date()
      },
      { upsert: true }
    );
    
    // 📸 Snapshot #2: เก็บชื่อผู้ใช้ใน Logs ทุกตาราง
    const { snapshotUserBeforeDelete } = await import('@/lib/snapshot-helpers');
    await snapshotUserBeforeDelete(userToDelete.user_id);
    
    // 🗑️ ลบผู้ใช้
    await User.findByIdAndDelete(id);
    
    return NextResponse.json({ message: 'ลบผู้ใช้เรียบร้อยแล้ว' });
  }
}
```

### 2. ฟังก์ชัน Snapshot Helpers
**ไฟล์:** `src/lib/snapshot-helpers.ts` (บรรทัด 203-245)

```typescript
export async function snapshotUserBeforeDelete(userId: string) {
  // Snapshot Equipment Logs (RequestLog, ReturnLog, TransferLog)
  const equipmentResults = await snapshotEquipmentLogsBeforeUserDelete(userId);
  
  // Snapshot IssueLog
  const issueResults = await snapshotIssueLogsBeforeUserDelete(userId);
  
  console.log(`✅ Snapshot completed for user ${userId}:`);
  console.log(`   - RequestLogs: ${equipmentResults.requestLogs.modifiedCount}`);
  console.log(`   - ReturnLogs: ${equipmentResults.returnLogs.modifiedCount}`);
  console.log(`   - TransferLogs: ${equipmentResults.transferLogs.modifiedCount}`);
  console.log(`   - IssueLogs (Requester): ${issueResults.requester.modifiedCount}`);
  console.log(`   - IssueLogs (Admin): ${issueResults.admin.modifiedCount}`);
  
  return { success: true, totalModified, equipment, issues };
}
```

**ไฟล์:** `src/lib/equipment-snapshot-helpers.ts` (บรรทัด 75-237)

```typescript
// Snapshot RequestLog: อัพเดตชื่อผู้อนุมัติและผู้ปฏิเสธ
export async function snapshotRequestLogsBeforeUserDelete(userId) {
  await RequestLog.updateMany(
    { approvedBy: userId },
    { $set: { approvedByName: userName } }
  );
  
  await RequestLog.updateMany(
    { rejectedBy: userId },
    { $set: { rejectedByName: userName } }
  );
}

// Snapshot ReturnLog: อัพเดตชื่อผู้อนุมัติการคืน
export async function snapshotReturnLogsBeforeUserDelete(userId) {
  const returnLogs = await ReturnLog.find({ 'items.approvedBy': userId });
  
  for (const log of returnLogs) {
    log.items = log.items.map(item => {
      if (item.approvedBy === userId) {
        return { ...item, approvedByName: userName };
      }
      return item;
    });
    await log.save();
  }
}

// Snapshot TransferLog: อัพเดตชื่อผู้โอนและผู้อนุมัติ
export async function snapshotTransferLogsBeforeUserDelete(userId) {
  await TransferLog.updateMany(
    { 'fromOwnership.userId': userId },
    { $set: { 'fromOwnership.userName': userName } }
  );
  
  await TransferLog.updateMany(
    { 'toOwnership.userId': userId },
    { $set: { 'toOwnership.userName': userName } }
  );
  
  await TransferLog.updateMany(
    { processedBy: userId },
    { $set: { processedByName: userName } }
  );
  
  await TransferLog.updateMany(
    { approvedBy: userId },
    { $set: { approvedByName: userName } }
  );
}

// Snapshot IssueLog: อัพเดตชื่อผู้แจ้งและผู้รับงาน
async function snapshotIssueLogsBeforeUserDelete(userId) {
  await IssueLog.updateMany(
    { requester: userId },
    { $set: { requesterName: userName } }
  );
  
  await IssueLog.updateMany(
    { assignedTo: userId },
    { $set: { assignedToName: userName } }
  );
}
```

---

## ตารางสรุป: ข้อมูลที่อัพเดตหลังลบผู้ใช้

| ประเภทข้อมูล | ก่อนลบผู้ใช้ | หลังลบผู้ใช้ | อัพเดตได้หรือไม่? |
|--------------|-------------|-------------|------------------|
| **ชื่อผู้ใช้ (requesterName, approvedByName)** | อ้างอิงจากตาราง Users | Snapshot (frozen) | ❌ ไม่อัพเดต |
| **ชื่ออุปกรณ์ (itemName)** | อ้างอิงจาก InventoryItem | Snapshot + อัพเดตได้ | ✅ ยังอัพเดตได้ |
| **หมวดหมู่ (categoryName)** | อ้างอิงจาก InventoryConfig | Snapshot + อัพเดตได้ | ✅ ยังอัพเดตได้ |
| **สถานะ (statusName)** | อ้างอิงจาก InventoryConfig | Snapshot + อัพเดตได้ | ✅ ยังอัพเดตได้ |
| **สภาพ (conditionName)** | อ้างอิงจาก InventoryConfig | Snapshot + อัพเดตได้ | ✅ ยังอัพเดตได้ |
| **ผู้อนุมัติคนอื่น (approvedByName)** | อ้างอิงจากตาราง Users | อ้างอิงจากตาราง Users | ✅ ยังอัพเดตได้ |

---

## ตัวอย่างสถานการณ์จริง

### สถานการณ์: ลบผู้ใช้ "ชุติมณฑน์ อนุศักดิ์ (แอมป์)"

#### **ก่อนลบ:**

**ตาราง RequestLog:**
```javascript
{
  _id: "req_001",
  requester: "USER1760941679483263",
  requesterSnapshot: {
    fullName: "ชุติมณฑน์ อนุศักดิ์",
    nickname: "แอมป์",
    department: "Web",
    office: "Rasa One",
    phone: "0834294154"
  },
  approvedBy: "ADMIN1756103604440",
  approvedByName: null,  // 🔴 ยังไม่ถูก snapshot
  items: [
    {
      itemName: "HP one 1",
      category: "Laptop",
      categoryId: "cat_laptop",
      statusOnRequest: "status_available",
      statusOnRequestName: null,  // 🔴 ยังไม่ถูก snapshot
      conditionOnRequest: "condition_good",
      conditionOnRequestName: null  // 🔴 ยังไม่ถูก snapshot
    }
  ]
}
```

#### **ระหว่างลบ (Automatic Snapshot):**

```
📸 Starting snapshot for user USER1760941679483263...
✅ Snapshot completed for user USER1760941679483263:
   - RequestLogs: 1
   - ReturnLogs: 1
   - TransferLogs: 0
   - IssueLogs (Requester): 1
   - IssueLogs (Admin): 0
   - Total: 3 records
```

#### **หลังลบ:**

**ตาราง RequestLog:**
```javascript
{
  _id: "req_001",
  requester: "USER1760941679483263",  // ❌ User ID ยังอยู่ (เป็น reference)
  requesterSnapshot: {
    fullName: "ชุติมณฑน์ อนุศักดิ์",  // ✅ ข้อมูล Snapshot เดิม (frozen)
    nickname: "แอมป์",
    department: "Web",
    office: "Rasa One",
    phone: "0834294154"
  },
  approvedBy: "ADMIN1756103604440",
  approvedByName: "Admin AD",  // ✅ ยังอัพเดตได้ (ถ้า Admin ยังอยู่)
  items: [
    {
      itemName: "HP one 1",  // ✅ ยังอัพเดตได้ถ้าแก้ไขชื่ออุปกรณ์
      category: "Laptop",  // ✅ ยังอัพเดตได้ถ้าแก้ไขชื่อหมวดหมู่
      categoryId: "cat_laptop",
      statusOnRequest: "status_available",
      statusOnRequestName: "พร้อมใช้งาน",  // ✅ ยังอัพเดตได้ถ้าแก้ไขชื่อสถานะ
      conditionOnRequest: "condition_good",
      conditionOnRequestName: "สภาพดี"  // ✅ ยังอัพเดตได้ถ้าแก้ไขชื่อสภาพ
    }
  ]
}
```

---

## การอัพเดตข้อมูลหลังลบผู้ใช้

### ✅ สิ่งที่ยังอัพเดตได้:

#### 1. **ชื่ออุปกรณ์ (itemName)**
เมื่อแก้ไขชื่ออุปกรณ์ในระบบ ชื่อใน RequestLog/ReturnLog จะอัพเดตอัตโนมัติ

**ฟังก์ชันที่รับผิดชอบ:**
```typescript
// src/lib/equipment-snapshot-helpers.ts
export async function snapshotItemNameBeforeDelete(masterId: string)
```

#### 2. **หมวดหมู่ (categoryName)**
เมื่อแก้ไขชื่อหมวดหมู่ใน Config ชื่อใน Logs จะอัพเดตอัตโนมัติ

**ฟังก์ชันที่รับผิดชอบ:**
```typescript
// src/lib/equipment-snapshot-helpers.ts
export async function snapshotCategoryConfigBeforeChange(categoryId, newName)
```

**ตัวอย่าง:**
```javascript
// แก้ไขชื่อหมวดหมู่ "Laptop" → "Notebook"
await snapshotCategoryConfigBeforeChange('cat_laptop', 'Notebook');

// ✅ ผลลัพธ์: ทุก RequestLog/ReturnLog/TransferLog ที่มี categoryId='cat_laptop'
//    จะมี category อัพเดตเป็น "Notebook"
```

#### 3. **สถานะ (statusName)**
เมื่อแก้ไขชื่อสถานะใน Config ชื่อใน Logs จะอัพเดตอัตโนมัติ

**ฟังก์ชันที่รับผิดชอบ:**
```typescript
// src/lib/equipment-snapshot-helpers.ts
export async function snapshotStatusConfigBeforeChange(statusId, newName)
```

#### 4. **สภาพ (conditionName)**
เมื่อแก้ไขชื่อสภาพใน Config ชื่อใน Logs จะอัพเดตอัตโนมัติ

**ฟังก์ชันที่รับผิดชอบ:**
```typescript
// src/lib/equipment-snapshot-helpers.ts
export async function snapshotConditionConfigBeforeChange(conditionId, newName)
```

#### 5. **ผู้อนุมัติที่เป็นคนอื่น**
ถ้า Admin ที่อนุมัติไม่ใช่ผู้ใช้ที่ถูกลบ ชื่อยังอัพเดตได้ปกติ

**ตัวอย่าง:**
```javascript
// Admin AD อนุมัติรายการเบิก → Admin AD แก้ไขชื่อเป็น "ผู้ดูแลระบบ AD"
// ✅ approvedByName จะอัพเดตเป็น "ผู้ดูแลระบบ AD"

// แต่ถ้า requester คือผู้ใช้ที่ถูกลบแล้ว
// ❌ requesterSnapshot.fullName จะไม่อัพเดต (frozen)
```

---

### ❌ สิ่งที่ไม่อัพเดต:

#### 1. **ชื่อผู้ใช้ที่ถูกลบ (requesterName, approvedByName)**
เนื่องจากผู้ใช้ไม่มีในระบบแล้ว ชื่อจะเป็นค่าล่าสุดก่อนลบ (frozen)

**ตัวอย่าง:**
```javascript
// ผู้ใช้ "ชุติมณฑน์ อนุศักดิ์" ถูกลบแล้ว
// ❌ requesterSnapshot.fullName จะยังเป็น "ชุติมณฑน์ อนุศักดิ์" ตลอดไป
// ❌ ไม่สามารถแก้ไขได้ เพราะผู้ใช้ไม่มีในระบบ
```

---

## การทดสอบ

### สคริปต์ทดสอบ: `test-user-deletion-snapshot.js`

สคริปต์นี้จะตรวจสอบ:
1. ✅ ผู้ใช้ยังอยู่ในระบบหรือไม่
2. ✅ มี Snapshot ใน DeletedUsers หรือไม่
3. ✅ มีข้อมูลใน Logs ที่เกี่ยวข้องหรือไม่
4. ✅ ข้อมูลผู้ใช้ถูก Snapshot ครบถ้วนหรือไม่

**วิธีใช้:**
```bash
node test-user-deletion-snapshot.js
```

**ผลลัพธ์:**
```
================================================================================
📋 ตรวจสอบข้อมูลผู้ใช้: USER1760941679483263
================================================================================

✅ ผู้ใช้ยังอยู่ในระบบ
   ชื่อ: ชุติมณฑน์ อนุศักดิ์ (แอมป์)
   แผนก: Web
   สาขา: Rasa One
   เบอร์: 0834294154
   อีเมล: chutimon.a@vsqclinic.com

================================================================================
📊 ตรวจสอบข้อมูลใน Logs ที่เกี่ยวข้อง
================================================================================

1️⃣  รายการแจ้งงาน IT (IssueLog):
   ✅ พบ 1 รายการ

2️⃣  รายการเบิกอุปกรณ์ (RequestLog):
   ✅ พบ 1 รายการ

3️⃣  รายการคืนอุปกรณ์ (ReturnLog):
   ✅ พบ 1 รายการ
```

---

## สรุป 🎯

### คำตอบสำหรับคำถามของคุณ:

| คำถาม | คำตอบ |
|-------|-------|
| จะมีการสร้าง snapshot ล่าสุดก่อนลบสมบูรณ์หรือไม่? | ✅ **ใช่** ระบบจะสร้าง snapshot อัตโนมัติก่อนลบ |
| ข้อมูลผู้ใช้ในตารางจะอัพเดตหลังลบหรือไม่? | ❌ **ไม่อัพเดต** (frozen เป็นค่าล่าสุดก่อนลบ) |
| ข้อมูลอุปกรณ์จะอัพเดตหลังลบผู้ใช้หรือไม่? | ✅ **ยังอัพเดตได้** |
| ข้อมูลหมวดหมู่จะอัพเดตหลังลบผู้ใช้หรือไม่? | ✅ **ยังอัพเดตได้** |
| ข้อมูลสถานะจะอัพเดตหลังลบผู้ใช้หรือไม่? | ✅ **ยังอัพเดตได้** |
| ข้อมูลสภาพจะอัพเดตหลังลบผู้ใช้หรือไม่? | ✅ **ยังอัพเดตได้** |
| ข้อมูลแอดมินคนอื่นจะอัพเดตหลังลบผู้ใช้หรือไม่? | ✅ **ยังอัพเดตได้** (ถ้าแอดมินยังอยู่ในระบบ) |

### หลักการทำงาน:
1. **User Deletion Snapshot** = บันทึกชื่อผู้ใช้ล่าสุดไว้ใน Logs ทุกตาราง (frozen)
2. **Config/Equipment Snapshot** = อัพเดตชื่อเมื่อมีการเปลี่ยนแปลง Config หรืออุปกรณ์
3. **ข้อมูลผู้ใช้ที่ถูกลบ** = ไม่อัพเดตอีก (เพราะไม่มีในระบบแล้ว)
4. **ข้อมูลอื่นๆ** = ยังอัพเดตได้ปกติ (เพราะมี Snapshot Function แยกอิสระ)

---

## เอกสารอ้างอิง

1. `src/app/api/admin/users/[id]/route.ts` - API Endpoint ลบผู้ใช้
2. `src/lib/snapshot-helpers.ts` - User Snapshot Functions
3. `src/lib/equipment-snapshot-helpers.ts` - Config/Equipment Snapshot Functions
4. `BRANCH_USER_SNAPSHOT_VERIFICATION.md` - เอกสารตรวจสอบ Snapshot
5. `POPULATE_SNAPSHOT_SYSTEM_UPGRADE.md` - เอกสารอัพเกรดระบบ Snapshot
6. `SNAPSHOT_SYSTEM_COMPLETE_GUIDE.md` - คู่มือระบบ Snapshot แบบสมบูรณ์

---

**สร้างเมื่อ:** 20 ตุลาคม 2568  
**เวอร์ชัน:** 1.0.0

