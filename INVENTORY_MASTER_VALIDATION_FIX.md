# 🔧 แก้ไขบั๊ก InventoryMaster Validation

## ปัญหา

เมื่อคืนอุปกรณ์สภาพ "ชำรุด" และ Admin อนุมัติ:
- อุปกรณ์แสดงในตาราง ✅
- แต่ `totalQuantity = 0` ❌ (ควรเป็น 1)

## สาเหตุ

**Pre-save hook ใน InventoryMaster Schema** บังคับให้:
```typescript
totalQuantity = availableQuantity + userOwnedQuantity
```

ในกรณีอุปกรณ์ชำรุด:
- `availableQuantity` = 0 (ชำรุด = ไม่นับ)
- `userOwnedQuantity` = 0 (คืนแล้ว = อยู่ admin_stock)
- `totalQuantity` = **0 + 0 = 0** ❌

## การแก้ไข

ลบ validation ที่ผิด และเปลี่ยนเป็นตรวจสอบค่าติดลบเท่านั้น:

**ก่อนแก้ไข:**
```typescript
InventoryMasterSchema.pre('save', function(next) {
  const calculatedTotal = this.availableQuantity + this.userOwnedQuantity;
  if (Math.abs(this.totalQuantity - calculatedTotal) > 0.01) {
    // Auto-correct ❌ ผิด!
    this.totalQuantity = calculatedTotal;
  }
  ...
});
```

**หลังแก้ไข:**
```typescript
InventoryMasterSchema.pre('save', function(next) {
  // ตรวจสอบเฉพาะค่าติดลบ
  if (this.totalQuantity < 0) {
    this.totalQuantity = 0;
  }
  if (this.availableQuantity < 0) {
    this.availableQuantity = 0;
  }
  if (this.userOwnedQuantity < 0) {
    this.userOwnedQuantity = 0;
  }
  ...
});
```

## ความหมายที่ถูกต้อง

- **`totalQuantity`**: จำนวนทั้งหมด (admin_stock ทุกสภาพ + user_owned)
- **`availableQuantity`**: จำนวนที่พร้อมเบิก (admin_stock + available + working เท่านั้น)
- **`userOwnedQuantity`**: จำนวนที่ user ถือ

## ขั้นตอนการแก้ไข

1. ✅ แก้ไข `src/models/InventoryMaster.ts` (ลบ auto-correct validation)
2. 🔄 **Restart Server** (สำคัญ!)
   ```bash
   Ctrl + C (หยุด server)
   npm run dev (เริ่มใหม่)
   ```
3. 🔧 รัน Force Update ที่ `http://localhost:3000/fix-name-equipment.html`
4. ✅ Refresh หน้าจัดการคลังสินค้า (`Ctrl+Shift+R`)

## ผลลัพธ์ที่คาดหวัง

หลัง Force Update:
```
✅ Force Update เรียบร้อยแล้ว!

BEFORE: totalQuantity = 0
AFTER:  totalQuantity = 1 ✅

AIS จะแสดงในตาราง:
- จำนวนที่เบิกได้: 0
- จำนวนทั้งหมด: 1 ✅
  - ⚠️ ชำรุด/สูญหาย: 1
```

## ไฟล์ที่แก้ไข

- ✅ `src/models/InventoryMaster.ts` - ลบ validation ที่ผิด

---

**หมายเหตุ**: ต้อง **Restart Server** เพื่อให้การเปลี่ยนแปลง Schema มีผล!

