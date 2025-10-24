'use client';

import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  confirmColor: 'green' | 'red' | 'blue';
  icon: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText,
  confirmColor,
  icon,
  onConfirm,
  onCancel,
  isDangerous = false,
  isLoading = false
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const colorClasses = {
    green: {
      button: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
      border: 'border-green-200',
      background: 'bg-green-50',
      text: 'text-green-800'
    },
    red: {
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      border: 'border-red-200', 
      background: 'bg-red-50',
      text: 'text-red-800'
    },
    blue: {
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      border: 'border-blue-200',
      background: 'bg-blue-50', 
      text: 'text-blue-800'
    }
  };

  const colors = colorClasses[confirmColor];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className={`px-6 py-4 ${colors.background} ${colors.border} border-b`}>
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{icon}</div>
            <h3 className={`text-lg font-semibold ${colors.text}`}>
              {title}
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="text-gray-700 leading-relaxed whitespace-pre-line">
            {message}
          </div>
          
          {isDangerous && (
            <div className={`mt-4 p-4 ${colors.background} ${colors.border} border rounded-lg`}>
              <div className="flex items-start space-x-2">
                <div className="text-lg">⚠️</div>
                <div className={`text-sm ${colors.text} font-medium`}>
                  การดำเนินการนี้ไม่สามารถยกเลิกได้ กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
              isLoading ? 'bg-gray-400' : colors.button
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                กำลังดำเนินการ...
              </div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
