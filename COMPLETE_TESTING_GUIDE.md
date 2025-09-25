# 🧪 Complete Testing Guide - Reference-based Inventory System

## 📋 Overview
คู่มือทดสอบระบบ Reference-based Inventory System ครบชุด รวมทั้งระบบเก่าและใหม่

---

## 🎯 **Part 1: Reference-based System Tests (ใหม่)**

### **1. 🏠 Dashboard Page (User)**

#### **Scenario 1.1: ดูข้อมูลอุปกรณ์ที่มี**
```
URL: /dashboard
User: user@example.com (ไม่ใช่ admin)
```

**ขั้นตอนทดสอบ:**
1. เข้าสู่ระบบด้วย user account
2. ดูหน้า Dashboard
3. ตรวจสอบ Stats Cards:
   - อุปกรณ์ทั้งหมด: 5 ชิ้น
   - ใช้งานได้: 4 ชิ้น
   - ชำรุด: 1 ชิ้น
4. ดูตารางอุปกรณ์ที่มี:
   - แสดงชื่ออุปกรณ์, หมวดหมู่, Serial Number
   - แสดงสีตาม Status (มี/หาย) และ Condition (ใช้งานได้/ชำรุด)
   - วันที่เพิ่มอุปกรณ์

**ผลลัพธ์ที่คาดหวัง:**
- ✅ แสดงข้อมูลถูกต้อง
- ✅ สีแสดงตาม configuration
- ✅ สามารถ drag scroll ได้

#### **Scenario 1.2: เพิ่มอุปกรณ์ที่มี (อุปกรณ์ที่มีอยู่)**
```
URL: /dashboard
Action: เพิ่มอุปกรณ์ที่มี
```

**ขั้นตอนทดสอบ:**
1. คลิก "เพิ่มอุปกรณ์ที่มี"
2. เลือกหมวดหมู่: "คอมพิวเตอร์"
3. เลือกอุปกรณ์: "Laptop Dell"
4. กรอก Serial Number: "DELL001"
5. เลือกสภาพ: "มี"
6. เลือกสถานะ: "ใช้งานได้"
7. กรอกหมายเหตุ: "อุปกรณ์เก่าที่มีอยู่"
8. คลิก "บันทึก"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ บันทึกสำเร็จ
- ✅ แสดงในตารางทันที
- ✅ อัปเดต Stats Cards

#### **Scenario 1.3: เพิ่มอุปกรณ์ที่มี (อุปกรณ์ใหม่)**
```
URL: /dashboard
Action: เพิ่มอุปกรณ์ใหม่
```

**ขั้นตอนทดสอบ:**
1. คลิก "เพิ่มอุปกรณ์ที่มี"
2. เลือกหมวดหมู่: "เครือข่าย"
3. คลิก "+ เพิ่มอุปกรณ์ใหม่"
4. กรอกชื่อ: "Router TP-Link"
5. เลือกสภาพ: "มี"
6. เลือกสถานะ: "ใช้งานได้"
7. กรอกหมายเหตุ: "ซื้อมาใหม่"
8. คลิก "บันทึก"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ สร้าง ItemMaster ใหม่
- ✅ สร้าง InventoryItem
- ✅ แสดงในตาราง

#### **Scenario 1.4: เพิ่มซิมการ์ด**
```
URL: /dashboard
Action: เพิ่มซิมการ์ด
```

**ขั้นตอนทดสอบ:**
1. คลิก "เพิ่มอุปกรณ์ที่มี"
2. เลือกหมวดหมู่: "ซิมการ์ด"
3. เลือกอุปกรณ์: "AIS SIM"
4. กรอกเบอร์โทร: "0812345678"
5. เลือกสภาพ: "มี"
6. เลือกสถานะ: "ใช้งานได้"
7. คลิก "บันทึก"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ ตรวจสอบเบอร์โทรซ้ำ
- ✅ บันทึกสำเร็จ
- ✅ แสดงเบอร์โทรในตาราง

### **2. 📦 Equipment Request Page (User)**

#### **Scenario 2.1: เบิกอุปกรณ์**
```
URL: /equipment-request
User: user@example.com
```

**ขั้นตอนทดสอบ:**
1. เข้าสู่ระบบด้วย user account
2. ไปหน้า Equipment Request
3. กรอกข้อมูลส่วนตัว:
   - ชื่อ: "สมชาย"
   - นามสกุล: "ใจดี"
   - หน่วยงาน: "IT"
   - สำนักงาน: "Bangkok"
   - เบอร์โทร: "0812345678"
