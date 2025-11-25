'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Layout from '@/components/Layout';
import { 
  RefreshCw, 
  Eye, 
  AlertTriangle,
  Clock,
  Package,
  PackageOpen,
  Users,
  ExternalLink,
  CheckCircle,
  FileText,
  Upload
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

interface ITIssue {
  _id: string;
  issueId: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  email: string;
  department: string;
  office: string;
  issueCategory: string;
  urgency: 'normal' | 'very_urgent';
  description: string;
  reportDate: string;
  status?: 'pending' | 'in_progress' | 'completed';
}

interface RequestLog {
  _id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  department: string;
  office: string;
  requestDate: string;
  urgency: string;
  phone: string;
  items: Array<{
    itemName: string;
    quantity: number;
    category?: string;
  }>;
}

interface ReturnLog {
  _id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  department: string;
  office: string;
  returnDate: string;
  phone?: string;
  items: Array<{
    itemName: string;
    quantity: number;
    category?: string;
    approvalStatus?: 'pending' | 'approved';
  }>;
}

interface User {
  _id: string;
  user_id?: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  email: string;
  office: string;
  userType: 'individual' | 'branch';
  createdAt: string;
  isApproved?: boolean;
}

export default function PendingSummaryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const dataLoadedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  
  // Data states
  const [pendingITIssues, setPendingITIssues] = useState<ITIssue[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RequestLog[]>([]);
  const [pendingReturns, setPendingReturns] = useState<ReturnLog[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);

  // ✅ Reset data loaded flag when pathname changes (navigation to this page)
  useEffect(() => {
    dataLoadedRef.current = false;
  }, [pathname]);

  useEffect(() => {
    if (!dataLoadedRef.current) {
      dataLoadedRef.current = true;
      // Initial fetch
      fetchAllData();
    }

    // Auto-refresh ทุก 10 นาที (600000 ms)
    const intervalId = setInterval(() => {
      fetchAllData(true); // true = silent refresh (ไม่แสดง loading animation)
    }, 600000);

    // Cleanup interval เมื่อออกจากหน้า
    return () => clearInterval(intervalId);
  }, [pathname]);

  const fetchAllData = async (silent: boolean = false) => {
    // ถ้าไม่ใช่ silent refresh ให้แสดง loading animation
    if (!silent) {
      setLoading(true);
    }
    
    try {
      // Fetch all data in parallel แต่ไม่ใช้ cache-busting ทุกครั้ง
      const [itResponse, requestResponse, returnResponse, userResponse] = await Promise.all([
        fetch('/api/admin/it-reports'),
        fetch('/api/admin/equipment-reports/requests'),
        fetch('/api/admin/equipment-reports/returns'),
        fetch('/api/admin/users')
      ]);

      // Process IT Issues (pending only)
      if (itResponse.ok) {
        const itData = await itResponse.json();
        // API returns { issues: [...], pagination: {...} }
        const issues = itData.issues || [];
        const pending = issues.filter((issue: ITIssue) => issue.status === 'pending');
        setPendingITIssues(pending);
      }

      // Process Request Logs (pending only)
      if (requestResponse.ok) {
        const requestData = await requestResponse.json();
        const pending = requestData.filter((req: any) => req.status === 'pending');
        setPendingRequests(pending);
      }

      // Process Return Logs (pending only)
      if (returnResponse.ok) {
        const returnData = await returnResponse.json();
        // Filter returns that have at least one pending item
        const pending = returnData.filter((ret: ReturnLog) => 
          ret.items.some(item => item.approvalStatus === 'pending' || !item.approvalStatus)
        );
        setPendingReturns(pending);
      }

      // Process Users (pending approval only)
      if (userResponse.ok) {
        const userData = await userResponse.json();
        const pending = userData.filter((user: User) => user.isApproved === false);
        setPendingUsers(pending);
      }
    } catch (error) {
      // แสดง error message เฉพาะตอนกดปุ่มรีเฟรช (ไม่ใช่ silent refresh)
      if (!silent) {
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      }
      console.error('Error fetching pending data:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // คำนวณจำนวนวันทำการที่ค้าง (นับจาก 18:00 ของวันที่สร้าง, ข้ามเสาร์-อาทิตย์)
  const calculateBusinessDaysPending = (createdDate: string): number => {
    const created = new Date(createdDate);
    const now = new Date();
    
    // เซ็ตเวลาเริ่มนับเป็น 18:00 ของวันที่สร้าง
    const startCounting = new Date(created);
    startCounting.setHours(18, 0, 0, 0);
    
    // ถ้ายังไม่ถึง 18:00 ของวันที่สร้าง = ยังไม่เริ่มนับ
    if (now < startCounting) {
      return 0;
    }
    
    let businessDays = 0;
    let currentDate = new Date(startCounting);
    
    // วนลูปนับวันทำการ (จันทร์-ศุกร์ เท่านั้น)
    while (currentDate < now) {
      const dayOfWeek = currentDate.getDay();
      
      // ถ้าเป็นวันจันทร์-ศุกร์ (1-5) และผ่าน 18:00 แล้ว
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const next18 = new Date(currentDate);
        next18.setDate(next18.getDate() + 1);
        next18.setHours(18, 0, 0, 0);
        
        if (now >= next18) {
          businessDays++;
        }
      }
      
      // เดินไปวันถัดไป
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(18, 0, 0, 0);
    }
    
    return businessDays;
  };

  // ดึงไอคอนตามจำนวนวันที่ค้าง
  const getPendingIcon = (days: number) => {
    if (days >= 2) return '🔥';
    if (days >= 1) return '⚠️';
    return null;
  };

  // ดึงสี background ตามจำนวนวันและความเร่งด่วน
  const getRowColor = (days: number, urgency?: string, baseClass?: string) => {
    if (days >= 2) {
      return urgency === 'very_urgent' ? 'bg-red-200' : 'bg-red-100';
    }
    if (days >= 1) {
      return urgency === 'very_urgent' ? 'bg-orange-200' : 'bg-orange-100';
    }
    return baseClass || 'bg-white';
  };

  const getUrgencyBadge = (urgency: string) => {
    return urgency === 'very_urgent' ? 
      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">ด่วนมาก</span> :
      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">ปกติ</span>;
  };

  const totalPendingCount = 
    pendingITIssues.length + 
    pendingRequests.reduce((sum, req) => sum + req.items.length, 0) + 
    pendingReturns.reduce((sum, ret) => sum + ret.items.filter(item => item.approvalStatus === 'pending' || !item.approvalStatus).length, 0) + 
    pendingUsers.length;

  const handleExportExcel = () => {
    try {
      if (totalPendingCount === 0) {
        toast.error('ไม่มีข้อมูลให้ Export');
        return;
      }

      const wb = XLSX.utils.book_new();

      // 1. Export Pending IT Issues
      if (pendingITIssues.length > 0) {
        const itData = pendingITIssues.map((issue, index) => {
          const days = calculateBusinessDaysPending(issue.reportDate);
          return {
            'ลำดับ': index + 1,
            'Issue ID': issue.issueId || '-',
            'ชื่อ-นามสกุล': `${issue.firstName} ${issue.lastName}`,
            'ชื่อเล่น': issue.nickname || '-',
            'แผนก': issue.department || '-',
            'สาขา': issue.office || '-',
            'เบอร์โทร': issue.phone || '-',
            'ประเภทปัญหา': issue.issueCategory || '-',
            'ความเร่งด่วน': issue.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ',
            'คำอธิบาย': issue.description || '-',
            'วันที่แจ้ง': new Date(issue.reportDate).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
            'จำนวนวันที่ค้าง': days,
            'สถานะ': 'รอดำเนินการ'
          };
        });
        const wsIT = XLSX.utils.json_to_sheet(itData);
        wsIT['!cols'] = [
          { wch: 8 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 20 },
          { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 30 },
          { wch: 22 }, { wch: 15 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(wb, wsIT, 'รอแจ้งงาน IT');
      }

      // 2. Export Pending Equipment Requests
      if (pendingRequests.length > 0) {
        const requestData: any[] = [];
        let rowIndex = 1;
        pendingRequests.forEach(req => {
          const days = calculateBusinessDaysPending(req.requestDate);
          req.items.forEach((item, itemIndex) => {
            requestData.push({
              'ลำดับ': rowIndex++,
              'ชื่อ-นามสกุล': `${req.firstName} ${req.lastName}`,
              'ชื่อเล่น': req.nickname || '-',
              'แผนก': req.department || '-',
              'สาขา': req.office || '-',
              'เบอร์โทร': req.phone || '-',
              'อุปกรณ์': item.itemName,
              'หมวดหมู่': item.category || '-',
              'จำนวน': item.quantity,
              'ความเร่งด่วน': req.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ',
              'วันที่เบิก': new Date(req.requestDate).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
              'จำนวนวันที่ค้าง': days,
              'สถานะ': 'รอจัดส่ง'
            });
          });
        });
        const wsRequests = XLSX.utils.json_to_sheet(requestData);
        wsRequests['!cols'] = [
          { wch: 8 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 20 },
          { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 12 },
          { wch: 22 }, { wch: 15 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(wb, wsRequests, 'รอจัดส่งอุปกรณ์');
      }

      // 3. Export Pending Returns
      if (pendingReturns.length > 0) {
        const returnData: any[] = [];
        let rowIndex = 1;
        pendingReturns.forEach(ret => {
          const days = calculateBusinessDaysPending(ret.returnDate);
          const pendingItems = ret.items.filter(item => item.approvalStatus === 'pending' || !item.approvalStatus);
          pendingItems.forEach((item) => {
            returnData.push({
              'ลำดับ': rowIndex++,
              'ชื่อ-นามสกุล': `${ret.firstName} ${ret.lastName}`,
              'ชื่อเล่น': ret.nickname || '-',
              'แผนก': ret.department || '-',
              'สาขา': ret.office || '-',
              'เบอร์โทร': ret.phone || '-',
              'อุปกรณ์': item.itemName,
              'หมวดหมู่': item.category || '-',
              'จำนวน': item.quantity,
              'วันที่คืน': new Date(ret.returnDate).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
              'จำนวนวันที่ค้าง': days,
              'สถานะ': 'รออนุมัติ'
            });
          });
        });
        const wsReturns = XLSX.utils.json_to_sheet(returnData);
        wsReturns['!cols'] = [
          { wch: 8 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 20 },
          { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 22 },
          { wch: 15 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(wb, wsReturns, 'รออนุมัติคืนอุปกรณ์');
      }

      // 4. Export Pending Users
      if (pendingUsers.length > 0) {
        const userData = pendingUsers.map((user, index) => {
          const days = calculateBusinessDaysPending(user.createdAt);
          return {
            'ลำดับ': index + 1,
            'ประเภท': user.userType === 'individual' ? 'บุคคล' : 'สาขา',
            'ชื่อ-นามสกุล': `${user.firstName} ${user.lastName}`,
            'ชื่อเล่น': user.nickname || '-',
            'อีเมล': user.email,
            'สาขา': user.office,
            'วันที่สมัคร': new Date(user.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
            'จำนวนวันที่ค้าง': days,
            'สถานะ': 'รออนุมัติ'
          };
        });
        const wsUsers = XLSX.utils.json_to_sheet(userData);
        wsUsers['!cols'] = [
          { wch: 8 }, { wch: 12 }, { wch: 25 }, { wch: 12 }, 
          { wch: 30 }, { wch: 20 }, { wch: 22 }, { wch: 15 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(wb, wsUsers, 'รออนุมัติผู้ใช้');
      }

      // Generate filename
      const now = new Date();
      const dateStr = now.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).replace(/:/g, '-');
      
      const filename = `สรุปรายการรอดำเนินการ_${dateStr}_${timeStr}.xlsx`;

      // Export file
      XLSX.writeFile(wb, filename);
      
      toast.success(`ส่งออกข้อมูล ${totalPendingCount} รายการสำเร็จ`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    }
  };

  return (
    <Layout>
      <div className="max-w-full mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
          {/* Header */}
          <div className="flex flex-col justify-between items-center mb-7 xl:flex-row">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 pb-2 xl:pb-0">สรุปรายงานรอทำ</h1>
              <p className="text-sm text-gray-600">รวมรายการที่รอดำเนินการทั้งหมด</p>
            </div>
            <div className="flex flex-wrap justify-center gap-4 w-full xl:w-auto mt-5 xl:mt-0">
              <div className="flex items-center space-x-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg">
                <Clock className="w-5 h-5" />
                <span className="font-semibold">รอดำเนินการทั้งหมด: {totalPendingCount} รายการ</span>
              </div>
              <button
                onClick={() => fetchAllData(false)} // false = แสดง loading animation
                disabled={loading}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>รีเฟรช</span>
              </button>
              <button
                onClick={handleExportExcel}
                disabled={loading || totalPendingCount === 0}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={totalPendingCount === 0 ? 'ไม่มีข้อมูลให้ Export' : 'Export ข้อมูลเป็น Excel'}
              >
                <Upload className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-700 font-medium">รายงานแจ้งงาน IT</p>
                  <p className="text-2xl font-bold text-yellow-900">{pendingITIssues.length}</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-yellow-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 font-medium">ประวัติเบิก</p>
                  <p className="text-2xl font-bold text-blue-900">{pendingRequests.reduce((sum, req) => sum + req.items.length, 0)}</p>
                </div>
                <Package className="w-10 h-10 text-blue-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700 font-medium">ประวัติคืน</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {pendingReturns.reduce((sum, ret) => sum + ret.items.filter(item => item.approvalStatus === 'pending' || !item.approvalStatus).length, 0)}
                  </p>
                </div>
                <PackageOpen className="w-10 h-10 text-purple-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium">อนุมัติรายชื่อ</p>
                  <p className="text-2xl font-bold text-green-900">{pendingUsers.length}</p>
                </div>
                <Users className="w-10 h-10 text-green-500" />
              </div>
            </div>
          </div>

          {/* 1. IT Issues Table */}
          <div className="mb-10">
            <div className="flex items-center justify-between flex-col sm:flex-row mb-4 gap-4 sm:gap-0">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <h2 className="text-xl font-semibold text-gray-900">รายงานแจ้งงาน IT - รอดำเนินการ</h2>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm font-semibold rounded-full">
                  {pendingITIssues.length}
                </span>
              </div>
              <button
                onClick={() => router.push('/admin/it-reports')}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <span>ไปที่หน้าเต็ม</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-yellow-600">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">วันที่แจ้ง</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">ความเร่งด่วน</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Issue ID</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">ชื่อ</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">เบอร์โทร</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">อีเมล</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">หัวข้อปัญหา</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">วันที่ค้าง</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-left text-gray-500">
                        <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                        กำลังโหลดข้อมูล
                      </td>
                    </tr>
                  )}
                  {!loading && pendingITIssues.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        <CheckCircle className="inline-block w-5 h-5 mr-2 text-green-500" />
                        ไม่มีรายการรอดำเนินการ
                      </td>
                    </tr>
                  )}
                  {pendingITIssues.slice(0, 5).map((issue, index) => {
                    const pendingDays = calculateBusinessDaysPending(issue.reportDate);
                    const icon = getPendingIcon(pendingDays);
                    const rowColor = getRowColor(pendingDays, issue.urgency, index % 2 === 0 ? 'bg-white' : 'bg-yellow-50');
                    
                    return (
                      <tr key={issue._id} className={rowColor}>
                        <td className="px-6 py-4 text-sm text-gray-500 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            {icon && <span className="text-base">{icon}</span>}
                            <span>{new Date(issue.reportDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {getUrgencyBadge(issue.urgency)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-blue-600 text-center">
                          {issue.issueId}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-center">
                          {issue.firstName} {issue.lastName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-center">
                          {issue.phone}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-center">
                          {issue.email}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-center">
                          {issue.issueCategory}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-center">
                          {pendingDays > 0 ? `${pendingDays} วัน` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {pendingITIssues.length > 5 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 bg-gray-50">
                        <button
                          onClick={() => router.push('/admin/it-reports')}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          ดูทั้งหมด ({pendingITIssues.length} รายการ) →
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Request Logs Table */}
          <div className="mb-10">
            <div className="flex items-center justify-between flex-col sm:flex-row mb-4 gap-4 sm:gap-0">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">ประวัติเบิก - รอยืนยัน</h2>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                  {pendingRequests.reduce((sum, req) => sum + req.items.length, 0)}
                </span>
              </div>
              <button
                onClick={() => router.push('/admin/equipment-reports')}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <span>ไปที่หน้าเต็ม</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-600">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">วันที่เบิก</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">ชื่อผู้เบิก</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">แผนก</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">สาขา</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">เบอร์โทร</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">ชื่ออุปกรณ์</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">จำนวน</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">วันที่ค้าง</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-left text-gray-500">
                        <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                        กำลังโหลดข้อมูล
                      </td>
                    </tr>
                  )}
                  {!loading && pendingRequests.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        <CheckCircle className="inline-block w-5 h-5 mr-2 text-green-500" />
                        ไม่มีรายการรอยืนยัน
                      </td>
                    </tr>
                  )}
                  {pendingRequests.slice(0, 5).flatMap((request, reqIndex) => 
                    request.items.map((item, itemIndex) => {
                      const pendingDays = calculateBusinessDaysPending(request.requestDate);
                      const icon = getPendingIcon(pendingDays);
                      const rowColor = getRowColor(pendingDays, request.urgency, reqIndex % 2 === 0 ? 'bg-white' : 'bg-blue-50');
                      
                      return (
                        <tr key={`${request._id}-${itemIndex}`} className={rowColor}>
                          <td className="px-6 py-4 text-sm text-gray-500 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              {icon && <span className="text-base">{icon}</span>}
                              <span>{new Date(request.requestDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 text-center">
                            {request.firstName} {request.lastName}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 text-center">
                            {request.department || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 text-center">
                            {request.office}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 text-center">
                            {request.phone}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-500 text-center">
                            {item.itemName}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 text-center">
                            {item.quantity}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-center">
                            {pendingDays > 0 ? `${pendingDays} วัน` : '-'}
                          </td>
                        </tr>
                      );
                    })
                  ).slice(0, 5)}
                  {pendingRequests.reduce((sum, req) => sum + req.items.length, 0) > 5 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 bg-gray-50">
                        <button
                          onClick={() => router.push('/admin/equipment-reports')}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          ดูทั้งหมด ({pendingRequests.reduce((sum, req) => sum + req.items.length, 0)} รายการ) →
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Return Logs Table */}
          <div className="mb-10">
            <div className="flex items-center justify-between flex-col sm:flex-row mb-4 gap-4 sm:gap-0">
              <div className="flex items-center space-x-2">
                <PackageOpen className="w-5 h-5 text-purple-600" />
                <h2 className="text-xl font-semibold text-gray-900">ประวัติคืน - รอยืนยัน</h2>
                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-sm font-semibold rounded-full">
                  {pendingReturns.reduce((sum, ret) => sum + ret.items.filter(item => item.approvalStatus === 'pending' || !item.approvalStatus).length, 0)}
                </span>
              </div>
              <button
                onClick={() => router.push('/admin/equipment-reports')}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <span>ไปที่หน้าเต็ม</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-purple-600">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">วันที่คืน</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">ชื่อผู้คืน</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">แผนก</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">สาขา</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">เบอร์โทร</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">ชื่ออุปกรณ์</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">จำนวน</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">วันที่ค้าง</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-left text-gray-500">
                        <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                        กำลังโหลดข้อมูล
                      </td>
                    </tr>
                  )}
                  {!loading && pendingReturns.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        <CheckCircle className="inline-block w-5 h-5 mr-2 text-green-500" />
                        ไม่มีรายการรอยืนยัน
                      </td>
                    </tr>
                  )}
                  {pendingReturns.slice(0, 5).flatMap((returnLog, retIndex) => 
                    returnLog.items
                      .filter(item => item.approvalStatus === 'pending' || !item.approvalStatus)
                      .map((item, itemIndex) => {
                        const pendingDays = calculateBusinessDaysPending(returnLog.returnDate);
                        const icon = getPendingIcon(pendingDays);
                        const rowColor = getRowColor(pendingDays, undefined, retIndex % 2 === 0 ? 'bg-white' : 'bg-purple-50');
                        
                        return (
                          <tr key={`${returnLog._id}-${itemIndex}`} className={rowColor}>
                            <td className="px-6 py-4 text-sm text-gray-500 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                {icon && <span className="text-base">{icon}</span>}
                                <span>{new Date(returnLog.returnDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 text-center">
                              {returnLog.firstName} {returnLog.lastName}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 text-center">
                              {returnLog.department || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 text-center">
                              {returnLog.office}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 text-center">
                              {returnLog.phone || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-500 text-center">
                              {item.itemName}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 text-center">
                              {item.quantity}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-center">
                              {pendingDays > 0 ? `${pendingDays} วัน` : '-'}
                            </td>
                          </tr>
                        );
                      })
                  ).slice(0, 5)}
                  {pendingReturns.reduce((sum, ret) => sum + ret.items.filter(item => item.approvalStatus === 'pending' || !item.approvalStatus).length, 0) > 5 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 bg-gray-50">
                        <button
                          onClick={() => router.push('/admin/equipment-reports')}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          ดูทั้งหมด ({pendingReturns.reduce((sum, ret) => sum + ret.items.filter(item => item.approvalStatus === 'pending' || !item.approvalStatus).length, 0)} รายการ) →
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Pending Users Table */}
          <div className="mb-10">
            <div className="flex items-center justify-between flex-col sm:flex-row gap-2 sm:gap-0 mb-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-green-600" />
                <h2 className="text-xl font-semibold text-gray-900">อนุมัติรายชื่อ - รออนุมัติ</h2>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full">
                  {pendingUsers.length}
                </span>
              </div>
              <button
                onClick={() => router.push('/admin/users')}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <span>ไปที่หน้าเต็ม</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-green-600">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">User ID</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">ชื่อ-นามสกุล</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">ชื่อเล่น</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">อีเมล</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">สาขา</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">วันที่สร้าง</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">วันที่ค้าง</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-left text-gray-500">
                        <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                        กำลังโหลดข้อมูล
                      </td>
                    </tr>
                  )}
                  {!loading && pendingUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        <CheckCircle className="inline-block w-5 h-5 mr-2 text-green-500" />
                        ไม่มีผู้ใช้รอการอนุมัติ
                      </td>
                    </tr>
                  )}
                  {pendingUsers.slice(0, 5).map((user, index) => {
                    const pendingDays = calculateBusinessDaysPending(user.createdAt);
                    const icon = getPendingIcon(pendingDays);
                    const rowColor = getRowColor(pendingDays, undefined, index % 2 === 0 ? 'bg-white' : 'bg-green-50');
                    
                    return (
                      <tr key={user._id} className={rowColor}>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                            {user.user_id || 'รอสร้าง'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {user.userType === 'individual' ? `${user.firstName} ${user.lastName}` : user.office}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {user.nickname || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {user.office}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            {icon && <span className="text-base">{icon}</span>}
                            <span>{new Date(user.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-center">
                          {pendingDays > 0 ? `${pendingDays} วัน` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {pendingUsers.length > 5 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 bg-gray-50">
                        <button
                          onClick={() => router.push('/admin/users')}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          ดูทั้งหมด ({pendingUsers.length} รายการ) →
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
