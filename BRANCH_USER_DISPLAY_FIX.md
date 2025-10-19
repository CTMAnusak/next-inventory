# การแก้ไขปัญหาการแสดงข้อมูลผู้ใช้ประเภทสาขา

## ปัญหาที่พบ

เมื่อผู้ใช้ประเภทสาขา (Branch User) กรอกฟอร์มการเบิก/คืนอุปกรณ์ ข้อมูลทั้งหมดถูกบันทึกลง database อย่างถูกต้อง แต่เมื่อแอดมินเปิดดูหน้ารายงาน:
- `/admin/pending-summary`
- `/admin/equipment-reports`

พบว่าคอลัมน์ข้อมูลผู้ใช้แสดงเป็น "Unknown User" หรือ "-" แทนที่จะแสดงชื่อจริง

## สาเหตุ

ปัญหาอยู่ที่ฟังก์ชัน `populateRequestLogUser` และ `populateReturnLogUser` ในไฟล์ `src/lib/equipment-populate-helpers.ts`

**โค้ดเดิม (บรรทัด 231-236):**
```typescript
// Branch User: Populate เฉพาะข้อมูลสาขา (ข้อมูลส่วนตัวใช้จากฟอร์ม)
else if (user.userType === 'branch') {
  populated.office = user.office;
  populated.phone = user.phone;
  populated.email = user.email;
  // firstName, lastName, etc. → ใช้จาก requesterFirstName, requesterLastName (snapshot ในฟอร์ม)
}
```

**ปัญหา:** มีคอมเมนต์บอกว่าจะใช้ข้อมูลจาก `requesterFirstName`, `requesterLastName` ฯลฯ แต่ไม่มีโค้ดทำจริง!

## การแก้ไข

เพิ่มโค้ดเพื่อ populate ข้อมูลส่วนตัวจาก snapshot ที่เก็บไว้ในแต่ละการเบิก/คืน:

### 1. แก้ไข `populateRequestLogUser` (บรรทัด 231-240)
```typescript
// Branch User: Populate เฉพาะข้อมูลสาขา (ข้อมูลส่วนตัวใช้จากฟอร์ม)
else if (user.userType === 'branch') {
  populated.office = user.office;
  populated.phone = user.phone;
  populated.email = user.email;
  // firstName, lastName, etc. → ใช้จาก requesterFirstName, requesterLastName (snapshot ในฟอร์ม)
  populated.firstName = populated.requesterFirstName || '-';
  populated.lastName = populated.requesterLastName || '-';
  populated.nickname = populated.requesterNickname || '-';
  populated.department = populated.requesterDepartment || '-';
}
```

### 2. แก้ไข `populateReturnLogUser` (บรรทัด 324-333)
```typescript
// Branch User: Populate เฉพาะข้อมูลสาขา (ข้อมูลส่วนตัวใช้จากฟอร์ม)
else if (user.userType === 'branch') {
  populated.office = user.office;
  populated.phone = user.phone;
  populated.email = user.email;
  // firstName, lastName, etc. → ใช้จาก returnerFirstName, returnerLastName (snapshot ในฟอร์ม)
  populated.firstName = populated.returnerFirstName || '-';
  populated.lastName = populated.returnerLastName || '-';
  populated.nickname = populated.returnerNickname || '-';
  populated.department = populated.returnerDepartment || '-';
}
```

## การทำงานของระบบ Branch User

### ข้อมูลที่บันทึกในแต่ละการเบิก/คืน

**RequestLog (การเบิก):**
- `userId`: ID ของ user (สำหรับ real-time lookup)
- `requesterFirstName`: ชื่อที่กรอกในฟอร์ม
- `requesterLastName`: นามสกุลที่กรอกในฟอร์ม
- `requesterNickname`: ชื่อเล่นที่กรอกในฟอร์ม
- `requesterDepartment`: แผนกที่กรอกในฟอร์ม
- `requesterPhone`: เบอร์โทรที่กรอกในฟอร์ม
- `requesterOffice`: สาขา (จาก User profile)