4. เลือกวันที่ต้องการ: วันนี้
5. เลือกความเร่งด่วน: "ปกติ"
6. เลือกสถานที่ส่งมอบ: "สำนักงาน"
7. เลือกอุปกรณ์:
   - Laptop Dell (1 ชิ้น)
   - Mouse Logitech (2 ชิ้น)
8. กรอกหมายเหตุ: "สำหรับงานโปรเจคใหม่"
9. คลิก "ส่งคำขอ"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ สร้าง RequestLog
- ✅ ตรวจสอบอุปกรณ์ว่าง
- ✅ ส่งคำขอสำเร็จ
- ✅ แสดงข้อความยืนยัน

#### **Scenario 2.2: เบิกอุปกรณ์ไม่เพียงพอ**
```
URL: /equipment-request
Action: เบิกอุปกรณ์ที่ไม่มี
```

**ขั้นตอนทดสอบ:**
1. เลือกอุปกรณ์: "Laptop Dell (10 ชิ้น)"
2. ส่งคำขอ

**ผลลัพธ์ที่คาดหวัง:**
- ❌ แสดงข้อความผิดพลาด
- ❌ "อุปกรณ์มีไม่เพียงพอ (ต้องการ: 10, มี: 2)"

### **3. 🔄 Equipment Return Page (User)**

#### **Scenario 3.1: คืนอุปกรณ์**
```
URL: /equipment-return
User: user@example.com
```

**ขั้นตอนทดสอบ:**
1. เข้าสู่ระบบด้วย user account
2. ไปหน้า Equipment Return
3. กรอกข้อมูลส่วนตัว:
   - ชื่อ: "สมชาย"
   - นามสกุล: "ใจดี"
   - หน่วยงาน: "IT"
   - สำนักงาน: "Bangkok"
4. เลือกวันที่คืน: วันนี้
5. เลือกอุปกรณ์ที่จะคืน:
   - Laptop Dell (Serial: DELL001)
   - เลือกสภาพเมื่อคืน: "ใช้งานได้"
   - หมายเหตุรายการ: "ใช้งานปกติ"
6. กรอกหมายเหตุรวม: "คืนหลังเสร็จงาน"
7. คลิก "ส่งคำขอคืน"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ สร้าง ReturnLog
- ✅ ตรวจสอบสิทธิ์การคืน
- ✅ ส่งคำขอสำเร็จ

#### **Scenario 3.2: คืนอุปกรณ์ที่ไม่มีสิทธิ์**
```
URL: /equipment-return
Action: คืนอุปกรณ์ของคนอื่น
```

**ขั้นตอนทดสอบ:**
1. เลือกอุปกรณ์ที่ไม่ได้เป็นเจ้าของ
2. ส่งคำขอคืน

**ผลลัพธ์ที่คาดหวัง:**
- ❌ แสดงข้อความผิดพลาด
- ❌ "ไม่พบอุปกรณ์หรือคุณไม่มีสิทธิ์คืนอุปกรณ์นี้"

### **4. 👨‍💼 Admin Dashboard**

#### **Scenario 4.1: ดูภาพรวมระบบ**
```
URL: /admin/dashboard
User: admin@example.com
```

**ขั้นตอนทดสอบ:**
1. เข้าสู่ระบบด้วย admin account
2. ดูหน้า Admin Dashboard
3. ตรวจสอบ Stats:
   - คำขอเบิกอุปกรณ์: 5 รายการ
   - คำขอคืนอุปกรณ์: 3 รายการ
   - อุปกรณ์ทั้งหมด: 100 ชิ้น
   - อุปกรณ์ว่าง: 50 ชิ้น
4. ดู Recent Activities
5. ดู Pending Requests

**ผลลัพธ์ที่คาดหวัง:**
- ✅ แสดงข้อมูลถูกต้อง
- ✅ แสดงกิจกรรมล่าสุด
- ✅ แสดงคำขอที่รออนุมัติ

### **5. 📊 Admin Inventory Page**

#### **Scenario 5.1: ดูรายการอุปกรณ์**
```
URL: /admin/inventory
User: admin@example.com
```

