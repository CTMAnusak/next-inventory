import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConditionDeleteConfirmModalProps {
  isOpen: boolean;
  conditionName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConditionDeleteConfirmModal({
  isOpen,
  conditionName,
  onConfirm,
  onCancel,
  loading = false
}: ConditionDeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-full">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              ยืนยันการลบสถานะอุปกรณ์
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-700 mb-4">
            คุณแน่ใจหรือไม่ที่จะลบสถานะอุปกรณ์{' '}
            <span className="font-semibold text-red-600">"{conditionName}"</span>?
          </p>
          <p className="text-sm text-gray-500 mb-6">
            การดำเนินการนี้ไม่สามารถยกเลิกได้ และอาจส่งผลต่ออุปกรณ์ที่ใช้สถานะนี้อยู่
          </p>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={loading}
            >
              ยกเลิก
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'กำลังลบ...' : 'ลบ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
