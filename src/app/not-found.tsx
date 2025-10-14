'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Home } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // Auto redirect to home page after 3 seconds
    const timer = setTimeout(() => {
      router.replace('/');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  const handleRedirect = () => {
    router.replace('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center">
            {/* Icon */}
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-white" />
            </div>

            {/* 404 Text */}
            <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-4">
              404
            </h1>

            {/* Message */}
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              ไม่พบหน้าที่คุณต้องการ
            </h2>
            
            <p className="text-gray-600 mb-6">
              หน้าที่คุณกำลังค้นหาไม่มีอยู่ในระบบ
            </p>

            {/* Auto redirect message */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-blue-700">
                กำลังนำคุณไปยังหน้าหลักใน 3 วินาที...
              </p>
              <div className="mt-2 w-full bg-blue-200 rounded-full h-1.5">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full animate-progress"
                  style={{
                    animation: 'progress 3s linear forwards'
                  }}
                />
              </div>
            </div>

            {/* Redirect Button */}
            <button
              onClick={handleRedirect}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
            >
              <Home className="w-4 h-4" />
              ไปหน้าหลักทันที
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
        
        .animate-progress {
          animation: progress 3s linear forwards;
        }
      `}</style>
    </div>
  );
}

