# คู่มือระบบอีเมลแจ้งเตือนเมื่อยกเลิกคำขอเบิกอุปกรณ์

## สรุปภาพรวม

ระบบอีเมลแจ้งเตือนเมื่อยกเลิกคำขอเบิกอุปกรณ์ **ทำงานอยู่แล้ว** และพร้อมใช้งาน ✅

เมื่อ Admin คลิกปุ่ม **"เลือกอุปกรณ์และอนุมัติ"** แล้วคลิก **"ลบรายการนี้"** ในหน้า `/admin/equipment-reports` ระบบจะส่งอีเมลแจ้งเตือนไปยง:
- ✅ **ผู้ใช้ที่ขอเบิก** (อีเมลของผู้ใช้)
- ✅ **ทีม IT Admin ทุกคน** (ดึงจาก database ผู้ใช้ที่มี role = 'it' หรือ 'super_admin')

---

## ข้อมูลที่แสดงในอีเมล

### 1. รายละเอียดการเบิก
- 📅 **วันที่แจ้ง** - วันที่ผู้ใช้ส่งคำขอเบิก
- 📅 **วันที่ยกเลิก** - วันที่ Admin ลบรายการ
- 📊 **สถานะ** - แสดง "❌ ถูกยกเลิก"
- 👤 **ผู้ยกเลิก** - ชื่อ Admin ที่ทำการลบ

### 2. เหตุผลการยกเลิก
- แสดงเหตุผลการยกเลิก (ปัจจุบันเป็น "ลบรายการสุดท้ายออกจากคำขอ")

### 3. ข้อมูลผู้ใช้งาน (ผู้ขอเบิก)
- **ชื่อ-นามสกุล** (พร้อมชื่อเล่น)
- **แผนก**
- **ออฟฟิศ/สาขา**
- **เบอร์โทร** ⬅️ **เบอร์โทรของผู้แจ้ง/ผู้ขอเบิก**
- **อีเมล** (คลิกได้)

### 4. รายการอุปกรณ์ที่ถูกยกเลิก
สำหรับแต่ละรายการจะแสดง:
- **ชื่ออุปกรณ์** (itemName)
- **หมวดหมู่** (category)
- **จำนวน** (quantity)
- **Serial Number** (สำหรับอุปกรณ์ที่ไม่ใช่ซิมการ์ด) ⬅️ **หมายเลข SN**
- **Phone Number** (สำหรับซิมการ์ด) ⬅️ **หมายเลข Phone Number ของซิมการ์ด**
- **หมายเหตุ** (itemNotes) ⬅️ **หมายเหตุ**
- **รูปภาพ** (ถ้ามี) ⬅️ **รองรับรูปภาพ**

---

## การทำงานของระบบ

### ไฟล์ที่เกี่ยวข้อง

1. **API Route**: `src/app/api/admin/equipment-reports/requests/[id]/items/[itemIndex]/route.ts`
   - ฟังก์ชัน DELETE ที่จัดการการลบรายการ
   - เรียกใช้ `sendEquipmentRequestCancellationNotification()` เมื่อลบรายการสุดท้าย

2. **Email Library**: `src/lib/email.ts`
   - ฟังก์ชัน `sendEquipmentRequestCancellationNotification()` (บรรทัด 1977-2073)
   - Helper functions:
     - `formatEquipmentItemsForEmail()` - จัดรูปแบบรายการอุปกรณ์
     - `buildUserInfoSection()` - สร้างส่วนข้อมูลผู้ใช้
     - `prepareEquipmentImageAttachments()` - เตรียมรูปภาพแนบ

3. **Model**: `src/models/RequestLog.ts`
   - เพิ่มฟิลด์ `image?: string` ใน IRequestItem interface
   - รองรับการเก็บชื่อไฟล์รูปภาพสำหรับแต่ละรายการ

---

## โฟลว์การทำงาน

```
1. Admin คลิก "ลบรายการนี้" ในหน้า /admin/equipment-reports
   ↓
2. API DELETE ถูกเรียก: /api/admin/equipment-reports/requests/[id]/items/[itemIndex]
   ↓
3. ตรวจสอบว่าเป็นรายการสุดท้ายหรือไม่
   ↓
4. ถ้าใช่ → เตรียมข้อมูลอีเมล:
   - เก็บข้อมูลคำขอก่อนลบ
   - เพิ่มข้อมูล cancelledAt, cancelledBy, cancelledByName
   - Populate category names สำหรับรายการอุปกรณ์
   ↓
5. เรียก sendEquipmentRequestCancellationNotification(emailData)
   ↓
6. ส่งอีเมลไปยัง:
   - IT Admin ทุกคน (loop ส่งทีละคน)
   - ผู้ใช้ที่ขอเบิก (ถ้ามีอีเมล)
   ↓
7. ลบคำขอออกจาก database
   ↓
8. ส่ง response กลับไปหน้าเว็บ
```