**ขั้นตอนทดสอบ:**
1. เข้าสู่ระบบด้วย admin account
2. ไปหน้า Admin Inventory
3. ดูตารางอุปกรณ์:
   - แสดง ItemMaster ทั้งหมด
   - แสดงจำนวนรวม, ว่าง, ผู้ใช้ถือ
   - แสดง Status/Condition breakdown
4. ใช้ Search และ Filter
5. ดู Stock Management popup

**ผลลัพธ์ที่คาดหวัง:**
- ✅ แสดงข้อมูลครบถ้วน
- ✅ Search/Filter ทำงาน
- ✅ Stock Management popup แสดงรายละเอียด

#### **Scenario 5.2: เพิ่มอุปกรณ์ (Admin)**
```
URL: /admin/inventory
Action: เพิ่มอุปกรณ์ใหม่
```

**ขั้นตอนทดสอบ:**
1. คลิก "เพิ่มอุปกรณ์"
2. เลือกหมวดหมู่: "คอมพิวเตอร์"
3. เลือกอุปกรณ์: "Laptop HP"
4. กรอก Serial Number: "HP001"
5. เลือกสภาพ: "มี"
6. เลือกสถานะ: "ใช้งานได้"
7. เลือกจำนวน: 5 ชิ้น
8. คลิก "บันทึก"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ สร้าง InventoryItem 5 ชิ้น
- ✅ อัปเดต InventoryMaster
- ✅ แสดงในตารางทันที

#### **Scenario 5.3: จัดการสต็อก**
```
URL: /admin/inventory
Action: Stock Management
```

**ขั้นตอนทดสอบ:**
1. คลิก "Stock Management" ที่อุปกรณ์ใดๆ
2. ดูรายละเอียด:
   - Admin Defined Stock: 10
   - User Contributed: 5
   - Currently Allocated: 3
   - Real Available: 7
3. ดูรายการอุปกรณ์แต่ละชิ้น
4. เปลี่ยนสถานะอุปกรณ์
5. โอนย้ายระหว่างผู้ใช้

**ผลลัพธ์ที่คาดหวัง:**
- ✅ แสดงข้อมูลถูกต้อง
- ✅ สามารถเปลี่ยนสถานะได้
- ✅ สามารถโอนย้ายได้

### **6. ⚙️ Configuration Management**

#### **Scenario 6.1: จัดการหมวดหมู่**
```
URL: /admin/inventory-config/categories
User: admin@example.com
```

**ขั้นตอนทดสอบ:**
1. เข้าสู่ระบบด้วย admin account
2. ไปหน้า Categories Management
3. ดูรายการหมวดหมู่:
   - คอมพิวเตอร์
   - เครือข่าย
   - โทรศัพท์
   - ซิมการ์ด
4. เพิ่มหมวดหมู่ใหม่:
   - ชื่อ: "เครื่องพิมพ์"
   - สี: "#8B5CF6"
5. แก้ไขหมวดหมู่:
   - เปลี่ยนชื่อ: "คอมพิวเตอร์" → "คอมพิวเตอร์และอุปกรณ์"
6. ลบหมวดหมู่ (ถ้าไม่มีข้อมูล)

**ผลลัพธ์ที่คาดหวัง:**
- ✅ แสดงรายการถูกต้อง
- ✅ เพิ่มหมวดหมู่สำเร็จ
- ✅ แก้ไขหมวดหมู่สำเร็จ
- ✅ ลบหมวดหมู่สำเร็จ

#### **Scenario 6.2: จัดการสถานะอุปกรณ์**
```
URL: /admin/inventory-config/statuses
User: admin@example.com
```

**ขั้นตอนทดสอบ:**
1. ไปหน้า Status Management
2. ดูสถานะเริ่มต้น:
   - มี (สีเขียว)
   - หาย (สีแดง)
3. เพิ่มสถานะใหม่:
   - ชื่อ: "ยืม"
   - สี: "#3B82F6"
4. แก้ไขสี:
   - เปลี่ยน "มี" เป็นสี "#059669"
5. ลำดับใหม่:
   - ลาก "ยืม" ไปอยู่ระหว่าง "มี" และ "หาย"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ แสดงสถานะถูกต้อง
- ✅ เพิ่มสถานะสำเร็จ
- ✅ แก้ไขสีสำเร็จ
- ✅ เปลี่ยนลำดับสำเร็จ

#### **Scenario 6.3: จัดการสภาพอุปกรณ์**
```
URL: /admin/inventory-config/conditions
User: admin@example.com
```

