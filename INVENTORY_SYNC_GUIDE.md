# 📋 คู่มือแก้ไขปัญหาการซิงค์จำนวนอุปกรณ์

## 🔍 ปัญหาที่พบ
เมื่อใช้ Stock Management เพื่อปรับจำนวนอุปกรณ์ จำนวนใน `inventoryitems` และ `inventorymasters` ไม่ตรงกัน เนื่องจากระบบใช้ **soft delete** (เปลี่ยน status เป็น 'deleted') แทนการลบจริง

**ตัวอย่าง:**
- `inventoryitems`: แสดง 8 รายการ (5 active + 3 soft deleted)
- `inventorymasters`: แสดง 5 รายการ (ถูกต้อง)

## 🛠️ วิธีแก้ไข

### 1. ใช้ Script (แนะนำ)

#### ตรวจสอบปัญหาทั้งหมด
```bash
node fix-inventory-count-sync.js --check-only
```

#### แก้ไขเฉพาะอุปกรณ์ที่มีปัญหา
```bash
# แก้ไขเฉพาะ Dell01
node fix-inventory-count-sync.js --item="Dell01"

# แก้ไขเฉพาะหมวดหมู่
node fix-inventory-count-sync.js --category="คอมพิวเตอร์และอุปกรณ์ต่อพ่วง"

# ตรวจสอบเฉพาะ Dell01
node fix-inventory-count-sync.js --item="Dell01" --check-only
```

#### แก้ไขทุกรายการ (ระวัง!)
```bash
node fix-inventory-count-sync.js
```

### 2. ใช้ API Endpoints

#### 2.1 ตรวจสอบปัญหา (GET)

```bash
# ตรวจสอบทุกรายการ
curl "http://localhost:3000/api/admin/cleanup-deleted-items" \
  -H "Cookie: auth-token=YOUR_TOKEN"

# ตรวจสอบเฉพาะ Dell01
curl "http://localhost:3000/api/admin/cleanup-deleted-items?itemName=Dell01&category=คอมพิวเตอร์และอุปกรณ์ต่อพ่วง" \
  -H "Cookie: auth-token=YOUR_TOKEN"

# ดูเฉพาะรายการที่ถูก soft delete
curl "http://localhost:3000/api/admin/cleanup-deleted-items?type=soft-deleted-only" \
  -H "Cookie: auth-token=YOUR_TOKEN"
```

#### 2.2 แก้ไขปัญหา (POST)

**แก้ไขเฉพาะรายการ:**
```bash
curl -X POST "http://localhost:3000/api/admin/cleanup-deleted-items" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{
    "cleanupType": "specific",
    "itemName": "Dell01",
    "category": "คอมพิวเตอร์และอุปกรณ์ต่อพ่วง"
  }'
```

**ตรวจสอบก่อนแก้ไข (Dry Run):**
```bash
curl -X POST "http://localhost:3000/api/admin/cleanup-deleted-items" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{
    "cleanupType": "specific",
    "itemName": "Dell01",
    "category": "คอมพิวเตอร์และอุปกรณ์ต่อพ่วง",
    "dryRun": true
  }'
```

**แก้ไขหลายรายการพร้อมกัน:**
```bash
curl -X POST "http://localhost:3000/api/admin/cleanup-deleted-items" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{
    "cleanupType": "batch",
    "items": [
      {"itemName": "Dell01", "category": "คอมพิวเตอร์และอุปกรณ์ต่อพ่วง"},
      {"itemName": "Mouse01", "category": "คอมพิวเตอร์และอุปกรณ์ต่อพ่วง"}
    ]
  }'
```

**แก้ไขทุกรายการ (ระวัง!):**
```bash
curl -X POST "http://localhost:3000/api/admin/cleanup-deleted-items" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=YOUR_TOKEN" \
  -d '{
    "cleanupType": "all"
  }'
```

## 🔧 การแก้ไขที่ทำไปแล้ว

### 1. ปรับปรุง `syncAdminStockItems()` function
- เปลี่ยนจาก soft delete เป็น **hard delete** สำหรับรายการที่ไม่มี Serial Number
- ป้องกันปัญหาการนับจำนวนไม่ตรงกันในอนาคต

### 2. เพิ่ม `cleanupSoftDeletedItems()` function
- ทำความสะอาดรายการที่ถูก soft delete แล้วในระบบ
- รองรับการทำความสะอาดเฉพาะรายการ หรือทั้งระบบ
- สร้าง transfer log ก่อนลบเพื่อ audit trail

### 3. สร้าง API endpoints
- GET: วิเคราะห์ปัญหาการซิงค์แบบละเอียด
- POST: แก้ไขปัญหาด้วยตัวเลือกต่างๆ (specific, batch, all)
- รองรับ dry run mode เพื่อตรวจสอบก่อนแก้ไข

### 4. สร้าง Script ทั่วไป
- รองรับการแก้ไขทุกประเภทอุปกรณ์
- มี command line options ที่ยืดหยุ่น
- แสดงรายงานผลการทำงานที่ละเอียด

## ⚠️ ข้อควรระวัง

1. **สำรองข้อมูลก่อนใช้งาน** - แม้ว่าจะมี transfer log แต่การลบรายการเป็น permanent
2. **ทดสอบด้วย `--check-only` หรือ `dryRun: true` ก่อน** - เพื่อดูผลกระทบ
3. **รัน script ในเวลาที่ผู้ใช้น้อย** - เพื่อหลีกเลี่ยงการขัดแย้งข้อมูล
4. **ตรวจสอบ transfer logs** - เพื่อ audit trail ของการเปลี่ยนแปลง

## 🎯 แนวทางป้องกัน

1. **ใช้ Stock Management อย่างระวัง** - ตรวจสอบจำนวนก่อนปรับ
2. **ตรวจสอบความสอดคล้องเป็นประจำ** - ใช้ GET API เพื่อ monitor
3. **ใช้ Serial Number สำหรับอุปกรณ์สำคัญ** - ป้องกันการลบโดยไม่ตั้งใจ
4. **สำรองข้อมูลเป็นประจำ** - ใช้ backup scripts ที่มีอยู่

## 📞 การติดต่อ

หากพบปัญหาหรือต้องการความช่วยเหลือ:
1. ตรวจสอบ logs ใน console
2. ใช้ `--help` หรือ `-h` กับ script
3. ตรวจสอบ transfer logs ใน database
4. ติดต่อ IT Admin สำหรับการสนับสนุน

---

**📝 หมายเหตุ:** คู่มือนี้อัพเดตล่าสุดเมื่อ ${new Date().toLocaleDateString('th-TH')} เพื่อแก้ไขปัญหาการซิงค์จำนวนอุปกรณ์ที่ไม่ตรงกันระหว่าง inventoryitems และ inventorymasters
