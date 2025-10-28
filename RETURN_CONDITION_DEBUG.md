# 🐛 Debug: ทำไม conditionOnReturnName ไม่ตรงกับ conditionOnReturn

## ปัญหาที่พบ

จาก MongoDB:
```json
{
  "statusOnReturn": "status_available",
  "statusOnReturnName": "มี",              // ✅ ถูกต้อง
  "conditionOnReturn": "cond_damaged",
  "conditionOnReturnName": "ใช้งานได้"     // ❌ ผิด! ควรเป็น "ชำรุด"
}
```

## การตรวจสอบ

### ขั้นตอน 1: ลองคืนอุปกรณ์ใหม่

1. **คืนอุปกรณ์** (เลือกสภาพ "ชำรุด")
2. **เปิด Browser Console** (F12)
3. **ดู log** ที่ขึ้นมา:

```
🔍 Config Lookup for item: Dell
  statusOnReturn: status_available
  statusConfig found: { id: "status_available", name: "มี" }
  conditionOnReturn: cond_damaged
  conditionConfig found: { id: "cond_damaged", name: "ชำรุด" }  // ✅ ถ้าพบ = ถูกต้อง
  All statusConfigs: [...]
  All conditionConfigs: [...]
```

### ขั้นตอน 2: ตรวจสอบผลลัพธ์

**ถ้า `conditionConfig found: null` หรือ `undefined`:**
- แสดงว่า `conditionConfigs` ไม่มีข้อมูล หรือ ID ไม่ตรง
- ต้องตรวจสอบ API `/api/inventory-config`

**ถ้า `conditionConfig found: { id: "cond_damaged", name: "ชำรุด" }`:**
- แสดงว่า logic ถูกต้อง ✅
- ข้อมูลใน MongoDB ที่ผิดคือ **ข้อมูลเก่า** (ก่อนแก้ไข)

### ขั้นตอน 3: ตรวจสอบใน MongoDB

หลังคืนอุปกรณ์ใหม่:
1. **Refresh MongoDB Compass**
2. **ดู ReturnLog ล่าสุด**
3. **ตรวจสอบ:**
   - `conditionOnReturn` = "cond_damaged"
   - `conditionOnReturnName` = "ชำรุด" ✅ (ควรถูกแล้ว)

## สาเหตุที่เป็นไปได้

1. **ข้อมูลใน MongoDB เป็นข้อมูลเก่า** (ก่อนแก้ไข)
   - Solution: คืนอุปกรณ์ใหม่อีกครั้ง

2. **conditionConfigs ไม่ถูกโหลด**
   - Solution: ตรวจสอบ `/api/inventory-config`

3. **ID ไม่ตรงกัน**
   - เช่น `cond_damaged` vs `cond-damaged`
   - Solution: ตรวจสอบ config

## คำแนะนำ

**ลองคืนอุปกรณ์ใหม่ 1 รายการ** พร้อมดู console log แล้วบอกผลให้ฉันทราบว่า:
- `conditionConfig found:` แสดงอะไร?
- ข้อมูลใน MongoDB ใหม่ถูกหรือไม่?

---

**พร้อม Debug แล้ว!** 🔍

