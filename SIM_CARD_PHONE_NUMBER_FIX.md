# การแก้ไขระบบเบอร์โทรศัพท์ซิมการ์ด ✅

## ปัญหาเดิม

### การเก็บข้อมูลเบอร์โทรซิมการ์ดไม่ชัดเจน

ก่อนแก้ไข:
```typescript
// ❌ ปัญหา: ใช้ serialNumbers เก็บทั้ง Serial Number และเบอร์โทร
interface IRequestItem {
  serialNumbers?: string[];  // ใช้เก็บทั้ง SN และเบอร์โทร (สับสน!)
  assignedPhoneNumbers?: string[];  // เบอร์ที่แอดมิน assign (ถูกต้อง)
}
```

**สิ่งที่เกิดขึ้น:**
- เมื่อผู้ใช้เบิกซิมการ์ด → เบอร์โทรเก็บใน `serialNumbers[]`
- เมื่อแอดมินอนุมัติ → เบอร์โทรเก็บใน `assignedPhoneNumbers[]`
- ชื่อฟิลด์ไม่สื่อความหมาย ทำให้สับสน

---

## การแก้ไข

### 1. เพิ่มฟิลด์ `requestedPhoneNumbers` ใน RequestLog Model

```typescript
// ✅ แก้ไข: แยกชัดเจนระหว่าง Serial Number และเบอร์โทร
interface IRequestItem {
  serialNumbers?: string[];           // สำหรับ Serial Number เท่านั้น
  requestedPhoneNumbers?: string[];   // 🆕 สำหรับเบอร์โทรที่ผู้ใช้ขอเบิก
  assignedPhoneNumbers?: string[];    // สำหรับเบอร์โทรที่แอดมิน assign
}
```

**ไฟล์:** `src/models/RequestLog.ts`

### 2. แก้ไขฟอร์มการเบิกอุปกรณ์

แก้ให้ส่งข้อมูลแยกชัดเจนระหว่างซิมการ์ดกับอุปกรณ์อื่น:

```typescript
items: selectedItems.map(it => {
  const selectedItem = inventoryItems.find(i => String(i._id) === it.itemId);
  const isSIMCard = selectedItem?.categoryId === 'cat_sim_card';
  
  return {
    masterId: it.itemId,
    quantity: it.quantity,
    // ✅ แยกชัดเจน
    serialNumbers: !isSIMCard && it.serialNumber ? [it.serialNumber] : undefined,
    requestedPhoneNumbers: isSIMCard && it.serialNumber ? [it.serialNumber] : undefined,
    itemNotes: it.itemNotes || ''
  };
})
```

**ไฟล์:** `src/app/equipment-request/page.tsx`

### 3. แก้ไข API รับคำขอเบิก

เพิ่มการรองรับฟิลด์ใหม่:

```typescript
const cleanItems = {
  masterId: item.masterId,
  itemName: itemName,
  categoryId: categoryId,
  quantity: item.quantity,
  // ✅ รองรับทั้ง serialNumbers และ requestedPhoneNumbers
  serialNumbers: item.serialNumbers || (item.serialNumber ? [item.serialNumber] : undefined),
  requestedPhoneNumbers: item.requestedPhoneNumbers || undefined,
  availableItemIds: availableItems.map(it => it._id.toString()),
  itemNotes: item.itemNotes || undefined,
  statusOnRequest: availableStatusId,
  conditionOnRequest: workingConditionId
};
```

**ไฟล์:** `src/app/api/equipment-request/route.ts`

### 4. แก้ไขหน้ารายงาน Equipment Reports

#### 4.1 แก้ไขการค้นหา (Search Filter)
```typescript
// ✅ ก่อน: ค้นหาจาก serialNumbers
// ✅ หลัง: ค้นหาจาก requestedPhoneNumbers
if (Array.isArray((requestItem as any).requestedPhoneNumbers) && 
    (requestItem as any).requestedPhoneNumbers.length > 0) {
  return (requestItem as any).requestedPhoneNumbers.some((phone: string) => 
    phone && phone.toLowerCase().includes(searchValue.toLowerCase())
  );
}
```

#### 4.2 แก้ไขการแสดงผลในตาราง
```typescript
// ยังไม่อนุมัติ - แสดง requestedPhoneNumbers (ที่ผู้ใช้ขอเบิก)
if (Array.isArray((item as any).requestedPhoneNumbers) && 
    (item as any).requestedPhoneNumbers.length > 0) {
  return (item as any).requestedPhoneNumbers.map((phone: string, idx: number) => (
    <span key={idx} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
      {phone}
    </span>
  ));
}
```

