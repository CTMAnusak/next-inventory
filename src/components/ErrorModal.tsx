import React from 'react';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  reason: string;
  nextSteps: string[];
  itemName: string;
  adminStock: number;
  userOwned: number;
}

export default function ErrorModal({
  isOpen,
  onClose,
  title,
  message,
  reason,
  nextSteps,
  itemName,
  adminStock,
  userOwned
}: ErrorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-red-500 text-white p-4 rounded-t-lg">
          <div className="flex items-center">
            <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Item Info */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <h4 className="font-semibold text-gray-800 mb-2">📊 สถานะอุปกรณ์ "{itemName}"</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Admin Stock:</span>
                <span className="font-medium text-blue-600">{adminStock} ชิ้น</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">User Owned:</span>
                <span className="font-medium text-orange-600">{userOwned} ชิ้น</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          <div className="mb-4">
            <p className="text-red-600 font-medium mb-2">❌ {message}</p>
            <p className="text-gray-700">{reason}</p>
          </div>

          {/* Next Steps */}
          <div className="mb-4">
            <h4 className="font-semibold text-gray-800 mb-2">💡 วิธีแก้ไข</h4>
            <ul className="space-y-2">
              {nextSteps.map((step, index) => (
                <li key={index} className="flex items-start">
                  <span className="bg-blue-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mr-2 mt-0.5 flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-gray-700 text-sm">{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-yellow-800 font-medium text-sm">⚠️ หมายเหตุ</p>
                <p className="text-yellow-700 text-sm mt-1">
                  รายการจะหายไปจากหน้าคลังสินค้าเมื่อ User คืนอุปกรณ์ครบทั้งหมด
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-3 rounded-b-lg flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
