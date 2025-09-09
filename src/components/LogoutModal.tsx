'use client';

interface LogoutModalProps {
  isOpen: boolean;
  onConfirm: () => void;
}

export default function LogoutModal({ isOpen, onConfirm }: LogoutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-red-200">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-3">
            <span className="text-2xl">🔐</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            หมดเวลาการใช้งาน
          </h2>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-700 leading-relaxed">
            เซสชันของคุณได้หมดอายุแล้ว
          </p>
          <p className="text-gray-700 leading-relaxed mt-2">
            ระบบจะนำคุณไปยังหน้า Login เพื่อเข้าสู่ระบบใหม่
          </p>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            ไปหน้า Login
          </button>
        </div>
      </div>
    </div>
  );
}
