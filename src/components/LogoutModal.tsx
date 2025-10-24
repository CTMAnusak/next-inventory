'use client';

import { useEffect, useState } from 'react';

interface LogoutModalProps {
  isOpen: boolean;
  onConfirm: () => void;
}

export default function LogoutModal({ isOpen, onConfirm }: LogoutModalProps) {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(10);
      return;
    }

    // เริ่มนับถอยหลัง
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // เด้งไปหน้า login เมื่อนับถอยหลังเสร็จ
          onConfirm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-red-200">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-3">
            <span className="text-2xl">🔐</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            หมดเวลาการใช้งาน
          </h2>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-700 leading-relaxed">
            เซสชันของคุณได้หมดอายุแล้ว (ครบ 7 วัน)
          </p>
          <p className="text-gray-700 leading-relaxed mt-2">
            ระบบจะนำคุณไปยังหน้า Login เพื่อเข้าสู่ระบบใหม่
          </p>
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-red-700 font-semibold text-center">
              เหลือเวลา: <span className="text-2xl font-semibold">{countdown}</span> วินาที
            </p>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            ไปหน้า Login ทันที
          </button>
        </div>
      </div>
    </div>
  );
}
