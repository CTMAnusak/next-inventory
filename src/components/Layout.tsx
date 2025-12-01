'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTokenWarning } from '@/hooks/useTokenWarning';
import { useForceLogoutCheck } from '@/hooks/useForceLogoutCheck';
import { useRecycleBinCleanup } from '@/hooks/useRecycleBinCleanup';
import dynamic from 'next/dynamic';
import Sidebar from './Sidebar';
import { Menu, LogOut, User } from 'lucide-react';

// Lazy load modals
const TokenExpiryModal = dynamic(() => import('./TokenExpiryModal'), { ssr: false });
const LogoutModal = dynamic(() => import('./LogoutModal'), { ssr: false });

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading, logout } = useAuth();

  // เปิดใช้ระบบแจ้งเตือน token หมดอายุ
  const { timeToExpiry, showModal, showLogoutModal, handleCloseModal, handleLogoutConfirm } = useTokenWarning();

  // เปิดใช้ระบบตรวจสอบ force logout สำหรับ user ที่รอลบ
  useForceLogoutCheck();

  // เปิดใช้ระบบลบถาวรอัตโนมัติสำหรับถังขยะ (ทุกวัน)
  useRecycleBinCleanup();

  const handleLogout = async () => {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
      try {
        await logout();
        // เพิ่มการรีเฟรชหน้าเว็บเพื่อให้แน่ใจว่าไปหน้า login
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      } catch (error) {
        console.error('Logout error:', error);
        // ถ้า logout ไม่สำเร็จ ให้รีเฟรชหน้าเว็บเพื่อไปหน้า login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content with margin for sidebar */}
      <div className="lg:ml-64">
        {/* Top Navigation */}
        <nav className="bg-white/80 backdrop-blur-md shadow-lg border-b border-blue-100">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                {/* Mobile menu button */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-xl text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-all duration-200"
                >
                  <Menu className="h-6 w-6" />
                </button>
              </div>

              {/* User menu */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3 bg-blue-50 px-4 py-2 rounded-full mr-2 min-[510px]:mr-4">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  {loading ? (
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                  ) : (
                    <span className="text-sm font-medium text-blue-800">
                      {user?.firstName} {user?.lastName}
                      {user?.userType === 'branch' && ` สาขา ${user.office}`}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-3 py-3 min-[510px]:px-4 min-[510px]:py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all duration-200 border border-red-200 hover:border-red-300"
                >
                  <LogOut className="h-4 w-4 mr-0 min-[510px]:mr-2" />
                  <span className="hidden min-[510px]:inline-block">ออกจากระบบ</span>
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="relative py-2 lg:py-12 h-full overflow-auto">
          <div className="px-4 sm:px-6 lg:px-8 h-full min-h-screen py-5">
            {children}
          </div>
        </main>
      </div>

      {/* Token Expiry Modal */}
      <TokenExpiryModal
        isOpen={showModal}
        timeLeft={timeToExpiry || 0}
        onClose={handleCloseModal}
      />

      {/* Logout Modal */}
      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={handleLogoutConfirm}
      />
    </div>
  );
}
