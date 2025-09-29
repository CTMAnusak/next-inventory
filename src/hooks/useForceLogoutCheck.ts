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

    // ตรวจสอบเฉพาะ user ที่มี pendingDeletion = true
    if (!user.pendingDeletion) {
      return;
    }


    const checkForceLogout = async () => {
      // ป้องกันการแสดง alert ซ้ำ
      if (hasShownAlert) {
        return;
      }

      try {
        // ตรวจสอบ force logout signal
        const forceLogoutResponse = await fetch('/api/admin/force-logout-user', {
          method: 'GET',
          credentials: 'include'
        });

        if (forceLogoutResponse.ok) {
          const data = await forceLogoutResponse.json();
          
          if (data.shouldLogout) {
            
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

        // ตรวจสอบ auth status (กรณี user ถูกลบแล้ว)
        const authResponse = await fetch('/api/auth/check', {
          method: 'GET',
          credentials: 'include'
        });

        if (!authResponse.ok || authResponse.status === 401) {
          
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

    // ตรวจสอบทันทีเมื่อ component mount เท่านั้น (ไม่ต้องเช็คทุก 10 วินาที)
    checkForceLogout();
    
    // ไม่ต้องใช้ interval เพราะ admin จะส่งสัญญาณทันทีเมื่อลบ user
    // const interval = setInterval(checkForceLogout, 10000);

    // ไม่ต้อง clear interval เพราะไม่ได้ใช้
    // return () => clearInterval(interval);
  }, [user, logout, hasShownAlert]);
}