---

## รองรับรูปภาพ (Image Support)

### การทำงานปัจจุบัน:
- ✅ **Email template รองรับการแสดงรูปภาพแล้ว** (inline image via CID)
- ✅ **Model เพิ่มฟิลด์ `image` แล้ว** (IRequestItem interface)
- ✅ **Email function รองรับ attachments** (prepareEquipmentImageAttachments)

### การเก็บรูปภาพ:
- รูปภาพจะถูกเก็บที่: `public/assets/RequestLog/`
- รูปภาพจะถูกแนบใน email ผ่าน CID (Content-ID): `cid:item${index}_image@equipment`
- ระบบจะค้นหารูปภาพจาก 3 ตำแหน่ง:
  1. `public/assets/ReturnLog/`
  2. `public/assets/RequestLog/`
  3. `public/assets/uploads/`

### ตัวอย่าง HTML ที่แสดงรูปภาพ:
```html
<tr>
  <td style="padding: 5px 0; vertical-align: top;"><strong>รูปภาพ:</strong></td>
  <td style="padding: 5px 0;">
    <img src="cid:item0_image@equipment" 
         alt="รูปภาพอุปกรณ์" 
         style="max-width: 300px; max-height: 300px; border-radius: 8px; border: 1px solid #ddd; margin-top: 5px;" />
  </td>
</tr>
```

---

## การตรวจสอบว่าอีเมลส่งสำเร็จ

### ใน Console/Terminal:
ระบบจะแสดง log เมื่อส่งอีเมล:
```
Email notification error: <ข้อผิดพลาด>  // ถ้าส่งไม่สำเร็จ
```