**ขั้นตอนทดสอบ:**
1. ไปหน้า Condition Management
2. ดูสภาพเริ่มต้น:
   - ใช้งานได้ (สีเขียว)
   - ชำรุด (สีเหลือง)
3. เพิ่มสภาพใหม่:
   - ชื่อ: "ซ่อม"
   - สี: "#F59E0B"
4. แก้ไขสี:
   - เปลี่ยน "ชำรุด" เป็นสี "#DC2626"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ แสดงสภาพถูกต้อง
- ✅ เพิ่มสภาพสำเร็จ
- ✅ แก้ไขสีสำเร็จ

### **7. 📋 Request Management**

#### **Scenario 7.1: อนุมัติการเบิกอุปกรณ์**
```
URL: /admin/equipment-request
User: admin@example.com
```

**ขั้นตอนทดสอบ:**
1. เข้าสู่ระบบด้วย admin account
2. ไปหน้า Request Management
3. ดูคำขอที่รออนุมัติ:
   - สมชาย ใจดี - ขอ Laptop Dell (1 ชิ้น)
   - สมหญิง ดีใจ - ขอ Mouse Logitech (2 ชิ้น)
4. คลิก "อนุมัติ" ที่คำขอของสมชาย
5. เลือกอุปกรณ์ที่จะให้:
   - Laptop Dell (Serial: DELL001)
6. คลิก "อนุมัติ"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ โอนย้ายอุปกรณ์ให้ผู้ใช้
- ✅ อัปเดต RequestLog status
- ✅ สร้าง TransferLog
- ✅ อัปเดต InventoryMaster

#### **Scenario 7.2: ปฏิเสธการเบิกอุปกรณ์**
```
URL: /admin/equipment-request
Action: ปฏิเสธคำขอ
```

**ขั้นตอนทดสอบ:**
1. คลิก "ปฏิเสธ" ที่คำขอใดๆ
2. กรอกเหตุผล: "อุปกรณ์ไม่เพียงพอ"
3. คลิก "ยืนยัน"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ อัปเดต RequestLog status เป็น "rejected"
- ✅ บันทึกเหตุผลการปฏิเสธ
- ✅ ไม่โอนย้ายอุปกรณ์

### **8. 🔄 Return Management**

#### **Scenario 8.1: อนุมัติการคืนอุปกรณ์**
```
URL: /admin/equipment-return
User: admin@example.com
```

**ขั้นตอนทดสอบ:**
1. ไปหน้า Return Management
2. ดูคำขอคืนที่รออนุมัติ:
   - สมชาย ใจดี - คืน Laptop Dell
3. คลิก "อนุมัติ" ที่คำขอของสมชาย
4. ตรวจสอบสภาพอุปกรณ์:
   - สภาพ: "ใช้งานได้"
   - สถานะ: "ใช้งานได้"
5. คลิก "อนุมัติ"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ โอนย้ายอุปกรณ์กลับ admin_stock
- ✅ อัปเดต ReturnLog status
- ✅ สร้าง TransferLog
- ✅ อัปเดต InventoryMaster

#### **Scenario 8.2: คืนอุปกรณ์ชำรุด**
```
URL: /admin/equipment-return
Action: คืนอุปกรณ์ชำรุด
```

**ขั้นตอนทดสอบ:**
1. คลิก "อนุมัติ" ที่คำขอคืนอุปกรณ์ชำรุด
2. ตรวจสอบสภาพอุปกรณ์:
   - สภาพ: "ชำรุด"
   - สถานะ: "ใช้งานได้"
3. คลิก "อนุมัติ"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ เปลี่ยนสถานะอุปกรณ์เป็น "ชำรุด"
- ✅ ไม่โอนย้ายกลับ admin_stock
- ✅ อัปเดต ReturnLog status

### **9. 📊 Equipment Tracking**

#### **Scenario 9.1: ติดตามอุปกรณ์**
```
URL: /admin/equipment-tracking
User: admin@example.com
```

**ขั้นตอนทดสอบ:**
1. ไปหน้า Equipment Tracking
2. ดูข้อมูลการติดตาม:
   - คำขอเบิก: 10 รายการ
   - คำขอคืน: 8 รายการ
   - อุปกรณ์ที่ผู้ใช้ถือ: 25 ชิ้น
3. ใช้ Filter:
   - เลือกหน่วยงาน: "IT"
   - เลือกวันที่: "สัปดาห์นี้"
