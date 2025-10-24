'use client';

import { useState } from 'react';

export default function DebugAuthPage() {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkAuthStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/auth-status');
      const data = await response.json();
      setAuthStatus(data);
    } catch (error) {
      console.error('Error:', error);
      setAuthStatus({ error: 'เกิดข้อผิดพลาดในการตรวจสอบ' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            🔍 ตรวจสอบสถานะ Authentication
          </h1>
          
          <div className="mb-6">
            <button
              onClick={checkAuthStatus}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบสถานะ'}
            </button>
          </div>

          {authStatus && (
            <div className="space-y-6">
              {/* ข้อมูลผู้ใช้ */}
              {authStatus.user && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h2 className="text-lg font-semibold text-gray-800 mb-3">
                    📊 ข้อมูลผู้ใช้
                  </h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">ชื่อ:</span> {authStatus.user.firstName} {authStatus.user.lastName}
                    </div>
                    <div>
                      <span className="font-medium">อีเมล:</span> {authStatus.user.email}
                    </div>
                    <div>
                      <span className="font-medium">User ID:</span> {authStatus.user.user_id}
                    </div>
                    <div>
                      <span className="font-medium">วันที่สร้าง:</span> {new Date(authStatus.user.createdAt).toLocaleString('th-TH')}
                    </div>
                  </div>
                </div>
              )}

              {/* สถานะ Authentication */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">
                  🔐 สถานะ Authentication
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center">
                    <span className="font-medium w-32">isDeleted:</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      authStatus.user?.isDeleted ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {authStatus.user?.isDeleted ? 'ใช่' : 'ไม่'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-32">deletedAt:</span>
                    <span className="text-gray-600">
                      {authStatus.user?.deletedAt ? new Date(authStatus.user.deletedAt).toLocaleString('th-TH') : 'ไม่มี'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-32">pendingDeletion:</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      authStatus.user?.pendingDeletion ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {authStatus.user?.pendingDeletion ? 'ใช่' : 'ไม่'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-32">jwtInvalidatedAt:</span>
                    <span className="text-gray-600">
                      {authStatus.user?.jwtInvalidatedAt ? new Date(authStatus.user.jwtInvalidatedAt).toLocaleString('th-TH') : 'ไม่มี'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ปัญหาที่พบ */}
              {authStatus.authIssues && authStatus.authIssues.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h2 className="text-lg font-semibold text-red-800 mb-3">
                    ❌ ปัญหาที่พบ
                  </h2>
                  <ul className="space-y-1">
                    {authStatus.authIssues.map((issue: string, index: number) => (
                      <li key={index} className="text-red-700 text-sm">• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* คำแนะนำ */}
              {authStatus.recommendations && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h2 className="text-lg font-semibold text-blue-800 mb-3">
                    💡 คำแนะนำ
                  </h2>
                  <ul className="space-y-1">
                    {authStatus.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="text-blue-700 text-sm">• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ข้อผิดพลาด */}
              {authStatus.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h2 className="text-lg font-semibold text-red-800 mb-3">
                    ❌ ข้อผิดพลาด
                  </h2>
                  <p className="text-red-700 text-sm">{authStatus.error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
