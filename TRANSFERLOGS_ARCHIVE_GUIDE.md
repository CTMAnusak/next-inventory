# 📦 TransferLogs Archive System Guide

คู่มือระบบจัดการและเก็บถาวร TransferLogs เพื่อให้ฐานข้อมูลเบาและเว็บทำงานเร็ว

---

## 📋 สารบัญ

1. [ภาพรวมระบบ](#ภาพรวมระบบ)
2. [โครงสร้างการเก็บข้อมูล](#โครงสร้างการเก็บข้อมูล)
3. [การใช้งานสคริปต์](#การใช้งานสคริปต์)
4. [ตารางเวลาที่แนะนำ](#ตารางเวลาที่แนะนำ)
5. [การค้นหาข้อมูลเก่า](#การค้นหาข้อมูลเก่า)

---

## ภาพรวมระบบ

ระบบจัดการ TransferLogs แบบ**ตัดรอบตามปีปฏิทิน** (1 มกราคม - 31 ธันวาคม):

```
transferlogs (ออนไลน์ - ปีปัจจุบัน)
    ↓ รันวันที่ 1 มกราคมของทุกปี
transferlogs_archive (1-2 ปีย้อนหลัง)
    ↓ Export รายปีเป็นไฟล์
ไฟล์ JSON (2+ ปี - เก็บถาวร)
```

### การทำงาน
- **1 มกราคม 2026**: Export + Archive + ลบข้อมูลปี 2025 (1/1/2025 00:00 - 31/12/2025 23:59)
- **1 มกราคม 2027**: Export + Archive + ลบข้อมูลปี 2026 (1/1/2026 00:00 - 31/12/2026 23:59)

### ประโยชน์
- ✅ ตัดรอบชัดเจนตามปีปฏิทิน
- ✅ ฐานข้อมูลเบา เว็บเร็วขึ้น
- ✅ ยังเข้าถึงข้อมูลเก่าได้
- ✅ ประหยัดพื้นที่และต้นทุน

---

## โครงสร้างการเก็บข้อมูล

### 1. `transferlogs` (คอลเลกชันหลัก)
- **เก็บ**: ข้อมูลปีปัจจุบัน (1 มกราคม - 31 ธันวาคม)
- **ดัชนี**: ไม่มี TTL (ลบด้วยสคริปต์รันวันที่ 1 มกราคม)
- **ใช้สำหรับ**: ระบบปกติ, รายงานปัจจุบัน
- **ตัวอย่าง**: วันนี้ 6 ตุลาคม 2025 → เก็บข้อมูลตั้งแต่ 1/1/2025 ถึงปัจจุบัน

### 2. `transferlogs_archive` (คอลเลกชัน Archive)
- **เก็บ**: ข้อมูล 1-2 ปีย้อนหลัง
- **ย้ายจาก**: `transferlogs` รันวันที่ 1 มกราคมของทุกปี
- **ใช้สำหรับ**: รายงานย้อนหลัง
- **ตัวอย่าง**: วันนี้ 6 ตุลาคม 2025 → เก็บข้อมูลปี 2024, 2023

### 3. ไฟล์ JSON (backup_migration/transferlogs/)
- **เก็บ**: ข้อมูล 2+ ปี แยกไฟล์รายปี
- **ตัวอย่าง**: `transferlogs_2023.json`, `transferlogs_2024.json`
- **ใช้สำหรับ**: เก็บถาวรระยะยาว
- **รูปแบบ**: 1 ไฟล์ต่อ 1 ปีปฏิทิน (1/1 - 31/12)

---

## การใช้งานสคริปต์

### 1️⃣ สร้างดัชนี (รันครั้งแรก)

```bash
# ตั้งค่าดัชนีให้ transferlogs
npx tsx src/scripts/add-transferlogs-indexes.ts
```

**ผลลัพธ์**:
- ดัชนี `itemId + transferDate` (ค้นหาประวัติรายการ)
- ดัชนี `transferDate` (ช่วงเวลา)
- ดัชนี `transferType + processedBy` (กรองข้อมูล)
- **ไม่มี TTL** (จะลบด้วยสคริปต์แบบตัดรอบปี)

---

### 2️⃣ Yearly Archive & Cleanup (รันวันที่ 1 มกราคม)

```bash
# วิธีที่ 1: รันอัตโนมัติ (ตรวจสอบวันที่เอง)
npx tsx src/scripts/yearly-archive-cleanup.ts

# วิธีที่ 2: บังคับรันปีที่ต้องการ
npx tsx src/scripts/yearly-archive-cleanup.ts --year=2025
```

**สิ่งที่สคริปต์ทำ** (วันที่ 1 มกราคม 2026):
1. Export ข้อมูลปี 2025 (1/1/2025 00:00 - 31/12/2025 23:59) ไปไฟล์
2. ย้ายข้อมูลปี 2025 ไป `transferlogs_archive`
3. ลบข้อมูลปี 2025 ออกจาก `transferlogs`

**ผลลัพธ์**:
```
📅 Today is January 1st - auto-processing year 2025
📦 Processing transferlogs for year 2025
   Start: 2025-01-01T00:00:00.000Z
   End: 2025-12-31T23:59:59.999Z
📊 Found 15000 records to process

📝 Step 1: Exporting to JSON file...
   ✅ Exported 15000 records to transferlogs_2025.json (2.34 MB)

📤 Step 2: Moving to transferlogs_archive...
   ✅ Moved 15000 records to transferlogs_archive

🗑️  Step 3: Deleting from transferlogs...
   ✅ Deleted 15000 records from transferlogs

🎉 Yearly archive & cleanup completed!
```

---

### 3️⃣ Export เฉพาะ (ไม่ย้ายและลบ)

#### วิธีที่ 1: รันอัตโนมัติทุกวันที่ 1 มกราคม
```bash
# ตรวจสอบวันที่อัตโนมัติ ถ้าเป็น 1 มกราคมจะ export ปีที่แล้ว
npx tsx src/scripts/export-transferlogs-yearly.ts
```

#### วิธีที่ 2: บังคับ export ปีที่กำหนด
```bash
# Export ปี 2024
npx tsx src/scripts/export-transferlogs-yearly.ts --year=2024

# Export ทุกปี
npx tsx src/scripts/export-transferlogs-yearly.ts --all
```

**ผลลัพธ์**:
```
📦 Exporting transferlogs for year 2024...
✅ Exported 15000 records to transferlogs_2024.json (2.34 MB)
```

**ไฟล์จะถูกบันทึกที่**: `backup_migration/transferlogs/transferlogs_2024.json`

---

### 4️⃣ Import ข้อมูลกลับ

```bash
# Import ปี 2024 กลับเข้า transferlogs_archive
npx tsx src/scripts/import-transferlogs-yearly.ts --year=2024

# Import ทุกปี
npx tsx src/scripts/import-transferlogs-yearly.ts --all

# Import ไปที่คอลเลกชันอื่น
npx tsx src/scripts/import-transferlogs-yearly.ts --year=2024 --target=transferlogs
```

**ผลลัพธ์**:
```
📥 Importing from transferlogs_2024.json...
   Year: 2024, Records: 15000
✅ Imported 15000 records
```

---

### 5️⃣ ลบข้อมูลเก่าจาก Database

```bash
# ลบข้อมูลปี 2023 (หลังจาก export แล้ว)
npx tsx src/scripts/cleanup-archived-transferlogs.ts --year=2023

# ลบข้อมูลทุกปีก่อน 2024
npx tsx src/scripts/cleanup-archived-transferlogs.ts --before=2024

# ข้าม confirmation (ระวัง!)
npx tsx src/scripts/cleanup-archived-transferlogs.ts --year=2023 --force
```

**ระบบจะตรวจสอบ**:
- ✅ ไฟล์ backup มีอยู่หรือไม่
- ⏱️ รอ 5 วินาทีก่อนลบ (ยกเว้นมี --force)

---

## ตารางเวลาที่แนะนำ

### 🌐 Production (Vercel/Cloud) - **อัตโนมัติ 100%**

**ตั้งค่าแล้ว**: Vercel Cron จะรันอัตโนมัติทุกวันที่ **1 มกราคม เวลา 02:00**

**ไม่ต้องทำอะไร** - ระบบจะ:
1. ✅ ตรวจสอบวันที่อัตโนมัติ
2. ✅ Export ข้อมูลปีที่แล้วไปไฟล์
3. ✅ ย้ายไปใหม่ `transferlogs_archive`
4. ✅ ลบออกจาก `transferlogs`

**ตรวจสอบ Log**:
- Vercel Dashboard → Functions → Logs
- ดูว่า `/api/admin/cron/yearly-archive` รันสำเร็จหรือไม่

---

### 💻 Local Development - **รันเอง**

```bash
# วิธีที่ 1: รันสคริปต์โดยตรง (แนะนำ)
npx tsx src/scripts/yearly-archive-cleanup.ts

# วิธีที่ 2: เรียก API endpoint
curl -X POST http://localhost:3000/api/admin/cron/yearly-archive

# หรือใช้ PowerShell
Invoke-WebRequest -Uri "http://localhost:3000/api/admin/cron/yearly-archive" -Method POST
```

**เมื่อไหร่**: ทุกวันที่ 1 มกราคม หรือเมื่อต้องการ archive ปีที่แล้ว

---

### รายปี (ถ้าต้องการ) - ลบข้อมูลเก่าจาก Archive
```bash
# ลบข้อมูลเก่ากว่า 2 ปีออกจาก transferlogs_archive
# (หลังจาก export ไปไฟล์แล้ว)
npx tsx src/scripts/cleanup-archived-transferlogs.ts --before=2024
```

---

## การค้นหาข้อมูลเก่า

### ค้นหาจาก Database (1-2 ปี)
```javascript
// ใน MongoDB Compass หรือ code
db.transferlogs_archive.find({
  itemId: "68df8b68ddc0643ce146fb6a",
  transferDate: { $gte: new Date("2023-01-01") }
})
```

### ค้นหาจากไฟล์ (2+ ปี)
```bash
# เปิดไฟล์ JSON
cat backup_migration/transferlogs/transferlogs_2023.json

# หรือ import กลับเข้า DB ชั่วคราว
npx tsx src/scripts/import-transferlogs-yearly.ts --year=2023
```

---

## ⚠️ ข้อควรระวัง

1. **ก่อน cleanup**: ตรวจสอบว่า export สำเร็จแล้ว
2. **Backup ไฟล์**: สำรองไฟล์ JSON ไปที่อื่นด้วย (Google Drive, S3)
3. **TTL Index**: จะลบข้อมูลอัตโนมัติหลัง 365 วัน ตรวจสอบก่อนตั้งค่า

---

## 🔧 Troubleshooting

### ปัญหา: สคริปต์หา MongoDB ไม่เจอ
```bash
# ตั้งค่า environment variable
$env:MONGODB_URI="mongodb+srv://..."
npx tsx src/scripts/...
```

### ปัญหา: Import ข้อมูลซ้ำ
- ระบบจะข้าม duplicate key อัตโนมัติ
- ใช้ `--force` ถ้าต้องการเขียนทับ

### ปัญหา: ไฟล์ขนาดใหญ่เกินไป
- Export ปีละไฟล์แทนที่จะรวมทั้งหมด
- บีบอัดด้วย gzip: `gzip transferlogs_2023.json`

---

## 📞 สนับสนุน

หากมีปัญหาหรือข้อสงสัย:
1. ตรวจสอบ console log
2. ดู MongoDB Compass เพื่อตรวจสอบข้อมูล
3. ตรวจสอบไฟล์ใน `backup_migration/transferlogs/`

---

**สร้างเมื่อ**: 2025-10-06  
**เวอร์ชัน**: 1.0