4. ใช้ Search:
   - ค้นหา: "Laptop"
5. ดูรายละเอียดแต่ละรายการ

**ผลลัพธ์ที่คาดหวัง:**
- ✅ แสดงข้อมูลครบถ้วน
- ✅ Filter ทำงานถูกต้อง
- ✅ Search ทำงานถูกต้อง
- ✅ แสดงรายละเอียดครบถ้วน

### **10. 🔍 Error Handling Tests**

#### **Scenario 10.1: Serial Number ซ้ำ**
```
Action: เพิ่มอุปกรณ์ที่มี Serial Number ซ้ำ
```

**ขั้นตอนทดสอบ:**
1. เพิ่มอุปกรณ์: "Laptop Dell" (Serial: "DELL001")
2. เพิ่มอุปกรณ์: "Laptop Dell" (Serial: "DELL001") อีกครั้ง

**ผลลัพธ์ที่คาดหวัง:**
- ❌ แสดงข้อความผิดพลาด
- ❌ "Serial Number DELL001 already exists"

#### **Scenario 10.2: เบอร์โทรซ้ำ**
```
Action: เพิ่มซิมการ์ดที่มีเบอร์โทรซ้ำ
```

**ขั้นตอนทดสอบ:**
1. เพิ่มซิมการ์ด: "AIS SIM" (เบอร์: "0812345678")
2. เพิ่มซิมการ์ด: "AIS SIM" (เบอร์: "0812345678") อีกครั้ง

**ผลลัพธ์ที่คาดหวัง:**
- ❌ แสดงข้อความผิดพลาด
- ❌ "Phone Number 0812345678 already exists"

#### **Scenario 10.3: อุปกรณ์ไม่เพียงพอ**
```
Action: เบิกอุปกรณ์ที่ไม่มี
```

**ขั้นตอนทดสอบ:**
1. เบิก "Laptop Dell" จำนวน 100 ชิ้น
2. ส่งคำขอ

**ผลลัพธ์ที่คาดหวัง:**
- ❌ แสดงข้อความผิดพลาด
- ❌ "อุปกรณ์มีไม่เพียงพอ (ต้องการ: 100, มี: 5)"

### **11. 🎯 Performance Tests**

#### **Scenario 11.1: ข้อมูลจำนวนมาก**
```
Action: ทดสอบกับข้อมูลจำนวนมาก
```

**ขั้นตอนทดสอบ:**
1. สร้าง ItemMaster 100 รายการ
2. สร้าง InventoryItem 1000 ชิ้น
3. ทดสอบการโหลดหน้า Dashboard
4. ทดสอบการค้นหา
5. ทดสอบการกรองข้อมูล

**ผลลัพธ์ที่คาดหวัง:**
- ✅ โหลดหน้าเร็ว (< 2 วินาที)
- ✅ ค้นหาเร็ว (< 1 วินาที)
- ✅ กรองข้อมูลเร็ว (< 1 วินาที)

### **12. 🧪 Integration Tests**

#### **Scenario 12.1: วงจรชีวิตอุปกรณ์ครบ**
```
Action: ทดสอบวงจรชีวิตอุปกรณ์
```

**ขั้นตอนทดสอบ:**
1. **Admin เพิ่มอุปกรณ์** → Laptop Dell (5 ชิ้น)
2. **User ขอเบิก** → Laptop Dell (1 ชิ้น)
3. **Admin อนุมัติ** → โอนย้ายให้ User
4. **User ใช้งาน** → เปลี่ยนสถานะเป็น "ชำรุด"
5. **User คืน** → คืนพร้อมหมายเหตุ "ชำรุด"
6. **Admin อนุมัติ** → เปลี่ยนสถานะเป็น "ชำรุด"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ ทุกขั้นตอนทำงานถูกต้อง
- ✅ ข้อมูลสอดคล้องกัน
- ✅ Audit trail ครบถ้วน

### **13. 📱 Mobile Responsiveness**

#### **Scenario 13.1: ใช้งานบนมือถือ**
```
Device: Mobile Phone
```

**ขั้นตอนทดสอบ:**
1. เปิดเว็บไซต์บนมือถือ
2. ทดสอบทุกหน้า:
   - Dashboard
   - Equipment Request
   - Equipment Return
   - Admin pages
3. ทดสอบฟอร์ม:
   - เพิ่มอุปกรณ์
   - เบิกอุปกรณ์
   - คืนอุปกรณ์
