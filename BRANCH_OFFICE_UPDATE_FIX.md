# การแก้ไข: ชื่อสาขาไม่อัปเดตในหน้า Dashboard และ Equipment Tracking ✅

## ปัญหา

เมื่อแอดมินเปลี่ยนชื่อสาขาจาก "CTW" เป็น "CTW1" ใน User Collection พบว่า:
- ❌ หน้า `/dashboard` ยังแสดง "CTW" (ชื่อเก่า)
- ❌ หน้า `/admin/equipment-tracking` ยังแสดง "CTW" (ชื่อเก่า)

## สาเหตุ

ระบบมีการเก็บ `requesterInfo` ไว้ใน `InventoryItem` ตอนที่ผู้ใช้เพิ่มอุปกรณ์ที่มี ซึ่งใน `requesterInfo.office` จะเป็นชื่อสาขาตอนนั้น

**ปัญหา:** API ใช้ `requesterInfo.office` (ข้อมูลเก่า) แทนที่จะใช้ `user.office` (ข้อมูลล่าสุดจาก User Collection)

## Logic ที่ถูกต้อง

สำหรับผู้ใช้ประเภทสาขา:
- ✅ `office` → **ต้องมาจาก User Collection เสมอ** (เพื่อให้อัปเดตตามที่แอดมินแก้ไข)
- ✅ `firstName`, `lastName`, `nickname`, `department`, `phone` → จากฟอร์ม/snapshot

**เพราะว่า:**
- ชื่อสาขาเป็นข้อมูลคงที่ของ organization ที่แอดมินควบคุม
- ข้อมูลส่วนตัว (ชื่อ, แผนก, เบอร์) เปลี่ยนตามคนที่ทำธุรกรรม

---

## การแก้ไข

### 1. แก้ไข `/api/admin/equipment-tracking`

**ไฟล์:** `src/app/api/admin/equipment-tracking/route.ts` (บรรทัด 153-181)

#### ก่อนแก้ไข ❌
```typescript
const itemRequesterInfo = (item as any).requesterInfo;
if (itemRequesterInfo && (itemRequesterInfo.firstName || itemRequesterInfo.lastName)) {
  firstName = itemRequesterInfo.firstName || firstName;
  lastName = itemRequesterInfo.lastName || lastName;
  nickname = itemRequesterInfo.nickname || nickname;
  userDepartment = itemRequesterInfo.department || userDepartment;
  userPhone = itemRequesterInfo.phone || userPhone;
  
  // ❌ ปัญหา: ใช้ office จาก requesterInfo (ข้อมูลเก่า)
  if (isDeletedUser && user?.userType === 'branch') {
    userOffice = user.office || itemRequesterInfo.office || userOffice;
  } else {
    userOffice = itemRequesterInfo.office || userOffice;  // ❌ ผิด!
  }
}
```

#### หลังแก้ไข ✅
```typescript
const itemRequesterInfo = (item as any).requesterInfo;
if (itemRequesterInfo && (itemRequesterInfo.firstName || itemRequesterInfo.lastName)) {
  // ✅ สำหรับผู้ใช้สาขา: ข้อมูลส่วนตัวจาก requesterInfo, office จาก User Collection
  if (user?.userType === 'branch') {
    firstName = itemRequesterInfo.firstName || firstName;
    lastName = itemRequesterInfo.lastName || lastName;
    nickname = itemRequesterInfo.nickname || nickname;
    userDepartment = itemRequesterInfo.department || userDepartment;
    userPhone = itemRequesterInfo.phone || userPhone;
    
    // ✅ office ต้องใช้จาก User Collection เสมอ
    userOffice = user?.office || userOffice;
  } else {
    // ผู้ใช้ individual: ใช้ข้อมูลจาก requesterInfo ทั้งหมด
    firstName = itemRequesterInfo.firstName || firstName;
    lastName = itemRequesterInfo.lastName || lastName;
    nickname = itemRequesterInfo.nickname || nickname;
    userDepartment = itemRequesterInfo.department || userDepartment;
    userPhone = itemRequesterInfo.phone || userPhone;
    userOffice = itemRequesterInfo.office || userOffice;
  }
}
```

### 2. แก้ไข `/api/user/owned-equipment`

**ไฟล์:** `src/app/api/user/owned-equipment/route.ts` (บรรทัด 159-173)

