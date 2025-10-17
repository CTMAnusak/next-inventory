# 📸 คู่มือระบบ Snapshot ฉบับสมบูรณ์

> **เอกสารรวม**: ระบบ Snapshot สำหรับทุก Logs ในระบบจัดการอุปกรณ์  
> **รุ่น**: v3.0 - Hybrid Approach (Snapshot on Approve + Update on Delete)  
> **อัปเดทล่าสุด**: ตุลาคม 2568

---

## 📋 **สารบัญ**

### [ส่วนที่ 1: ภาพรวมระบบ](#ส่วนที่-1-ภาพรวมระบบ)
- วัตถุประสงค์
- สถาปัตยกรรม
- แนวคิด Hybrid Approach

### [ส่วนที่ 2: Equipment Tracking Snapshot](#ส่วนที่-2-equipment-tracking-snapshot)
- โครงสร้างข้อมูล
- ลำดับการทำงาน
- Helper Functions

### [ส่วนที่ 3: Issue Log Snapshot](#ส่วนที่-3-issue-log-snapshot)
- ระบบผู้แจ้งงาน
- ระบบ IT Admin
- Status & Condition

### [ส่วนที่ 4: การทดสอบ](#ส่วนที่-4-การทดสอบ)
- Test Scenarios
- Expected Results

### [ส่วนที่ 5: FAQ & Best Practices](#ส่วนที่-5-faq--best-practices)

---

# ส่วนที่ 1: ภาพรวมระบบ

## 🎯 **วัตถุประสงค์**

Snapshot System ออกแบบมาเพื่อแก้ปัญหา:

1. **ข้อมูลอุปกรณ์หายเมื่อลบ**
   - ลบอุปกรณ์ → ประวัติการเบิก/คืนแสดง "Unknown"
   - ลบ `InventoryMaster` → หา `masterId` ไม่เจอ

2. **ข้อมูล User/Admin หายเมื่อลบ**
   - ลบ User → ไม่รู้ว่าใครเบิก/คืน
   - ลบ Admin → ไม่รู้ว่าใครอนุมัติ

3. **Config หายเมื่อแก้ไข/ลบ**
   - ลบ Status Config → ไม่รู้สถานะเดิม
   - แก้ไขชื่อ → ประวัติไม่ตรง

---

## 🏗️ **สถาปัตยกรรม**

### **Database Collections**

```
inventoryitems (หลัก)
  ↓
inventorymasters (สรุป)
  ↓
requestlogs (+ snapshot)  ← เก็บประวัติการเบิก
returnlogs (+ snapshot)   ← เก็บประวัติการคืน
transferlogs (+ snapshot) ← เก็บประวัติการโอนย้าย
issuelogs (+ snapshot)    ← เก็บประวัติแจ้งงาน IT
```

---

## 💡 **Hybrid Approach**

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

---

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

# ส่วนที่ 2: Equipment Tracking Snapshot

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

---

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

---

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

---

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

## 🛠️ **Helper Functions**

### **`snapshot-helpers.ts`**

```typescript
// สร้าง snapshot สำหรับ 1 item
async function createInventoryItemSnapshot(itemId: string)

// สร้าง snapshot สำหรับหลาย items
async function createInventoryItemSnapshotsBatch(itemIds: string[])

// สร้าง snapshot จาก object (ประหยัด query)
async function createInventoryItemSnapshotFromObject(item: any)

// 🆕 อัปเดต snapshot ก่อนลบ
async function updateSnapshotsBeforeDelete(itemId: string)
```

---

# ส่วนที่ 3: Issue Log Snapshot

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

# ส่วนที่ 4: การทดสอบ

## 🧪 **Test Scenario: Equipment Tracking**

### **วัตถุประสงค์:**
ทดสอบว่าระบบ Snapshot ทำงานถูกต้อง:
- เบิกอุปกรณ์ → มี snapshot
- คืนอุปกรณ์ → มี snapshot
- ลบอุปกรณ์ → snapshot อัปเดตล่าสุด
- ตารางแสดงข้อมูลล่าสุด (ไม่มี "Unknown")

---

### **Step 1: เตรียมข้อมูล**

#### **1.1 สร้าง Admin User**
- User ID: `ADMIN001`
- ชื่อ: สมชาย ใจดี
- Role: admin

#### **1.2 สร้าง Regular User**
- User ID: `USER001`
- ชื่อ: สมหญิง มีสุข
- Role: user