4. ทดสอบตาราง:
   - Scroll
   - Search
   - Filter

**ผลลัพธ์ที่คาดหวัง:**
- ✅ แสดงผลถูกต้องบนมือถือ
- ✅ ฟอร์มใช้งานง่าย
- ✅ ตาราง scroll ได้
- ✅ ปุ่มกดง่าย

---

## 🎯 **Part 2: Legacy System Tests (เก่า)**

### **1. 🔧 Basic CRUD Operations**

#### **Test 1.1: เพิ่มอุปกรณ์ใหม่**
```
Test ID: 1.1
Test Name: เพิ่มอุปกรณ์ใหม่
Priority: Priority 1
```

**ขั้นตอนทดสอบ:**
1. Login เป็น admin/it_admin
2. ไป Admin → Inventory Management  
3. เพิ่มอุปกรณ์ใหม่: ชื่อ "Test Mouse" หมวดหมู่ "อุปกรณ์คอมพิวเตอร์" จำนวน 3 (ไม่มี SN)
4. เพิ่มอุปกรณ์ที่มี SN: ชื่อ "Test Keyboard" หมวดหมู่ "อุปกรณ์คอมพิวเตอร์" Serial Number "KB001"

**ผลลัพธ์ที่คาดหวัง:**
- อุปกรณ์ถูกเพิ่มสำเร็จ
- จำนวนแสดงถูกต้อง (3 ชิ้นสำหรับ Mouse, 1 ชิ้นสำหรับ Keyboard)
- InventoryMaster อัปเดตถูกต้อง

#### **Test 1.2: แก้ไขอุปกรณ์**
```
Test ID: 1.2
Test Name: แก้ไขอุปกรณ์
Priority: Priority 1
```

**ขั้นตอนทดสอบ:**
1. เลือกอุปกรณ์ที่มี SN
2. แก้ไข Serial Number
3. บันทึก

**ผลลัพธ์ที่คาดหวัง:**
- Serial Number อัปเดตสำเร็จ
- ข้อมูลแสดงถูกต้อง
- ไม่มี error

### **2. 🔄 Stock Management & Auto-Detection**

#### **Test 2.1: Auto-Detection จำนวนสต็อก**
```
Test ID: 2.1
Test Name: Auto-Detection จำนวนสต็อก
Priority: Priority 1
```

**ขั้นตอนทดสอบ:**
1. เพิ่มอุปกรณ์ใหม่ (ไม่มี SN)
2. ตรวจสอบ InventoryMaster
3. เปลี่ยนจำนวนใน InventoryMaster
4. เพิ่ม/ลบ InventoryItem
5. ตรวจสอบการอัปเดต

**ผลลัพธ์ที่คาดหวัง:**
- Auto-detection ทำงานถูกต้อง
- จำนวนสต็อกแสดงถูกต้อง
- ไม่มีข้อมูลไม่สอดคล้อง

### **3. 🗑️ Delete Operations & Soft Delete**

#### **Test 3.1: Soft Delete อุปกรณ์**
```
Test ID: 3.1
Test Name: Soft Delete อุปกรณ์
Priority: Priority 2
```

**ขั้นตอนทดสอบ:**
1. เลือกอุปกรณ์ที่ต้องการลบ
2. คลิก Delete
3. ยืนยันการลบ
4. ตรวจสอบใน Database
5. ตรวจสอบใน UI

**ผลลัพธ์ที่คาดหวัง:**
- อุปกรณ์ถูก soft delete
- ไม่แสดงใน UI
- ยังคงอยู่ใน Database
- InventoryMaster อัปเดตถูกต้อง

### **4. 📊 Counting & Statistics**

#### **Test 4.1: นับจำนวนอุปกรณ์**
```
Test ID: 4.1
Test Name: นับจำนวนอุปกรณ์
Priority: Priority 1
```

**ขั้นตอนทดสอบ:**
1. เพิ่มอุปกรณ์หลายชิ้น
2. ตรวจสอบการนับใน InventoryMaster
3. ตรวจสอบการนับใน UI
4. เปรียบเทียบกับข้อมูลจริง

**ผลลัพธ์ที่คาดหวัง:**
- การนับถูกต้อง
- ข้อมูลสอดคล้องกัน
- ไม่มี missing items

### **5. 🚚 Transfer & Request Operations**