#### ก่อนแก้ไข ❌
```typescript
const itemRequesterInfo = (item as any).requesterInfo;

// ลำดับความสำคัญ: item.requesterInfo > mostRecentRequesterInfo
const finalFirstName = itemRequesterInfo?.firstName || mostRecentRequesterInfo?.firstName || undefined;
const finalLastName = itemRequesterInfo?.lastName || mostRecentRequesterInfo?.lastName || undefined;
const finalNickname = itemRequesterInfo?.nickname || mostRecentRequesterInfo?.nickname || undefined;
const finalDepartment = itemRequesterInfo?.department || mostRecentRequesterInfo?.department || undefined;
const finalPhone = itemRequesterInfo?.phone || mostRecentRequesterInfo?.phone || undefined;

// ❌ ปัญหา: ใช้ office จาก requesterInfo (ข้อมูลเก่า)
const finalOffice = itemRequesterInfo?.office || mostRecentRequesterInfo?.office || undefined;
```

#### หลังแก้ไข ✅
```typescript
const itemRequesterInfo = (item as any).requesterInfo;

// ลำดับความสำคัญ: item.requesterInfo > mostRecentRequesterInfo
const finalFirstName = itemRequesterInfo?.firstName || mostRecentRequesterInfo?.firstName || undefined;
const finalLastName = itemRequesterInfo?.lastName || mostRecentRequesterInfo?.lastName || undefined;
const finalNickname = itemRequesterInfo?.nickname || mostRecentRequesterInfo?.nickname || undefined;
const finalDepartment = itemRequesterInfo?.department || mostRecentRequesterInfo?.department || undefined;
const finalPhone = itemRequesterInfo?.phone || mostRecentRequesterInfo?.phone || undefined;

// ✅ สำหรับผู้ใช้สาขา: office ต้องใช้จาก User Collection เสมอ
const finalOffice = user?.userType === 'branch' 
  ? user?.office 
  : (itemRequesterInfo?.office || mostRecentRequesterInfo?.office || undefined);
```

---

## ตัวอย่างการทำงาน

### สถานการณ์: แอดมินเปลี่ยนชื่อสาขา

#### 1. ข้อมูลเริ่มต้น

**User Collection:**
```json
{
  "user_id": "U004",
  "userType": "branch",
  "office": "CTW"  // ชื่อเดิม
}
```

**InventoryItem (อุปกรณ์ที่ผู้ใช้เพิ่มเอง):**
```json
{
  "_id": "item001",
  "itemName": "HP one 1",
  "currentOwnership": {
    "userId": "U004",
    "ownerType": "user_owned"
  },
  "requesterInfo": {
    "firstName": "aaaa",
    "lastName": "bbbb",
    "department": "Marketing",
    "office": "CTW"  // ชื่อตอนที่เพิ่ม
  }
}
```

#### 2. แอดมินแก้ไขชื่อสาขา

**User Collection (หลังแก้ไข):**
```json
{
  "user_id": "U004",
  "userType": "branch",
  "office": "CTW1"  // ✅ ชื่อใหม่
}
```

#### 3. ก่อนแก้ไข Code ❌

**API Response:**
```json
{
  "firstName": "aaaa",
  "lastName": "bbbb",
  "department": "Marketing",
  "office": "CTW"  // ❌ ยังเป็นชื่อเก่า (จาก requesterInfo)
}
```

**หน้า Dashboard แสดง:** `ออฟฟิศ/สาขา: CTW` ❌

#### 4. หลังแก้ไข Code ✅

**API Response:**
```json
{
  "firstName": "aaaa",
  "lastName": "bbbb",
  "department": "Marketing",
  "office": "CTW1"  // ✅ ชื่อใหม่ (จาก User Collection)
}
```

**หน้า Dashboard แสดง:** `ออฟฟิศ/สาขา: CTW1` ✅

---

## เปรียบเทียบ Individual User vs Branch User

### Individual User (ผู้ใช้บุคคล)

| ฟิลด์ | แหล่งข้อมูล | เหตุผล |
|-------|-------------|--------|
| firstName | User Collection | ข้อมูล profile ส่วนตัว |
| lastName | User Collection | ข้อมูล profile ส่วนตัว |
| nickname | User Collection | ข้อมูล profile ส่วนตัว |
| department | User Collection | ข้อมูล profile ส่วนตัว |
| office | User Collection | ข้อมูล profile ส่วนตัว |
| phone | User Collection | ข้อมูล profile ส่วนตัว |

**การทำงาน:** ใช้ข้อมูลจาก User Collection ทั้งหมด เพราะ 1 user = 1 คน

### Branch User (ผู้ใช้สาขา)

