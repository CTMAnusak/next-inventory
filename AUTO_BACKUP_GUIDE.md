# 🤖 Auto Backup Guide for Next Inventory

## ⏰ Backup Schedule
- **เวลา**: ทุกวันเวลา 2:00 AM
- **เหตุผล**: ช่วงเวลาที่มีผู้ใช้น้อยที่สุด ไม่กระทบ performance

## 🚀 วิธีการตั้งค่า Auto Backup

### Step 1: เรียกใช้ PowerShell แบบ Administrator
1. กดปุ่ม `Windows + X`
2. เลือก **"Windows PowerShell (Admin)"** หรือ **"Terminal (Admin)"**
3. กด **Yes** เมื่อขออนุญาต

### Step 2: รันคำสั่งตั้งค่า
```powershell
cd "C:\Users\USER\Desktop\next-inventory"
.\setup-auto-backup.ps1
```

### Step 3: ตรวจสอบว่าตั้งค่าสำเร็จ
- เปิด **Task Scheduler** (พิมพ์ "Task Scheduler" ใน Start Menu)
- หา task ชื่อ **"NextInventory-AutoBackup"**
- ตรวจสอบว่า Status เป็น **"Ready"**

## 📁 ไฟล์ที่เกี่ยวข้อง

### ไฟล์ที่สร้างขึ้น:
- `backup_migration/auto-backup.bat` - Script สำหรับรัน backup
- `setup-auto-backup.ps1` - Script สำหรับตั้งค่า Task Scheduler
- `backup_migration/backup_log.txt` - Log ไฟล์ (จะสร้างอัตโนมัติ)

### ไฟล์ backup ที่จะสร้าง:
- `backup_YYYY-MM-DDTHH-MM-SS_inventoryitems.json`
- `backup_YYYY-MM-DDTHH-MM-SS_requestlogs.json`
- `backup_YYYY-MM-DDTHH-MM-SS_returnlogs.json`
- `backup_YYYY-MM-DDTHH-MM-SS_issuelogs.json`

## 📊 การตรวจสอบ Backup

### ตรวจสอบ Log:
```bash
# ดู backup log (ดูผลการ backup)
type backup_migration\backup_log.txt

# ดู backup log แบบ real-time
Get-Content backup_migration\backup_log.txt -Tail 10 -Wait
```

### ทดสอบ Backup ด้วยตนเอง:
```bash
# วิธีที่ 1: ใช้ npm script
npm run backup

# วิธีที่ 2: ใช้ batch file
backup_migration\auto-backup.bat
```

## ⚙️ การจัดการ Task Scheduler

### ดูสถานะ:
```powershell
Get-ScheduledTask -TaskName "NextInventory-AutoBackup"
```

### เปิด/ปิด task:
```powershell
# เปิด
Enable-ScheduledTask -TaskName "NextInventory-AutoBackup"

# ปิด
Disable-ScheduledTask -TaskName "NextInventory-AutoBackup"
```

### ลบ task:
```powershell
Unregister-ScheduledTask -TaskName "NextInventory-AutoBackup" -Confirm:$false
```

### รัน task ทันที (ทดสอบ):
```powershell
Start-ScheduledTask -TaskName "NextInventory-AutoBackup"
```

## 🔧 Troubleshooting

### ปัญหา: Task ไม่รัน
**วิธีแก้:**
1. เช็คว่า Node.js อยู่ใน PATH
2. เช็คว่า project path ถูกต้อง
3. ดู log ใน `backup_migration\backup_log.txt`

### ปัญหา: Permission denied
**วิธีแก้:**
1. รัน PowerShell แบบ Administrator
2. ตรวจสอบว่า Task รันด้วย SYSTEM account

### ปัญหา: MongoDB connection failed
**วิธีแก้:**
1. เช็ค internet connection
2. เช็ค MongoDB connection string
3. เช็ค MongoDB server status

## 📈 การ Monitor

### ไฟล์สำคัญที่ควรตรวจสอบ:
- `backup_migration/backup_log.txt` - Log การทำงาน
- `backup_migration/backup_*.json` - ไฟล์ backup ล่าสุด
- Task Scheduler → Last Run Result

### สัญญาณที่ backup ทำงานปกติ:
- ✅ Last Run Result = "Success (0x0)"
- ✅ มีไฟล์ backup ใหม่ทุกวัน
- ✅ Log file มี entry ใหม่ทุกวัน

## 🔄 การเปลี่ยนแปลงเวลา

หากต้องการเปลี่ยนเวลา backup:
1. เปิด Task Scheduler
2. หา "NextInventory-AutoBackup"
3. คลิกขวา → Properties
4. ไปที่ tab "Triggers"
5. แก้ไขเวลาตามต้องการ

## 🎯 Best Practices

1. **ตรวจสอบ log เป็นประจำ** - อย่างน้อยสัปดาห์ละครั้ง
2. **ทดสอบ restore** - ทดสอบใช้ backup file เป็นครั้งคราว
3. **Monitor disk space** - backup files จะใช้พื้นที่ประมาณ 1-10 MB ต่อวัน
4. **Keep offsite backup** - เก็บ backup สำคัญใน cloud storage
