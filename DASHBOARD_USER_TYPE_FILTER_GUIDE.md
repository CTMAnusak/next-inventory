# คู่มือฟีเจอร์ฟิลเตอร์ผู้ใช้ในหน้า Dashboard

## สรุปการแก้ไข

เพิ่มฟีเจอร์ฟิลเตอร์ผู้ใช้ตามประเภท (userType) ในหน้า `/admin/dashboard` เพื่อให้สามารถกรองข้อมูลสถิติต่างๆ ได้ตามประเภทผู้ใช้

## ฟีเจอร์ที่เพิ่ม

### 1. Dropdown ฟิลเตอร์ผู้ใช้
- **ทั้งหมด**: แสดงข้อมูลทั้งหมด (ไม่กรอง)
- **ผู้ใช้ประเภทบุคคล**: กรองเฉพาะผู้ใช้ที่มี `userType = 'individual'`
- **ผู้ใช้ประเภทสาขา**: กรองเฉพาะผู้ใช้ที่มี `userType = 'branch'`

### 2. กล่องข้อมูลที่ได้รับการกรอง

เมื่อเลือกฟิลเตอร์ ข้อมูลในกล่องต่อไปนี้จะถูกกรองตามประเภทผู้ใช้:

#### การ์ดด้านบน (ทั้งหมด - ไม่อิงเดือน/ปี)
1. **แจ้งงาน IT ทั้งหมด** - นับจาก IssueLog ที่ requesterId ตรงกับ userType
2. **User เพิ่มเองทั้งหมด** - นับจาก InventoryItem ที่ currentOwnership.userId ตรงกับ userType
3. **เบิกอุปกรณ์ทั้งหมด** - นับจาก RequestLog ที่ userId ตรงกับ userType
4. **คืนอุปกรณ์ทั้งหมด** - นับจาก ReturnLog ที่ userId ตรงกับ userType
5. **ผู้ใช้งานทั้งหมด** - นับจาก User ที่ userType ตรงกับที่เลือก
6. **จำนวนคลังสินค้าทั้งหมด** - ไม่กรอง (แสดงทั้งหมด)
7. **รายการเบิกได้ที่ใกล้หมด (≤ 2)** - ไม่กรอง (แสดงทั้งหมด)

#### กล่อง "สถานะแจ้งงาน IT" (อิงช่วงเวลา)
- รอดำเนินการ
- ดำเนินการแล้ว
- เสร็จสิ้นแล้ว
- ปิดงานแล้ว
- ด่วนมาก
- ปกติ

#### กล่อง "สถานะคลังสินค้า" (อิงช่วงเวลา)
- จำนวนทั้งหมด - ไม่กรอง (แสดงทั้งหมด)
- รายการอุปกรณ์ที่ใกล้หมด (≤ 2) - ไม่กรอง (แสดงทั้งหมด)

#### กล่อง "สรุป" (อิงช่วงเวลา)
- แจ้งงาน IT
- เบิกอุปกรณ์
- คืนอุปกรณ์
- User เพิ่มเองทั้งหมด

#### กราฟและแผนภูมิ
1. **แจ้งงาน IT ตามประเภท** - กรองตาม userType
2. **เบิกอุปกรณ์ตามความเร่งด่วน** - กรองตาม userType

## การทำงานภายใน

### Frontend (page.tsx)
```typescript
// เพิ่ม state สำหรับ userType filter
const [selectedUserType, setSelectedUserType] = useState<'all' | 'individual' | 'branch'>('all');

// ส่ง parameter ไปยัง API
const url = `/api/admin/dashboard?month=${selectedMonth}&year=${selectedYear}&userType=${selectedUserType}`;
```

### Backend (route.ts)
```typescript
// รับ parameter จาก query string
const userTypeParam = searchParams.get('userType') || 'all';

// สร้าง array ของ user_id ที่ตรงกับ userType
let userIdsForFilter: string[] | null = null;
if (userTypeParam !== 'all') {
  const usersWithType = await User.find({ 
    userType: userTypeParam,
    pendingDeletion: { $ne: true }
  }).select('user_id').lean();
  userIdsForFilter = usersWithType.map(u => u.user_id);
}

// ใช้ userIdsForFilter ในการกรอง queries
```

### การกรองข้อมูลแต่ละ Collection

#### 1. IssueLog
- ใช้ field: `requesterId` (เก็บ User.user_id)
- กรอง: `{ requesterId: { $in: userIdsForFilter } }`

#### 2. RequestLog
- ใช้ field: `userId` (เก็บ User.user_id)
- กรอง: `{ userId: { $in: userIdsForFilter } }`

