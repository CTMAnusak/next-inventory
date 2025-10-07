import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface TokenPayload {
  exp: number;
  userId: string;
  userRole: string;
}

export function useTokenWarning() {
  const [timeToExpiry, setTimeToExpiry] = useState<number | null>(null);
  const [hasWarned, setHasWarned] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const router = useRouter();
  const lastCheckRef = useRef<number>(0);

  // ใช้ localStorage เพื่อเก็บสถานะว่าได้แจ้งเตือนไปแล้วในช่วงเวลานี้
  const getWarningKey = (exp: number) => `token_warning_${Math.floor(exp / 60)}`; // group by minute

  useEffect(() => {
    const checkTokenExpiry = () => {
      try {
        // ตรวจสอบว่าเวลาผ่านไปเพียงพอหรือไม่ (ป้องกันการตรวจสอบซ้ำ)
        const now = Date.now();
        // ถ้าใกล้หมดอายุ (เหลือน้อยกว่า 60 วินาที) ให้ตรวจสอบทุกวินาที
        // ถ้าไม่ใกล้หมดอายุ ให้ตรวจสอบทุก 3 วินาที
        const throttleTime = (timeToExpiry !== null && timeToExpiry <= 60) ? 500 : 3000;
        if (now - lastCheckRef.current < throttleTime) {
          return;
        }
        lastCheckRef.current = now;

        // ดึง token จาก cookie
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('auth-token='))
          ?.split('=')[1];

        if (!token) {
          setTimeToExpiry(null);
          return;
        }

        // Decode JWT payload (base64)
        const base64Payload = token.split('.')[1];
        const payload: TokenPayload = JSON.parse(atob(base64Payload));
        
        // คำนวณเวลาที่เหลือ (milliseconds)
        const currentTime = Math.floor(Date.now() / 1000);
        const timeLeft = payload.exp - currentTime;
        
        setTimeToExpiry(timeLeft);

        // แจ้งเตือนเมื่อเหลือ 50 วินาที (10 วินาทีหลัง login)
        const warningThreshold = timeLeft <= 50 && timeLeft > 0;
        
        // สร้าง key สำหรับ localStorage based on token expiry time
        const warningKey = getWarningKey(payload.exp);
        const hasShownWarning = localStorage.getItem(warningKey) === 'true';
        
        if (warningThreshold && !hasShownWarning && !showModal) {
          // บันทึกใน localStorage ว่าได้แจ้งเตือนแล้ว
          localStorage.setItem(warningKey, 'true');
          
          setHasWarned(true);
          setShowModal(true);
        }

        // Auto logout เมื่อ token หมดอายุ - แสดง modal แทน alert
        if (timeLeft <= 0 && !showLogoutModal) {
          // ลบ cookie
          document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          
          // แสดง logout modal พร้อมนับถอยหลัง 10 วินาที
          setShowLogoutModal(true);
        }

      } catch (error) {
        console.error('Error checking token expiry:', error);
        setTimeToExpiry(null);
      }
    };

    // ตรวจสอบทุก 10 วินาที เพื่อประหยัดทรัพยากร (แต่มี throttling ภายใน)
    // แต่เมื่อใกล้หมดอายุ (เหลือน้อยกว่า 60 วินาที) จะตรวจสอบทุกวินาที
    const getCheckInterval = () => {
      return (timeToExpiry !== null && timeToExpiry <= 60) ? 1000 : 10000;
    };
    
    const interval = setInterval(checkTokenExpiry, getCheckInterval());
    
    // ตรวจสอบครั้งแรกทันที
    checkTokenExpiry();

    return () => {
      clearInterval(interval);
    };
  }, [router, timeToExpiry]);

  // Reset hasWarned เมื่อ login ใหม่ (timeToExpiry กลับมาเป็นค่าสูง)
  useEffect(() => {
    if (timeToExpiry && timeToExpiry > 50) {
      setHasWarned(false);
      setShowModal(false);
      
      // ล้าง localStorage ของ warning เก่าๆ
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('token_warning_')) {
          localStorage.removeItem(key);
        }
      });
    }
  }, [timeToExpiry]);

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    window.location.href = '/login';
  };

  return {
    timeToExpiry,
    hasWarned,
    showModal,
    showLogoutModal,
    handleCloseModal,
    handleLogoutConfirm
  };
}
