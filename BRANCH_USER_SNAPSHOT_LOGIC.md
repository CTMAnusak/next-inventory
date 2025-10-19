# Logic การจัดการข้อมูลผู้ใช้สาขา (Branch User) ✅

## หลักการสำคัญ

ผู้ใช้ประเภทสาขา (Branch User) มีข้อมูล **2 ประเภท**:

### 1. ข้อมูลสาขา (จาก User Collection)
- `office` - ชื่อสาขา
- `phone` - เบอร์โทรสาขา
- `email` - อีเมลสาขา

### 2. ข้อมูลส่วนตัว (จากฟอร์มที่กรอกในแต่ละครั้ง)
- `firstName` - ชื่อจริง
- `lastName` - นามสกุล
- `nickname` - ชื่อเล่น
- `department` - แผนก

---

## เหตุผลที่ต้องแยกการจัดการ

### ทำไมไม่เก็บข้อมูลส่วนตัวใน User Collection?

เพราะว่า **บัญชีสาขาเป็นบัญชีร่วม** (Shared Account):

```
User ID: U004
User Type: branch
Office: CTW

→ คนในสาขา CTW ทุกคนใช้บัญชีนี้ร่วมกัน
→ แต่ละครั้งที่เบิก/คืน อาจเป็นคนละคน
→ ดังนั้นต้องให้กรอกชื่อจริงในแต่ละครั้ง
```

### ตัวอย่างการใช้งานจริง

**สัปดาห์ที่ 1:**
- วันจันทร์: "สมชาย ใจดี" (แผนก Marketing) เบิกเมาส์
- วันพุธ: "สมหญิง รักงาน" (แผนก HR) เบิก Keyboard

**สัปดาห์ที่ 2:**
- วันจันทร์: "สมชาย ใจดี" กลับมาคืนเมาส์
- วันพฤหัส: "สมปอง มานะ" (แผนก Sales) เบิก USB

**ทั้งหมดใช้ User ID เดียวกัน แต่เป็นคนละคน!**

---

## การทำงานของ populateRequestLogUser

### กรณีที่ 1: User ยังอยู่ในระบบ

```typescript
if (user && user.userType === 'branch') {
  // ข้อมูลสาขา → ดึงจาก User Collection (ข้อมูลล่าสุด)
  populated.office = user.office;
  populated.phone = user.phone;
  populated.email = user.email;
  
  // ข้อมูลส่วนตัว → ดึงจากฟอร์ม (ที่กรอกตอนเบิก)
  populated.firstName = populated.requesterFirstName || '-';
  populated.lastName = populated.requesterLastName || '-';
  populated.nickname = populated.requesterNickname || '-';
  populated.department = populated.requesterDepartment || '-';
}
```

**ตัวอย่าง Output:**
```
ชื่อ: aaaa bbbb (cccc)
แผนก: Marketing
สาขา: CTW
เบอร์: 0285415656
```

### กรณีที่ 2: User ถูกลบแล้ว

```typescript
if (deletedUser && deletedUser.userType === 'branch') {
  // ข้อมูลส่วนตัว → ดึงจากฟอร์ม (ที่กรอกตอนเบิก)
  populated.firstName = populated.requesterFirstName || '-';
  populated.lastName = populated.requesterLastName || '-';
  populated.nickname = populated.requesterNickname || '-';
  populated.department = populated.requesterDepartment || '-';
  populated.phone = populated.requesterPhone || '-';
  populated.email = populated.requesterEmail || '-';
  
  // เฉพาะสาขา → ดึงจาก DeletedUsers (สาขาล่าสุดก่อนลบ)
  populated.office = deletedUser.office || populated.requesterOffice || '-';
}
```

**ตัวอย่าง Output:**
```
ชื่อ: aaaa bbbb (cccc)
แผนก: Marketing
สาขา: CTW (จาก DeletedUsers)
เบอร์: 0845641646 (จากฟอร์ม)
```

---

## การทำงานของ populateReturnLogUser

เหมือนกับ `populateRequestLogUser` ทุกประการ แต่ใช้ฟิลด์:
- `returnerFirstName` แทน `requesterFirstName`
- `returnerLastName` แทน `requesterLastName`
- `returnerNickname` แทน `requesterNickname`
- `returnerDepartment` แทน `requesterDepartment`
- `returnerPhone` แทน `requesterPhone`
- `returnerOffice` แทน `requesterOffice`

---

## เปรียบเทียบกับผู้ใช้ประเภทบุคคล (Individual User)

### Individual User
```typescript
if (user && user.userType === 'individual') {
  // ✅ ใช้ข้อมูลจาก User Collection ทั้งหมด (Real-time)
  populated.firstName = user.firstName;
  populated.lastName = user.lastName;
  populated.nickname = user.nickname;
  populated.department = user.department;
  populated.office = user.office;
  populated.phone = user.phone;
  populated.email = user.email;
}
```

**เหตุผล:** บัญชีบุคคลเป็นบัญชีส่วนตัว (1 คน = 1 บัญชี) ดังนั้นใช้ข้อมูลจาก User Collection ได้เลย