#### **1.3 สร้างอุปกรณ์ในคลัง (Admin)**
```
หมวดหมู่: อุปกรณ์เสริม (cat_accessories)
ชื่ออุปกรณ์: Mouse Logitech
Serial Number: SN-MOUSE-001
สถานะ: มี (status_available)
สภาพ: ใช้งานได้ (cond_working)
จำนวน: 3 ชิ้น
```

**Expected Result:**
```
✅ InventoryMaster created
✅ 3 InventoryItems created (admin_stock)
```

---

### **Step 2: การเบิกอุปกรณ์**

#### **2.1 User ส่งคำขอเบิก**
```
User: USER001 (สมหญิง มีสุข)
อุปกรณ์: Mouse Logitech x 1
Serial Number: ไม่ระบุ (ให้ Admin เลือก)
วันที่ต้องการ: วันนี้
สถานที่จัดส่ง: สำนักงานใหญ่
```

**Expected Result:**
```
✅ RequestLog created (status: pending)
✅ masterId: [InventoryMaster._id]
✅ ไม่มี assignedItemSnapshots (ยังไม่อนุมัติ)
```

#### **2.2 Admin อนุมัติและเลือกอุปกรณ์**
```
Admin: ADMIN001 (สมชาย ใจดี)
เลือก: Mouse SN-MOUSE-001
```

**Expected Result:**
```
✅ RequestLog updated:
   - status: approved
   - assignedItemIds: ["item_id_001"]
   - assignedItemSnapshots: [{
       itemId: "item_id_001",
       itemName: "Mouse Logitech",
       categoryId: "cat_accessories",
       categoryName: "อุปกรณ์เสริม",
       serialNumber: "SN-MOUSE-001",
       statusId: "status_available",
       statusName: "มี",
       conditionId: "cond_working",
       conditionName: "ใช้งานได้"
     }]
   - approvedBy: "ADMIN001"
   
✅ InventoryItem updated:
   - currentOwnership.ownerType: "user_owned"
   - currentOwnership.userId: "USER001"

✅ TransferLog created
```

---

### **Step 3: User เพิ่มอุปกรณ์เอง**

#### **3.1 เพิ่มอุปกรณ์ที่มีอยู่แล้ว**
```
User: USER001
อุปกรณ์: Keyboard Logitech
หมวดหมู่: อุปกรณ์เสริม
Serial Number: KB-12345
สถานะ: มี
สภาพ: ใช้งานได้
```

**Expected Result:**
```
✅ InventoryItem created:
   - itemName: "Keyboard Logitech"
   - serialNumber: "KB-12345"
   - currentOwnership.ownerType: "user_owned"
   - currentOwnership.userId: "USER001"
   - sourceInfo.addedBy: "user"
   - sourceInfo.acquisitionMethod: "self_reported"

✅ ไม่สร้าง RequestLog (เพราะเพิ่มเอง)
```

---

### **Step 4: ตรวจสอบหน้าติดตามอุปกรณ์ (ก่อนลบ)**

#### **เข้าหน้า: `/admin/equipment-tracking`**

**Expected Result:**

| อุปกรณ์ | Serial Number | หมวดหมู่ | สถานะ | สภาพ | ผู้ถือครอง | Source |
|---------|---------------|----------|-------|------|-----------|--------|
| Mouse Logitech | SN-MOUSE-001 | อุปกรณ์เสริม | มี | ใช้งานได้ | สมหญิง มีสุข | เบิก |
| Keyboard Logitech | KB-12345 | อุปกรณ์เสริม | มี | ใช้งานได้ | สมหญิง มีสุข | เพิ่มเอง |

**ตรวจสอบ:**
```
✅ Mouse: ใช้ข้อมูลจาก assignedItemSnapshots
✅ Keyboard: ใช้ข้อมูลจาก InventoryItem real-time
✅ ไม่มี "Unknown" ทั้งหมด
```

---

### **Step 5: คืนอุปกรณ์**

#### **5.1 User ส่งคำขอคืน Mouse**
```
User: USER001
อุปกรณ์: Mouse Logitech (SN-MOUSE-001)
สถานะเมื่อคืน: มี
สภาพเมื่อคืน: ชำรุด (เปลี่ยนจาก "ใช้งานได้")
หมายเหตุ: ปุ่มซ้ายชำรุด
```

**Expected Result:**
```
✅ ReturnLog created:
   - items[0].itemId: "item_id_001"
   - items[0].itemName: "Mouse Logitech" (snapshot)
   - items[0].categoryName: "อุปกรณ์เสริม" (snapshot)
   - items[0].serialNumber: "SN-MOUSE-001" (snapshot)
   - items[0].statusOnReturn: "status_available"
   - items[0].statusOnReturnName: "มี" (snapshot)
   - items[0].conditionOnReturn: "cond_damaged"
   - items[0].conditionOnReturnName: "ชำรุด" (snapshot)
   - items[0].approvalStatus: "pending"
```

