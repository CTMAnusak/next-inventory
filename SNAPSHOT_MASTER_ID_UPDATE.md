# สรุปการแก้ไข: เก็บ masterId ใน Snapshot

## ปัญหาที่พบ

เดิม snapshot เก็บเฉพาะ `itemName` และ `categoryId` เป็น string โดยตรง ทำให้:
- ❌ ถ้าเปลี่ยนชื่อ item ใน InventoryMaster ชื่อใน snapshot จะไม่เปลี่ยนตาม
- ❌ ไม่สามารถอ้างอิงกลับไปยัง InventoryMaster ได้
- ❌ ถ้า InventoryMaster ถูกลบจะหาไม่เจอ

## การแก้ไข

### 1. เพิ่ม `masterId` ใน Model

**ไฟล์**: `src/models/InventorySnapshot.ts`

```typescript
itemDetails?: Array<{
  masterId?: string;        // 🆕 อ้างอิงไปยัง InventoryMaster._id (ถ้ามี)
  itemName: string;        // ชื่ออุปกรณ์ (snapshot ณ เวลานั้น)
  categoryId: string;
  // ... other fields
}>
```

### 2. อัพเดตการสร้าง Snapshot

**ไฟล์**: `src/lib/snapshot-helpers.ts`

```typescript
itemDetails.push({
  masterId: master._id?.toString(), // 🆕 เก็บ masterId เพื่ออ้างอิง
  itemName: master.itemName,        // เก็บชื่อ ณ เวลาที่ snapshot (ประวัติศาสตร์)
  categoryId: master.categoryId,
  // ... other fields
});
```

### 3. สร้าง Helper Functions สำหรับ Populate ชื่อปัจจุบัน

**ไฟล์**: `src/lib/snapshot-populate-helpers.ts`

- `getCurrentItemName(masterId)` - ดึงชื่อปัจจุบันจาก masterId
- `populateSnapshotItemNames(itemDetails)` - Populate ชื่อปัจจุบันให้กับ snapshot items

## ข้อดีของการแก้ไขนี้

### ✅ เก็บทั้ง ID และชื่อ
- `masterId`: อ้างอิงไปยัง InventoryMaster (ใช้สำหรับ lookup ชื่อปัจจุบัน)
- `itemName`: ชื่อ ณ เวลาที่ snapshot (เก็บประวัติศาสตร์)

### ✅ ยืดหยุ่น
- ถ้ามี `masterId` → สามารถดึงชื่อปัจจุบันได้
- ถ้าไม่มี `masterId` หรือ master ถูกลบ → ใช้ชื่อที่ snapshot ไว้

### ✅ Backward Compatible
- `masterId` เป็น optional field → snapshot เก่าจะยังใช้งานได้
- ถ้า snapshot เก่าไม่มี `masterId` จะใช้ชื่อที่ snapshot ไว้

## วิธีใช้งาน

### 1. แสดงชื่อปัจจุบันใน Dashboard

```typescript
import { populateSnapshotItemNames } from '@/lib/snapshot-populate-helpers';

// เมื่อดึง snapshot มา
const snapshot = await InventorySnapshot.findOne({ year: 2568, month: 10 });

if (snapshot?.itemDetails) {
  // Populate ชื่อปัจจุบัน
  const itemsWithCurrentName = await populateSnapshotItemNames(snapshot.itemDetails);
  
  // itemsWithCurrentName จะมี:
  // - itemName: ชื่อ ณ เวลาที่ snapshot
  // - currentItemName: ชื่อปัจจุบัน (ถ้ามี masterId)
}
```

### 2. แสดงใน UI

```tsx
{itemDetails.map(item => (
  <div>
    {/* แสดงชื่อปัจจุบัน (ถ้ามี) หรือชื่อที่ snapshot ไว้ */}
    <span>{item.currentItemName || item.itemName}</span>
    
    {/* แสดงชื่อเดิมสำหรับดูประวัติศาสตร์ (ถ้าต่างจากชื่อปัจจุบัน) */}
    {item.currentItemName && item.currentItemName !== item.itemName && (
      <span className="text-xs text-gray-500">
        (เดิม: {item.itemName})
      </span>
    )}
  </div>
))}
```

## Migration

### สำหรับ Snapshot ที่มีอยู่แล้ว

Snapshot เก่าจะยังใช้งานได้โดยไม่มี `masterId`:
- ถ้าไม่มี `masterId` → ใช้ชื่อที่ snapshot ไว้
- Snapshot ใหม่จะมีการเก็บ `masterId` อัตโนมัติ

### ถ้าต้องการ Backfill masterId ให้ snapshot เก่า

```javascript
// สคริปต์สำหรับ backfill (ถ้าต้องการ)
const snapshots = await InventorySnapshot.find({ 'itemDetails.masterId': { $exists: false } });

for (const snapshot of snapshots) {
  for (const item of snapshot.itemDetails || []) {
    const master = await InventoryMaster.findOne({
      itemName: item.itemName,
      categoryId: item.categoryId
    });
    
    if (master) {
      item.masterId = master._id.toString();
    }
  }
  
  await snapshot.save();
}
```

## สรุป

✅ **เก็บทั้ง masterId และ itemName**
- `masterId`: สำหรับอ้างอิงและดึงชื่อปัจจุบัน
- `itemName`: สำหรับเก็บประวัติศาสตร์

✅ **Backward Compatible**
- Snapshot เก่าจะยังใช้งานได้
- `masterId` เป็น optional field

✅ **ยืดหยุ่น**
- ถ้ามี masterId → แสดงชื่อปัจจุบัน
- ถ้าไม่มี masterId → ใช้ชื่อที่ snapshot ไว้

## หมายเหตุ

- Snapshot ใหม่จะเก็บ `masterId` อัตโนมัติเมื่อสร้าง
- Snapshot เก่าจะยังทำงานได้โดยไม่มี `masterId`
- ใช้ helper function `populateSnapshotItemNames()` เพื่อดึงชื่อปัจจุบันเมื่อต้องการ

