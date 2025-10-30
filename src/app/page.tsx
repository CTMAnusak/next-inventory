'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Package, AlertTriangle, BarChart3, Users } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const quickActions = [
    {
      title: 'เบิกอุปกรณ์',
      description: 'ยื่นคำขอเบิกอุปกรณ์จากคลัง',
      icon: Package,
      href: '/equipment-request',
      color: 'bg-blue-500',
    },
    {
      title: 'แจ้งปัญหา IT',
      description: 'แจ้งปัญหาเทคนิคหรือขอความช่วยเหลือ',
      icon: AlertTriangle,
      href: '/it-report',
      color: 'bg-red-500',
    },
    {
      title: 'ติดตามสถานะ',
      description: 'ตรวจสอบสถานะการแจ้งงาน IT',
      icon: BarChart3,
      href: '/it-tracking',
      color: 'bg-green-500',
    },
    {
      title: 'ติดต่อทีม IT Support',
      description: 'ข้อมูลการติดต่อทีม IT Support',
      icon: Users,
      href: '/contact',
      color: 'bg-purple-500',
    },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            ยินดีต้อนรับสู่ระบบจัดการคลังสินค้า
          </h1>
          <p className="text-gray-600">
            สวัสดี{user.firstName ? ` คุณ${user.firstName}` : ''} เลือกเมนูที่ต้องการใช้งาน
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {quickActions.map((action, index) => (
            <div
              key={index}
              onClick={() => router.push(action.href)}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
            >
              <div className="flex items-center">
                <div className={`${action.color} p-3 rounded-lg`}>
                  <action.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {action.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {action.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity or Stats */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">สำหรับพนักงาน</div>
              <div className="text-gray-600">ระบบเบิก-คืนอุปกรณ์</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">แจ้งปัญหา IT</div>
              <div className="text-gray-600">รายงานและติดตามสถานะ</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">จัดการระบบ</div>
              <div className="text-gray-600">สำหรับทีม IT Support</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}