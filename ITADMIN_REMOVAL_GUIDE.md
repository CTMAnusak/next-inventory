# คู่มือการลบ ITAdmin Collection

## ภาพรวมการเปลี่ยนแปลง

ระบบได้ลบ collection `itadmins` ออกแล้ว และใช้ `userRole` ใน `users` collection เท่านั้น

## การเปลี่ยนแปลงที่ทำ

### ✅ **ลบออกแล้ว**
- `src/models/ITAdmin.ts` - Model สำหรับ ITAdmin
- `src/app/api/admin/it-admins/route.ts` - API route สำหรับ ITAdmin
- Collection `itadmins` ในฐานข้อมูล

### ✅ **ใช้แทน**
- `userRole: 'it_admin'` ใน `users` collection
- `/api/admin/users` API สำหรับจัดการ IT Admin
- หน้า **Admin → Users** สำหรับเปลี่ยน role

## วิธีการจัดการ IT Admin

### 1. **เพิ่ม IT Admin ใหม่**
1. ไปที่ **Admin → Users**
2. หาผู้ใช้ที่ต้องการ
3. คลิก **แก้ไข** (Edit)
4. เปลี่ยน **Role** เป็น **"Admin ทีม IT"**
5. คลิก **บันทึก**

### 2. **ลบ IT Admin**
1. ไปที่ **Admin → Users**
2. หา IT Admin ที่ต้องการ
3. คลิก **แก้ไข** (Edit)
4. เปลี่ยน **Role** เป็น **"User"**
5. คลิก **บันทึก**

### 3. **ดูรายชื่อ IT Admin**
- ไปที่ **Admin → Users**
- กรองด้วย **Role: "Admin ทีม IT"**
- หรือไปที่ **Admin → IT Reports** จะแสดงรายชื่อ IT Admin อัตโนมัติ

## การรัน Script ลบ Collection

### ขั้นตอนที่ 1: สำรองข้อมูล
```bash
# สำรองฐานข้อมูลก่อน
mongodump --uri="your-mongodb-uri" --out=./backup-before-removal
```

### ขั้นตอนที่ 2: รัน Script ลบ Collection
```bash
# ตั้งค่า MongoDB URI (ถ้าจำเป็น)
export MONGODB_URI="your-mongodb-connection-string"

# รัน script ลบ collection
node remove-itadmin-collection.js
```

### ขั้นตอนที่ 3: ตรวจสอบผลลัพธ์
Script จะ:
- สำรองข้อมูล `itadmins` (ถ้ามี)
- ลบ collection `itadmins`
- แสดงรายการ collections ที่เหลือ

## โครงสร้างใหม่

### การดึงข้อมูล IT Admin
```javascript
// เก่า - ใช้ collection แยก
const itAdmins = await ITAdmin.find({});

// ใหม่ - ใช้ users collection
const itAdmins = await User.find({ 
  userRole: 'it_admin',
  isApproved: true 
});
```

### การแสดงชื่อ IT Admin
```javascript
// เก่า - ใช้ name field
const name = admin.name;

// ใหม่ - สร้างชื่อจาก user data
const name = user.userType === 'individual' 
  ? `${user.firstName} ${user.lastName}`.trim()
  : user.office;
```

## การทดสอบระบบ

### 1. **ทดสอบการเข้าสู่ระบบ**
- เข้าสู่ระบบด้วยบัญชี IT Admin
- ตรวจสอบว่าเข้าถึงหน้า Admin ได้

### 2. **ทดสอบการมอบหมายงาน**
- ไปที่ **Admin → IT Reports**
- ทดสอบการมอบหมายงานให้ IT Admin
- ตรวจสอบว่ารายชื่อ IT Admin แสดงถูกต้อง

### 3. **ทดสอบการจัดการผู้ใช้**
- ไปที่ **Admin → Users**
- เปลี่ยน role เป็น IT Admin
- เปลี่ยน role กลับเป็น User

## การแก้ไขปัญหา

### ปัญหา: ไม่พบ IT Admin ในระบบ

**สาเหตุ**: ไม่มี User ที่มี `userRole: 'it_admin'`

**วิธีแก้**:
```javascript
// ตรวจสอบใน MongoDB
db.users.find({ userRole: 'it_admin' })

// เพิ่ม IT Admin ใหม่
db.users.updateOne(
  { email: 'admin@example.com' },
  { $set: { userRole: 'it_admin' } }
)
```

### ปัญหา: IT Admin ไม่สามารถเข้าถึงฟีเจอร์ได้

**สาเหตุ**: Permission ไม่ถูกต้อง

**วิธีแก้**:
```javascript
// ตรวจสอบ User role และ permissions
db.users.findOne({ email: 'admin@example.com' })

// อัปเดต permissions
db.users.updateOne(
  { email: 'admin@example.com' },
  { 
    $set: { 
      userRole: 'it_admin',
      isApproved: true 
    }
  }
)
```

### ปัญหา: ข้อมูลไม่แสดงถูกต้อง

**สาเหตุ**: Frontend ยังใช้ API เก่า

**วิธีแก้**:
- ตรวจสอบว่า frontend ใช้ `/api/admin/users` แทน `/api/admin/it-admins`
- ตรวจสอบการกรอง `userRole: 'it_admin'`

## ข้อดีของการเปลี่ยนแปลง

### ✅ **ลดความซับซ้อน**
- ไม่มี collection แยก
- ใช้ระบบ role เดียวกัน

### ✅ **การจัดการง่ายขึ้น**
- จัดการผ่านหน้า Users เดียว
- ไม่ต้องซิงค์ข้อมูล 2 ที่

### ✅ **ประสิทธิภาพดีขึ้น**
- Query ครั้งเดียวได้ข้อมูลครบ
- ไม่ต้อง join หลาย collection

### ✅ **ความยืดหยุ่น**
- เพิ่ม role ใหม่ได้ง่าย
- เปลี่ยน role ได้ทันที

## การสำรองข้อมูล

ข้อมูลสำรองจะถูกสร้างอัตโนมัติใน:
- `./backup_migration/backup_itadmins_before_delete_[timestamp].json`

**คำแนะนำ**: เก็บไฟล์สำรองไว้อย่างน้อย 30 วัน

## สรุป

ระบบได้ลบ collection `itadmins` ออกแล้ว และใช้ `userRole` ใน `users` collection เท่านั้น ซึ่งทำให้:

- **เรียบง่าย**: ไม่มีข้อมูลซ้ำซ้อน
- **มีประสิทธิภาพ**: Query เร็วขึ้น
- **ยืดหยุ่น**: จัดการ role ได้ง่าย
- **สอดคล้อง**: ใช้ระบบเดียวทั้งระบบ

🎉 **ระบบพร้อมใช้งาน!** 🎉