#### 4.3 แก้ไข Export Excel
```typescript
let phoneNumbers = '-';
if (isSimCard) {
  if (isApproved && Array.isArray(item.assignedPhoneNumbers) && 
      item.assignedPhoneNumbers.length > 0) {
    phoneNumbers = item.assignedPhoneNumbers.join(', ');
  } else if (!isApproved && Array.isArray((item as any).requestedPhoneNumbers) && 
             (item as any).requestedPhoneNumbers.length > 0) {
    phoneNumbers = (item as any).requestedPhoneNumbers.join(', ');
  }
}
```

**ไฟล์:** `src/app/admin/equipment-reports/page.tsx`

---

## การทำงานหลังแก้ไข

### Flow การเบิกซิมการ์ด

#### 1. ผู้ใช้กรอกฟอร์มเบิก
```
ผู้ใช้เลือก: ซิมการ์ด AIS
เลือกเบอร์: 0845645456
```

#### 2. Frontend ส่งข้อมูล
```json
{
  "items": [{
    "masterId": "xxx",
    "quantity": 1,
    "requestedPhoneNumbers": ["0845645456"]  // ✅ เก็บในฟิลด์ที่ถูกต้อง
  }]
}
```

#### 3. บันทึกลง Database
```json
{
  "_id": "xxx",
  "items": [{
    "masterId": "xxx",
    "quantity": 1,
    "requestedPhoneNumbers": ["0845645456"],  // ✅ เบอร์ที่ผู้ใช้ขอเบิก
    "status": "pending"
  }]
}
```

#### 4. แอดมินดูรายงาน (ก่อนอนุมัติ)
```
คอลัมน์ PHONE NUMBER: 0845645456
สีพื้นหลัง: ส้ม (รออนุมัติ)
ข้อมูลจาก: requestedPhoneNumbers
```

#### 5. แอดมินอนุมัติและเลือกเบอร์
```json
{
  "items": [{
    "requestedPhoneNumbers": ["0845645456"],     // เบอร์ที่ผู้ใช้ขอ
    "assignedPhoneNumbers": ["0845645456"],      // เบอร์ที่แอดมินอนุมัติให้
    "itemApproved": true
  }]
}
```

#### 6. แอดมินดูรายงาน (หลังอนุมัติ)
```
คอลัมน์ PHONE NUMBER: 0845645456
สีพื้นหลัง: เขียว (อนุมัติแล้ว)
ข้อมูลจาก: assignedPhoneNumbers
```

---

## เปรียบเทียบก่อน-หลัง

### ก่อนแก้ไข ❌

| สถานะ | ฟิลด์ที่ใช้ | ปัญหา |
|-------|------------|-------|
| ผู้ใช้ขอเบิก | `serialNumbers[]` | ชื่อไม่สื่อความหมาย (เป็นเบอร์โทรไม่ใช่ SN) |
| แอดมินอนุมัติ | `assignedPhoneNumbers[]` | ถูกต้อง ✅ |
| ตอนคืน | `numberPhone` | ถูกต้อง ✅ |

### หลังแก้ไข ✅

| สถานะ | ฟิลด์ที่ใช้ | ความชัดเจน |
|-------|------------|-----------|
| ผู้ใช้ขอเบิก | `requestedPhoneNumbers[]` | ชัดเจน ✅ |
| แอดมินอนุมัติ | `assignedPhoneNumbers[]` | ชัดเจน ✅ |
| ตอนคืน | `numberPhone` | ชัดเจน ✅ |

---

## สำหรับอุปกรณ์อื่น (ไม่ใช่ซิมการ์ด)

การแก้ไขนี้ไม่กระทบกับอุปกรณ์อื่น:

```typescript
// อุปกรณ์ทั่วไป (เช่น Laptop, Mouse)
{
  "serialNumbers": ["SN001"],  // ใช้ serialNumbers ตามปกติ
  "assignedSerialNumbers": ["SN001"]
}

// ซิมการ์ด
{
  "requestedPhoneNumbers": ["0845645456"],  // 🆕 ใช้ฟิลด์ใหม่
  "assignedPhoneNumbers": ["0845645456"]
}
```

---

## Backward Compatibility

### ข้อมูลเก่าในระบบ

ข้อมูลที่เบิกก่อนการแก้ไขยังคงใช้ `serialNumbers` เก็บเบอร์โทร:

```json
// ข้อมูลเก่า (ก่อนแก้ไข)
{
  "items": [{
    "serialNumbers": ["0845645456"],  // เป็นเบอร์โทรแต่เก็บใน serialNumbers
    "assignedPhoneNumbers": ["0845645456"]
  }]
}

// ข้อมูลใหม่ (หลังแก้ไข)
{
  "items": [{
    "requestedPhoneNumbers": ["0845645456"],  // เบอร์โทรเก็บในฟิลด์ที่ถูกต้อง
    "assignedPhoneNumbers": ["0845645456"]
  }]
}
```

**วิธีจัดการ:** หน้ารายงานจะตรวจสอบทั้งสองฟิลด์ (fallback)

```typescript
// ✅ รองรับข้อมูลเก่า
if (Array.isArray(item.requestedPhoneNumbers) && item.requestedPhoneNumbers.length > 0) {
  // ใช้ข้อมูลใหม่
  phoneNumbers = item.requestedPhoneNumbers;
} else if (Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
  // Fallback: ใช้ข้อมูลเก่า (สำหรับรายการที่เบิกก่อนการแก้ไข)
  phoneNumbers = item.serialNumbers;
}
```

---

## การทดสอบ

### 1. ทดสอบการเบิกซิมการ์ดใหม่
1. ล็อกอินด้วยบัญชีผู้ใช้
2. ไปที่หน้าเบิกอุปกรณ์
3. เลือกซิมการ์ด เลือกเบอร์ เช่น "0812345678"
4. กดส่งฟอร์ม
5. **ผลที่คาดหวัง:** 
   - บันทึกสำเร็จ
   - ใน DB จะเห็น `requestedPhoneNumbers: ["0812345678"]`

### 2. ทดสอบหน้ารายงาน (ก่อนอนุมัติ)
1. ล็อกอินด้วยบัญชีแอดมิน
2. เปิดหน้า `/admin/equipment-reports`
3. **ผลที่คาดหวัง:**
   - คอลัมน์ PHONE NUMBER แสดง "0812345678" (พื้นหลังสีส้ม)

### 3. ทดสอบการอนุมัติ
1. คลิกอนุมัติรายการ
2. เลือกซิมการ์ดที่มีเบอร์
3. **ผลที่คาดหวัง:**
   - อนุมัติสำเร็จ
   - คอลัมน์ PHONE NUMBER แสดง "0812345678" (พื้นหลังสีเขียว)

### 4. ทดสอบ Backward Compatibility
1. ดูรายการเบิกเก่า (ก่อนการแก้ไข)
2. **ผลที่คาดหวัง:**
   - ยังคงแสดงเบอร์โทรได้ปกติ (จาก serialNumbers)

### 5. ทดสอบ Export Excel
1. คลิก Export Excel
2. เปิดไฟล์ Excel
3. **ผลที่คาดหวัง:**
   - คอลัมน์ PHONE NUMBER แสดงเบอร์โทรถูกต้อง

---

## ไฟล์ที่แก้ไข

1. ✅ `src/models/RequestLog.ts` - เพิ่มฟิลด์ `requestedPhoneNumbers`
2. ✅ `src/app/equipment-request/page.tsx` - แก้ฟอร์มให้ส่งข้อมูลถูกฟิลด์
3. ✅ `src/app/api/equipment-request/route.ts` - แก้ API รองรับฟิลด์ใหม่
4. ✅ `src/app/admin/equipment-reports/page.tsx` - แก้การแสดงผลและ export

---

## สรุป

### ปัญหาที่แก้ไข ✅
1. **ชื่อฟิลด์สับสน** - เบอร์โทรเก็บใน `serialNumbers` (ไม่สื่อความหมาย)
2. **ไม่ชัดเจน** - ผสมปนเทกับ Serial Number

### การแก้ไข ✅
1. **เพิ่มฟิลด์ใหม่** - `requestedPhoneNumbers[]` สำหรับเบอร์ที่ผู้ใช้ขอเบิก
2. **แยกชัดเจน** - Serial Number กับเบอร์โทรอยู่คนละฟิลด์
3. **Backward Compatible** - รองรับข้อมูลเก่าที่มีอยู่

### Flow ที่ถูกต้อง ✅
```
ก่อนอนุมัติ: requestedPhoneNumbers[]  (เบอร์ที่ผู้ใช้ขอเบิก)
           ↓
หลังอนุมัติ: assignedPhoneNumbers[]  (เบอร์ที่แอดมิน assign)
           ↓
ตอนคืน: numberPhone                  (เบอร์ที่คืน)
```

**ผลลัพธ์:** ระบบชัดเจน ง่ายต่อการบำรุงรักษา และไม่สับสนอีกต่อไป! 🎉