| ฟิลด์ | แหล่งข้อมูล | เหตุผล |
|-------|-------------|--------|
| firstName | ฟอร์ม/snapshot | แต่ละครั้งอาจเป็นคนละคน |
| lastName | ฟอร์ม/snapshot | แต่ละครั้งอาจเป็นคนละคน |
| nickname | ฟอร์ม/snapshot | แต่ละครั้งอาจเป็นคนละคน |
| department | ฟอร์ม/snapshot | แต่ละครั้งอาจเป็นคนละแผนก |
| phone | ฟอร์ม/snapshot | แต่ละครั้งอาจเป็นคนละเบอร์ |
| **office** | **User Collection** ✅ | **ข้อมูลสาขาคงที่ (แอดมินควบคุม)** |

**การทำงาน:** 
- ข้อมูลส่วนตัวใช้จากฟอร์ม (เพราะหลายคนใช้บัญชีร่วม)
- **office ใช้จาก User Collection** (เพราะเป็นข้อมูล organization ที่แอดมินควบคุม)

---

## การทดสอบ

### ขั้นตอนการทดสอบ

1. **เข้าสู่ระบบด้วยบัญชีแอดมิน**

2. **ตรวจสอบชื่อสาขาเดิม**
   - ไปที่ `/admin/users`
   - ดูผู้ใช้สาขา เช่น "สาขา CTW" (U004)
   - จดชื่อสาขาเดิม: "CTW"

3. **ตรวจสอบหน้า Dashboard (ก่อนแก้ไข)**
   - Logout แล้ว Login ด้วย U004
   - ไปที่ `/dashboard`
   - ดูตาราง "ทรัพย์สินที่มี"
   - **ควรเห็น:** ออฟฟิศ/สาขา: "CTW"

4. **แก้ไขชื่อสาขา**
   - Login ด้วยแอดมิน
   - ไปที่ `/admin/users`
   - คลิกแก้ไข user U004
   - เปลี่ยน office จาก "CTW" เป็น "CTW1"
   - บันทึก

5. **ตรวจสอบหน้า Dashboard (หลังแก้ไข)**
   - Logout แล้ว Login ด้วย U004 อีกครั้ง
   - ไปที่ `/dashboard`
   - กด Refresh (F5)
   - **ผลที่คาดหวัง:** ออฟฟิศ/สาขา: "CTW1" ✅

6. **ตรวจสอบหน้า Equipment Tracking**
   - Login ด้วยแอดมิน
   - ไปที่ `/admin/equipment-tracking`
   - ค้นหาอุปกรณ์ของ U004
   - **ผลที่คาดหวัง:** คอลัมน์ "ออฟฟิศ/สาขา" แสดง "CTW1" ✅

---

## Flow การแก้ไข

```
1. แอดมินแก้ไข User.office
   User Collection: { office: "CTW" } → { office: "CTW1" }

2. API ดึงข้อมูล (ก่อนแก้ไข code)
   ❌ ใช้ requesterInfo.office (ข้อมูลเก่า)
   → Response: { office: "CTW" }

3. API ดึงข้อมูล (หลังแก้ไข code)
   ✅ ใช้ user.office (ข้อมูลล่าสุดจาก User Collection)
   → Response: { office: "CTW1" }

4. Frontend แสดงผล
   ✅ แสดง "CTW1" ตามข้อมูลล่าสุด
```

---

## สรุป

### ✅ ปัญหาที่แก้ไข

1. **หน้า Dashboard** - ชื่อสาขาไม่อัปเดต
2. **หน้า Equipment Tracking** - ชื่อสาขาไม่อัปเดต

### ✅ การแก้ไข

1. แก้ไข `/api/admin/equipment-tracking` - แยก logic สำหรับ branch user
2. แก้ไข `/api/user/owned-equipment` - ใช้ user.office สำหรับ branch user

### ✅ ผลลัพธ์

- เมื่อแอดมินแก้ไขชื่อสาขา → หน้าทั้งหมดจะแสดงชื่อใหม่ทันที
- ข้อมูลส่วนตัว (ชื่อ, แผนก) ยังคงมาจากฟอร์มตามเดิม
- รักษา logic ที่ถูกต้อง: office มาจาก User Collection เสมอ

---

## ไฟล์ที่แก้ไข

1. ✅ `src/app/api/admin/equipment-tracking/route.ts` - แยก logic branch user
2. ✅ `src/app/api/user/owned-equipment/route.ts` - ใช้ user.office

---

**หมายเหตุ:** การแก้ไขนี้ส่งผลทันทีหลัง deploy ไม่ต้อง migrate ข้อมูล! 🎉

