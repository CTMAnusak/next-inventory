# คู่มือการลบการเก็บสีออกจากระบบ

## สรุปการเปลี่ยนแปลง

ได้ทำการลบการเก็บสีออกจากระบบทั้งหมดแล้ว โดยมีการเปลี่ยนแปลงดังนี้:

### 1. Models ที่เปลี่ยนแปลง
- **src/models/InventoryConfig.ts**
  - ลบฟิลด์ `color` ออกจาก interface `IConditionConfig`
  - ลบฟิลด์ `color` ออกจาก `ConditionConfigSchema`
  - อัปเดต `DEFAULT_CONDITION_CONFIGS` ให้ไม่มีสี
  - อัปเดต `createConditionConfig` function ให้ไม่รับพารามิเตอร์สี

### 2. Components ที่เปลี่ยนแปลง
- **src/components/ConditionConfigList.tsx**
  - ลบการแสดงสี indicator
  - อัปเดต interface `IConditionConfig` ให้ไม่มีฟิลด์สี
  - ลบการจัดการสีในการ reorder

### 3. API Routes ที่เปลี่ยนแปลง
- **src/app/api/admin/inventory-config/route.ts**
  - ลบการจัดการสีในการสร้าง condition ใหม่
- **src/app/api/admin/inventory/config/route.ts**
  - ลบการส่งสีใน response
  - ลบการจัดการสีในการอัปเดต
- **src/app/api/admin/inventory-config/conditions/route.ts**
  - ลบการรับพารามิเตอร์สีในการสร้าง condition ใหม่
- **src/app/api/admin/inventory-config/conditions/[id]/route.ts**
  - ลบการจัดการสีในการแก้ไข condition

## วิธีการลบข้อมูลในฐานข้อมูล

### วิธีที่ 1: ใช้ MongoDB Compass (แนะนำ)

1. เปิด MongoDB Compass
2. เชื่อมต่อกับฐานข้อมูลของคุณ
3. เลือก database `next-inventory`
4. ไปที่ collection `inventoryconfigs`
5. คลิกปุ่ม "Delete" หรือ "Trash" icon
6. เลือก "Delete All Documents" หรือ "Delete Many"
7. ยืนยันการลบ

### วิธีที่ 2: ใช้ MongoDB Shell

```bash
# เชื่อมต่อ MongoDB
mongosh

# เลือก database
use next-inventory

# ตรวจสอบข้อมูลที่มีอยู่
db.inventoryconfigs.find().count()

# ลบข้อมูลทั้งหมดใน collection
db.inventoryconfigs.deleteMany({})

# ตรวจสอบว่าลบหมดแล้ว
db.inventoryconfigs.find().count()
```

### วิธีที่ 3: ใช้สคริปต์ที่เตรียมไว้

```bash
# รันสคริปต์เพื่อลบข้อมูลทั้งหมดใน collection "inventoryconfigs"
node clear-inventory-configs-mongoose.js
```

**หมายเหตุ**: สคริปต์จะทำงานได้เมื่อ MongoDB กำลังรันอยู่และสามารถเชื่อมต่อได้

### วิธีที่ 4: ลบฟิลด์ color จากข้อมูลที่มีอยู่

หากคุณได้ลบข้อมูลแล้ว แต่ระบบสร้างข้อมูลใหม่ที่ยังมีฟิลด์ `color` อยู่:

```bash
# รันสคริปต์เพื่อลบฟิลด์ color ออกจากข้อมูลที่มีอยู่
node remove-color-fields.js
```

### วิธีที่ 5: สร้างข้อมูล default ใหม่ที่ไม่มีสี

หากคุณต้องการสร้างข้อมูล default configs ใหม่ที่ไม่มีสี:

```bash
# รันสคริปต์เพื่อสร้างข้อมูล default ใหม่
node create-default-configs.js
```

### วิธีที่ 6: ใช้ MongoDB Atlas (หากใช้ Cloud)

1. เข้าสู่ MongoDB Atlas Dashboard
2. เลือก Cluster ของคุณ
3. คลิก "Browse Collections"
4. เลือก database `next-inventory`
5. เลือก collection `inventoryconfigs`
6. ใช้ Filter `{}` เพื่อเลือกข้อมูลทั้งหมด
7. คลิก "Delete" และยืนยัน

## การตรวจสอบผลลัพธ์

หลังจากลบข้อมูลแล้ว ระบบจะสร้างข้อมูลใหม่โดยอัตโนมัติเมื่อมีการเข้าถึงหน้า Admin Configuration โดยจะไม่มีสีในส่วนของ Condition Configs

### ข้อมูลที่ระบบจะสร้างใหม่:
- **Status Configs**: มี, หาย (ไม่มีสี)
- **Condition Configs**: ใช้งานได้, ชำรุด (ไม่มีสี)
- **Category Configs**: ซิมการ์ด, ไม่ระบุ

## หมายเหตุสำคัญ

1. **การสำรองข้อมูล**: ควรสำรองข้อมูลก่อนลบ (หากต้องการ)
2. **การทดสอบ**: ควรทดสอบระบบหลังจากการเปลี่ยนแปลง
3. **การอัปเดต**: ระบบจะทำงานได้ปกติโดยไม่มีสีในส่วนของ Condition Configs

## การย้อนกลับ (หากจำเป็น)

หากต้องการย้อนกลับการเปลี่ยนแปลง สามารถ:
1. ใช้ git เพื่อย้อนกลับไฟล์ที่เปลี่ยนแปลง
2. กู้คืนข้อมูลจาก backup (หากมี)
3. เพิ่มฟิลด์สีกลับเข้าไปในระบบ

## ไฟล์ที่เปลี่ยนแปลงทั้งหมด

- `src/models/InventoryConfig.ts`
- `src/components/ConditionConfigList.tsx`
- `src/app/api/admin/inventory-config/route.ts`
- `src/app/api/admin/inventory/config/route.ts`
- `src/app/api/admin/inventory-config/conditions/route.ts`
- `src/app/api/admin/inventory-config/conditions/[id]/route.ts`

## สคริปต์ที่สร้างขึ้น

- `clear-inventory-configs.js` - สคริปต์สำหรับลบข้อมูลในฐานข้อมูล
- `COLOR_REMOVAL_GUIDE.md` - คู่มือนี้