#### **5.2 Admin อนุมัติการคืน**
```
Admin: ADMIN001
```

**Expected Result:**
```
✅ ReturnLog updated:
   - items[0].approvalStatus: "approved"
   - items[0].approvedBy: "ADMIN001"
   - items[0].approvedByName: "สมชาย ใจดี" (snapshot)

✅ InventoryItem updated:
   - statusId: "status_available"
   - conditionId: "cond_damaged" (อัปเดตเป็น "ชำรุด")
   - currentOwnership.ownerType: "admin_stock"
```

---

### **Step 6: ตรวจสอบตารางประวัติคืน**

#### **เข้าหน้า: `/admin/equipment-reports` → Tab "ประวัติคืน"**

**Expected Result:**

| วันที่คืน | ผู้คืน | อุปกรณ์ | Serial Number | สถานะเมื่อคืน | สภาพเมื่อคืน |
|----------|--------|---------|---------------|--------------|-------------|
| วันนี้ | สมหญิง มีสุข | Mouse Logitech | SN-MOUSE-001 | มี | ชำรุด |

**ตรวจสอบ:**
```
✅ ชื่ออุปกรณ์: "Mouse Logitech" (จาก snapshot)
✅ หมวดหมู่: "อุปกรณ์เสริม" (จาก snapshot)
✅ สภาพ: "ชำรุด" (จาก snapshot ตอนคืน)
✅ ไม่มี "Unknown"
```

---

### **Step 7: ลบอุปกรณ์**

#### **7.1 Admin แก้ไขสภาพอุปกรณ์ก่อนลบ**
```
Admin: ADMIN001
อุปกรณ์: Mouse (SN-MOUSE-001)
แก้ไข: conditionId = "cond_broken" (เสียหายมาก)
```

**Expected Result:**
```
✅ InventoryItem updated:
   - conditionId: "cond_broken"
   - conditionName: "เสียหายมาก"

⏸️ RequestLog ไม่เปลี่ยน (snapshot ยังคงเป็น "ชำรุด")
```

#### **7.2 Admin ลบอุปกรณ์ลงถังขยะ**
```
Admin: ADMIN001
อุปกรณ์: Mouse (SN-MOUSE-001)
เหตุผล: เสียหายไม่สามารถซ่อมได้
```

**Expected Log:**
```
📸 Updating snapshots before deleting item: item_id_001
📸 Created latest snapshot: {
  itemId: "item_id_001",
  itemName: "Mouse Logitech",
  categoryId: "cat_accessories",
  categoryName: "อุปกรณ์เสริม",
  serialNumber: "SN-MOUSE-001",
  statusId: "status_available",
  statusName: "มี",
  conditionId: "cond_broken",
  conditionName: "เสียหายมาก"  // 🆕 อัปเดตเป็นสถานะล่าสุด
}
📋 Found 1 RequestLog with this item
   ✅ Updated existing snapshot for item in RequestLog [id]
✅ Updated 1 RequestLog with latest snapshot
```

**Expected Result:**
```
✅ RequestLog.assignedItemSnapshots อัปเดตเป็น:
   - conditionId: "cond_broken"
   - conditionName: "เสียหายมาก" (ข้อมูลล่าสุดก่อนลบ)

✅ InventoryItem moved to RecycleBin
✅ InventoryItem deleted
```

---

### **Step 8: ตรวจสอบหลังลบ**

#### **8.1 ตรวจสอบหน้าติดตามอุปกรณ์**

**เข้าหน้า: `/admin/equipment-tracking`**

**Expected Result:**

| อุปกรณ์ | Serial Number | หมวดหมู่ | สถานะ | สภาพ | ผู้ถือครอง | Source |
|---------|---------------|----------|-------|------|-----------|--------|
| Keyboard Logitech | KB-12345 | อุปกรณ์เสริม | มี | ใช้งานได้ | สมหญิง มีสุข | เพิ่มเอง |

**ตรวจสอบ:**
```
✅ Mouse หายจากตาราง (เพราะลบไปถังขยะแล้ว)
✅ Keyboard ยังแสดงอยู่ปกติ
```

#### **8.2 ตรวจสอบตารางประวัติเบิก**

**เข้าหน้า: `/admin/equipment-reports` → Tab "ประวัติเบิก"**

**Expected Result:**

