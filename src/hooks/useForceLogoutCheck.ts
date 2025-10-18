import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook สำหรับตรวจสอบว่า admin สั่งให้ user logout หรือไม่
 * ใช้กับ user ที่อยู่ในสถานะ pendingDeletion
 */
export function useForceLogoutCheck() {
  const { user, logout } = useAuth();
  const [hasShownAlert, setHasShownAlert] = useState(false);

  useEffect(() => {
    if (!user) return;

    // ตรวจสอบเฉพาะ user ที่มี pendingDeletion = true เท่านั้น
    // (user ที่ถูกลบแล้วจะถูกจัดการโดย AuthContext.checkAuth)
    if (!user.pendingDeletion) {
      return;
    }

    let isActive = true;

    const checkForceLogout = async () => {
      // ป้องกันการแสดง alert ซ้ำ
      if (hasShownAlert || !isActive) {
        return;
      }

      try {
        // ตรวจสอบ force logout signal (สำหรับ user ที่มี pendingDeletion = true)
        const forceLogoutResponse = await fetch('/api/admin/force-logout-user', {
          method: 'GET',
          credentials: 'include'
        });

        if (forceLogoutResponse.ok) {
          const data = await forceLogoutResponse.json();
          
          if (data.shouldLogout && isActive) {
            // แสดงข้อความแจ้งเตือนก่อน logout (ครั้งเดียว)
            if (!hasShownAlert) {
              setHasShownAlert(true);
              alert('บัญชีของคุณได้รับการอนุมัติให้ลบแล้ว คุณจะถูกนำออกจากระบบ');
            }
            
            // Logout user
            await logout();
            return;
          }
        }

        // ตรวจสอบ auth status
        const authResponse = await fetch('/api/auth/check', {
          method: 'GET',
          credentials: 'include'
        });

        if ((!authResponse.ok || authResponse.status === 401) && isActive) {
          // แสดงข้อความแจ้งเตือนก่อน logout (ครั้งเดียว)
          if (!hasShownAlert) {
            setHasShownAlert(true);
            alert('บัญชีของคุณไม่พบในระบบ คุณจะถูกนำออกจากระบบ');
          }
          
          // Logout user
          await logout();
        }
      } catch (error) {
        // Silent fail - ไม่ต้อง log error เพราะอาจจะเป็น network issue
      }
    };

    // ตรวจสอบทันทีเมื่อ component mount
    checkForceLogout();
    
    // ตรวจสอบทุก 10 วินาทีสำหรับ pendingDeletion users
    const interval = setInterval(checkForceLogout, 10000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [user, logout, hasShownAlert]);
}
