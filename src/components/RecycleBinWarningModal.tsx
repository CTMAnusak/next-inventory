'use client';

import React from 'react';

interface RecycleBinWarningModalProps {
  isOpen: boolean;
  itemName: string;
  serialNumber: string;
  onClose: () => void;
  onOpenRecycleBin: () => void;
}

export default function RecycleBinWarningModal({
  isOpen,
  itemName,
  serialNumber,
  onClose,
  onOpenRecycleBin
}: RecycleBinWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-orange-50 to-red-50 border-b border-orange-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🗑️</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-orange-800">
                Serial Number ซ้ำในถังขยะ
              </h3>
              <p className="text-sm text-orange-600 mt-1">
                พบ Serial Number นี้ในรายการที่ถูกลบแล้ว
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="space-y-4">
            {/* Item Info */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium text-gray-600">ชื่ออุปกรณ์:</span>
                  <div className="text-gray-900 font-medium">{itemName}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Serial Number:</span>
                  <div className="text-gray-900 font-mono font-medium bg-gray-100 px-2 py-1 rounded border">
                    {serialNumber}
                  </div>
                </div>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <span className="text-xl">⚠️</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-orange-800 mb-2">
                    ไม่สามารถเพิ่ม Serial Number นี้ได้
                  </h4>
                  <p className="text-orange-700 text-sm leading-relaxed">
                    Serial Number <span className="font-mono font-semibold bg-orange-100 px-1 rounded">{serialNumber}</span> 
                    {' '}มีอยู่แล้วในถังขยะ หากต้องการใช้ Serial Number นี้ กรุณากู้คืนจากถังขยะก่อน
                  </p>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <span className="text-xl">💡</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-800 mb-2">
                    วิธีแก้ไข
                  </h4>
                  <ol className="text-blue-700 text-sm space-y-1 list-decimal list-inside">
                    <li>คลิกปุ่ม "เปิดถังขยะ" ด้านล่าง</li>
                    <li>ค้นหา Serial Number: {serialNumber}</li>
                    <li>คลิก "กู้คืน" เพื่อนำอุปกรณ์กลับมาใช้งาน</li>
                    <li>หรือลบถาวรหากไม่ต้องการใช้ Serial Number นี้</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 font-medium"
          >
            ปิด
          </button>
          <button
            onClick={() => {
              onClose();
              onOpenRecycleBin();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium flex items-center space-x-2"
          >
            <span>🗑️</span>
            <span>เปิดถังขยะ</span>
          </button>
        </div>
      </div>
    </div>
  );
}
