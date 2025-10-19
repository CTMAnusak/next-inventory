# การแก้ไขปัญหา: ผู้ใช้ถูกลบแล้วยังใช้งานหน้าเว็บได้

## ปัญหาที่พบ
เมื่อแอดมินลบผู้ใช้จากระบบ ผู้ใช้ที่ถูกลบยังสามารถใช้งานหน้าเว็บได้ (กดเมนูต่างๆ กรอกฟอร์มได้) แทนที่จะถูกเด้งออกจากระบบทันที

## สาเหตุของปัญหา
1. **API routes ส่งคืน 401 Unauthorized** เมื่อผู้ใช้ถูกลบจาก database
2. **Client-side ไม่ได้จัดการ 401 error** ให้เด้งออกจากระบบ
3. **AuthContext มีการจัดการ 401 แล้ว** แต่เฉพาะใน `checkAuth()` function เท่านั้น

## การแก้ไข

### 1. สร้าง Auth Error Handler Utility
สร้างไฟล์ `src/lib/auth-error-handler.ts`:
```typescript
export function handleAuthError(response: Response): boolean {
  if (response.status === 401) {
    console.log('❌ User authentication failed (401), redirecting to login');
    if (typeof window !== 'undefined') {
      window.location.href = '/login?error=session_expired';
    }
    return true;
  }
  
  if (response.status === 403) {
    console.log('❌ User access denied (403), redirecting to login');
    if (typeof window !== 'undefined') {
      window.location.href = '/login?error=access_denied';
    }
    return true;
  }
  
  return false;
}
```

### 2. อัปเดต AuthContext
ใช้ `handleAuthError` ใน `checkAuth()` function:
```typescript
import { handleAuthError } from '@/lib/auth-error-handler';

// ใน checkAuth function
if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
  console.log('❌ AuthContext: Authentication failed, redirecting to login');
  handleAuthError(response);
}
```

### 3. อัปเดต Client-side Pages
เพิ่มการจัดการ 401 error ในหน้าสำคัญ:

#### Dashboard Page (`src/app/dashboard/page.tsx`)
```typescript
import { handleAuthError } from '@/lib/auth-error-handler';

const ownedRes = await fetch(`/api/user/owned-equipment?${withUserId.toString()}`, {
  signal: controller.signal,
  cache: 'no-cache',
  headers: {
    'Cache-Control': 'no-cache'
  }
});

// ✅ จัดการ 401/403 error - เด้งออกจากระบบทันที
if (handleAuthError(ownedRes)) {
  return;
}
```

#### Equipment Return Page (`src/app/equipment-return/page.tsx`)
```typescript
import { handleAuthError } from '@/lib/auth-error-handler';

const res = await fetch(`/api/user/owned-equipment?${params.toString()}`);

// ✅ จัดการ 401/403 error - เด้งออกจากระบบทันที
if (handleAuthError(res)) {
  return;
}
```

#### IT Tracking Page (`src/app/it-tracking/page.tsx`)
```typescript
import { handleAuthError } from '@/lib/auth-error-handler';

const response = await fetch('/api/user/issues');

// ✅ จัดการ 401/403 error - เด้งออกจากระบบทันที
if (handleAuthError(response)) {
  return;
}
```

## ผลลัพธ์
- ✅ เมื่อผู้ใช้ถูกลบจากระบบ จะถูกเด้งออกจากระบบทันที
- ✅ ไม่สามารถใช้งานหน้าเว็บได้อีกต่อไป
- ✅ Redirect ไปหน้า login พร้อม error message
- ✅ จัดการทั้ง 401 (Unauthorized) และ 403 (Forbidden) errors

## ไฟล์ที่แก้ไข
1. `src/lib/auth-error-handler.ts` - สร้างใหม่
2. `src/contexts/AuthContext.tsx` - อัปเดต
3. `src/app/dashboard/page.tsx` - อัปเดต
4. `src/app/equipment-return/page.tsx` - อัปเดต
5. `src/app/it-tracking/page.tsx` - อัปเดต

## การทดสอบ
1. เข้าสู่ระบบด้วยบัญชีผู้ใช้
2. แอดมินลบบัญชีผู้ใช้จากระบบ
3. ผู้ใช้จะถูกเด้งออกจากระบบทันทีเมื่อเรียก API
4. ไม่สามารถใช้งานหน้าเว็บได้อีกต่อไป