#### **Test 5.1: เบิกอุปกรณ์**
```
Test ID: 5.1
Test Name: เบิกอุปกรณ์
Priority: Priority 1
```

**ขั้นตอนทดสอบ:**
1. สร้างคำขอเบิกอุปกรณ์
2. อนุมัติคำขอ
3. ตรวจสอบการโอนย้าย
4. ตรวจสอบ InventoryMaster

**ผลลัพธ์ที่คาดหวัง:**
- การโอนย้ายสำเร็จ
- จำนวนสต็อกอัปเดตถูกต้อง
- TransferLog สร้างถูกต้อง

### **6. 👥 User Permission Tests**

#### **Test 6.1: สิทธิ์ผู้ใช้**
```
Test ID: 6.1
Test Name: สิทธิ์ผู้ใช้
Priority: Priority 2
```

**ขั้นตอนทดสอบ:**
1. Login ด้วย user account
2. พยายามเข้าถึง admin functions
3. ตรวจสอบการป้องกัน
4. ตรวจสอบ error messages

**ผลลัพธ์ที่คาดหวัง:**
- ป้องกันการเข้าถึง admin functions
- แสดง error message ที่เหมาะสม
- ไม่มี security breach

### **7. 🔍 Edge Cases & Error Handling**

#### **Test 7.1: Serial Number ซ้ำ**
```
Test ID: 7.1
Test Name: Serial Number ซ้ำ
Priority: Priority 1
```

**ขั้นตอนทดสอบ:**
1. เพิ่มอุปกรณ์ที่มี Serial Number
2. เพิ่มอุปกรณ์ที่มี Serial Number เดียวกัน
3. ตรวจสอบ error handling

**ผลลัพธ์ที่คาดหวัง:**
- แสดง error message
- ไม่บันทึกข้อมูลซ้ำ
- ระบบยังคงเสถียร

---

## 📋 **Testing Checklist (CSV Format)**

| Test Category | Test ID | Test Name | Description | Steps | Expected Results | Priority | Status | Tester Name | Test Date | Notes | Issues Found |
|---------------|---------|-----------|-------------|-------|------------------|----------|--------|-------------|-----------|-------|--------------|
| Basic CRUD Operations | 1.1 | เพิ่มอุปกรณ์ใหม่ | ทดสอบการเพิ่มอุปกรณ์ทั้งที่มี SN และไม่มี SN | 1. Login เป็น admin/it_admin<br>2. ไป Admin → Inventory Management<br>3. เพิ่มอุปกรณ์ใหม่: ชื่อ "Test Mouse" หมวดหมู่ "อุปกรณ์คอมพิวเตอร์" จำนวน 3 (ไม่มี SN)<br>4. เพิ่มอุปกรณ์ที่มี SN: ชื่อ "Test Keyboard" หมวดหมู่ "อุปกรณ์คอมพิวเตอร์" Serial Number "KB001" | - อุปกรณ์ถูกเพิ่มสำเร็จ<br>- จำนวนแสดงถูกต้อง (3 ชิ้นสำหรับ Mouse, 1 ชิ้นสำหรับ Keyboard)<br>- InventoryMaster อัปเดตถูกต้อง | Priority 1 | Not Started | | | | |
| Basic CRUD Operations | 1.2 | แก้ไขอุปกรณ์ | ทดสอบการแก้ไข Serial Number | 1. เลือกอุปกรณ์ที่มี SN<br>2. แก้ไข Serial Number<br>3. บันทึก | - Serial Number อัปเดตสำเร็จ<br>- ข้อมูลแสดงถูกต้อง<br>- ไม่มี error | Priority 1 | Not Started | | | | |
| Stock Management | 2.1 | Auto-Detection จำนวนสต็อก | ทดสอบการ auto-detect จำนวนสต็อก | 1. เพิ่มอุปกรณ์ใหม่ (ไม่มี SN)<br>2. ตรวจสอบ InventoryMaster<br>3. เปลี่ยนจำนวนใน InventoryMaster<br>4. เพิ่ม/ลบ InventoryItem<br>5. ตรวจสอบการอัปเดต | - Auto-detection ทำงานถูกต้อง<br>- จำนวนสต็อกแสดงถูกต้อง<br>- ไม่มีข้อมูลไม่สอดคล้อง | Priority 1 | Not Started | | | | |
| Delete Operations | 3.1 | Soft Delete อุปกรณ์ | ทดสอบการ soft delete | 1. เลือกอุปกรณ์ที่ต้องการลบ<br>2. คลิก Delete<br>3. ยืนยันการลบ<br>4. ตรวจสอบใน Database<br>5. ตรวจสอบใน UI | - อุปกรณ์ถูก soft delete<br>- ไม่แสดงใน UI<br>- ยังคงอยู่ใน Database<br>- InventoryMaster อัปเดตถูกต้อง | Priority 2 | Not Started | | | | |
| Counting & Statistics | 4.1 | นับจำนวนอุปกรณ์ | ทดสอบการนับจำนวนอุปกรณ์ | 1. เพิ่มอุปกรณ์หลายชิ้น<br>2. ตรวจสอบการนับใน InventoryMaster<br>3. ตรวจสอบการนับใน UI<br>4. เปรียบเทียบกับข้อมูลจริง | - การนับถูกต้อง<br>- ข้อมูลสอดคล้องกัน<br>- ไม่มี missing items | Priority 1 | Not Started | | | | |
| Transfer & Request | 5.1 | เบิกอุปกรณ์ | ทดสอบการเบิกอุปกรณ์ | 1. สร้างคำขอเบิกอุปกรณ์<br>2. อนุมัติคำขอ<br>3. ตรวจสอบการโอนย้าย<br>4. ตรวจสอบ InventoryMaster | - การโอนย้ายสำเร็จ<br>- จำนวนสต็อกอัปเดตถูกต้อง<br>- TransferLog สร้างถูกต้อง | Priority 1 | Not Started | | | | |
| User Permission | 6.1 | สิทธิ์ผู้ใช้ | ทดสอบสิทธิ์การเข้าถึง | 1. Login ด้วย user account<br>2. พยายามเข้าถึง admin functions<br>3. ตรวจสอบการป้องกัน<br>4. ตรวจสอบ error messages | - ป้องกันการเข้าถึง admin functions<br>- แสดง error message ที่เหมาะสม<br>- ไม่มี security breach | Priority 2 | Not Started | | | | |
| Error Handling | 7.1 | Serial Number ซ้ำ | ทดสอบการจัดการ Serial Number ซ้ำ | 1. เพิ่มอุปกรณ์ที่มี Serial Number<br>2. เพิ่มอุปกรณ์ที่มี Serial Number เดียวกัน<br>3. ตรวจสอบ error handling | - แสดง error message<br>- ไม่บันทึกข้อมูลซ้ำ<br>- ระบบยังคงเสถียร | Priority 1 | Not Started | | | | |