| วันที่เบิก | ผู้เบิก | อุปกรณ์ | Serial Number | สถานะ | สภาพ | ผู้อนุมัติ |
|-----------|--------|---------|---------------|-------|------|-----------|
| วันนี้ | สมหญิง มีสุข | Mouse Logitech | SN-MOUSE-001 | มี | **เสียหายมาก** | สมชาย ใจดี |

**ตรวจสอบ:**
```
✅ ชื่ออุปกรณ์: "Mouse Logitech" (จาก snapshot)
✅ หมวดหมู่: "อุปกรณ์เสริม" (จาก snapshot)
✅ สภาพ: "เสียหายมาก" (อัปเดตเป็นข้อมูลล่าสุดก่อนลบ)
✅ ไม่มี "Unknown" !!!
```

#### **8.3 ตรวจสอบตารางประวัติคืน**

**Expected Result:**

| วันที่คืน | ผู้คืน | อุปกรณ์ | Serial Number | สถานะเมื่อคืน | สภาพเมื่อคืน |
|----------|--------|---------|---------------|--------------|-------------|
| วันนี้ | สมหญิง มีสุข | Mouse Logitech | SN-MOUSE-001 | มี | ชำรุด |

**ตรวจสอบ:**
```
✅ ยังแสดงข้อมูลปกติ
✅ สภาพเมื่อคืน: "ชำรุด" (ข้อมูลตอนคืน)
✅ ไม่มี "Unknown"
```

---

### **Step 9: กู้คืนอุปกรณ์จากถังขยะ (Optional)**

#### **9.1 Admin กู้คืน Mouse จากถังขยะ**
```
Admin: ADMIN001
อุปกรณ์: Mouse (SN-MOUSE-001)
```

**Expected Result:**
```
✅ InventoryItem created (ID ใหม่: item_id_002)
✅ InventoryMaster อาจถูกสร้างใหม่ (ID ใหม่)
✅ RequestLog เก่ายังมี snapshot (ชี้ไป item_id_001)
✅ ตาราง Equipment Tracking แสดง Mouse 2 รายการ:
   - รายการเก่า (snapshot จาก item_id_001)
   - รายการใหม่ (real-time จาก item_id_002)
```

---

## ✅ **Expected Results Summary**

| สถานการณ์ | ผลลัพธ์ที่คาดหวัง |
|-----------|------------------|
| **เบิกอุปกรณ์** | ✅ สร้าง snapshot ใน RequestLog |
| **คืนอุปกรณ์** | ✅ สร้าง snapshot ใน ReturnLog |
| **แก้ไขอุปกรณ์** | ⏸️ Snapshot ไม่เปลี่ยน |
| **ลบอุปกรณ์** | ✅ อัปเดต snapshot เป็นข้อมูลล่าสุด |
| **ตารางประวัติเบิก** | ✅ แสดงสภาพล่าสุดก่อนลบ (ไม่มี Unknown) |
| **ตารางประวัติคืน** | ✅ แสดงสภาพตอนคืน (จาก snapshot) |
| **Equipment Tracking** | ✅ อุปกรณ์ที่ลบไม่แสดง, ที่เหลือแสดงปกติ |
| **กู้คืนอุปกรณ์** | ✅ ได้ ID ใหม่ แต่ snapshot เก่ายังคงอยู่ |

---

# ส่วนที่ 5: FAQ & Best Practices

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

## 📚 **ไฟล์ที่เกี่ยวข้อง**

### **Models:**
- `src/models/RequestLog.ts` - เพิ่ม assignedItemSnapshots
- `src/models/ReturnLog.ts` - เพิ่ม snapshot fields
- `src/models/InventoryItem.ts`
- `src/models/IssueLog.ts`

### **Helper Functions:**
- `src/lib/snapshot-helpers.ts` - Equipment snapshots
- `src/lib/equipment-snapshot-helpers.ts` - Config snapshots
- `src/lib/equipment-populate-helpers.ts` - Populate functions
- `src/lib/issue-helpers.ts` - Issue snapshots

### **API Routes:**
- `src/app/api/admin/equipment-reports/requests/[id]/approve-with-selection/route.ts`
- `src/app/api/equipment-return/route.ts`
- `src/app/api/admin/inventory/route.ts`
- `src/app/api/admin/inventory/edit-item/route.ts`
- `src/app/api/admin/equipment-tracking/route.ts`

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

---

**สถานะ:** ✅ พร้อมใช้งาน  
**รุ่น:** v3.0  
**อัปเดทล่าสุด:** ตุลาคม 2568

🎉 **Happy Tracking!**

