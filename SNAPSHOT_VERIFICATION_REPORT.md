# สรุปการตรวจสอบระบบ Snapshot

## ผลการทดสอบ

### ✅ การบันทึกข้อมูลทำงานได้จริง
- Collection `inventorysnapshots` มีอยู่จริงใน MongoDB
- การบันทึกข้อมูลด้วย `findOneAndUpdate` พร้อม `upsert: true` ทำงานได้ถูกต้อง
- มี snapshot 1 รายการที่ถูกสร้างจากสคริปต์ทดสอบ (เดือน 10/2568)

### 🔍 สาเหตุที่อาจทำให้ไม่มีข้อมูล

1. **Cron Job ไม่ได้รัน**
   - Vercel Cron Job ต้องมี environment variable `VERCEL_SNAPSHOT_SECRET_KEY` ตั้งค่าไว้
   - Cron schedule: `0 0 1 * *` (ทุกวันแรกของเดือน เวลา 00:00 UTC)
   - หาก deploy บน Vercel ต้องตรวจสอบว่า cron job ถูก enable และรันจริง

2. **Secret Key ไม่ถูกต้อง**
   - API endpoint `/api/admin/inventory-snapshot/auto-create` ต้องการ secret key
   - Environment variables ที่ต้องตั้งค่า:
     - `SNAPSHOT_SECRET_KEY` หรือ
     - `VERCEL_SNAPSHOT_SECRET_KEY` (สำหรับ Vercel Cron)

3. **ไม่มีข้อมูล InventoryMaster**
   - ระบบ snapshot ต้องการข้อมูลจาก `InventoryMaster` collection
   - ถ้าไม่มี `InventoryMaster` ที่มี `relatedItemIds` จะได้ snapshot ที่ว่างเปล่า

4. **วันที่/เวลาไม่ถูกต้อง**
   - Cron job จะสร้าง snapshot สำหรับ**เดือนก่อนหน้า**
   - ถ้าตอนนี้เป็นเดือน 11/2568 จะสร้าง snapshot สำหรับเดือน 10/2568

## วิธีแก้ไข

### 1. ตรวจสอบ Environment Variables

เพิ่มใน `.env.local` หรือ Vercel Environment Variables:
```env
SNAPSHOT_SECRET_KEY=your-secret-key-here-change-this
VERCEL_SNAPSHOT_SECRET_KEY=your-secret-key-here-change-this
```

### 2. ทดสอบการสร้าง Snapshot แบบ Manual

เรียก API endpoint:
```bash
# สำหรับ Vercel (ใช้ secret key)
curl -X POST "https://your-domain.com/api/admin/inventory-snapshot/auto-create?secret=YOUR_SECRET_KEY" \
  -H "Content-Type: application/json"

# สำหรับ Local (ใช้ secret key)
curl -X POST "http://localhost:3000/api/admin/inventory-snapshot/auto-create?secret=YOUR_SECRET_KEY" \
  -H "Content-Type: application/json"
```

หรือใช้ API endpoint แบบ manual (ต้อง login เป็น admin):
```bash
# POST /api/admin/inventory-snapshot/create?year=2568&month=10
# ต้องมี Authorization header
```

### 3. ตรวจสอบ Vercel Cron Job

ถ้า deploy บน Vercel:
1. ไปที่ Vercel Dashboard → Project → Settings → Cron Jobs
2. ตรวจสอบว่า cron job สำหรับ `/api/admin/inventory-snapshot/auto-create` ถูก enable
3. ตรวจสอบ environment variable `VERCEL_SNAPSHOT_SECRET_KEY`
4. ดู logs ใน Functions tab เพื่อดูว่า cron job รันหรือไม่

### 4. สร้าง Snapshot สำหรับเดือนที่ผ่านมา

ใช้สคริปต์ทดสอบ:
```bash
node test-snapshot-creation.js
```

หรือเรียก API โดยระบุ month และ year:
```bash
curl -X POST "http://localhost:3000/api/admin/inventory-snapshot/auto-create?secret=YOUR_SECRET_KEY&month=10&year=2568" \
  -H "Content-Type: application/json"
```

