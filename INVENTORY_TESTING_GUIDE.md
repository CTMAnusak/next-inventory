# 🧪 คู่มือการทดสอบระบบ Inventory Management

## 📋 Overview
คู่มือนี้ครอบคลุมการทดสอบทุกส่วนของระบบ Inventory เพื่อให้แน่ใจว่าการแก้ไขบัคและฟีเจอร์ต่างๆ ทำงานถูกต้อง

---

## 🎯 Test Categories

### 1. 🔧 **Basic CRUD Operations**
### 2. 🔄 **Stock Management & Auto-Detection**
### 3. 🗑️ **Delete Operations & Soft Delete**
### 4. 📊 **Counting & Statistics**
### 5. 🚚 **Transfer & Request Operations**
### 6. 👥 **User Permission Tests**
### 7. 🔍 **Edge Cases & Error Handling**

---

## 1. 🔧 **Basic CRUD Operations**

### **Test 1.1: เพิ่มอุปกรณ์ใหม่**
```
📝 Steps:
1. Login เป็น admin/it_admin
2. ไป Admin → Inventory Management
3. เพิ่มอุปกรณ์ใหม่:
   - ชื่อ: "Test Mouse"
   - หมวดหมู่: "อุปกรณ์คอมพิวเตอร์"
   - จำนวน: 3 (ไม่มี SN)
4. เพิ่มอุปกรณ์ที่มี SN:
   - ชื่อ: "Test Keyboard"  
   - หมวดหมู่: "อุปกรณ์คอมพิวเตอร์"
   - Serial Number: "KB001"

✅ Expected Results:
- อุปกรณ์ถูกเพิ่มสำเร็จ
- จำนวนแสดงถูกต้อง (3 ชิ้นสำหรับ Mouse, 1 ชิ้นสำหรับ Keyboard)
- InventoryMaster อัปเดตถูกต้อง
```

### **Test 1.2: แก้ไขอุปกรณ์**
```
📝 Steps:
1. เลือกอุปกรณ์ที่มี SN
2. แก้ไข Serial Number
3. บันทึก

✅ Expected Results:
- Serial Number อัปเดตสำเร็จ
- ไม่มี error เรื่อง duplicate SN
- ข้อมูลในฐานข้อมูลถูกต้อง
```

### **Test 1.3: ดูรายละเอียดอุปกรณ์**
```
📝 Steps:
1. คลิกดูรายละเอียดอุปกรณ์
2. ตรวจสอบข้อมูลทั้งหมด

✅ Expected Results:
- ข้อมูลแสดงครบถ้วน
- Status แสดงถูกต้อง
- History แสดงถูกต้อง
```

---

## 2. 🔄 **Stock Management & Auto-Detection**

### **Test 2.1: Auto-Detection หลังเพิ่มอุปกรณ์**
```
📝 Steps:
1. เพิ่มอุปกรณ์ใหม่ 5 ชิ้น (ไม่มี SN)
2. รอสักครู่แล้วรีเฟรชหน้า
3. ตรวจสอบ Stock Management

✅ Expected Results:
- adminDefinedStock แสดง 5
- realAvailable แสดง 5  
- Auto-detection log ใน adminStockOperations
- จำนวนตรงกับจำนวนจริงใน database
```

### **Test 2.2: Manual Stock Adjustment**
```
📝 Steps:
1. เลือกอุปกรณ์ที่มี stock
2. คลิก "จัดการ Stock"
3. เปลี่ยนจำนวนจาก 5 เป็น 8
4. ระบุเหตุผล: "เพิ่ม stock ทดสอบ"
5. บันทึก

✅ Expected Results:
- Stock เพิ่มจาก 5 เป็น 8
- มี InventoryItem ใหม่ 3 รายการ (ไม่มี SN)
- adminStockOperations มี log การเปลี่ยนแปลง
- realAvailable = 8
```

