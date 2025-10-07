'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { 
  BarChart3, 
  RefreshCw, 
  Calendar,
  TrendingUp,
  AlertTriangle,
  Package,
  Users,
  FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface DashboardStats {
  totalIssues: number;
  pendingIssues: number;
  inProgressIssues: number;
  completedIssues: number;
  totalRequests: number;
  totalReturns: number;
  totalUsers: number;
  totalInventoryItems: number;
  lowStockItems: number;
  urgentIssues: number;
  monthlyIssues: Array<{ month: string; count: number }>;
  monthlyRequests: Array<{ month: string; count: number }>;
  monthlyReturns: Array<{ month: string; count: number }>;
  issuesByCategory: Array<{ category: string; count: number; percentage: number }>;
  requestsByUrgency: Array<{ urgency: string; count: number; percentage: number }>;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchStats();
  }, [selectedMonth, selectedYear]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/dashboard?month=${selectedMonth}&year=${selectedYear}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const generateMonths = () => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: new Date(2024, i, 1).toLocaleDateString('th-TH', { month: 'long' })
    }));
    return [{ value: 'all' as const, label: 'ทั้งหมด' }, ...months];
  };

  const generateYears = () => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  };

  const PieChart = ({ data, title, colorScheme }: { 
    data: Array<{ category?: string; urgency?: string; count: number; percentage: number }>;
    title: string;
    colorScheme: string[];
  }) => {
    const total = data.reduce((sum, item) => sum + item.count, 0);
    
    return (
      <div className="bg-white rounded-lg p-6 shadow-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        
        {total > 0 ? (
          <div className="flex items-center justify-center">
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 200 200" className="w-48 h-48 transform -rotate-90">
                {data.map((item, index) => {
                  const circumference = 2 * Math.PI * 80;
                  const strokeDasharray = (item.percentage / 100) * circumference;
                  const strokeDashoffset = -data.slice(0, index).reduce((sum, prev) => 
                    sum + (prev.percentage / 100) * circumference, 0
                  );
                  
                  return (
                    <circle
                      key={index}
                      cx="100"
                      cy="100"
                      r="80"
                      fill="transparent"
                      stroke={colorScheme[index % colorScheme.length]}
                      strokeWidth="20"
                      strokeDasharray={`${strokeDasharray} ${circumference - strokeDasharray}`}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-300 hover:stroke-width-[25]"
                    />
                  );
                })}
              </svg>
              
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{total}</div>
                  <div className="text-sm text-gray-500">รวม</div>
                </div>
              </div>
            </div>
            
            <div className="ml-6 space-y-2">
              {data.map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: colorScheme[index % colorScheme.length] }}
                  ></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {item.category || item.urgency}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.count} รายการ ({item.percentage.toFixed(1)}%)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-500">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>ไม่มีข้อมูล</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color, 
    change 
  }: { 
    title: string; 
    value: number; 
    icon: any; 
    color: string;
    change?: string;
  }) => (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          {change && (
            <p className="text-sm text-green-600 flex items-center mt-1">
              <TrendingUp className="w-4 h-4 mr-1" />
              {change}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  if (loading && !stats) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6">
            <div className="text-center md:text-left mb-5 md:mb-0">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">ภาพรวมระบบจัดการคลังสินค้า</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <select
                  value={selectedMonth as any}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedMonth(val === 'all' ? 'all' : Number(val));
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  {generateMonths().map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  {generateYears().map((year) => (
                    <option key={year} value={year}>
                      {year + 543}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={fetchStats}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4  max-[420px]:mr-0 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden min-[420px]:inline-block">รีเฟรช</span>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid max-[768px]:grid-cols-1 max-[1120px]:grid-cols-2 grid-cols-4 grid-cols-4 gap-6">
              <StatCard
                title="แจ้งงาน IT ทั้งหมด"
                value={stats.totalIssues}
                icon={AlertTriangle}
                color="bg-red-500"
              />
              <StatCard
                title="เบิกอุปกรณ์ทั้งหมด"
                value={stats.totalRequests}
                icon={Package}
                color="bg-blue-500"
              />
              <StatCard
                title="คืนอุปกรณ์ทั้งหมด"
                value={stats.totalReturns}
                icon={FileText}
                color="bg-green-500"
              />
              <StatCard
                title="ผู้ใช้งานทั้งหมด"
                value={stats.totalUsers}
                icon={Users}
                color="bg-purple-500"
              />
            </div>
          )}
        </div>

        {/* Charts Section */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieChart
              data={stats.issuesByCategory}
              title={`แจ้งงาน IT ตามประเภท (${selectedMonth === 'all' ? 'ทั้งหมด' : selectedMonth}/${selectedYear + 543})`}
              colorScheme={['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']}
            />
            <PieChart
              data={stats.requestsByUrgency}
              title={`เบิกอุปกรณ์ตามความเร่งด่วน (${selectedMonth === 'all' ? 'ทั้งหมด' : selectedMonth}/${selectedYear + 543})`}
              colorScheme={['#dc2626', '#059669']}
            />
          </div>
        )}

        {/* Additional Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">สถานะแจ้งงาน IT</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">รอดำเนินการ</span>
                  <span className="font-semibold text-yellow-600">{stats.pendingIssues}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">ดำเนินการแล้ว</span>
                  <span className="font-semibold text-blue-600">{stats.inProgressIssues}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">ปิดงานแล้ว</span>
                  <span className="font-semibold text-green-600">{stats.completedIssues}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-red-600 font-medium">ด่วนมาก</span>
                  <span className="font-semibold text-red-600">{stats.urgentIssues}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">สถานะคลังสินค้า</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">รายการทั้งหมด</span>
                  <span className="font-semibold text-blue-600">{stats.totalInventoryItems}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-red-600 font-medium">สินค้าใกล้หมด</span>
                  <span className="font-semibold text-red-600">{stats.lowStockItems}</span>
                </div>
                {stats.lowStockItems > 0 && (
                  <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                    <p className="text-xs text-red-700">
                      ⚠️ มีสินค้าใกล้หมด {stats.lowStockItems} รายการ
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">สรุป</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">แจ้งงาน IT</span>
                  <span className="font-semibold text-red-600">
                    {selectedMonth === 'all' ? stats.monthlyIssues.filter(m => m.month.startsWith(`${selectedYear}-`)).reduce((sum, m) => sum + m.count, 0) : (stats.monthlyIssues.find(m => m.month === `${selectedYear}-${(selectedMonth as number).toString().padStart(2, '0')}`)?.count || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">เบิกอุปกรณ์</span>
                  <span className="font-semibold text-blue-600">
                    {selectedMonth === 'all' ? stats.monthlyRequests.filter(m => m.month.startsWith(`${selectedYear}-`)).reduce((sum, m) => sum + m.count, 0) : (stats.monthlyRequests.find(m => m.month === `${selectedYear}-${(selectedMonth as number).toString().padStart(2, '0')}`)?.count || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">คืนอุปกรณ์</span>
                  <span className="font-semibold text-green-600">
                    {selectedMonth === 'all' ? stats.monthlyReturns.filter(m => m.month.startsWith(`${selectedYear}-`)).reduce((sum, m) => sum + m.count, 0) : (stats.monthlyReturns.find(m => m.month === `${selectedYear}-${(selectedMonth as number).toString().padStart(2, '0')}`)?.count || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
