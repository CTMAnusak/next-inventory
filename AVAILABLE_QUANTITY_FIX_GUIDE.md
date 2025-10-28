# คู่มือแก้ไขปัญหา "จำนวนที่เบิกได้" แสดง 0 แทนที่จะเป็น 4

## 📋 สรุปปัญหา

จากการตรวจสอบ "Mouse Logitech" พบว่า:
- **สถานะ "มี"**: 5 ชิ้น
- **สภาพ "ใช้งานได้"**: 4 ชิ้น  
- **สภาพ "ชำรุด"**: 1 ชิ้น
- **จำนวนที่เบิกได้**: 0 ชิ้น ❌ (ควรจะเป็น 4 ชิ้น)

## 🔍 สาเหตุที่เป็นไปได้

### สาเหตุที่ 1: ข้อมูลแสดงรวมทั้ง Admin Stock และ User Owned

ข้อมูลเดิมที่แสดงในป๊อปอัพ "ข้อมูลเพิ่มเติม" แสดง**รวมทั้งหมด** (Admin Stock + User Owned) แต่ **"จำนวนที่เบิกได้"** นับเฉพาะ:

```
จำนวนที่เบิกได้ = Admin Stock + สถานะ "มี" + สภาพ "ใช้งานได้"
```

**ตัวอย่าง:**
- หากมีอุปกรณ์ 5 ชิ้นที่มีสถานะ "มี" แต่ทั้งหมดเป็น **User Owned** (ไม่ใช่ Admin Stock)
- จำนวนที่เบิกได้จะเป็น **0** (ถูกต้อง เพราะไม่มีอุปกรณ์ในคลังให้เบิก)

### สาเหตุที่ 2: ข้อมูลเก่าไม่มีฟิลด์ conditionId

อุปกรณ์ที่สร้างก่อนที่จะมีระบบ `conditionId` อาจมีค่า `null` หรือ `undefined` ทำให้ไม่ถูกนับใน "จำนวนที่เบิกได้"

### สาเหตุที่ 3: InventoryMaster ยังไม่ได้อัปเดต

ข้อมูลใน InventoryMaster อาจยังไม่ Sync กับ InventoryItems

---

## ✅ การแก้ไขที่ทำไปแล้ว

### 1. ปรับปรุงการแสดงผลใน Popup "ข้อมูลเพิ่มเติม"

**ไฟล์:** `src/components/StatusCell.tsx`

**การเปลี่ยนแปลง:**
- แยกแสดง **Admin Stock** และ **User Owned** ต่างหาก
- เพิ่มคำอธิบาย: "จำนวนที่เบิกได้ = อุปกรณ์ที่อยู่ใน Admin Stock + สถานะ 'มี' + สภาพ 'ใช้งานได้'"

**ผลลัพธ์:**
```
💡 จำนวนที่เบิกได้ = อุปกรณ์ที่อยู่ใน Admin Stock + สถานะ "มี" + สภาพ "ใช้งานได้"

สถานะอุปกรณ์ (Admin Stock):
• มี: X ชิ้น

สภาพอุปกรณ์ (Admin Stock):
• ใช้งานได้: Y ชิ้น
• ชำรุด: Z ชิ้น

สถานะอุปกรณ์ (User Owned):  // ถ้ามี
• มี: A ชิ้น

สภาพอุปกรณ์ (User Owned):  // ถ้ามี
• ใช้งานได้: B ชิ้น
```

### 2. เพิ่ม Debug Logging ใน updateInventoryMaster

**ไฟล์:** `src/lib/inventory-helpers.ts`

**การเปลี่ยนแปลง:**
- เพิ่ม logging เมื่อ availableQuantity = 0 แต่มี adminStock > 0
- แสดง status และ condition breakdown
- ตรวจจับรายการที่ไม่มี conditionId

**ตัวอย่าง Log:**
```
⚠️  Mouse Logitech: availableQuantity=0 but adminStock=5
   Status breakdown: { status_available: 5 }
   Condition breakdown: { undefined: 5 }
   ⚠️  5 items have null/undefined conditionId
```

### 3. สร้าง Migration Script

**ไฟล์:** `fix-missing-condition-ids.js`

**วิธีใช้:**
```bash
node fix-missing-condition-ids.js
```

**ทำอะไร:**
1. หารายการที่ไม่มี `conditionId`
2. กำหนดค่า `conditionId = 'cond_working'` ให้กับรายการเหล่านั้น
3. อัปเดต InventoryMaster ให้ตรงกับข้อมูลใหม่

---

## 🔧 วิธีแก้ไขปัญหา

### ขั้นตอนที่ 1: ตรวจสอบข้อมูล

1. เปิดหน้า Admin Inventory
2. คลิกปุ่ม ℹ️ ที่รายการ "Mouse Logitech"
3. ดูข้อมูลที่แสดงใหม่:
   - ถ้ามี "Admin Stock" แสดงว่ามีอุปกรณ์ในคลัง
   - ถ้าแสดงแต่ "User Owned" แสดงว่าอุปกรณ์ทั้งหมดอยู่กับ User (จำนวนที่เบิกได้ควรเป็น 0)

### ขั้นตอนที่ 2: รัน Migration Script (ถ้าจำเป็น)

ถ้าพบว่ามี log แสดงว่ามีรายการไม่มี conditionId:

```bash
# สำหรับ Production (ปรับ connection string ให้ถูกต้อง)
node fix-missing-condition-ids.js
```

### ขั้นตอนที่ 3: Refresh InventoryMaster

กดปุ่ม "🔄 รีเฟรช" ในหน้า Admin Inventory เพื่อ:
1. Sync ข้อมูล InventoryMaster
2. ล้าง cache
3. อัปเดต availableQuantity ให้ถูกต้อง