**ReturnLog (การคืน):**
- `userId`: ID ของ user (สำหรับ real-time lookup)
- `returnerFirstName`: ชื่อที่กรอกในฟอร์ม
- `returnerLastName`: นามสกุลที่กรอกในฟอร์ม
- `returnerNickname`: ชื่อเล่นที่กรอกในฟอร์ม
- `returnerDepartment`: แผนกที่กรอกในฟอร์ม
- `returnerPhone`: เบอร์โทรที่กรอกในฟอร์ม
- `returnerOffice`: สาขา (จาก User profile)

### เหตุผลที่ต้องเก็บ Snapshot

สำหรับผู้ใช้ประเภทสาขา ข้อมูลส่วนตัว (ชื่อ, นามสกุล, แผนก) อาจเปลี่ยนแปลงในแต่ละครั้งที่เบิก/คืน เพราะอาจเป็นคนละคน ดังนั้นต้องเก็บข้อมูลแยกในแต่ละ transaction

**ตัวอย่าง:**
- วันที่ 1/1/2568: สาขา CTW มีพนักงานชื่อ "สมชาย ใจดี" เบิกอุปกรณ์
- วันที่ 15/1/2568: สาขา CTW มีพนักงานชื่อ "สมหญิง รักงาน" เบิกอุปกรณ์
- ทั้งสองคนใช้บัญชีเดียวกัน (user_id: "U004") แต่เป็นคนละคน

## การทดสอบ

1. ล็อกอินด้วยบัญชีผู้ใช้ประเภทสาขา (เช่น U004)
2. กรอกฟอร์มการเบิกอุปกรณ์ โดยกรอกข้อมูลส่วนตัว:
   - ชื่อ: aaaa
   - นามสกุล: bbbb
   - ชื่อเล่น: cccc
   - แผนก: Marketing
   - เบอร์โทร: 0845641646
3. กดส่งฟอร์ม
4. ล็อกอินด้วยบัญชีแอดมิน
5. เปิดหน้า `/admin/pending-summary` หรือ `/admin/equipment-reports`
6. **ผลลัพธ์ที่คาดหวัง:** ควรเห็นชื่อ "aaaa bbbb" และข้อมูลอื่นๆ แสดงในตาราง (ไม่ใช่ "Unknown User")

## หมายเหตุเรื่องซิมการ์ด

ปัจจุบันระบบจัดการเบอร์โทรของซิมการ์ดดังนี้:

### ในประวัติเบิก (RequestLog):
- **ก่อนอนุมัติ:** เบอร์โทรที่ผู้ใช้ขอเบิกเก็บใน `serialNumbers` array (แม้จะเป็นเบอร์โทรไม่ใช่ serial number)
- **หลังอนุมัติ:** เบอร์โทรที่แอดมิน assign เก็บใน `assignedPhoneNumbers` array ✅

### ในประวัติคืน (ReturnLog):
- เบอร์โทรเก็บใน `numberPhone` field (ถูกต้อง) ✅

### ข้อเสนอแนะ:
ควรแก้ไข RequestLog ให้มีฟิลด์แยกสำหรับเบอร์โทรตั้งแต่ขั้นตอนการขอเบิก เช่น `requestedPhoneNumbers` เพื่อความชัดเจน แต่การเปลี่ยนแปลงนี้จะต้องแก้ไข:
- Schema ของ RequestLog model
- API การเบิกอุปกรณ์
- UI ฟอร์มการเบิก
- Logic การอนุมัติ

**ข้อสรุป:** ปัจจุบันระบบทำงานถูกต้อง แต่ชื่อฟิลด์อาจทำให้สับสน

## ไฟล์ที่เกี่ยวข้อง

- `src/lib/equipment-populate-helpers.ts` - ฟังก์ชัน populate ข้อมูลผู้ใช้
- `src/models/RequestLog.ts` - Schema การเบิกอุปกรณ์
- `src/models/ReturnLog.ts` - Schema การคืนอุปกรณ์
- `src/app/api/equipment-request/route.ts` - API รับฟอร์มการเบิก
- `src/app/api/equipment-return/route.ts` - API รับฟอร์มการคืน
- `src/app/api/admin/equipment-reports/requests/route.ts` - API ดึงข้อมูลรายงานการเบิก
- `src/app/api/admin/equipment-reports/returns/route.ts` - API ดึงข้อมูลรายงานการคืน

