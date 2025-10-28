# คู่มือการใช้งาน: แก้ไขสถานะ/สภาพแบบ Inline Table

## 📋 ภาพรวม

ระบบจัดการ Stock ได้รับการปรับปรุงให้แสดงรายการอุปกรณ์แบบตารางที่สามารถแก้ไขได้ทันที (Inline Edit) สำหรับอุปกรณ์ที่ไม่มี Serial Number

### ✨ คุณสมบัติใหม่

- ✅ แสดงรายการทุก combinations ของ สถานะ + สภาพ ที่มีจำนวน > 0
- ✅ แก้ไขได้ทันทีในตาราง ไม่ต้องเปิด modal ซ้อน
- ✅ เลือกจำนวนที่ต้องการแก้ไขได้ (1 ถึง จำนวนทั้งหมด)
- ✅ เปลี่ยนได้ทั้งสถานะอย่างเดียว, สภาพอย่างเดียว, หรือทั้งคู่
- ✅ Validation: จำนวนต้อง 1 ≤ จำนวน ≤ max (ทั้ง frontend และ backend)
- ✅ Flow: บันทึก → ปิด popup → รีเฟรชตารางหลักอัตโนมัติ

---

## 🎯 วิธีใช้งาน

### 1. เข้าถึงหน้าจัดการ Stock

1. ไปที่ `/admin/inventory`
2. คลิกปุ่ม "📦 จัดการ Stock" ของอุปกรณ์ที่ต้องการ
3. เลือก "🔄 เปลี่ยนสถานะ/สภาพ (อุปกรณ์ที่ไม่มี SN)"

### 2. ดูรายการ Combinations

ตารางจะแสดง:

```
┌─────────────┬─────────────┬─────────┬──────────────────┐
│ สถานะ       │ สภาพ        │ จำนวน   │ การดำเนินการ     │
├─────────────┼─────────────┼─────────┼──────────────────┤
│ มี          │ ใช้งานได้    │ 5 ชิ้น  │ [แก้ไข]         │
│ มี          │ ชำรุด       │ 2 ชิ้น  │ [แก้ไข]         │
│ หาย         │ ใช้งานได้    │ 1 ชิ้น  │ [แก้ไข]         │
└─────────────┴─────────────┴─────────┴──────────────────┘
```

### 3. แก้ไขรายการ

1. **คลิกปุ่ม "แก้ไข"** ในแถวที่ต้องการ
2. แถวจะเปลี่ยนเป็นโหมดแก้ไข (พื้นหลังสีฟ้า):
   ```
   ├──────────────┬──────────────┬───────────┬──────────────────┤
   │ [Dropdown]   │ [Dropdown]   │ [Input]   │ [บันทึก] [ยกเลิก] │
   │ สถานะใหม่    │ สภาพใหม่     │ 2 / 5     │                   │
   └──────────────┴──────────────┴───────────┴──────────────────┘
   ```

3. **เลือกสถานะใหม่** (dropdown ซ้าย)
   - เลือกสถานะที่ต้องการเปลี่ยนไป
   - หรือเลือกสถานะเดิมถ้าไม่ต้องการเปลี่ยนสถานะ

4. **เลือกสภาพใหม่** (dropdown กลาง)
   - เลือกสภาพที่ต้องการเปลี่ยนไป
   - หรือเลือกสภาพเดิมถ้าไม่ต้องการเปลี่ยนสภาพ

5. **ระบุจำนวน** (input ขวา)
   - ใส่จำนวนที่ต้องการแก้ไข (1 ถึง จำนวนทั้งหมด)
   - ระบบจะจำกัดไม่ให้เกินจำนวนที่มี

6. **บันทึก**
   - คลิกปุ่ม "บันทึก" (สีเขียว)
   - ระบบจะอัปเดตและปิด popup อัตโนมัติ
   - ตารางหลักจะรีเฟรชแสดงข้อมูลใหม่

7. **ยกเลิก**
   - คลิกปุ่ม "ยกเลิก" ถ้าไม่ต้องการแก้ไข
   - จะกลับไปโหมดปกติทันที

---

## 💡 ตัวอย่างการใช้งาน

### ตัวอย่าง 1: เปลี่ยนเฉพาะสถานะ

**สถานการณ์:** มีอุปกรณ์ "มี + ใช้งานได้" 5 ชิ้น ต้องการเปลี่ยน 2 ชิ้นเป็น "หาย"

**ขั้นตอน:**
1. คลิก "แก้ไข" ที่แถว "มี | ใช้งานได้ | 5 ชิ้น"
2. เลือกสถานะใหม่: **หาย**
3. เลือกสภาพใหม่: **ใช้งานได้** (ไม่เปลี่ยน)
4. ระบุจำนวน: **2**
5. คลิก "บันทึก"

