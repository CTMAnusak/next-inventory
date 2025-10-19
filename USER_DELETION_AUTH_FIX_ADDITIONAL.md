# การแก้ไขเพิ่มเติม: เพิ่มการจัดการ 401 Error ในหน้าอื่นๆ

## ปัญหาที่พบเพิ่มเติม
ผู้ใช้ที่ถูกลบบัญชียังสามารถกดเมนูบางอันได้โดยไม่เด้งออกจากระบบ เพราะยังมีหน้าอื่นๆ ที่ไม่ได้เพิ่มการจัดการ 401 error

## หน้าที่ยังขาดการจัดการ 401 Error

### 1. IT Report Page (`src/app/it-report/page.tsx`)
**API Calls ที่เพิ่มการจัดการ 401 error:**
- `POST /api/it-report` - ส่งข้อมูลแจ้งปัญหา IT

```typescript
import { handleAuthError } from '@/lib/auth-error-handler';

const response = await fetch('/api/it-report', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(reportData),
});

// ✅ จัดการ 401/403 error - เด้งออกจากระบบทันที
if (handleAuthError(response)) {
  return;
}
```

### 2. Equipment Request Page (`src/app/equipment-request/page.tsx`)
**API Calls ที่เพิ่มการจัดการ 401 error:**
- `GET /api/admin/inventory/config` - ดึงข้อมูล config
- `GET /api/equipment-request/available` - ดึงข้อมูลอุปกรณ์ที่พร้อมเบิก
- `GET /api/admin/equipment-reports/available-items` - ดึงข้อมูล serial numbers
- `POST /api/equipment-request` - ส่งข้อมูลขอเบิกอุปกรณ์

```typescript
import { handleAuthError } from '@/lib/auth-error-handler';

// ใน fetchInventoryItems function
const configResponse = await fetch('/api/admin/inventory/config');
if (handleAuthError(configResponse)) {
  return;
}

const availableResponse = await fetch('/api/equipment-request/available');
if (handleAuthError(availableResponse)) {
  return;
}

// ใน fetchAvailableSerialNumbers function
const response = await fetch(`/api/admin/equipment-reports/available-items?...`);
if (handleAuthError(response)) {
  return;
}

// ใน handleSubmit function
const response = await fetch('/api/equipment-request', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(requestData),
});
if (handleAuthError(response)) {
  return;
}
```

### 3. IT Tracking Page (`src/app/it-tracking/page.tsx`)
**API Calls ที่เพิ่มการจัดการ 401 error:**
- `POST /api/user/approve-issue` - อนุมัติ/ปฏิเสธ issue

```typescript
import { handleAuthError } from '@/lib/auth-error-handler';

const response = await fetch('/api/user/approve-issue', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    issueId: selectedIssue._id,
    action: approvalAction,
    reason: reasonText
  }),
});

// ✅ จัดการ 401/403 error - เด้งออกจากระบบทันที
if (handleAuthError(response)) {
  return;
}
```

### 4. Close Issue Page (`src/app/close-issue/[issueId]/page.tsx`)
**API Calls ที่เพิ่มการจัดการ 401 error:**
- `GET /api/close-issue/${issueId}` - ดึงข้อมูล issue
- `POST /api/close-issue/${issueId}/close` - ปิดงาน
- `POST /api/close-issue/${issueId}/not-close` - บันทึกหมายเหตุไม่ปิดงาน

```typescript
import { handleAuthError } from '@/lib/auth-error-handler';

// ใน fetchIssue function
const response = await fetch(`/api/close-issue/${issueId}`);
if (handleAuthError(response)) {
  return;
}

// ใน handleCloseIssue function
const response = await fetch(`/api/close-issue/${issueId}/close`, {
  method: 'POST',
});
if (handleAuthError(response)) {
  return;
}

// ใน handleNotCloseIssue function
const response = await fetch(`/api/close-issue/${issueId}/not-close`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ notes }),
});
if (handleAuthError(response)) {
  return;
}
```

## ไฟล์ที่แก้ไขเพิ่มเติม
1. `src/app/it-report/page.tsx` - เพิ่มการจัดการ 401 error
2. `src/app/equipment-request/page.tsx` - เพิ่มการจัดการ 401 error ใน 4 API calls
3. `src/app/it-tracking/page.tsx` - เพิ่มการจัดการ 401 error ใน approve-issue API
4. `src/app/close-issue/[issueId]/page.tsx` - เพิ่มการจัดการ 401 error ใน 3 API calls

## ผลลัพธ์
✅ **ตอนนี้ทุกหน้าผู้ใช้จะเด้งออกจากระบบทันทีเมื่อผู้ใช้ถูกลบ**  
✅ **ไม่สามารถใช้งานหน้าเว็บได้อีกต่อไป**  
✅ **ครอบคลุมทุก API calls ที่สำคัญ**  
✅ **ใช้ centralized error handling ผ่าน `handleAuthError` utility**

## การทดสอบ
1. เข้าสู่ระบบด้วยบัญชีผู้ใช้
2. แอดมินลบบัญชีผู้ใช้จากระบบ
3. ลองใช้งานทุกหน้า:
   - Dashboard
   - Equipment Request
   - Equipment Return
   - IT Report
   - IT Tracking
   - Close Issue
4. ผู้ใช้จะถูกเด้งออกจากระบบทันทีเมื่อเรียก API ใดๆ
5. ไม่สามารถใช้งานหน้าเว็บได้อีกต่อไป
