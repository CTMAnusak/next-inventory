import React, { useEffect, useState } from 'react';

interface SimpleErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  autoCloseDelay?: number; // in milliseconds, default 4000 (4 seconds)
}

export default function SimpleErrorModal({
  isOpen,
  onClose,
  message,
  autoCloseDelay = 4000
}: SimpleErrorModalProps) {
  const [countdown, setCountdown] = useState(Math.ceil(autoCloseDelay / 1000));

  // Reset countdown when modal opens
  useEffect(() => {
    if (isOpen) {
      setCountdown(Math.ceil(autoCloseDelay / 1000));
    }
  }, [isOpen, autoCloseDelay]);

  // Countdown timer (updates every second)
  useEffect(() => {
    if (isOpen && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isOpen, countdown]);

  // Auto-close after specified delay
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose, autoCloseDelay]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-red-500 text-white p-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="text-lg font-semibold">เกิดข้อผิดพลาด</h3>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-gray-800 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>

        {/* Footer with auto-close indicator */}
        <div className="bg-gray-50 px-6 py-3 rounded-b-lg flex justify-between items-center">
          <div className="text-sm text-gray-500">
            จะปิดอัตโนมัติใน {countdown} วินาที
          </div>
          <button
            onClick={onClose}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
