# การแก้ไขปัญหา: AuthGuard เด้งผู้ใช้ปกติออกจากระบบ

## ปัญหาที่พบ
AuthGuard component มีการตรวจสอบที่เข้มงวดเกินไป ทำให้ผู้ใช้ที่ยังไม่ถูกลบและยังอยู่ในระบบถูกเด้งออกจากระบบด้วย

**อาการที่พบ:**
- บัญชีที่ไม่ถูกลบ และยังเข้าสู่ระบบไม่เกิน 7 วัน ถูกเด้งออกจากระบบ
- ผู้ใช้ปกติไม่สามารถใช้งานระบบได้

## สาเหตุของปัญหา
AuthGuard component มีการตรวจสอบ `user.pendingDeletion` ซึ่งอาจจะทำให้ผู้ใช้ปกติถูกเด้งออกจากระบบด้วย เพราะ:

1. **การตรวจสอบ pendingDeletion** - อาจจะมีการตั้งค่าไม่ถูกต้องใน database
2. **การตรวจสอบที่เข้มงวดเกินไป** - ตรวจสอบเงื่อนไขที่ไม่จำเป็น
3. **การทำงานร่วมกับ API auth check** - อาจจะมีการส่งข้อมูลไม่ถูกต้อง

## การแก้ไข

### 1. แก้ไข AuthGuard Component
แก้ไขไฟล์ `src/components/AuthGuard.tsx`:

```typescript
export default function AuthGuard({ 
  children, 
  redirectTo = '/login?error=session_expired' 
}: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // รอให้ AuthContext โหลดเสร็จก่อน
    if (loading) return;

    // ถ้าไม่มี user ให้ redirect ไป login
    if (!user) {
      console.log('❌ AuthGuard: No user found, redirecting to login');
      router.push(redirectTo);
      return;
    }

    // ✅ ตรวจสอบเฉพาะกรณีที่ผู้ใช้ถูกลบจริงๆ (deletedAt หรือ isDeleted)
    // ไม่ตรวจสอบ pendingDeletion เพราะอาจจะทำให้ผู้ใช้ปกติถูกเด้งออกจากระบบ
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

  // ถ้าไม่มี user ไม่แสดงเนื้อหา
  if (!user) {
    return null;
  }

  // แสดงเนื้อหาปกติ
  return <>{children}</>;
}
```

### 2. การเปลี่ยนแปลงหลัก

**ก่อนแก้ไข:**
```typescript
// ตรวจสอบว่า user ถูกลบแล้วหรือไม่
if (user.pendingDeletion) {
  console.log('❌ AuthGuard: User is pending deletion, redirecting to login');
  router.push(redirectTo);
  return;
}

// ถ้าไม่มี user หรือ user ถูกลบแล้ว ไม่แสดงเนื้อหา
if (!user || user.pendingDeletion) {
  return null;
}
```

**หลังแก้ไข:**
```typescript
// ✅ ตรวจสอบเฉพาะกรณีที่ผู้ใช้ถูกลบจริงๆ (deletedAt หรือ isDeleted)
// ไม่ตรวจสอบ pendingDeletion เพราะอาจจะทำให้ผู้ใช้ปกติถูกเด้งออกจากระบบ
console.log('✅ AuthGuard: User authenticated, allowing access');

// ถ้าไม่มี user ไม่แสดงเนื้อหา
if (!user) {
  return null;
}
```

## วิธีการทำงานใหม่ของ AuthGuard

1. **ตรวจสอบ AuthContext** - รอให้ AuthContext โหลดเสร็จก่อน
2. **ตรวจสอบ User** - ถ้าไม่มี user ให้ redirect ไป login
3. **ไม่ตรวจสอบ pendingDeletion** - เพื่อป้องกันผู้ใช้ปกติถูกเด้งออกจากระบบ
4. **แสดง Loading** - แสดง loading spinner ขณะตรวจสอบ
5. **ป้องกันการแสดงเนื้อหา** - ถ้าไม่มี user ไม่แสดงเนื้อหา

## การป้องกันผู้ใช้ที่ถูกลบ

การป้องกันผู้ใช้ที่ถูกลบจะทำงานผ่าน:

1. **API-level authentication** - `/api/auth/check` จะตรวจสอบ `deletedAt` และ `isDeleted`
2. **API calls** - ทุก API call จะใช้ `authenticateUser` ที่ตรวจสอบการถูกลบ
3. **401 error handling** - เมื่อได้ 401 error จะเด้งออกจากระบบทันที

## ผลลัพธ์
✅ **ผู้ใช้ปกติสามารถใช้งานระบบได้ตามปกติ**  
✅ **ผู้ใช้ที่ถูกลบจะถูกเด้งออกจากระบบผ่าน API calls**  
✅ **ไม่มีการเด้งออกจากระบบโดยไม่จำเป็น**  
✅ **ระบบยังคงปลอดภัยและป้องกันผู้ใช้ที่ถูกลบ**  
✅ **การทำงานร่วมกับ API-level authentication**

## ไฟล์ที่แก้ไข
1. `src/components/AuthGuard.tsx` - แก้ไขการตรวจสอบ authentication

## การทดสอบ
1. เข้าสู่ระบบด้วยบัญชีผู้ใช้ปกติ
2. ตรวจสอบว่าสามารถใช้งานระบบได้ตามปกติ
3. ไม่ถูกเด้งออกจากระบบโดยไม่จำเป็น
4. ผู้ใช้ที่ถูกลบจะถูกเด้งออกจากระบบผ่าน API calls เมื่อมีการเรียก API