**ผลลัพธ์:**
```
│ มี          │ ใช้งานได้    │ 3 ชิ้น  │
│ หาย         │ ใช้งานได้    │ 3 ชิ้น  │  ← เพิ่มจาก 1 → 3
```

### ตัวอย่าง 2: เปลี่ยนทั้งสถานะและสภาพ

**สถานการณ์:** มีอุปกรณ์ "มี + ใช้งานได้" 5 ชิ้น ต้องการเปลี่ยน 3 ชิ้นเป็น "หาย + ชำรุด"

**ขั้นตอน:**
1. คลิก "แก้ไข" ที่แถว "มี | ใช้งานได้ | 5 ชิ้น"
2. เลือกสถานะใหม่: **หาย**
3. เลือกสภาพใหม่: **ชำรุด**
4. ระบุจำนวน: **3**
5. คลิก "บันทึก"

**ผลลัพธ์:**
```
│ มี          │ ใช้งานได้    │ 2 ชิ้น  │  ← เหลือ 2 ชิ้น
│ หาย         │ ชำรุด       │ 3 ชิ้น  │  ← สร้างใหม่
```

### ตัวอย่าง 3: เปลี่ยนเฉพาะสภาพ

**สถานการณ์:** มีอุปกรณ์ "มี + ใช้งานได้" 4 ชิ้น พบว่าชำรุด 1 ชิ้น

**ขั้นตอน:**
1. คลิก "แก้ไข" ที่แถว "มี | ใช้งานได้ | 4 ชิ้น"
2. เลือกสถานะใหม่: **มี** (ไม่เปลี่ยน)
3. เลือกสภาพใหม่: **ชำรุด**
4. ระบุจำนวน: **1**
5. คลิก "บันทึก"

**ผลลัพธ์:**
```
│ มี          │ ใช้งานได้    │ 3 ชิ้น  │
│ มี          │ ชำรุด       │ 1 ชิ้น  │  ← สร้างใหม่
```

---

## ⚙️ การทำงานภายใน (Technical)

### Frontend Components

**ไฟล์:** `src/app/admin/inventory/page.tsx`

**State ใหม่:**
```typescript
- editingCombinationKey: string | null  // Key ของแถวที่กำลังแก้ไข
- editingCombinationData: {             // ข้อมูลที่กำลังแก้ไข
    newStatusId: string
    newConditionId: string
    quantity: number
  }
- combinationsData: Array<{              // รายการ combinations
    statusId: string
    conditionId: string
    quantity: number
    key: string
  }>
- combinationsLoading: boolean           // สถานะ loading
```

**ฟังก์ชันสำคัญ:**
1. `fetchCombinationsData()` - ดึงข้อมูล combinations
2. `handleSaveCombination()` - บันทึกการแก้ไข

### Backend APIs

#### 1. GET `/api/admin/inventory/combinations`

**ไฟล์:** `src/app/api/admin/inventory/combinations/route.ts`

**Query Parameters:**
- `itemName`: ชื่ออุปกรณ์
- `categoryId`: ID หมวดหมู่

**Response:**
```json
{
  "combinations": [
    {
      "statusId": "status_available",
      "conditionId": "cond_working",
      "quantity": 5,
      "key": "status_available_cond_working"
    }
  ]
}
```

**Logic:**
1. Query อุปกรณ์ที่ไม่มี SN + admin_stock + ไม่ถูกลบ
2. จัดกลุ่มตาม `statusId` และ `conditionId`
3. นับจำนวนในแต่ละกลุ่ม
4. Return เฉพาะที่มีจำนวน > 0

#### 2. POST `/api/admin/inventory/update-combination`

**ไฟล์:** `src/app/api/admin/inventory/update-combination/route.ts`

**Request Body:**
```json
{
  "itemName": "Dell Laptop",
  "categoryId": "cat_laptop",
  "currentStatusId": "status_available",
  "currentConditionId": "cond_working",
  "newStatusId": "status_missing",
  "newConditionId": "cond_damaged",
  "quantity": 2
}
```

**Logic:**
1. Verify admin authentication
2. Validate input (quantity ≥ 1, ครบถ้วน)
3. Find items ที่ตรงกับ current status+condition
4. Limit จำนวนตาม quantity
5. Update statusId และ/หรือ conditionId
6. Update InventoryMaster
7. Return success message

**Validation:**
- ✅ จำนวนต้อง ≥ 1
- ✅ ต้องมีอุปกรณ์เพียงพอ
- ✅ ต้องเป็น admin
- ✅ ข้อมูลครบถ้วน

---

## 🔒 Security & Validation

### Frontend Validation
- จำนวนไม่เกินที่มี (Math.min/max)
- ปิดปุ่มบันทึกถ้าจำนวนไม่ถูกต้อง
- แสดง visual feedback (border สีแดงถ้าเกิน)

### Backend Validation
- ตรวจสอบ authentication (admin only)
- ตรวจสอบข้อมูลครบถ้วน
- ตรวจสอบจำนวนที่มีจริงใน database
- ป้องกัน race condition ด้วย transaction

