# 📋 คู่มือการ Migrate Status System

## 🎯 วัตถุประสงค์

การเปลี่ยนระบบ Status จาก **String-based** เป็น **ID-based** เพื่อ:
- ✅ รองรับการเปลี่ยนชื่อสถานะโดยไม่กระทบข้อมูลเดิม
- ✅ เพิ่มความยืดหยุ่นในการจัดการสถานะ
- ✅ รองรับ Drag & Drop เรียงลำดับ
- ✅ มีความสอดคล้องกับระบบ Category ที่มีอยู่

## 🏗️ โครงสร้างใหม่

### เดิม (String-based):
```typescript
status: 'active' | 'maintenance' | 'damaged' | 'retired'
```

### ใหม่ (ID-based):
```typescript
statusId: string  // เช่น 'status_active', 'status_maintenance'
```

พร้อม StatusConfig:
```typescript
interface IStatusConfig {
  id: string;        // 'status_active'
  name: string;      // 'ใช้งานได้'
  order: number;     // สำหรับ drag & drop
  createdAt: Date;
  updatedAt: Date;
}
```

## 🚀 วิธีการ Migration

### 1. **Dry Run (ทดสอบก่อน)**
```bash
npm run migrate-status-dry-run
```

### 2. **Execute Migration (ทำจริง)**
```bash
npm run migrate-status-execute
```

### 3. **Rollback (ยกเลิก)**
```bash
npm run migrate-status-rollback
```

## 🛠️ Utility Scripts (เพิ่มเติม)

### 4. **ทำความสะอาด Database**
```bash
npm run cleanup-config        # ลบ fields เก่าที่ไม่จำเป็น
npm run remove-statuses-field # ลบ statuses field เก่า
```

### 5. **แก้ไขปัญหา**
```bash
npm run fix-statusconfigs     # แก้ปัญหา statusConfigs หายใน UI
npm run add-sample-status     # เพิ่ม sample statusConfig
```

## 📊 ขั้นตอนการ Migration

### Step 1: การเตรียมตัว
1. ✅ วิเคราะห์ statuses ที่มีอยู่จริงใน Database
2. ✅ สร้าง StatusConfigs จาก statuses จริง (ไม่ใช่ default)
3. ✅ Backup ข้อมูลเดิม

### Step 2: การวิเคราะห์
1. ✅ นับจำนวน Status ที่ใช้งานอยู่
2. ✅ สร้าง Mapping Table (status string → statusId)
3. ✅ แสดงรายงานผลกระทบ

### Step 3: การ Migration
1. ✅ เพิ่ม `statusId` field ใน InventoryItem
2. ⚠️ ยังคง `status` field เก่าไว้ (Backward Compatibility)
3. ✅ อัปเดต UI ให้ใช้ statusId

### Step 4: การตรวจสอบ
1. ✅ ทดสอบการแสดงผล
2. ✅ ทดสอบการ Filter
3. ✅ ทดสอบการ CRUD Status

## 🔧 การใช้งาน API

### GET Status Migration Info
```bash
curl http://localhost:3000/api/admin/migrate-status-to-id
```
**Response:** ข้อมูล API endpoints และวิธีการใช้งาน

### POST Dry Run
```bash
curl -X POST http://localhost:3000/api/admin/migrate-status-to-id \
  -H "Content-Type: application/json" \
  -d '{"action":"migrate","dryRun":true}'
```
**Response:** ผลการทดสอบ migration โดยไม่เปลี่ยนแปลงข้อมูลจริง

### POST Execute Migration
```bash
curl -X POST http://localhost:3000/api/admin/migrate-status-to-id \
  -H "Content-Type: application/json" \
  -d '{"action":"migrate","dryRun":false}'
```
**Response:** ผลการ migrate ข้อมูลจริง

### POST Rollback
```bash
curl -X POST http://localhost:3000/api/admin/migrate-status-to-id \
  -H "Content-Type: application/json" \
  -d '{"action":"rollback"}'
```
**Response:** ผลการยกเลิก migration และกู้คืนข้อมูลเดิม

## 🧹 การจัดการ Database

### ทำความสะอาดหลัง Migration
```bash
# ลบ fields เก่าที่ไม่จำเป็น
npm run cleanup-config

# ลบ statuses field เก่าโดยเฉพาะ
npm run remove-statuses-field
```

### แก้ไขปัญหาที่พบบ่อย
```bash
# แก้ปัญหา statusConfigs หายใน MongoDB Atlas UI
npm run fix-statusconfigs

# เพิ่ม sample statusConfig เพื่อทดสอบ
npm run add-sample-status
```

## 📁 ไฟล์ที่เกี่ยวข้อง

