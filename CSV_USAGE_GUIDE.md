# 📊 คู่มือการใช้งาน CSV Testing Checklist ใน Google Sheets

## 🎯 วิธีการนำเข้า CSV ไป Google Sheets

### **Step 1: Upload ไฟล์ CSV**
1. เปิด Google Drive
2. คลิก "New" → "File upload"
3. เลือกไฟล์ `inventory_testing_checklist.csv`
4. รอให้อัพโหลดเสร็จ

### **Step 2: เปิดด้วย Google Sheets**
1. คลิกขวาที่ไฟล์ CSV
2. เลือก "Open with" → "Google Sheets"
3. Google Sheets จะแปลงไฟล์เป็น spreadsheet

---

## 🛠️ การปรับแต่ง Google Sheets

### **1. ปรับขนาด Column**
```
- Test Category: 200px
- Test ID: 80px  
- Test Name: 250px
- Description: 300px
- Steps: 400px
- Expected Results: 400px
- Priority: 100px
- Status: 120px
- Tester Name: 150px
- Test Date: 120px
- Notes: 300px
- Issues Found: 300px
```

### **2. สร้าง Dropdown สำหรับ Status**
1. เลือก column "Status" ทั้งหมด
2. ไป Data → Data validation
3. Criteria: "List of items"
4. ใส่รายการ:
   ```
   Not Started
   In Progress  
   Passed
   Failed
   Blocked
   Skipped
   ```

### **3. สร้าง Dropdown สำหรับ Priority**
1. เลือก column "Priority" ทั้งหมด
2. ไป Data → Data validation
3. Criteria: "List of items"
4. ใส่รายการ:
   ```
   CRITICAL
   Priority 1
   Priority 2
   Priority 3
   ```