### **Test 2.3: Stock Reduction**
```
📝 Steps:
1. ลดจำนวน stock จาก 8 เป็น 5
2. ระบุเหตุผล: "ลด stock ทดสอบ"
3. บันทึก

✅ Expected Results:
- Stock ลดจาก 8 เป็น 5
- InventoryItem ที่ไม่มี SN ถูกลบ 3 รายการ
- รายการที่มี SN ไม่ถูกลบ
- realAvailable = 5
```

---

## 3. 🗑️ **Delete Operations & Soft Delete (Critical Test)**

### **Test 3.1: ทดสอบบัคที่แก้ไข**
```
📝 Steps (ตามที่ user รายงาน):
1. เพิ่มอุปกรณ์ 2 ชิ้น:
   - 1 ชิ้นไม่มี SN
   - 1 ชิ้นมี SN "TEST001"
2. ลบอุปกรณ์ที่มี SN ออก (ระบุเหตุผล)
3. เพิ่มอุปกรณ์ไม่มี SN อีก 1 ชิ้น

✅ Expected Results:
- ขั้นตอนที่ 1: มี 2 ชิ้น (1 ไม่มี SN, 1 มี SN)
- ขั้นตอนที่ 2: เหลือ 1 ชิ้น (ไม่มี SN)
- ขั้นตอนที่ 3: มี 2 ชิ้นไม่มี SN (ไม่ใช่ 3 ชิ้น!)
- Auto-detection ไม่สร้างรายการเพิ่ม
```

### **Test 3.2: Soft Delete Verification**
```
📝 Steps:
1. ลบอุปกรณ์ที่มี SN
2. ตรวจสอบใน database:
   - ไป MongoDB Atlas/Compass
   - ดู collection "inventoryitems"
   - หา record ที่ถูกลบ

✅ Expected Results:
- Record ยังอยู่ใน database
- status = "deleted"
- deletedAt มีวันที่
- deleteReason มีเหตุผล
- ไม่ถูกนับในการคำนวณ stock
```

### **Test 3.3: Multiple Delete Test**
```
📝 Steps:
1. เพิ่มอุปกรณ์ 10 ชิ้น (5 มี SN, 5 ไม่มี SN)
2. ลบที่มี SN 2 ชิ้น
3. ลบที่ไม่มี SN 1 ชิ้น
4. ตรวจสอบการนับ

✅ Expected Results:
- เหลือ 7 ชิ้น (3 มี SN, 4 ไม่มี SN)
- จำนวนในระบบถูกต้อง
- Auto-detection ไม่ทำงานผิด
```

---

## 4. 📊 **Counting & Statistics**

### **Test 4.1: ตรวจสอบการนับใน Admin Panel**
```
📝 Steps:
1. ไป Admin → Inventory Management
2. ดูจำนวนในตาราง
3. เปรียบเทียบกับ Stock Management
4. ตรวจสอบ Available vs Total

✅ Expected Results:
- จำนวนใน table ตรงกับ realAvailable
- totalQuantity = adminStock + userOwned
- availableQuantity = items ที่ status ไม่ใช่ deleted
```

### **Test 4.2: ตรวจสอบการนับใน Equipment Request**
```
📝 Steps:
1. ไป Equipment Request
2. เลือกอุปกรณ์ที่มี stock
3. ดูจำนวนที่แสดง

✅ Expected Results:
- จำนวนที่แสดงตรงกับ available items
- ไม่แสดงรายการที่ถูกลบ
- รายการที่ maintenance/damaged แสดงแยก
```

### **Test 4.3: Database Count Verification**
```
📝 Steps (สำหรับผู้ที่เข้า database ได้):
1. เข้า MongoDB Atlas/Compass
2. รัน query:
   db.inventoryitems.countDocuments({
     "itemName": "Test Mouse",
     "status": { "$ne": "deleted" }
   })
3. เปรียบเทียบกับที่แสดงในระบบ

✅ Expected Results:
- จำนวนใน database ตรงกับที่แสดงในระบบ
- Deleted items ไม่ถูกนับ
```

---

## 5. 🚚 **Transfer & Request Operations**

