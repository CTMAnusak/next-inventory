'use client';

import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface CancelReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  equipmentName?: string;
  isLoading?: boolean;
}

export default function CancelReturnModal({
  isOpen,
  onClose,
  onConfirm,
  equipmentName,
  isLoading = false
}: CancelReturnModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">ยืนยันการยกเลิก</h3>
            </div>
            <button 
              onClick={onClose}
              disabled={isLoading}
              className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all duration-200 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              คุณต้องการยกเลิกการคืนอุปกรณ์นี้หรือไม่?
            </h4>
            {equipmentName && (
              <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                <span className="font-medium">อุปกรณ์:</span> {equipmentName}
              </p>
            )}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">หมายเหตุ:</p>
                <p>การยกเลิกการคืนจะทำให้รายการคืนอุปกรณ์นี้ถูกลบออกจากระบบ และคุณสามารถส่งคำขอคืนใหม่ได้อีกครั้ง</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 px-4 py-3 text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>กำลังยกเลิก...</span>
                </div>
              ) : (
                'ยืนยันยกเลิก'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
