# 📋 แผนการลบ ItemMaster Collection

## 🔴 ไฟล์ที่ต้องแก้ไข (จำเป็น)

### 1. **src/lib/inventory-helpers.ts**
- [ ] ลบ `import ItemMaster` (line 6)
- [ ] ลบ `createInventoryItem()` lines 123-135
- [ ] แก้ไข `changeItemStatus()` lines 483-487 และ 503-504
- [ ] ลบ `getItemMastersByCategory()` lines 562-567
- [ ] ลบ `getInventoryMastersWithDetails()` lines 572-588

### 2. **src/app/api/admin/item-masters/** (ลบทั้ง folder)
- [ ] ลบ `route.ts` - API สำหรับจัดการ ItemMaster
- [ ] ลบ `[id]/route.ts` - API สำหรับแก้ไข ItemMaster เดี่ยว

### 3. **src/models/ItemMaster.ts** 
- [ ] ลบไฟล์ทั้งไฟล์

## 🟡 ไฟล์ที่ควรแก้ไข (เสริม)

### 4. **APIs ที่เกี่ยวข้อง**
- [ ] `src/app/api/equipment-request/route.ts` - lines 43-44, 78-117
- [ ] `src/app/api/equipment-return/route.ts` - line 113
- [ ] `src/app/api/admin/equipment-request/approve/route.ts` - lines 55-67
- [ ] `src/app/api/user/owned-equipment/route.ts` - lines 39-51
- [ ] `src/app/api/equipment-request/available/route.ts` - lines 29-55

### 5. **Frontend Components**
- [ ] `src/components/DashboardNew.tsx` - lines 36,49,83,etc.

## 🟢 ไฟล์ที่ไม่จำเป็นต้องแก้ (Scripts/Migration)
- `src/scripts/` - เป็นแค่ migration scripts
- `src/models/InventoryItemNew.ts` - ไฟล์เก่า
- `src/models/InventoryMasterNew.ts` - ไฟล์เก่า

## 🛠️ การแก้ไขที่แนะนำ

### แทน ItemMaster ด้วย InventoryMaster:
```javascript
// เก่า: หา ItemMaster
const itemMaster = await ItemMaster.findById(item.itemMasterId);

// ใหม่: ใช้ข้อมูลจาก InventoryItem โดยตรง
const logData = {
  itemName: item.itemName,
  categoryId: item.categoryId
};
```

### สำหรับ hasSerialNumber:
```javascript
// เก่า: จาก ItemMaster.hasSerialNumber
hasSerialNumber: itemMaster.hasSerialNumber

// ใหม่: คำนวณจาก InventoryMaster.itemDetails
hasSerialNumber: inventoryMaster.itemDetails.withSerialNumber > 0
```

## 📊 สรุปผลกระทบ

| ระดับความรุนแรง | จำนวนไฟล์ | รายละเอียด |
|-----------------|-----------|------------|
| 🔴 **สำคัญมาก** | 3 ไฟล์ | จะพังทันทีถ้าไม่แก้ |
| 🟡 **ปานกลาง** | 8 ไฟล์ | อาจมี error ในบางฟีเจอร์ |
| 🟢 **ไม่สำคัญ** | 10+ ไฟล์ | Scripts/Legacy code |

## 🎯 คำแนะนำ

**แนะนำให้ลบ ItemMaster** เพราะ:
- ✅ ข้อมูลซ้ำซ้อนกับ InventoryMaster  
- ✅ ลดความซับซ้อนของระบบ
- ✅ Performance ดีขึ้น
- ⚠️ แต่ต้องแก้ไขโค้ดประมาณ 11 ไฟล์