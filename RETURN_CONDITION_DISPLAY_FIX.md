# 🔧 แก้ไขปัญหาประวัติการคืนแสดงสภาพผิด

## ปัญหา

เมื่อคืนอุปกรณ์สภาพ **"ชำรุด"** แต่ในตารางประวัติการคืนแสดงเป็น **"ใช้งานได้"** (หรือไม่ระบุ)

## สาเหตุ

**ตอนคืนอุปกรณ์**: บันทึกเฉพาะ ID (`conditionOnReturn: "cond_damaged"`)  
**แต่ไม่ได้บันทึก ชื่อ** (`conditionOnReturnName: "ชำรุด"`)

**ตารางประวัติ** พยายามแสดงจาก:
```typescript
{(item as any).conditionOnReturnName || item.conditionOnReturn || 'ไม่ระบุ'}
```

เมื่อ `conditionOnReturnName` ไม่มีข้อมูล → fallback ไปใช้ `conditionOnReturn` (ID) → อาจแสดงผิด

## การแก้ไข

เพิ่มการบันทึก `conditionOnReturnName` และ `statusOnReturnName` ตอนคืนอุปกรณ์:

**ก่อนแก้ไข:**
```typescript
return {
  itemId: finalId,
  statusOnReturn: ri.statusOnReturn || 'status_available',
  conditionOnReturn: ri.conditionOnReturn || 'cond_working'
  // ❌ ไม่มีชื่อ
};
```

**หลังแก้ไข:**
```typescript
// 🔧 FIX: Get status and condition names from configs
const statusConfig = statusConfigs.find(s => s.id === ri.statusOnReturn);
const conditionConfig = conditionConfigs.find(c => c.id === ri.conditionOnReturn);

return {
  itemId: finalId,
  statusOnReturn: ri.statusOnReturn || 'status_available',
  conditionOnReturn: ri.conditionOnReturn || 'cond_working',
  statusOnReturnName: statusConfig?.name || 'มี', // ✅ เพิ่มชื่อสถานะ
  conditionOnReturnName: conditionConfig?.name || 'ใช้งานได้' // ✅ เพิ่มชื่อสภาพ
};
```

## ผลลัพธ์

**ก่อนแก้ไข:**
```
คืนอุปกรณ์: Dell (จอ Monitor)
สภาพเลือก: ชำรุด
→ ประวัติแสดง: ใช้งานได้ ❌
```

**หลังแก้ไข:**
```
คืนอุปกรณ์: Dell (จอ Monitor)
สภาพเลือก: ชำรุด
→ ประวัติแสดง: ชำรุด ✅
```

## การทดสอบ

1. **คืนอุปกรณ์ใหม่** สภาพ "ชำรุด"
2. **Admin อนุมัติ**
3. **ตรวจสอบประวัติการคืน** → ควรแสดง "ชำรุด" ถูกต้อง ✅

## หมายเหตุ

- **ประวัติเก่า** (ก่อนแก้ไข) จะยังแสดงผิดอยู่ เพราะไม่มี `conditionOnReturnName`
- **ประวัติใหม่** (หลังแก้ไข) จะแสดงถูกต้อง ✅

## ไฟล์ที่แก้ไข

- ✅ `src/app/equipment-return/page.tsx` - เพิ่มการบันทึก statusOnReturnName และ conditionOnReturnName

---

**พร้อมทดสอบแล้ว!** 🎉 ลองคืนอุปกรณ์สภาพชำรุดดูอีกครั้ง

