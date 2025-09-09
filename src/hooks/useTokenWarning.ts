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

  console.log('🚀 useTokenWarning hook initialized');

  // ใช้ localStorage เพื่อเก็บสถานะว่าได้แจ้งเตือนไปแล้วในช่วงเวลานี้
  const getWarningKey = (exp: number) => `token_warning_${Math.floor(exp / 60)}`; // group by minute

  useEffect(() => {
    console.log('🔄 useEffect started, setting up token check interval');
    
    const checkTokenExpiry = () => {
      console.log('🔍 checkTokenExpiry function called');
      try {
        // ดึง token จาก cookie
        const allCookies = document.cookie;
        console.log('🍪 All cookies:', allCookies);
        
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('auth-token='))
          ?.split('=')[1];

        console.log('🎫 Token found:', token ? `${token.substring(0, 20)}...` : 'null');

        if (!token) {
          console.log('❌ No token found, skipping check');
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

        console.log('🔍 Token check:', { timeLeft, hasWarned });

        // แจ้งเตือนเมื่อเหลือ 50 วินาที (10 วินาทีหลัง login)
        const warningThreshold = timeLeft <= 50 && timeLeft > 0;
        
        // สร้าง key สำหรับ localStorage based on token expiry time
        const warningKey = getWarningKey(payload.exp);
        const hasShownWarning = localStorage.getItem(warningKey) === 'true';
        
        console.log('🔍 Warning check:', { 
          warningThreshold, 
          timeLeft, 
          hasWarned, 
          warningKey, 
          hasShownWarning 
        });
        
        if (warningThreshold && !hasShownWarning && !showModal) {
          // บันทึกใน localStorage ว่าได้แจ้งเตือนแล้ว
          localStorage.setItem(warningKey, 'true');
          
          setHasWarned(true);
          setShowModal(true);
          
          console.log('⚠️ Token expiry warning shown, time left:', timeLeft, 'seconds');
          console.log('🚨 Modal should be visible now!');
          console.log('💾 Saved warning flag to localStorage:', warningKey);
        }

        // Auto logout เมื่อ token หมดอายุ - แสดง modal แทน alert
        if (timeLeft <= 0 && !showLogoutModal) {
          console.log('🔐 Token expired, showing logout modal...');
          console.log('🔍 Current state:', { timeLeft, showLogoutModal, hasWarned });
          console.log('🔍 Token payload exp:', payload.exp);
          console.log('🔍 Current time:', Math.floor(Date.now() / 1000));
          
          // ลบ cookie
          document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          
          // แสดง logout modal
          setShowLogoutModal(true);
          console.log('✅ Logout modal should be shown now');
        }

      } catch (error) {
        console.error('Error checking token expiry:', error);
        setTimeToExpiry(null);
      }
    };

    // ตรวจสอบทุก 1 วินาที เพื่อความแม่นยำ
    const interval = setInterval(checkTokenExpiry, 1000);
    
    // ตรวจสอบครั้งแรกทันที
    checkTokenExpiry();

    return () => {
      clearInterval(interval);
    };
  }, [router]);

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
      
      console.log('🔄 Reset hasWarned and showModal flags, new session detected');
      console.log('🧹 Cleared old warning flags from localStorage');
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