### Helper Functions
- `src/lib/status-helpers.ts` - ฟังก์ชันแปลง ID ↔ Name
- `src/lib/status-backup-helpers.ts` - ระบบ Backup

### Migration Scripts
- `src/scripts/migrate-status-to-id.ts` - Main migration script
- `src/app/api/admin/migrate-status-to-id/route.ts` - API endpoint

### Utility Scripts (ใหม่)
- `src/scripts/cleanup-inventory-config.ts` - ทำความสะอาด database
- `src/scripts/fix-statusconfigs.ts` - แก้ปัญหา statusConfigs หายใน UI
- `src/scripts/add-sample-statusconfig.ts` - เพิ่ม sample statusConfig
- `src/scripts/remove-statuses-field.ts` - ลบ statuses field เก่า

### Updated Components
- `src/app/admin/inventory/page.tsx` - Admin inventory UI
- `src/components/StatusConfigList.tsx` - Status management UI

## ⚠️ ข้อควรระวัง

### ก่อน Migration:
1. **Backup Database** ทั้งหมด
2. **ทดสอบใน Development** ก่อน
3. **แจ้งผู้ใช้** เรื่องการหยุดระบบชั่วคราว

### หลัง Migration:
1. **ทดสอบการทำงาน** ทุกฟีเจอร์
2. **ตรวจสอบ Performance**
3. **Monitor Error Logs**

## 🔙 Backward Compatibility

ระบบใหม่รองรับ:
- ✅ Status string เก่า (จะแปลงอัตโนมัติ)
- ✅ Status ID ใหม่
- ✅ การแสดงชื่อไทย/อังกฤษ
- ✅ การ Filter แบบเก่าและใหม่

## 📈 การ Monitor

### Log Messages ที่ควรติดตาม:
```
✅ [create-config] Created default status configurations
✅ [analyze] Data analysis completed  
✅ [mapping] Status mapping created
✅ [backup] Current data backed up successfully
✅ [migration] Migration completed successfully
```

### Error Messages ที่ควรระวัง:
```
❌ [create-config] Failed to create status configurations
❌ [backup] Failed to backup current data
❌ [migration] Migration failed
```

## 🆘 การแก้ไขปัญหา

### ปัญหา: Migration หยุดกึ่งกลาง
**วิธีแก้:**
```bash
npm run migrate-status-rollback
# ตรวจสอบ logs และรัน migrate ใหม่
```

### ปัญหา: แสดงสถานะไม่ถูกต้อง
**วิธีแก้:**
1. ตรวจสอบ statusConfigs ใน Database
2. ตรวจสอบ statusId mapping
3. Clear cache และ refresh

### ปัญหา: Filter ไม่ทำงาน
**วิธีแก้:**
1. ตรวจสอบ matchesStatusFilter function
2. ตรวจสอบ statusConfigs ใน UI
3. ตรวจสอบ API response

### ปัญหา: statusConfigs หายใน MongoDB Atlas UI
**วิธีแก้:**
```bash
npm run fix-statusconfigs
# Force set statusConfigs field เป็น empty array
```

### ปัญหา: Database มี fields เก่าที่ไม่จำเป็น
**วิธีแก้:**
```bash
npm run cleanup-config
# ลบ createdAt, updatedAt, __v, statuses fields
```

### ปัญหา: statuses field เก่ายังคงกลับมา
**วิธีแก้:**
```bash
npm run remove-statuses-field
# ลบ statuses field เก่าออกให้หมดจด
```

## 📞 การติดต่อ

หากพบปัญหาหรือต้องการความช่วยเหลือ:
1. ตรวจสอบ Console Logs
2. ดู Migration Summary Table
3. ทำ Rollback หากจำเป็น

---

## 🎉 สำเร็จแล้ว!

เมื่อ Migration เสร็จสิ้น คุณจะได้:
- ✅ ระบบ Status ที่ยืดหยุ่น
- ✅ การจัดการสถานะแบบ Drag & Drop
- ✅ ความสามารถในการเปลี่ยนชื่อสถานะ
- ✅ การ Backup แบบ 2 ไฟล์ตามต้องการ
- ✅ เครื่องมือ Utility Scripts สำหรับการบำรุงรักษา
- ✅ Database ที่สะอาดและเป็นระเบียบ

## 📝 บันทึกการอัปเดต

**อัปเดตล่าสุด:** September 2025
- เพิ่ม Utility Scripts สำหรับการจัดการ Database
- ปรับปรุง API documentation ให้ละเอียดขึ้น
- เพิ่มวิธีแก้ไขปัญหาที่พบบ่อย
- อัปเดตรายชื่อไฟล์ที่เกี่ยวข้องให้ครบถ้วน
