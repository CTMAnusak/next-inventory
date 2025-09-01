# 🚀 วิธีการแก้ปัญหา User ID

## ปัญหา
- Users ที่มีอยู่แล้วไม่มี `user_id` field
- ตารางแสดง "ไม่มี" เพราะไม่มี `user_id`

## วิธีแก้ไข

### 1. รัน Migration API
เปิด browser หรือใช้ Postman ไปที่:
```
POST http://localhost:3000/api/admin/add-user-id-migration
```

หรือใช้ browser ไปที่:
```
http://localhost:3000/api/admin/add-user-id-migration
```
(จะแสดงข้อมูล API)

### 2. ทดสอบสร้าง User ใหม่
- ไปหน้า Admin → Users → เพิ่มผู้ใช้
- สร้าง user ใหม่
- ควรเห็น user_id ในตาราง

### 3. ตรวจสอบ Console Log
เมื่อสร้าง user ใหม่ ให้ดู console log ใน terminal:
```
Created user with user_id: USER1734567890123
```

## หากยังไม่ได้
1. ลบ users ทั้งหมดใน database
2. สร้าง users ใหม่ผ่านหน้า admin
3. users ใหม่จะมี user_id อัตโนมัติ
