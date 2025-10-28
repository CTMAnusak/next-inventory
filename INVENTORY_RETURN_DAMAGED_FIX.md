# 🔧 แก้ไขปัญหาอุปกรณ์หายจากตารางเมื่อคืนสภาพชำรุด

## ปัญหาที่พบ

เมื่อผู้ใช้คืนอุปกรณ์สภาพ "ชำรุด" และ Admin อนุมัติ:
- **กรณี 5 ชิ้น**: คืน 1 ชิ้นสภาพชำรุด → อนุมัติ → แสดง **4 ชิ้น** (ควรเป็น 5 ชิ้น)
- **กรณี 1 ชิ้น**: คืน 1 ชิ้นสภาพชำรุด → อนุมัติ → แสดง **0 ชิ้น** → **หายจากตาราง**

## สาเหตุ

ระบบเดิมแสดง `availableQuantity` (จำนวนที่พร้อมเบิก = มี + ใช้งานได้) ในคอลัมน์จำนวน
- เมื่อคืนอุปกรณ์สภาพชำรุด → `conditionId = "cond_damaged"`
- `availableQuantity` นับเฉพาะ `admin_stock + status_available + cond_working`
- อุปกรณ์ชำรุดไม่ถูกนับ → จำนวนลดลง → ถ้าเป็น 0 ก็หายจากตาราง

## การแก้ไข

### 1. ✅ API: `/api/admin/inventory` (src/app/api/admin/inventory/route.ts)
**เปลี่ยนจาก:**
```typescript
quantity: item.availableQuantity, // จำนวนที่เหลือให้เบิก
```

**เป็น:**
```typescript
quantity: item.totalQuantity, // 🔧 CRITICAL FIX: แสดงจำนวนทั้งหมด
availableQuantity: item.availableQuantity, // จำนวนที่พร้อมเบิก (available + working)
```

### 2. ✅ Frontend: Admin Inventory Page (src/app/admin/inventory/page.tsx)

**Interface:**
```typescript
interface InventoryItem {
  quantity: number; // totalQuantity (จำนวนทั้งหมด)
  totalQuantity?: number;
  availableQuantity?: number; // จำนวนที่พร้อมเบิก (available + working)
  userOwnedQuantity: number; // จำนวนที่ user ถือ
  hasSerialNumber?: boolean;
}
```

**ตาราง:**
- **คอลัมน์ "จำนวนที่เบิกได้"**: แสดง `availableQuantity` (พร้อมเบิก)
- **คอลัมน์ "จำนวนทั้งหมด"**: แสดง `totalQuantity` (ทั้งหมด รวมชำรุด)
  - แสดง breakdown: User ถือ, ชำรุด/สูญหาย

**Low Stock Warning:**
- เปลี่ยนจากเช็ค `quantity` เป็น `availableQuantity`
- แจ้งเตือนเมื่ออุปกรณ์ที่พร้อมเบิกน้อย ไม่ใช่อุปกรณ์ทั้งหมด

### 3. ✅ API: `/api/inventory` (src/app/api/inventory/route.ts)
**เพิ่มฟิลด์:**
```typescript
quantity: item.availableQuantity, // สำหรับ user - เบิกได้เฉพาะที่ available + working
availableQuantity: item.availableQuantity,
totalQuantity: item.totalQuantity,
```

## ผลลัพธ์

### ก่อนแก้ไข
```
อุปกรณ์: Mouse (5 ชิ้น)
- คืน 1 ชิ้นสภาพชำรุด → แสดง 4 ชิ้น ❌
```

### หลังแก้ไข
```
อุปกรณ์: Mouse
┌─────────────────┬──────────────────┐
│ จำนวนที่เบิกได้ │ จำนวนทั้งหมด    │
├─────────────────┼──────────────────┤
│ 4               │ 5                │
│                 │ ⚠️ ชำรุด: 1      │
└─────────────────┴──────────────────┘
```

## การทดสอบ

### สถานการณ์ที่ 1: คืนอุปกรณ์สภาพชำรุด (1 ชิ้น)
1. สร้างอุปกรณ์ใหม่ 1 ชิ้น (เช่น "Mouse Test")
2. User เบิกอุปกรณ์ไป → Admin อนุมัติ
3. User คืนอุปกรณ์ **สภาพ "ชำรุด"**
4. Admin อนุมัติการคืน
5. ✅ **ตรวจสอบ**: ในตาราง Admin Inventory ควรแสดง:
   - **จำนวนที่เบิกได้**: 0
   - **จำนวนทั้งหมด**: 1
     - ⚠️ ชำรุด/สูญหาย: 1
6. ✅ **อุปกรณ์ไม่หายจากตาราง**

### สถานการณ์ที่ 2: คืนอุปกรณ์สภาพชำรุด (5 ชิ้น)
1. สร้างอุปกรณ์ 5 ชิ้น (ไม่มี SN)
2. User เบิกอุปกรณ์ 1 ชิ้น → Admin อนุมัติ
3. User คืนอุปกรณ์ **สภาพ "ชำรุด"**
4. Admin อนุมัติการคืน
5. ✅ **ตรวจสอบ**: ในตาราง Admin Inventory ควรแสดง:
   - **จำนวนที่เบิกได้**: 4
   - **จำนวนทั้งหมด**: 5
     - ⚠️ ชำรุด/สูญหาย: 1

### สถานการณ์ที่ 3: คืนอุปกรณ์สภาพปกติ
1. User เบิกอุปกรณ์ → Admin อนุมัติ
2. User คืนอุปกรณ์ **สภาพ "ใช้งานได้"**
3. Admin อนุมัติการคืน
4. ✅ **ตรวจสอบ**: จำนวนที่เบิกได้ และจำนวนทั้งหมด ควรเท่ากัน (ไม่เปลี่ยน)

## ข้อควรระวัง

1. **Low Stock Warning**: ตอนนี้เช็คจาก `availableQuantity` แล้ว
   - ถ้ามีอุปกรณ์ 10 ชิ้น แต่ชำรุดหมด → แจ้งเตือน low stock ✅
   
2. **User Equipment Request**: ยังคงแสดงเฉพาะ `availableQuantity` เพราะ user เบิกได้เฉพาะที่ใช้งานได้

3. **InventoryMaster Calculation**: ไม่เปลี่ยนแปลง
   - `totalQuantity` = นับทุกอุปกรณ์ (ไม่รวมที่ถูกลบ)
   - `availableQuantity` = นับเฉพาะ admin_stock + status_available + cond_working
   - `userOwnedQuantity` = นับอุปกรณ์ที่ user ถือ

## ไฟล์ที่แก้ไข

1. ✅ `src/app/api/admin/inventory/route.ts` - เปลี่ยน quantity เป็น totalQuantity
2. ✅ `src/app/api/inventory/route.ts` - เพิ่มฟิลด์ availableQuantity
3. ✅ `src/app/admin/inventory/page.tsx` - แสดง totalQuantity และ availableQuantity แยกกัน

## หมายเหตุ

- **อุปกรณ์ชำรุดยังอยู่ใน admin_stock** (ไม่ได้ถูกลบ)
- **จำนวนทั้งหมดรวมอุปกรณ์ชำรุด** แต่จำนวนที่เบิกได้ไม่รวม
- **Breakdown** แสดงจำนวนชำรุด/สูญหายชัดเจน

---

**ทดสอบแล้ว**: ✅ No Linter Errors  
**พร้อมใช้งาน**: รอ User ทดสอบจริง