### ตรวจสอบการตั้งค่าอีเมล:
ตรวจสอบใน `.env`:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=it@vsqclinic.com
NEXTAUTH_URL=http://localhost:3000
```

### ดึงรายชื่อ IT Admins:
ฟังก์ชัน `getITAdminEmails()` จะดึงอีเมลของผู้ใช้ที่:
- `userType === 'it'` หรือ
- `role === 'super_admin'`

ตรวจสอบว่ามี IT Admins ในระบบโดยตรวจสอบ collection `users` ใน MongoDB

---

## ตัวอย่าง Email HTML

### Subject (สำหรับ IT Admin):
```
แจ้งยกเลิกคำขอเบิกอุปกรณ์ VSQ - [รายการอุปกรณ์] จาก [ชื่อผู้ใช้]
```

### Subject (สำหรับผู้ใช้):
```
ยกเลิก คำขอเบิกอุปกรณ์ VSQ - [รายการอุปกรณ์] จาก [ชื่อผู้ใช้]
```

### Body Structure:
```
┌────────────────────────────────────┐
│  ❌ แจ้งยกเลิกคำขอเบิกอุปกรณ์       │
│  (gradient background: red)        │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│  รายละเอียดการเบิก                 │
│  - วันที่แจ้ง                      │
│  - วันที่ยกเลิก                    │
│  - สถานะ: ❌ ถูกยกเลิก             │
│  - ผู้ยกเลิก: [ชื่อ Admin]          │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│  ⚠️ เหตุผลการยกเลิก                │
│  [เหตุผล]                          │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│  👤 ข้อมูลผู้ใช้งาน                │
│  - ชื่อ-นามสกุล                    │
│  - แผนก                            │
│  - ออฟฟิศ/สาขา                     │
│  - เบอร์โทร                        │
│  - อีเมล                           │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│  รายการอุปกรณ์ที่ถูกยกเลิก          │
│                                    │
│  รายการที่ 1: [ชื่ออุปกรณ์]        │
│  - หมวดหมู่: [หมวดหมู่]           │
│  - จำนวน: [จำนวน]                 │
│  - Serial Number: [SN]             │
│  - Phone Number: [เบอร์]           │
│  - หมายเหตุ: [หมายเหตุ]            │
│  - รูปภาพ: [แสดงรูป]               │
│                                    │
│  [รายการที่ 2...]                  │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│  📧 อีเมลนี้ถูกส่งจากระบบ          │
│  Inventory Management Dashboard    │
└────────────────────────────────────┘
```

---

## การทดสอบ

### ขั้นตอนการทดสอบ:

1. **สร้างคำขอเบิกอุปกรณ์**
   - ไปที่หน้า `/equipment-request`
   - กรอกข้อมูลผู้ขอเบิก (ชื่อ, แผนก, เบอร์โทร, ฯลฯ)
   - เลือกอุปกรณ์ (เช่น ais - ซิมการ์ด)
   - เลือก Serial Number หรือ Phone Number
   - กรอกหมายเหตุ (ถ้ามี)
   - ส่งคำขอ

2. **ไปที่หน้า Equipment Reports**
   - Login ด้วย Admin account
   - ไปที่ `/admin/equipment-reports`
   - ค้นหาคำขอที่เพิ่งสร้าง

3. **ลบรายการ**
   - คลิกปุ่ม "เลือกอุปกรณ์และอนุมัติ"
   - คลิกปุ่ม "ลบรายการนี้" (สีแดง)
   - ยืนยันการลบ

4. **ตรวจสอบอีเมล**
   - ตรวจสอบอีเมลของผู้ใช้ที่ขอเบิก
   - ตรวจสอบอีเมลของ IT Admins
   - ตรวจสอบว่าข้อมูลครบถ้วน:
     - ✅ ชื่ออุปกรณ์
     - ✅ หมวดหมู่
     - ✅ Serial Number / Phone Number
     - ✅ หมายเหตุ
     - ✅ ข้อมูลผู้ใช้ (รวมเบอร์โทร)
     - ✅ รูปภาพ (ถ้ามี)

---

## การแก้ไขปัญหา

### ปัญหา: ไม่ได้รับอีเมล

1. **ตรวจสอบการตั้งค่า SMTP**
   - ตรวจสอบ `.env` file
   - ทดสอบการส่งอีเมลด้วย nodemailer test

2. **ตรวจสอบว่ามี IT Admins**
   ```javascript
   // ใน MongoDB shell หรือ Compass
   db.users.find({ 
     $or: [
       { userType: 'it' },
       { role: 'super_admin' }
     ],
     email: { $exists: true, $ne: '' }
   })
   ```

3. **ตรวจสอบ Console Logs**
   - ดู Terminal ที่รัน Next.js server
   - มองหา error messages จาก email notification

4. **ตรวจสอบ Spam Folder**
   - อีเมลอาจถูกจัดเป็น spam

### ปัญหา: ข้อมูลในอีเมลไม่ครบ

1. **ตรวจสอบข้อมูลใน RequestLog**
   ```javascript
   // ใน MongoDB
   db.requestlogs.findOne({ _id: ObjectId('...') })
   ```

2. **ตรวจสอบ category names**
   - ระบบจะ populate category names ก่อนส่งอีเมล
   - ดู function `getCategoryNameById()` ใน `src/lib/item-name-resolver.ts`

### ปัญหา: รูปภาพไม่แสดง

1. **ตรวจสอบว่ารูปภาพมีอยู่**
   - ตรวจสอบ `public/assets/RequestLog/`
   - ตรวจสอบชื่อไฟล์ใน database ตรงกับไฟล์จริง

2. **ตรวจสอบ CID mapping**
   - Email attachment CID: `item${index}_image@equipment`
   - ตรวจสอบ function `prepareEquipmentImageAttachments()`

---

## สรุป

✅ **ระบบอีเมลแจ้งเตือนทำงานสมบูรณ์แล้ว**

เมื่อ Admin ลบรายการในหน้า `/admin/equipment-reports` โดยคลิกปุ่ม "ลบรายการนี้":
- ระบบจะส่งอีเมลไปยัง **ผู้ใช้ที่ขอเบิก**
- ระบบจะส่งอีเมลไปยัง **ทีม IT ทุกคน**
- อีเมลจะแสดงข้อมูลครบถ้วน:
  - ชื่ออุปกรณ์
  - หมวดหมู่
  - Serial Number / Phone Number (สำหรับซิมการ์ด)
  - หมายเหตุ
  - ข้อมูลผู้ใช้ (รวมเบอร์โทรของผู้แจ้ง)
  - รูปภาพ (ถ้ามี)

**ไม่จำเป็นต้องแก้ไขอะไรเพิ่มเติม** - ระบบพร้อมใช้งานแล้ว! 🎉

---

## Update Log

- **2025-01-18**: เพิ่มฟิลด์ `image` ใน RequestLog model สำหรับรองรับรูปภาพในอนาคต
- **Existing**: Email notification system สำหรับการยกเลิกคำขอเบิกทำงานสมบูรณ์

---

## เอกสารอ้างอิง

- [EMAIL_CONFIGURATION_GUIDE.md](./EMAIL_CONFIGURATION_GUIDE.md) - คู่มือการตั้งค่าอีเมล
- [EMAIL_QUICK_START.md](./EMAIL_QUICK_START.md) - เริ่มต้นใช้งานระบบอีเมล
- [IT_EMAIL_GUIDE.md](./IT_EMAIL_GUIDE.md) - คู่มือระบบอีเมล IT

