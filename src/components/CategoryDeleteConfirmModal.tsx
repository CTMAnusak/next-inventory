'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, Shield, Trash2 } from 'lucide-react';

interface ICategoryConfig {
  id: string;
  name: string;
  isSystemCategory: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CategoryDeleteConfirmModalProps {
  isOpen: boolean;
  category: ICategoryConfig | null;
  itemsCount?: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function CategoryDeleteConfirmModal({
  isOpen,
  category,
  itemsCount = 0,
  onConfirm,
  onCancel,
  isLoading = false
}: CategoryDeleteConfirmModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState(1); // 1 = first confirmation, 2 = DELETE confirmation

  if (!isOpen || !category) return null;

  const isConfirmTextValid = confirmText === 'DELETE';
  const canProceed = step === 1;

  const handleFirstConfirm = () => {
    onConfirm();
  };

  const handleFinalConfirm = () => {
    if (canProceed) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    setStep(1);
    setConfirmText('');
    onCancel();
  };

  const renderStepOne = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <Trash2 className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            ยืนยันการลบหมวดหมู่
          </h3>
          <p className="text-sm text-gray-500">
            การดำเนินการนี้ไม่สามารถย้อนกลับได้
          </p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">
            หมวดหมู่: {category.name}
          </span>
        </div>
        
        {itemsCount > 0 && (
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-2 rounded">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">
              มีอุปกรณ์ {itemsCount} รายการที่ใช้หมวดหมู่นี้ จะถูกย้ายไปยัง "ไม่ระบุ"
            </span>
          </div>
        )}
      </div>

      <p className="text-sm text-gray-600">
        คุณแน่ใจหรือไม่ที่ต้องการลบหมวดหมู่นี้?
      </p>
    </div>
  );

  const renderStepTwo = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            ยืนยันการลบหมวดหมู่พิเศษ (ขั้นตอนที่ 2)
          </h3>
          <p className="text-sm text-gray-500">
            กรุณาพิมพ์ "DELETE" เพื่อยืนยัน
          </p>
        </div>
      </div>

      <div className="bg-red-50 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-600" />
          <span className="font-medium text-red-900">
            หมวดหมู่พิเศษ: {category.name}
          </span>
        </div>
        
        <div className="text-sm text-red-700">
          <p className="font-medium">⚠️ คำเตือน:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>หมวดหมู่พิเศษต้องการการยืนยัน 2 ขั้นตอน</li>
            <li>การลบจะไม่สามารถย้อนกลับได้</li>
            {itemsCount > 0 && (
              <li>อุปกรณ์ {itemsCount} รายการจะถูกย้ายไปยัง "ไม่ระบุ"</li>
            )}
          </ul>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          พิมพ์ "DELETE" เพื่อยืนยันการลบ:
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          className="w-full px-4 py-3 border-2 border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono text-center text-lg"
          disabled={isLoading}
          autoComplete="off"
        />
        {confirmText && confirmText !== 'DELETE' && (
          <p className="text-red-500 text-sm mt-1">กรุณาพิมพ์ "DELETE" ให้ถูกต้อง</p>
        )}
        {confirmText === 'DELETE' && (
          <p className="text-green-600 text-sm mt-1">✓ ยืนยันแล้ว</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-900">
              {step === 1 ? 'ยืนยันการลบ' : 'ยืนยันขั้นสุดท้าย'}
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
          {step === 1 ? renderStepOne() : renderStepTwo()}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isLoading}
          >
            ยกเลิก
          </button>
          
          {step === 1 ? (
            <button
              onClick={handleFirstConfirm}
              disabled={isLoading}
              className={`px-6 py-2 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium ${
                (category as any).isSpecial
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isLoading ? 'กำลังประมวลผล...' : 
               (category as any).isSpecial ? 'ดำเนินการต่อ' : 'ลบหมวดหมู่'}
            </button>
          ) : (
            <button
              onClick={handleFinalConfirm}
              disabled={isLoading || !isConfirmTextValid}
              className={`px-6 py-2 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium ${
                isConfirmTextValid && !isLoading
                  ? 'bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-xl'
                  : 'bg-gray-400'
              }`}
            >
              {isLoading ? 'กำลังลบ...' : 'ลบหมวดหมู่พิเศษ'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
