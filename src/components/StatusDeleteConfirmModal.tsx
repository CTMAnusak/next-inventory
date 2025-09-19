'use client';

import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface StatusDeleteConfirmModalProps {
  isOpen: boolean;
  status: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function StatusDeleteConfirmModal({
  isOpen,
  status,
  onConfirm,
  onCancel,
  isLoading = false
}: StatusDeleteConfirmModalProps) {
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen || !status) return null;

  const isConfirmTextValid = confirmText === 'DELETE';

  const handleConfirm = () => {
    if (isConfirmTextValid) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    setConfirmText('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-900">
              ยืนยันการลบสถานะ
            </span>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                คุณแน่ใจหรือไม่ที่จะลบสถานะ "{status}"?
              </h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p>การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
                <p>สถานะนี้จะถูกลบออกจากระบบอย่างถาวร</p>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  พิมพ์ <span className="font-mono font-bold text-red-600">DELETE</span> เพื่อยืนยัน:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="DELETE"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={isLoading}
          >
            ยกเลิก
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmTextValid || isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            ลบสถานะ
          </button>
        </div>
      </div>
    </div>
  );
}
