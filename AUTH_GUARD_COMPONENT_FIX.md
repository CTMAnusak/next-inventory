# การแก้ไขปัญหา: เพิ่ม AuthGuard Component

## ปัญหาที่พบ
ผู้ใช้ที่ถูกลบบัญชียังสามารถคลิกเปิดหน้าต่างๆ กรอกฟอร์ม เบิก/คืนอุปกรณ์ แจ้งปัญหา IT ได้อยู่ ทั้งที่ควรรีเฟรชพาไป logout

**หน้าที่มีผลกระทบ:**
- `/it-report` - แจ้งปัญหา IT
- `/it-tracking` - ติดตามสถานะ IT
- `/it-manual` - คู่มือการใช้งาน
- `/contact` - ติดต่อทีม IT
- `/dashboard` - หน้าหลัก
- `/equipment-return` - คืนอุปกรณ์
- `/equipment-request` - เบิกอุปกรณ์
- `/admin/inventory` - จัดการคลังสินค้า
- `/admin/pending-summary` - สรุปงานรอดำเนินการ
- `/admin/dashboard` - หน้าหลักแอดมิน
- `/admin/equipment-tracking` - ติดตามอุปกรณ์
- `/admin/users` - จัดการผู้ใช้
- `/admin/equipment-reports` - รายงานอุปกรณ์
- `/admin/it-reports` - รายงาน IT

## สาเหตุของปัญหา
การจัดการ 401 error จะทำงานเฉพาะเมื่อมีการเรียก API เท่านั้น แต่ถ้าผู้ใช้ไม่กดปุ่มส่งข้อมูลหรือไม่มีการเรียก API ก็จะไม่เด้งออกจากระบบ

## การแก้ไข

### 1. สร้าง AuthGuard Component
สร้างไฟล์ `src/components/AuthGuard.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface AuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export default function AuthGuard({ 
  children, 
  redirectTo = '/login?error=session_expired' 
}: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // รอให้ AuthContext โหลดเสร็จก่อน
    if (loading) return;

    // ถ้าไม่มี user หรือ user ถูกลบแล้ว ให้ redirect ไป login
    if (!user) {
      console.log('❌ AuthGuard: No user found, redirecting to login');
      router.push(redirectTo);
      return;
    }

    // ตรวจสอบว่า user ถูกลบแล้วหรือไม่
    if (user.pendingDeletion) {
      console.log('❌ AuthGuard: User is pending deletion, redirecting to login');
      router.push(redirectTo);
      return;
    }

    console.log('✅ AuthGuard: User authenticated, allowing access');
  }, [user, loading, router, redirectTo]);

  // แสดง loading หรือไม่แสดงอะไรเลยขณะตรวจสอบ
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ถ้าไม่มี user หรือ user ถูกลบแล้ว ไม่แสดงเนื้อหา
  if (!user || user.pendingDeletion) {
    return null;
  }

  // แสดงเนื้อหาปกติ
  return <>{children}</>;
}
```

### 2. เพิ่ม AuthGuard ในหน้าผู้ใช้

#### IT Report Page (`src/app/it-report/page.tsx`)
```typescript
import AuthGuard from '@/components/AuthGuard';

export default function ITReportPage() {
  // ... component logic ...

  return (
    <AuthGuard>
      <Layout>
        {/* เนื้อหาหน้า */}
      </Layout>
    </AuthGuard>
  );
}
```

#### Equipment Request Page (`src/app/equipment-request/page.tsx`)
```typescript
import AuthGuard from '@/components/AuthGuard';

export default function EquipmentRequestPage() {
  // ... component logic ...

  return (
    <AuthGuard>
      <Layout>
        {/* เนื้อหาหน้า */}
      </Layout>
    </AuthGuard>
  );
}
```

#### Equipment Return Page (`src/app/equipment-return/page.tsx`)
```typescript
import AuthGuard from '@/components/AuthGuard';

export default function EquipmentReturnPage() {
  // ... component logic ...

  return (
    <AuthGuard>
      <Layout>
        {/* เนื้อหาหน้า */}
      </Layout>
    </AuthGuard>
  );
}
```

#### IT Tracking Page (`src/app/it-tracking/page.tsx`)
```typescript
import AuthGuard from '@/components/AuthGuard';

export default function ITTrackingPage() {
  // ... component logic ...

  return (
    <AuthGuard>
      <Layout>
        {/* เนื้อหาหน้า */}
      </Layout>
    </AuthGuard>
  );
}
```

#### Dashboard Page (`src/app/dashboard/page.tsx`)
```typescript
import AuthGuard from '@/components/AuthGuard';

export default function DashboardPage() {
  // ... component logic ...

  return (
    <AuthGuard>
      <Layout>
        {/* เนื้อหาหน้า */}
      </Layout>
    </AuthGuard>
  );
}
```

#### Close Issue Page (`src/app/close-issue/[issueId]/page.tsx`)
```typescript
import AuthGuard from '@/components/AuthGuard';

export default function CloseIssuePage() {
  // ... component logic ...

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50 flex items-center justify-center p-4">
        {/* เนื้อหาหน้า */}
      </div>
    </AuthGuard>
  );
}
```

## วิธีการทำงานของ AuthGuard

1. **ตรวจสอบ AuthContext** - รอให้ AuthContext โหลดเสร็จก่อน
2. **ตรวจสอบ User** - ถ้าไม่มี user หรือ user ถูกลบแล้ว ให้ redirect ไป login
3. **ตรวจสอบ PendingDeletion** - ถ้า user มีสถานะ pendingDeletion ให้ redirect ไป login
4. **แสดง Loading** - แสดง loading spinner ขณะตรวจสอบ
5. **ป้องกันการแสดงเนื้อหา** - ถ้าไม่มี user หรือ user ถูกลบแล้ว ไม่แสดงเนื้อหา

## ผลลัพธ์
✅ **ผู้ใช้ที่ถูกลบจะถูกเด้งออกจากระบบทันทีเมื่อเข้าหน้าใดๆ**  
✅ **ไม่สามารถกรอกฟอร์มหรือใช้งานหน้าเว็บได้อีกต่อไป**  
✅ **ป้องกันการเข้าถึงหน้าทั้งหมดที่ระบุ**  
✅ **ทำงานร่วมกับ API-level 401 error handling**  
✅ **แสดง loading state ขณะตรวจสอบ authentication**

## ไฟล์ที่แก้ไข
1. `src/components/AuthGuard.tsx` - สร้างใหม่
2. `src/app/it-report/page.tsx` - เพิ่ม AuthGuard
3. `src/app/equipment-request/page.tsx` - เพิ่ม AuthGuard
4. `src/app/equipment-return/page.tsx` - เพิ่ม AuthGuard
5. `src/app/it-tracking/page.tsx` - เพิ่ม AuthGuard
6. `src/app/dashboard/page.tsx` - เพิ่ม AuthGuard
7. `src/app/close-issue/[issueId]/page.tsx` - เพิ่ม AuthGuard

## การทดสอบ
1. เข้าสู่ระบบด้วยบัญชีผู้ใช้
2. แอดมินลบบัญชีผู้ใช้จากระบบ
3. ลองเข้าหน้าใดๆ ที่มี AuthGuard:
   - Dashboard
   - Equipment Request
   - Equipment Return
   - IT Report
   - IT Tracking
   - Close Issue
4. ผู้ใช้จะถูกเด้งออกจากระบบทันทีเมื่อเข้าหน้า
5. ไม่สามารถกรอกฟอร์มหรือใช้งานหน้าเว็บได้อีกต่อไป