### **4. เพิ่ม Color Coding สำหรับ Status**
1. เลือก column "Status"
2. ไป Format → Conditional formatting
3. ตั้งค่าสี:
   - **Passed** = เขียว (#34A853)
   - **Failed** = แดง (#EA4335)
   - **In Progress** = เหลือง (#FBBC04)
   - **Blocked** = ส้ม (#FF6D01)
   - **Not Started** = เทา (#9AA0A6)
   - **Skipped** = น้ำเงิน (#4285F4)

---

## 👥 การแชร์และทำงานร่วมกัน

### **1. แชร์ Spreadsheet**
1. คลิก "Share" ที่มุมขวาบน
2. เพิ่มอีเมลของเพื่อนร่วมงาน
3. ตั้งสิทธิ์เป็น "Editor"
4. คลิก "Send"

### **2. การมอบหมายงาน**
- ใส่ชื่อผู้ทดสอบใน column "Tester Name"
- ใช้ comment (@mention) เพื่อแจ้งเตือน
- ตั้ง deadline ใน column "Test Date"

### **3. การติดตามความคืบหน้า**
```
สร้าง Summary Dashboard:
- Total Tests: =COUNTA(B:B)-1
- Passed: =COUNTIF(H:H,"Passed")
- Failed: =COUNTIF(H:H,"Failed") 
- In Progress: =COUNTIF(H:H,"In Progress")
- Not Started: =COUNTIF(H:H,"Not Started")
- Progress: =COUNTIF(H:H,"Passed")/COUNTA(B:B)*100&"%"
```

---

## 📋 วิธีการใช้งานในทีม

### **Phase 1: Setup**
1. **Project Manager** สร้าง Google Sheet จาก CSV
2. แชร์ให้ทีมทั้งหมด
3. อธิบายวิธีการทดสอบ

### **Phase 2: Assignment**
1. แบ่งงานตาม Priority:
   - **CRITICAL & Priority 1** → Senior Tester
   - **Priority 2** → Mid-level Tester  
   - **Priority 3** → Junior Tester
2. ใส่ชื่อใน "Tester Name"
3. กำหนด "Test Date"

### **Phase 3: Execution**
1. ผู้ทดสอบเปลี่ยน Status เป็น "In Progress"
2. ทำการทดสอบตาม Steps
3. บันทึกผลลัพธ์:
   - **Passed** = ผ่าน
   - **Failed** = ไม่ผ่าน (ระบุใน Issues Found)
   - **Blocked** = ติดขัด (ระบุเหตุผล)

### **Phase 4: Review**
1. **Daily Standup** - รายงานความคืบหน้า
2. **Bug Triaging** - จัดการ issues ที่พบ
3. **Retest** - ทดสอบซ้ำหลังแก้ไขบัค

---

## 🔍 การใช้ Filter และ Sort

### **1. Filter ตาม Priority**
1. เลือก header row
2. ไป Data → Create a filter
3. คลิก filter icon ที่ Priority column
4. เลือก priority ที่ต้องการดู

### **2. Sort ตาม Status**
1. เลือกข้อมูลทั้งหมด
2. ไป Data → Sort range
3. เลือก "Status" column
4. เรียงตาม: Failed → In Progress → Not Started → Passed

### **3. Search Test Cases**
- ใช้ Ctrl+F เพื่อหา test case
- ค้นหาด้วย Test ID, Test Name, หรือ keyword

---

## 📊 Dashboard Template

สร้างแผ่นงาน "Dashboard" แยกต่างหาก:

```
=== INVENTORY TESTING DASHBOARD ===

📊 OVERALL PROGRESS:
Total Test Cases: =COUNTA(Sheet1!B:B)-1
Completed: =COUNTIFS(Sheet1!H:H,"Passed")+COUNTIFS(Sheet1!H:H,"Failed")
Progress: =Completed/Total*100 & "%"

🎯 BY PRIORITY:
CRITICAL: =COUNTIF(Sheet1!G:G,"CRITICAL") & " tests"
- Passed: =COUNTIFS(Sheet1!G:G,"CRITICAL",Sheet1!H:H,"Passed")
- Failed: =COUNTIFS(Sheet1!G:G,"CRITICAL",Sheet1!H:H,"Failed")

Priority 1: =COUNTIF(Sheet1!G:G,"Priority 1") & " tests"  
- Passed: =COUNTIFS(Sheet1!G:G,"Priority 1",Sheet1!H:H,"Passed")
- Failed: =COUNTIFS(Sheet1!G:G,"Priority 1",Sheet1!H:H,"Failed")

📋 BY STATUS:
✅ Passed: =COUNTIF(Sheet1!H:H,"Passed")
❌ Failed: =COUNTIF(Sheet1!H:H,"Failed") 
🔄 In Progress: =COUNTIF(Sheet1!H:H,"In Progress")
⏸️ Not Started: =COUNTIF(Sheet1!H:H,"Not Started")
🚫 Blocked: =COUNTIF(Sheet1!H:H,"Blocked")

👥 BY TESTER:
=QUERY(Sheet1!I:J,"SELECT I, COUNT(I) GROUP BY I LABEL COUNT(I) 'Tests Assigned'")

🐛 ISSUES SUMMARY:
Total Issues: =COUNTA(Sheet1!L:L)-COUNTBLANK(Sheet1!L:L)-1
Critical Issues: (Manual count of severe bugs)
```

---

## 🚨 Best Practices

### **1. การบันทึกผลการทดสอบ**
- ✅ **Passed**: บันทึกเวลาที่ทดสอบ
- ❌ **Failed**: ระบุรายละเอียดบัคใน "Issues Found"
- 🔄 **In Progress**: อัปเดตความคืบหน้าใน "Notes"
- 🚫 **Blocked**: ระบุสิ่งที่รอและ ETA

### **2. การจัดการบัค**
```
Format สำหรับ Issues Found:
🐛 [Bug ID] Brief Description
📝 Steps: 1. xxx 2. yyy
✅ Expected: zzz
❌ Actual: aaa
🔗 Screenshot: [link]
```

### **3. การ Retest**
- สร้าง row ใหม่สำหรับ retest
- ใส่ "(Retest)" ใน Test Name
- Link กลับไป original test

### **4. การ Archive**
- เมื่อทดสอบเสร็จ ให้ copy ไปแผ่นงาน "Completed"
- เก็บ history สำหรับ reference

---

## 📱 Mobile Testing

สำหรับการทดสอบบนมือถือ:
1. ใช้ Google Sheets app
2. ทำการทดสอบ
3. อัปเดต Status ผ่าน mobile
4. เพิ่มรูปภาพ bug ได้

---

## 🔄 Integration กับ Tools อื่น

### **1. Jira Integration**
- Export issues เป็น CSV
- Import ไป Jira สำหรับ bug tracking

### **2. Slack Notifications**  
- ใช้ Google Apps Script
- แจ้งเตือนเมื่อมี test failed

### **3. Email Reports**
- สร้าง automated email summary
- ส่งรายงานความคืบหน้าประจำวัน

---

**💡 Tips:** 
- ใช้ keyboard shortcuts: Ctrl+Enter (new line ใน cell)
- Freeze header row เพื่อการ scroll ที่ดีขึ้น
- สร้าง template สำหรับ test cases ใหม่
- Backup spreadsheet เป็นประจำ