#### 3. ReturnLog
- ใช้ field: `userId` (เก็บ User.user_id)
- กรอง: `{ userId: { $in: userIdsForFilter } }`

#### 4. InventoryItem
- ใช้ field: `currentOwnership.userId` (เก็บ User.user_id)
- กรอง: `{ 'currentOwnership.userId': { $in: userIdsForFilter } }`

#### 5. User
- ใช้ field: `user_id` และ `userType`
- กรอง: `{ user_id: { $in: userIdsForFilter } }`

## ข้อมูลที่ไม่ถูกกรอง

ข้อมูลต่อไปนี้จะแสดงทั้งหมดไม่ว่าจะเลือกฟิลเตอร์อะไร:
1. **จำนวนคลังสินค้าทั้งหมด** - เพราะเป็นข้อมูลของระบบโดยรวม
2. **รายการเบิกได้ที่ใกล้หมด (≤ 2)** - เพราะเป็นข้อมูลของระบบโดยรวม
3. **สถานะคลังสินค้า (อิงช่วงเวลา)** - เพราะเป็นข้อมูลของระบบโดยรวม

## Cache Management

Cache key ได้รับการปรับปรุงให้รวม userType parameter:
```typescript
const cacheKey = `dashboard_${year}_${monthParam || 'all'}_${userTypeParam}`;
```

## การทดสอบ

### ขั้นตอนการทดสอบ:
1. เข้าหน้า `/admin/dashboard`
2. ทดสอบเลือกฟิลเตอร์ "ทั้งหมด" - ควรแสดงข้อมูลทั้งหมด
3. ทดสอบเลือกฟิลเตอร์ "ผู้ใช้ประเภทบุคคล" - ควรแสดงเฉพาะข้อมูลของผู้ใช้บุคคล
4. ทดสอบเลือกฟิลเตอร์ "ผู้ใช้ประเภทสาขา" - ควรแสดงเฉพาะข้อมูลของผู้ใช้สาขา
5. ทดสอบร่วมกับฟิลเตอร์เดือน/ปี - ควรทำงานร่วมกันได้
6. ทดสอบปุ่ม "รีเฟรช" - ควร clear cache และดึงข้อมูลใหม่
7. ทดสอบปุ่ม "Export Excel" - ควร export ข้อมูลตามฟิลเตอร์ที่เลือก

### ตรวจสอบข้อมูลที่ควรเปลี่ยน:
- ✅ แจ้งงาน IT ทั้งหมด
- ✅ User เพิ่มเองทั้งหมด
- ✅ เบิกอุปกรณ์ทั้งหมด
- ✅ คืนอุปกรณ์ทั้งหมด
- ✅ ผู้ใช้งานทั้งหมด
- ✅ สถานะแจ้งงาน IT (ทุกสถานะ)
- ✅ กราฟแจ้งงาน IT ตามประเภท
- ✅ กราฟเบิกอุปกรณ์ตามความเร่งด่วน
- ✅ สรุป (แจ้งงาน IT, เบิกอุปกรณ์, คืนอุปกรณ์, User เพิ่มเอง)

### ตรวจสอบข้อมูลที่ไม่ควรเปลี่ยน:
- ✅ จำนวนคลังสินค้าทั้งหมด
- ✅ รายการเบิกได้ที่ใกล้หมด (≤ 2)
- ✅ สถานะคลังสินค้า (อิงช่วงเวลา)

## ไฟล์ที่แก้ไข

1. **src/app/admin/dashboard/page.tsx**
   - เพิ่ม state `selectedUserType`
   - เพิ่ม dropdown ฟิลเตอร์ userType
   - ส่ง parameter `userType` ไปยัง API

2. **src/app/api/admin/dashboard/route.ts**
   - รับ parameter `userType` จาก query string
   - สร้าง `userIdsForFilter` array
   - แก้ไข queries ทั้งหมดให้รองรับการกรอง userType
   - อัพเดท cache key ให้รวม userType

## Performance Considerations

- ใช้ `lean()` เพื่อลด memory overhead
- ใช้ aggregation pipeline สำหรับ queries ที่ซับซ้อน
- Cache results ตาม userType parameter
- ดึง user IDs ครั้งเดียวแล้วใช้ซ้ำในทุก query

## สรุป

ฟีเจอร์นี้ช่วยให้ Admin สามารถวิเคราะห์ข้อมูลแยกตามประเภทผู้ใช้ได้ เพื่อเข้าใจพฤติกรรมการใช้งานของผู้ใช้แต่ละประเภทได้ดีขึ้น และสามารถวางแผนการจัดการทรัพยากรได้อย่างมีประสิทธิภาพมากขึ้น

