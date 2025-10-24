'use client';

import { useEffect, useState } from 'react';

interface TokenExpiryModalProps {
  isOpen: boolean;
  timeLeft: number;
  onClose: () => void;
}

export default function TokenExpiryModal({ isOpen, timeLeft, onClose }: TokenExpiryModalProps) {
  if (!isOpen) return null;

  const timeUnit = timeLeft > 60 ? 'นาที' : 'วินาที';
  const timeValue = timeLeft > 60 ? Math.ceil(timeLeft / 60) : timeLeft;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-white/20">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            แจ้งเตือนหมดเวลาการใช้งาน
          </h2>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-700 leading-relaxed">
            เซสชันของคุณใกล้หมดอายุแล้ว (ระบบจำกัดการ login ไว้ 7 วัน)
          </p>
          <p className="text-gray-700 leading-relaxed mt-2">
            <strong className="text-red-600">อีก {timeValue} {timeUnit}</strong> เซสชันจะหมดอายุ
          </p>
          <p className="text-gray-700 leading-relaxed mt-2">
            เมื่อหมดอายุแล้ว ระบบจะแสดงหน้าต่างนับถอยหลัง 10 วินาที แล้วนำคุณไปหน้า Login
          </p>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
}