### Branch User
```typescript
if (user && user.userType === 'branch') {
  // ⚠️ ข้อมูลสาขาจาก User Collection
  // ✅ ข้อมูลส่วนตัวจากฟอร์ม
  populated.office = user.office;  // จาก DB
  populated.phone = user.phone;    // จาก DB
  populated.email = user.email;    // จาก DB
  
  populated.firstName = populated.requesterFirstName || '-';    // จากฟอร์ม
  populated.lastName = populated.requesterLastName || '-';      // จากฟอร์ม
  populated.nickname = populated.requesterNickname || '-';      // จากฟอร์ม
  populated.department = populated.requesterDepartment || '-';  // จากฟอร์ม
}
```

**เหตุผล:** บัญชีสาขาเป็นบัญชีร่วม (หลายคนใช้ร่วมกัน) ดังนั้นต้องเก็บชื่อจริงในแต่ละ transaction

---

## Flow การบันทึกและแสดงข้อมูล

### 1. เมื่อผู้ใช้สาขากรอกฟอร์มเบิกอุปกรณ์

```javascript
// Frontend (equipment-request/page.tsx)
const requestData = {
  firstName: "aaaa",      // ผู้ใช้กรอก
  lastName: "bbbb",       // ผู้ใช้กรอก
  nickname: "cccc",       // ผู้ใช้กรอก
  department: "Marketing",// ผู้ใช้กรอก
  phone: "0845641646",    // ผู้ใช้กรอก
  office: "CTW",          // ผู้ใช้กรอก (หรือ auto-fill จาก User)
  // ... items, requestDate, etc.
};
```

### 2. API บันทึกลง Database

```javascript
// Backend (api/equipment-request/route.ts)
const requestLogData = {
  userId: "U004",                              // จาก JWT
  requesterFirstName: "aaaa",                  // เก็บ snapshot
  requesterLastName: "bbbb",                   // เก็บ snapshot
  requesterNickname: "cccc",                   // เก็บ snapshot
  requesterDepartment: "Marketing",            // เก็บ snapshot
  requesterPhone: "0845641646",                // เก็บ snapshot
  requesterOffice: "CTW",                      // เก็บ snapshot
  requestDate: new Date(),
  items: [...],
  status: 'pending'
};

await RequestLog.create(requestLogData);
```

### 3. เมื่อแอดมินดูรายงาน

```javascript
// Backend (api/admin/equipment-reports/requests/route.ts)
const requests = await RequestLog.find({ requestType: 'request' });

// Populate ข้อมูล
const populatedRequests = await populateRequestLogCompleteBatch(requests);
// ↓
// populateRequestLogComplete() 
// ↓
// populateRequestLogUser()
// ↓
// ดึง User จาก DB โดยใช้ userId
// ↓
// ถ้าเป็น branch user:
//   - office, phone, email ← จาก User Collection
//   - firstName, lastName, etc. ← จาก requester* fields (snapshot)
```

### 4. Frontend แสดงผล

```javascript
// Frontend (admin/equipment-reports/page.tsx)
{log.firstName} {log.lastName} ({log.nickname})
แผนก: {log.department}
สาขา: {log.office}
เบอร์: {log.phone}

// Output: aaaa bbbb (cccc)
//         แผนก: Marketing
//         สาขา: CTW
//         เบอร์: 0285415656
```

---

## ข้อดีของการออกแบบแบบนี้

### ✅ ข้อดี

1. **ความถูกต้อง**: เห็นว่าใครเบิก/คืนอุปกรณ์จริงๆ ในแต่ละครั้ง
2. **การตรวจสอบ**: สามารถ audit trail ได้ชัดเจน
3. **ความยืดหยุ่น**: หากเปลี่ยนเบอร์สาขา ข้อมูลเก่าไม่เสียหาย
4. **ประสิทธิภาพ**: ไม่ต้อง join หลายตาราง (เก็บ snapshot ไว้)

### ⚠️ ข้อควรระวัง

1. **ข้อมูลซ้ำซ้อน**: เก็บข้อมูลเดิมซ้ำในทุก transaction (trade-off สำหรับ performance)
2. **ขนาด Database**: ขนาดใหญ่ขึ้นเล็กน้อย (แต่ไม่มีนัยสำคัญ)

---

## สรุป

### สำหรับผู้ใช้สาขา (Branch User)

| ข้อมูล | แหล่งที่มา | เหตุผล |
|--------|------------|--------|
| office | User Collection | ข้อมูลสาขา real-time |
| phone | User Collection | เบอร์สาขา real-time |
| email | User Collection | อีเมลสาขา real-time |
| firstName | ฟอร์มที่กรอก | คนละคนในแต่ละ transaction |
| lastName | ฟอร์มที่กรอก | คนละคนในแต่ละ transaction |
| nickname | ฟอร์มที่กรอก | คนละคนในแต่ละ transaction |
| department | ฟอร์มที่กรอก | คนละคนในแต่ละ transaction |

### สำหรับผู้ใช้บุคคล (Individual User)

| ข้อมูล | แหล่งที่มา | เหตุผล |
|--------|------------|--------|
| **ทุกฟิลด์** | User Collection | บัญชีส่วนตัว (1 คน = 1 บัญชี) |

---

## ไฟล์ที่เกี่ยวข้อง

- `src/lib/equipment-populate-helpers.ts` - Logic populate ข้อมูลผู้ใช้
- `src/models/RequestLog.ts` - Schema การเบิก (มี requester* fields)
- `src/models/ReturnLog.ts` - Schema การคืน (มี returner* fields)
- `src/app/api/equipment-request/route.ts` - บันทึกข้อมูลการเบิก
- `src/app/api/equipment-return/route.ts` - บันทึกข้อมูลการคืน