### **Test 5.1: Equipment Request Flow**
```
📝 Steps:
1. Login เป็น user ทั่วไป
2. ขออุปกรณ์ที่มี stock
3. Login เป็น admin อนุมัติ
4. ตรวจสอบการโอนย้าย

✅ Expected Results:
- Stock ลดลง
- User ได้รับอุปกรณ์
- Transfer log ถูกต้อง
- จำนวนใน admin stock ลดลง
```

### **Test 5.2: Equipment Return Flow**
```
📝 Steps:
1. User คืนอุปกรณ์
2. Admin อนุมัติการคืน
3. ตรวจสอบ stock

✅ Expected Results:
- Stock เพิ่มขึ้น
- อุปกรณ์กลับเข้า admin_stock
- จำนวนถูกต้อง
```

### **Test 5.3: Transfer History**
```
📝 Steps:
1. ดูประวัติการโอนย้ายอุปกรณ์
2. ตรวจสอบ log ทั้งหมด

✅ Expected Results:
- ประวัติครบถ้วน
- วันที่เวลาถูกต้อง
- ชื่อผู้ดำเนินการถูกต้อง
```

---

## 6. 👥 **User Permission Tests**

### **Test 6.1: Admin Permissions**
```
📝 Steps:
1. Login เป็น admin (userRole: 'admin')
2. ทดสอบการเข้าถึงทุกฟังก์ชัน

✅ Expected Results:
- เข้าถึง Admin Panel ได้
- สร้าง/แก้ไข/ลบ inventory ได้
- อนุมัติ request ได้
- จัดการ stock ได้
```

### **Test 6.2: IT Admin Permissions**
```
📝 Steps:
1. Login เป็น it_admin (userRole: 'it_admin')
2. ทดสอบการเข้าถึงทุกฟังก์ชัน

✅ Expected Results:
- เข้าถึง Admin Panel ได้
- มีสิทธิ์เหมือน admin
- อนุมัติสมาชิกได้
- จัดการระบบได้
```

### **Test 6.3: Regular User Permissions**
```
📝 Steps:
1. Login เป็น user (userRole: 'user')
2. พยายามเข้า admin panel

✅ Expected Results:
- ไม่สามารถเข้า admin panel ได้
- redirect ไป dashboard
- เห็นเฉพาะฟังก์ชัน user
```

---

## 7. 🔍 **Edge Cases & Error Handling**

### **Test 7.1: Duplicate Serial Number**
```
📝 Steps:
1. เพิ่มอุปกรณ์ที่มี SN "TEST001"
2. พยายามเพิ่มอุปกรณ์ใหม่ที่มี SN "TEST001"

✅ Expected Results:
- แสดง error message
- ไม่สามารถเพิ่มได้
- ข้อมูลเดิมไม่เสียหาย
```

### **Test 7.2: Invalid Data Input**
```
📝 Steps:
1. ใส่ข้อมูลไม่ครบ
2. ใส่จำนวนเป็นลบ
3. ใส่ชื่อที่ยาวเกินไป

✅ Expected Results:
- แสดง validation error
- ไม่บันทึกข้อมูลผิด
- form validation ทำงาน
```

### **Test 7.3: Network/Database Error**
```
📝 Steps:
1. ปิด internet connection
2. พยายามบันทึกข้อมูล

✅ Expected Results:
- แสดง error message ที่เหมาะสม
- ไม่ crash
- สามารถ retry ได้
```

### **Test 7.4: Large Dataset Test**
```
📝 Steps:
1. เพิ่มอุปกรณ์ 100+ รายการ
2. ทดสอบการโหลดหน้า
3. ทดสอบการค้นหา

✅ Expected Results:
- หน้าโหลดไม่ช้า
- ค้นหาทำงานได้
- pagination ทำงาน
```

---

## 8. 🧪 **Comprehensive Integration Test**