---

## 🧪 การทดสอบ

### ทดสอบว่าแก้ไขถูกต้อง

1. **ตรวจสอบ Popup:**
   - คลิก ℹ️ ที่รายการใดก็ได้
   - ควรเห็นการแยกระหว่าง "Admin Stock" และ "User Owned"
   - ควรเห็นคำอธิบายด้านบนว่า "จำนวนที่เบิกได้" คำนวณอย่างไร

2. **ตรวจสอบ Console Log:**
   - เปิด Browser Console (F12)
   - กด "รีเฟรช" ในหน้า Inventory
   - ดู log ว่ามีการคำนวณ availableQuantity ถูกต้องหรือไม่

3. **ตรวจสอบจำนวนที่เบิกได้:**
   - ดูคอลัมน์ "จำนวนที่เบิกได้"
   - ตัวเลขควรตรงกับจำนวน Admin Stock ที่มีสถานะ "มี" + สภาพ "ใช้งานได้"

---

## 📊 ตัวอย่างการคำนวณที่ถูกต้อง

### กรณีที่ 1: อุปกรณ์ทั้งหมดใน Admin Stock
```
Mouse Logitech:
- Admin Stock (สถานะ "มี" + สภาพ "ใช้งานได้"): 4 ชิ้น
- Admin Stock (สถานะ "มี" + สภาพ "ชำรุด"): 1 ชิ้น
- User Owned: 0 ชิ้น

จำนวนที่เบิกได้ = 4 ชิ้น ✅
```

### กรณีที่ 2: อุปกรณ์บางส่วนอยู่กับ User
```
Mouse Logitech:
- Admin Stock (สถานะ "มี" + สภาพ "ใช้งานได้"): 1 ชิ้น
- Admin Stock (สถานะ "มี" + สภาพ "ชำรุด"): 1 ชิ้น
- User Owned (สถานะ "มี" + สภาพ "ใช้งานได้"): 3 ชิ้น

จำนวนที่เบิกได้ = 1 ชิ้น ✅ (นับเฉพาะ Admin Stock)
```

### กรณีที่ 3: อุปกรณ์ทั้งหมดอยู่กับ User
```
Mouse Logitech:
- Admin Stock: 0 ชิ้น
- User Owned (สถานะ "มี" + สภาพ "ใช้งานได้"): 5 ชิ้น

จำนวนที่เบิกได้ = 0 ชิ้น ✅ (ไม่มีในคลังให้เบิก)
```

---

## 🐛 Debug Tools

### 1. ดูข้อมูล Raw จาก Database

```javascript
// เปิด Browser Console และรัน:
fetch('/api/admin/inventory/breakdown?itemName=Mouse Logitech&categoryId=YOUR_CATEGORY_ID')
  .then(r => r.json())
  .then(data => console.log(data))
```

### 2. Force Update InventoryMaster

```javascript
// ใน Admin Panel, เปิด Console และรัน:
fetch('/api/admin/refresh-master-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    itemName: 'Mouse Logitech',
    category: 'YOUR_CATEGORY_ID'
  })
}).then(r => r.json()).then(console.log)
```

---

## 📝 บันทึกการเปลี่ยนแปลง

### ไฟล์ที่แก้ไข:
1. `src/components/StatusCell.tsx` - แสดง Admin Stock / User Owned แยกกัน
2. `src/lib/inventory-helpers.ts` - เพิ่ม debug logging
3. `fix-missing-condition-ids.js` - Migration script (ใหม่)
4. `AVAILABLE_QUANTITY_FIX_GUIDE.md` - คู่มือนี้ (ใหม่)

### API Endpoints ที่เกี่ยวข้อง:
- `GET /api/admin/inventory/breakdown` - ดึงข้อมูล breakdown
- `POST /api/admin/refresh-master-data` - Sync InventoryMaster
- `POST /api/admin/clear-all-caches` - ล้าง cache

---

## ❓ FAQ

### Q: ทำไม "จำนวนที่เบิกได้" ไม่เท่ากับจำนวน "สถานะ มี"?
**A:** เพราะ "จำนวนที่เบิกได้" ต้องมีทั้ง 3 เงื่อนไข:
1. อยู่ใน **Admin Stock** (ไม่ใช่ User Owned)
2. สถานะเป็น **"มี"** (status_available)
3. สภาพเป็น **"ใช้งานได้"** (cond_working)

### Q: ถ้าอุปกรณ์สภาพ "ชำรุด" จะนับในจำนวนที่เบิกได้หรือไม่?
**A:** ไม่นับ เพราะสภาพต้องเป็น "ใช้งานได้" เท่านั้น

### Q: ถ้าอุปกรณ์อยู่กับ User แต่สภาพ "ใช้งานได้" จะนับหรือไม่?
**A:** ไม่นับ เพราะต้องอยู่ใน Admin Stock เท่านั้น

### Q: จะบังคับให้ Sync ข้อมูลได้อย่างไร?
**A:** กดปุ่ม "🔄 รีเฟรช" ในหน้า Admin Inventory

---

## 📞 ติดต่อ Support

หากปัญหายังไม่หายหลังทำตามขั้นตอนทั้งหมด:
1. ส่ง screenshot ของ popup "ข้อมูลเพิ่มเติม"
2. ส่ง console logs จาก Browser (F12 > Console tab)
3. แจ้งชื่ออุปกรณ์และหมวดหมู่ที่มีปัญหา

---

**อัปเดตล่าสุด:** 27 ตุลาคม 2568
**เวอร์ชัน:** 1.0