---

## 🎨 UI/UX Features

### Visual Feedback
- **โหมดปกติ:** พื้นหลังขาว, hover = เทา
- **โหมดแก้ไข:** พื้นหลังฟ้าอ่อน
- **Input validation:** border แดงถ้าจำนวนเกิน
- **Loading:** แสดง spinner ขณะโหลดข้อมูล

### Accessibility
- ปุ่ม disabled ถ้าข้อมูลไม่ถูกต้อง
- แสดงจำนวนสูงสุดที่เลือกได้
- สี contrast ชัดเจน
- ข้อความ error ชัดเจน

---

## 📊 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User clicks "จัดการ Stock"                              │
│    ↓                                                          │
│ 2. openStockModal()                                          │
│    ├─ fetchStockInfo()                                       │
│    └─ fetchCombinationsData() ← NEW                          │
│       └─ GET /api/admin/inventory/combinations               │
│                                                               │
│ 3. User clicks "แก้ไข" on a row                            │
│    ↓                                                          │
│ 4. setEditingCombinationKey(combo.key)                      │
│    setEditingCombinationData({ ...combo })                  │
│                                                               │
│ 5. User modifies: status, condition, quantity               │
│                                                               │
│ 6. User clicks "บันทึก"                                     │
│    ↓                                                          │
│ 7. handleSaveCombination()                                   │
│    └─ POST /api/admin/inventory/update-combination          │
│       ├─ Validate auth & data                                │
│       ├─ Find & update items                                 │
│       └─ updateInventoryMaster()                             │
│                                                               │
│ 8. Success                                                   │
│    ├─ Close modal                                            │
│    └─ fetchInventory() (refresh main table)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Testing Checklist

### Frontend
- [ ] ตารางแสดงข้อมูลถูกต้อง
- [ ] คลิก "แก้ไข" เปลี่ยนเป็นโหมดแก้ไข
- [ ] Dropdown แสดงตัวเลือกครบ
- [ ] Input จำนวนจำกัดค่าถูกต้อง (1 ≤ n ≤ max)
- [ ] ปุ่ม "บันทึก" disabled ถ้าจำนวนไม่ถูกต้อง
- [ ] คลิก "ยกเลิก" กลับโหมดปกติ
- [ ] บันทึกสำเร็จ → ปิด modal + refresh table

### Backend
- [ ] API combinations return ข้อมูลถูกต้อง
- [ ] API update-combination validate ครบ
- [ ] จำนวนที่อัปเดตตรงกับ request
- [ ] InventoryMaster ถูก update
- [ ] ไม่สามารถอัปเดตเกินจำนวนที่มี
- [ ] Non-admin ถูก reject

### Edge Cases
- [ ] จำนวน = 0 → ไม่แสดงในตาราง
- [ ] จำนวน = 1 → สามารถแก้ไขได้
- [ ] จำนวน = max → สามารถเลือกทั้งหมดได้
- [ ] เปลี่ยนทั้งคู่พร้อมกัน
- [ ] เปลี่ยนแค่สถานะ
- [ ] เปลี่ยนแค่สภาพ

---

## 🐛 Troubleshooting

### ปัญหา: ตารางไม่แสดงข้อมูล
**สาเหตุ:** API combinations error หรือไม่มีข้อมูล
**แก้ไข:** 
1. เช็ค console logs
2. ตรวจสอบว่ามีอุปกรณ์ที่ไม่มี SN หรือไม่
3. ตรวจสอบ network request

### ปัญหา: บันทึกไม่สำเร็จ
**สาเหตุ:** Validation error หรือ insufficient quantity
**แก้ไข:**
1. เช็คว่าจำนวนไม่เกินที่มี
2. ตรวจสอบ authentication
3. ดู error message ที่ toast

### ปัญหา: ตารางไม่ refresh หลังบันทึก
**สาเหตุ:** fetchInventory() fail
**แก้ไข:**
1. Refresh page manually
2. เช็ค console errors
3. ตรวจสอบ network

---

## 📝 Notes

- ระบบนี้ใช้กับ **อุปกรณ์ที่ไม่มี Serial Number เท่านั้น**
- สำหรับอุปกรณ์ที่มี SN ใช้โหมด "✏️ แก้ไข/ลบ" แทน
- การอัปเดตจะปิด modal อัตโนมัติ ตาม UX flow ที่เลือกไว้
- InventoryMaster จะถูกอัปเดตทันทีหลังการเปลี่ยนแปลง

---

## 🎉 สรุป

ระบบ Inline Edit Combination ช่วยให้การจัดการสถานะและสภาพของอุปกรณ์ทำได้ง่ายและรวดเร็วขึ้น โดยไม่ต้องเปิด modal ซ้อนหลายชั้น และสามารถเปลี่ยนแปลงได้อย่างยืดหยุ่นตามความต้องการจริง

