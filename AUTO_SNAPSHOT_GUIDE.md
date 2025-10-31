# Auto Snapshot System - คู่มือการตั้งค่า

## ภาพรวม

ระบบ Auto Snapshot จะสร้าง snapshot อัตโนมัติทุกสิ้นเดือนสำหรับเก็บสถิติสถานะคลังสินค้า

## ไฟล์ที่เกี่ยวข้อง

1. **API Endpoint**: `/api/admin/inventory-snapshot/auto-create`
2. **Helper Function**: `src/lib/snapshot-helpers.ts`
3. **Scripts**: 
   - `create-monthly-snapshot.sh` (Linux/Mac)
   - `create-monthly-snapshot.ps1` (Windows)

## การตั้งค่า Environment Variable

เพิ่มในไฟล์ `.env` หรือ `.env.local`:

```env
SNAPSHOT_SECRET_KEY=your-secret-key-here-change-this-in-production
```

**สำคัญ**: ต้องเปลี่ยน secret key เป็นค่าที่ปลอดภัยใน production!

## วิธีตั้งค่า Auto Snapshot

### วิธีที่ 1: ใช้ Cron Job (Linux/Mac)

1. ให้สิทธิ์ execute กับ script:
```bash
chmod +x create-monthly-snapshot.sh
```

2. แก้ไข script ให้ใส่ API_URL และ SECRET_KEY ที่ถูกต้อง:
```bash
nano create-monthly-snapshot.sh
```

3. ตั้งค่า cron job รันทุกวันแรกของเดือน เวลา 00:00:
```bash
crontab -e
```

เพิ่มบรรทัดนี้:
```cron
0 0 1 * * /absolute/path/to/create-monthly-snapshot.sh >> /var/log/snapshot.log 2>&1
```

### วิธีที่ 2: ใช้ Scheduled Task (Windows)

1. เปิด PowerShell as Administrator

2. สร้าง Scheduled Task:
```powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\path\to\create-monthly-snapshot.ps1"
$trigger = New-ScheduledTaskTrigger -Monthly -DaysOfMonth 1 -At 00:00
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "CreateMonthlySnapshot" -Action $action -Trigger $trigger -Principal $principal -Description "Create inventory snapshot every month"
```

3. ตั้งค่า Environment Variables ใน Task Scheduler:
   - เปิด Task Scheduler
   - คลิกขวาที่ task "CreateMonthlySnapshot" → Properties
   - แท็บ General → เลือก "Run whether user is logged on or not"
   - แท็บ Actions → Edit → เพิ่ม Environment Variables:
     - `API_URL`: `http://localhost:3000` (หรือ URL ของ server)
     - `SNAPSHOT_SECRET_KEY`: `your-secret-key`

### วิธีที่ 3: ใช้ External Cron Service (แนะนำสำหรับ Production)

#### ใช้ cron-job.org หรือ cronitor.io:

1. สร้าง account ที่ cron-job.org (หรือบริการอื่น)
2. เพิ่ม cron job:
   - URL: `https://your-domain.com/api/admin/inventory-snapshot/auto-create?secret=YOUR_SECRET_KEY`
   - Method: POST
   - Schedule: `0 0 1 * *` (ทุกวันแรกของเดือน เวลา 00:00 UTC)

#### ใช้ Vercel Cron Jobs (ถ้า deploy บน Vercel):

เพิ่มใน `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/admin/inventory-snapshot/auto-create?secret=YOUR_SECRET_KEY",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

## การทดสอบ

### ทดสอบ Auto Create API:

```bash
# POST request
curl -X POST "http://localhost:3000/api/admin/inventory-snapshot/auto-create?secret=YOUR_SECRET_KEY" \
  -H "Content-Type: application/json"

# GET request (ตรวจสอบสถานะ)
curl "http://localhost:3000/api/admin/inventory-snapshot/auto-create?secret=YOUR_SECRET_KEY"
```

### ทดสอบด้วย PowerShell:

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/admin/inventory-snapshot/auto-create?secret=YOUR_SECRET_KEY" `
  -Method POST `
  -ContentType "application/json"
```

## การทำงาน

เมื่อ cron job รัน:
1. ระบบจะสร้าง snapshot สำหรับ**เดือนก่อนหน้า**โดยอัตโนมัติ
2. ถ้ามี snapshot อยู่แล้ว จะอัพเดตทับข้อมูลเดิม
3. ถ้ายังไม่มี จะสร้าง snapshot ใหม่

## ข้อควรระวัง

1. **Secret Key**: ต้องเก็บ secret key ให้ปลอดภัย อย่า commit ลง git
2. **Timezone**: ตรวจสอบ timezone ของ server ให้ตรงกับที่ต้องการ
3. **Monitoring**: ควรตรวจสอบ log ว่าการสร้าง snapshot สำเร็จหรือไม่
4. **Backup**: แนะนำให้ backup ข้อมูล snapshot เป็นประจำ

## การตรวจสอบ Snapshot

เข้าไปดู snapshot ที่สร้างได้ผ่าน:
- API: `GET /api/admin/inventory-snapshot/create?year=2568&month=10`
- Dashboard: เลือกเดือน/ปีที่ต้องการดู

## Troubleshooting

### Snapshot ไม่ถูกสร้าง:
1. ตรวจสอบ secret key ว่าถูกต้องหรือไม่
2. ตรวจสอบ log ของ cron job
3. ตรวจสอบว่า API server ทำงานอยู่หรือไม่
4. ทดสอบด้วย curl/PowerShell ก่อน

### Snapshot ไม่ถูกต้อง:
1. ตรวจสอบข้อมูลใน database ว่าถูกต้องหรือไม่
2. ตรวจสอบว่า RequestLog และ ReturnLog มีข้อมูลครบหรือไม่
3. สร้าง snapshot ใหม่ด้วย API manual