## ไฟล์ที่เกี่ยวข้อง

- `src/lib/snapshot-helpers.ts` - ฟังก์ชัน `createSnapshotForMonth()`
- `src/app/api/admin/inventory-snapshot/auto-create/route.ts` - Auto-create endpoint
- `src/app/api/admin/inventory-snapshot/create/route.ts` - Manual create endpoint
- `src/models/InventorySnapshot.ts` - Model definition
- `vercel.json` - Vercel Cron configuration

## ⚠️ ปัญหาที่พบ

### 1. Vercel Cron Job ไม่มี Secret Key ใน URL
ใน `vercel.json` มีการตั้งค่า cron job แต่ไม่มี secret key:
```json
{
  "path": "/api/admin/inventory-snapshot/auto-create",
  "schedule": "0 0 1 * *"
}
```

**วิธีแก้**: โค้ดรองรับ environment variable `VERCEL_SNAPSHOT_SECRET_KEY` แล้ว แต่ต้องตั้งค่าไว้ใน Vercel Environment Variables

### 2. Environment Variable ไม่ได้ตั้งค่า
- สำหรับ Vercel: ต้องตั้งค่า `VERCEL_SNAPSHOT_SECRET_KEY` ใน Vercel Dashboard
- สำหรับ Local: ต้องตั้งค่า `SNAPSHOT_SECRET_KEY` ใน `.env.local`

### 3. การตรวจสอบ Secret Key
โค้ดจะตรวจสอบ secret key โดย:
- อ่านจาก query parameter `secret` หรือ
- อ่านจาก environment variable `VERCEL_SNAPSHOT_SECRET_KEY`

ถ้า secret key ไม่ถูกต้อง API จะ return 401 Unauthorized

## สรุป

ระบบ snapshot **ทำงานได้จริง** แต่ต้องตั้งค่าให้ถูกต้อง:
1. ✅ Model และ Schema ถูกต้อง
2. ✅ การบันทึกข้อมูลทำงานได้ (ทดสอบแล้ว)
3. ⚠️ **ต้องตั้งค่า Secret Key** ใน Environment Variables
4. ⚠️ **ต้องตั้งค่า Vercel Environment Variable** `VERCEL_SNAPSHOT_SECRET_KEY` (ถ้า deploy บน Vercel)
5. ⚠️ ต้องมีข้อมูล InventoryMaster เพื่อสร้าง snapshot

## ขั้นตอนถัดไป

### สำหรับ Local Development:
1. เพิ่มใน `.env.local`:
   ```env
   SNAPSHOT_SECRET_KEY=your-secret-key-here-change-this
   ```

2. ทดสอบสร้าง snapshot:
   ```bash
   node test-snapshot-creation.js
   ```

### สำหรับ Vercel Production:
1. ไปที่ Vercel Dashboard → Project → Settings → Environment Variables
2. เพิ่ม Environment Variable:
   - Key: `VERCEL_SNAPSHOT_SECRET_KEY`
   - Value: `your-secret-key-here-change-this` (ควรเป็นค่าที่แตกต่างจาก local)
   - Environment: Production, Preview, Development (เลือกตามต้องการ)

3. Redeploy project เพื่อให้ environment variable มีผล

4. ตรวจสอบ Vercel Cron Logs:
   - ไปที่ Vercel Dashboard → Project → Functions → Cron Jobs
   - ดู logs ว่ามี error หรือไม่

### ทดสอบสร้าง Snapshot สำหรับเดือนที่ผ่านมา:

**วิธีที่ 1: ใช้ API Manual (ต้อง login เป็น admin)**
```bash
# POST /api/admin/inventory-snapshot/create?year=2568&month=10
# ต้องมี Authorization header
```

**วิธีที่ 2: ใช้ Auto-Create API (ไม่ต้อง login แต่ต้องมี secret key)**
```bash
curl -X POST "http://localhost:3000/api/admin/inventory-snapshot/auto-create?secret=YOUR_SECRET_KEY&month=10&year=2568" \
  -H "Content-Type: application/json"
```

**วิธีที่ 3: ใช้สคริปต์ทดสอบ**
```bash
node test-snapshot-creation.js
```

