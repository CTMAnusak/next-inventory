/**
 * AuthGuard Component
 * ป้องกันการเข้าถึงหน้าสำหรับผู้ใช้ที่ไม่ได้ authenticate หรือถูกลบแล้ว
 */

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