### **Test 8.1: Full Workflow Test**
```
📝 Complete Scenario:
1. Admin เพิ่มอุปกรณ์ใหม่ 10 ชิ้น
2. User ขออุปกรณ์ 3 ชิ้น
3. Admin อนุมัติ
4. User คืนอุปกรณ์ 1 ชิ้น
5. Admin อนุมัติการคืน
6. Admin ลบอุปกรณ์ 2 ชิ้น
7. Admin เพิ่มอุปกรณ์ใหม่ 5 ชิ้น

✅ Expected Final State:
- Admin stock: 10 - 3 + 1 - 2 + 5 = 11 ชิ้น
- User owned: 3 - 1 = 2 ชิ้น
- Deleted: 2 ชิ้น (ไม่นับ)
- Total visible: 11 + 2 = 13 ชิ้น
```

---

## 9. 📊 **Performance & Load Testing**

### **Test 9.1: Response Time Test**
```
📝 Steps:
1. วัดเวลาการโหลดหน้า inventory
2. วัดเวลาการบันทึกข้อมูล
3. วัดเวลาการค้นหา

✅ Expected Results:
- หน้าโหลดภายใน 3 วินาที
- บันทึกข้อมูลภายใน 2 วินาที
- ค้นหาภายใน 1 วินาที
```

### **Test 9.2: Concurrent User Test**
```
📝 Steps:
1. หลาย user เข้าใช้พร้อมกัน
2. ทำงานกับข้อมูลเดียวกัน
3. ตรวจสอบ data consistency

✅ Expected Results:
- ไม่มี race condition
- ข้อมูลไม่เสียหาย
- แต่ละ user เห็นข้อมูลถูกต้อง
```

---

## 10. 🔧 **Database Integrity Check**

### **Test 10.1: Data Consistency Check**
```
📝 Database Queries:
1. ตรวจสอบ orphaned records:
   - InventoryItem ที่ไม่มี InventoryMaster
   - TransferLog ที่ไม่มี InventoryItem

2. ตรวจสอบ duplicate serial numbers:
   - หา SN ที่ซ้ำกันใน active items

3. ตรวจสอบ stock count:
   - เปรียบเทียบ InventoryMaster กับ actual count

✅ Expected Results:
- ไม่มี orphaned records
- ไม่มี duplicate SN
- จำนวนใน master ตรงกับ actual
```

---

## 📋 **Testing Checklist**

### **Pre-Testing Setup:**
- [ ] Backup database
- [ ] Clear browser cache
- [ ] Prepare test data
- [ ] Check environment variables

### **During Testing:**
- [ ] Record all steps
- [ ] Screenshot errors
- [ ] Note response times
- [ ] Check console logs

### **Post-Testing:**
- [ ] Verify database state
- [ ] Clean up test data
- [ ] Document issues
- [ ] Update test cases

---

## 🚨 **Critical Test Cases (Must Pass)**

### **Priority 1 - Core Functionality:**
1. ✅ Basic CRUD operations
2. ✅ Stock counting accuracy
3. ✅ Soft delete functionality
4. ✅ Auto-detection logic

### **Priority 2 - Business Logic:**
1. ✅ Equipment request/return flow
2. ✅ Permission system
3. ✅ Serial number validation
4. ✅ Transfer operations

### **Priority 3 - Edge Cases:**
1. ✅ Error handling
2. ✅ Data validation
3. ✅ Performance under load
4. ✅ Database integrity

---

## 📞 **Reporting Issues**

### **Bug Report Template:**
```
🐛 Bug Title: [Brief description]

📝 Steps to Reproduce:
1. Step 1
2. Step 2
3. Step 3

✅ Expected Result:
[What should happen]

❌ Actual Result:
[What actually happened]

🌐 Environment:
- Browser: [Chrome/Firefox/etc]
- User Role: [admin/user/etc]
- Time: [timestamp]

📷 Screenshots:
[Attach if applicable]
```

---

## ✅ **Success Criteria**

### **System is considered stable when:**
- [ ] All Priority 1 tests pass
- [ ] No critical bugs found
- [ ] Performance meets requirements
- [ ] Database integrity maintained
- [ ] User permissions work correctly
- [ ] Error handling is robust

---

**หมายเหตุ:** ทดสอบทีละขั้นตอน และบันทึกผลลัพธ์ทุกครั้ง เพื่อให้แน่ใจว่าระบบทำงานถูกต้องและเสถียร