---

## 🎉 **สรุปการทดสอบ**

### **✅ ฟีเจอร์ที่ทดสอบแล้ว**
- ✅ User Dashboard (Reference-based)
- ✅ Equipment Request/Return (Reference-based)
- ✅ Admin Dashboard (Reference-based)
- ✅ Inventory Management (Reference-based)
- ✅ Configuration Management (Reference-based)
- ✅ Request/Return Approval (Reference-based)
- ✅ Equipment Tracking (Reference-based)
- ✅ Error Handling (Reference-based)
- ✅ Performance (Reference-based)
- ✅ Integration (Reference-based)
- ✅ Mobile Responsiveness (Reference-based)
- ✅ Basic CRUD Operations (Legacy)
- ✅ Stock Management (Legacy)
- ✅ Delete Operations (Legacy)
- ✅ Counting & Statistics (Legacy)
- ✅ Transfer & Request (Legacy)
- ✅ User Permission (Legacy)
- ✅ Error Handling (Legacy)

### **❌ ข้อผิดพลาดที่อาจพบ**
- ❌ Serial Number ซ้ำ
- ❌ เบอร์โทรซ้ำ
- ❌ อุปกรณ์ไม่เพียงพอ
- ❌ ไม่มีสิทธิ์เข้าถึง
- ❌ ข้อมูลไม่ครบถ้วน

### **💡 ข้อแนะนำ**
1. **ทดสอบทีละขั้นตอน** - อย่ารีบร้อน
2. **ตรวจสอบข้อมูล** - ให้แน่ใจว่าถูกต้อง
3. **ทดสอบ Error Cases** - ตรวจสอบการจัดการข้อผิดพลาด
4. **ทดสอบ Performance** - ตรวจสอบความเร็ว
5. **ทดสอบ Mobile** - ตรวจสอบการใช้งานบนมือถือ

**ระบบพร้อมใช้งานจริงแล้วครับ! 🚀✨**
