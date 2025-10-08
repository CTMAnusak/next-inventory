'use client';

import { useState, useEffect, useRef } from 'react';
import { enableDragScroll } from '@/lib/drag-scroll';
import Layout from '@/components/Layout';
import { 
  Search, 
  RefreshCw, 
  Download, 
  Eye, 
  Send,
  Filter,
  X,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  Phone,
  Mail,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Building
} from 'lucide-react';
import DatePicker from '@/components/DatePicker';
import { toast } from 'react-hot-toast';

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
  customCategory?: string;
  urgency: 'normal' | 'very_urgent';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'closed';
  images?: string[];
  notes?: string;
  reportDate: string;
  updatedAt?: string;
  completedAt?: string;
  closedAt?: string;
  assignedAdmin?: {
    name: string;
    email: string;
  };
  userFeedback?: {
    action: 'approved' | 'rejected';
    reason: string;
    submittedAt: string;
  };
}

interface ITAdmin {
  id: string;
  userId: string;
  name: string;
  email: string;
}

type TabType = 'pending' | 'in_progress' | 'completed' | 'closed';

export default function AdminITReportsPage() {
  const [issues, setIssues] = useState<ITIssue[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<ITIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [showFilters, setShowFilters] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<ITIssue | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  
  // IT Admin Selection
  const [itAdmins, setItAdmins] = useState<ITAdmin[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedIssueForAssign, setSelectedIssueForAssign] = useState<ITIssue | null>(null);
  
  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; status: string; text: string } | null>(null);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Drag scroll ref
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const categories = [
    'ปัญหา Internet',
    'ปัญหา Notebook/Computer',
    'ปัญหา ปริ้นเตอร์ และ อุปกรณ์',
    'ปัญหา TV/VDO Conference',
    'ปัญหา ตู้ฝากเงิน',
    'ปัญหา อุปกรณ์ มือถือและแท็บเลต',
    'ปัญหา เบอร์โทรศัพท์',
    'ปัญหา Nas เข้าไม่ได้ ใช้งานไม่ได้',
    'ขอ User Account Email ระบบงาน',
    'อื่น ๆ โปรดระบุ'
  ];

  // Note: This component uses IT issue categories, not inventory categories
  // So we keep the hardcoded categories array for IT issues

  useEffect(() => {
    fetchIssues();
    fetchItAdmins();
  }, []);

  // Initialize drag scrolling
  useEffect(() => {
    const element = tableContainerRef.current;
    if (!element) return;

    const cleanup = enableDragScroll(element);
    return cleanup;
  }, []);

  useEffect(() => {
    applyFilters();
  }, [issues, activeTab, searchTerm, urgencyFilter, categoryFilter, dateFilter]);

  // Handle escape key to close image modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showImageModal) {
        setShowImageModal(false);
      }
    };

    if (showImageModal) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [showImageModal]);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/it-reports');
      if (response.ok) {
        const data = await response.json();
        console.log('Admin IT Reports - Data fetched:', data);
        // Check if any issue has userFeedback
        const issuesWithFeedback = data.filter((issue: any) => issue.userFeedback);
        if (issuesWithFeedback.length > 0) {
          console.log('Issues with userFeedback:', issuesWithFeedback);
        }
        setIssues(data);
      } else {
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = issues.filter(issue => {
      // Filter by tab
      if (issue.status !== activeTab) return false;

      // Search filter
      const matchesSearch = !searchTerm || 
        issue.issueId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.description.toLowerCase().includes(searchTerm.toLowerCase());

      // Urgency filter
      const matchesUrgency = !urgencyFilter || issue.urgency === urgencyFilter;

      // Category filter
      const matchesCategory = !categoryFilter || issue.issueCategory === categoryFilter;

      // Date filter
      const matchesDate = !dateFilter || 
        new Date(issue.reportDate).toISOString().split('T')[0] === dateFilter;

      return matchesSearch && matchesUrgency && matchesCategory && matchesDate;
    });

    // Sort by urgency and date
    filtered.sort((a, b) => {
      // First by urgency (very_urgent first)
      if (a.urgency === 'very_urgent' && b.urgency === 'normal') return -1;
      if (a.urgency === 'normal' && b.urgency === 'very_urgent') return 1;
      
      // Then by submission date (newest first)
      return new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime();
    });

    setFilteredIssues(filtered);
    setCurrentPage(1);
  };

  const fetchItAdmins = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const users = await response.json();
        // กรองเฉพาะ users ที่มี userRole = 'it_admin'
        const itAdminUsers = users
          .filter((user: any) => user.userRole === 'it_admin')
          .map((user: any) => ({
            id: user._id,
            userId: user.user_id,
            name: user.userType === 'individual' 
              ? `${user.firstName} ${user.lastName}`.trim()
              : user.office,
            email: user.email
          }));
        setItAdmins(itAdminUsers);
      }
    } catch (error) {
      console.error('Failed to fetch IT admins:', error);
    }
  };



  const handleAcceptJob = (issue: ITIssue) => {
    setSelectedIssueForAssign(issue);
    setShowAssignModal(true);
  };

  const handleAssignAdmin = async (admin: ITAdmin) => {
    if (!selectedIssueForAssign) return;

    try {
      const response = await fetch(`/api/admin/it-reports/${selectedIssueForAssign._id}/send-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedAdmin: {
            name: admin.name,
            email: admin.email
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setShowAssignModal(false);
        setSelectedIssueForAssign(null);
        await fetchIssues();
      } else {
        const data = await response.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleStatusChange = async (issueId: string, currentStatus: string) => {
    if (currentStatus === 'pending') {
      // For pending, show assign modal
      const issue = issues.find(i => i._id === issueId);
      if (issue) {
        handleAcceptJob(issue);
      }
      return;
    }

    // For in_progress, show confirmation modal
    const actionText = 'ส่งงาน';
    setConfirmAction({ id: issueId, status: currentStatus, text: actionText });
    setShowConfirmModal(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    try {
      const response = await fetch(`/api/admin/it-reports/${confirmAction.id}/send-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        await fetchIssues();
      } else {
        const data = await response.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setShowConfirmModal(false);
      setConfirmAction(null);
    }
  };

  const handleViewDetails = (issue: ITIssue) => {
    console.log('Viewing issue details:', issue);
    console.log('Issue userFeedback:', issue.userFeedback);
    setSelectedIssue(issue);
    setShowDetailModal(true);
  };

  const exportToExcel = () => {
    toast('ฟีเจอร์ Export Excel จะพัฒนาในอนาคต');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">รอดำเนินการ</span>;
      case 'in_progress':
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">กำลังดำเนินการ</span>;
      case 'completed':
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">รอผู้ใช้ตรวจสอบ</span>;
      case 'closed':
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">ปิดงาน</span>;
      default:
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    return urgency === 'very_urgent' ? 
      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">ด่วนมาก</span> :
      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">ปกติ</span>;
  };

  // Pagination
  const totalPages = Math.ceil(filteredIssues.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredIssues.slice(startIndex, endIndex);

  const getNoDataColSpan = () => {
    return activeTab === 'completed' ? 11 : 10;
  };

  return (
    <Layout>
      <div className="max-w-full mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
          {/* Header */}
          <div className="flex flex-col justify-between items-center mb-7 xl:flex-row">
            <h1 className="text-2xl font-bold text-gray-900 pb-5 xl:pb-0">รายงานแจ้งงาน IT</h1> 
            <div className="flex flex-wrap justify-center gap-4 w-full xl:w-auto">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="w-full min-[400px]:w-3/5 min-[481px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>ฟิลเตอร์</span>
              </button>
              <button
                onClick={fetchIssues}
                disabled={loading}
                className="w-full min-[400px]:w-3/5 min-[481px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>รีเฟรช</span>
              </button>

              <button
                onClick={exportToExcel}
                className="w-full min-[400px]:w-3/5 min-[481px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
              <div className="grid max-[768px]:grid-cols-1 max-[1120px]:grid-cols-2 grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ค้นหา
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="Issue ID, ชื่อ, รายละเอียด"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ความเร่งด่วน
                  </label>
                  <select
                    value={urgencyFilter}
                    onChange={(e) => setUrgencyFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="very_urgent">ด่วนมาก</option>
                    <option value="normal">ปกติ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หมวดหมู่
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">ทั้งหมด</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่
                  </label>
                  <DatePicker
                    value={dateFilter}
                    onChange={(date) => setDateFilter(date)}
                    placeholder="dd/mm/yyyy"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6 overflow-x-auto overflow-y-hidden">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'pending', label: 'รอดำเนินการ', icon: Clock, count: issues.filter(i => i.status === 'pending').length },
                { key: 'in_progress', label: 'กำลังดำเนินการ', icon: CheckCircle, count: issues.filter(i => i.status === 'in_progress').length },
                { key: 'completed', label: 'รอผู้ใช้ตรวจสอบ', icon: AlertTriangle, count: issues.filter(i => i.status === 'completed').length },
                { key: 'closed', label: 'ปิดงาน', icon: XCircle, count: issues.filter(i => i.status === 'closed').length },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as TabType)}
                    className={`flex max-[580px]:flex-col max-[580px]:gap-2 max-[580px]:mr-3 items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className='flex max-[560px]:flex-row items-center max-[560px]:mr-0 gap-2'>
                      <Icon className="w-4 h-4" />
                      <span className="w-max">{tab.label}</span>
                    </div>
                      
                    <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none rounded-full ${
                      activeTab === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Table */}
          <div ref={tableContainerRef} className="table-container">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-600">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    วันที่แจ้ง
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    ความเร่งด่วน
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    Issue ID
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    ชื่อ
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    เบอร์โทร
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    อีเมล
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    หัวข้อปัญหา
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    รายละเอียด
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    สถานะงาน
                  </th>
                  {(activeTab === 'pending' || activeTab === 'in_progress') && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      การดำเนินการ
                    </th>
                  )}
                  {activeTab !== 'pending' && activeTab !== 'in_progress' && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      วันที่ดำเนินการเสร็จ
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading && (
                  <tr>
                    <td colSpan={getNoDataColSpan()} className="px-6 py-8 text-center text-gray-500">
                      <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                      กำลังโหลดข้อมูล
                    </td>
                  </tr>
                )}
                {!loading && currentItems.length === 0 && (
                  <tr>
                    <td colSpan={getNoDataColSpan()} className="px-6 py-8 text-center text-gray-500">ไม่พบข้อมูล</td>
                  </tr>
                )}
                {currentItems.map((issue, index) => (
                  <tr 
                    key={issue._id} 
                    className={issue.urgency === 'very_urgent' ? 'bg-yellow-50' : (index % 2 === 0 ? 'bg-white' : 'bg-blue-50')}
                  >
                    <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                      {new Date(issue.reportDate).toLocaleDateString('th-TH')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getUrgencyBadge(issue.urgency)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-blue-600 text-center text-selectable">
                      {issue.issueId}
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-selectable">
                      <div className={
                        (issue as any).userId?.pendingDeletion 
                          ? 'text-orange-600' 
                          : !issue.firstName 
                          ? 'text-gray-500 italic' 
                          : 'text-gray-900'
                      }>
                        {issue.firstName && issue.lastName ? (
                          <>
                            {issue.firstName} {issue.lastName}
                            {(issue as any).userId?.pendingDeletion && ' (รอลบ)'}
                          </>
                        ) : (
                          '(ผู้ใช้ถูกลบแล้ว)'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                      {issue.phone}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                      {issue.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                      {issue.issueCategory}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleViewDetails(issue)}
                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-sm cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        <span>ดูรายละเอียด</span>
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(issue.status)}
                    </td>
                    {activeTab === 'pending' && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleStatusChange(issue._id, 'pending')}
                          className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm cursor-pointer"
                        >
                          <Clock className="w-4 h-4" />
                          <span>รับงาน</span>
                        </button>
                      </td>
                    )}
                    {activeTab === 'in_progress' && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleStatusChange(issue._id, 'in_progress')}
                          className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                          <span>ส่งงาน</span>
                        </button>
                      </td>
                    )}
                    {activeTab !== 'pending' && activeTab !== 'in_progress' && (
                      <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                        {issue.updatedAt ? new Date(issue.updatedAt).toLocaleDateString('th-TH') : '-'}
                      </td>
                    )}

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center text-sm text-gray-700">
                <span>
                  แสดง {startIndex + 1} ถึง {Math.min(endIndex, filteredIssues.length)} จาก {filteredIssues.length} รายการ
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ←
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 border rounded-md text-sm ${
                      currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedIssue && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-4xl w-full mx-4 border border-white/20 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">รายละเอียด Issue #{selectedIssue.issueId}</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Status & Priority Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-blue-500" />
                      <span className="font-semibold text-gray-900">สถานะ:</span>
                      {getStatusBadge(selectedIssue.status)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      <span className="font-semibold text-gray-900">ความเร่งด่วน:</span>
                      {getUrgencyBadge(selectedIssue.urgency)}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Issue ID</p>
                    <p className="text-blue-600 font-mono font-semibold">{selectedIssue.issueId}</p>
                  </div>
                </div>
              </div>

              {/* Personal Information Section */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="w-1 h-6 bg-blue-500 rounded-full mr-3"></div>
                  ข้อมูลผู้แจ้ง
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div className="flex items-center space-x-3 mb-3">
                      <User className="w-5 h-5 text-blue-500" />
                      <label className="text-sm font-semibold text-gray-700">ชื่อ-นามสกุล</label>
                    </div>
                    <div className={
                      (selectedIssue as any).userId?.pendingDeletion 
                        ? 'text-orange-600' 
                        : !selectedIssue.firstName 
                        ? 'text-gray-500 italic' 
                        : 'text-gray-900'
                    }>
                      {selectedIssue.firstName && selectedIssue.lastName ? (
                        <>
                          <p className="font-medium">
                            {selectedIssue.firstName} {selectedIssue.lastName}
                            {(selectedIssue as any).userId?.pendingDeletion && ' (รอลบ)'}
                          </p>
                          <p className="text-sm">({selectedIssue.nickname})</p>
                        </>
                      ) : (
                        <p className="font-medium">(ผู้ใช้ถูกลบแล้ว)</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div className="flex items-center space-x-3 mb-3">
                      <Building className="w-5 h-5 text-green-500" />
                      <label className="text-sm font-semibold text-gray-700">สาขา / แผนก</label>
                    </div>
                    <p className="text-gray-900 font-medium">{selectedIssue.office}</p>
                    <p className="text-gray-600 text-sm">{selectedIssue.department}</p>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="flex items-center space-x-3 mb-3">
                      <Phone className="w-5 h-5 text-green-500" />
                      <label className="text-sm font-semibold text-gray-700">เบอร์โทรศัพท์</label>
                    </div>
                    <p className="text-gray-900 font-medium">{selectedIssue.phone}</p>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="flex items-center space-x-3 mb-3">
                      <Mail className="w-5 h-5 text-red-500" />
                      <label className="text-sm font-semibold text-gray-700">อีเมล</label>
                    </div>
                    <p className="text-gray-900 font-medium break-all">{selectedIssue.email}</p>
                  </div>
                </div>
              </div>

              {/* Problem Information Section */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="w-1 h-6 bg-purple-500 rounded-full mr-3"></div>
                  ข้อมูลปัญหา
                </h4>
                
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <label className="block text-sm font-semibold text-purple-700 mb-2">ประเภทปัญหา</label>
                  <p className="text-gray-900 font-medium">
                    {selectedIssue.issueCategory}
                    {selectedIssue.customCategory && (
                      <span className="text-purple-600"> ({selectedIssue.customCategory})</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Timeline Section */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="w-1 h-6 bg-green-500 rounded-full mr-3"></div>
                  ไทม์ไลน์
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <div className="flex items-center space-x-3 mb-2">
                      <Calendar className="w-5 h-5 text-green-500" />
                      <label className="text-sm font-semibold text-green-700">วันที่แจ้ง</label>
                    </div>
                    <p className="text-gray-900 font-medium">
                      {new Date(selectedIssue.reportDate).toLocaleDateString('th-TH', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-gray-600 text-sm">
                      {new Date(selectedIssue.reportDate).toLocaleTimeString('th-TH')}
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="flex items-center space-x-3 mb-2">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      <label className="text-sm font-semibold text-blue-700">อัปเดตล่าสุด</label>
                    </div>
                    <p className="text-gray-900 font-medium">
                      {new Date(selectedIssue.updatedAt || selectedIssue.reportDate).toLocaleDateString('th-TH', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-gray-600 text-sm">
                      {new Date(selectedIssue.updatedAt || selectedIssue.reportDate).toLocaleTimeString('th-TH')}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Problem Description Section */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="w-1 h-6 bg-orange-500 rounded-full mr-3"></div>
                  รายละเอียดปัญหา
                </h4>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                  <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{selectedIssue.description}</p>
                </div>
              </div>

              {/* Additional Information Section */}
              {(selectedIssue.updatedAt || selectedIssue.closedAt || selectedIssue.notes || selectedIssue.userFeedback) && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <div className="w-1 h-6 bg-yellow-500 rounded-full mr-3"></div>
                    ข้อมูลเพิ่มเติม
                  </h4>
                  
                  <div className="space-y-4">
                    {selectedIssue.updatedAt && (
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                        <label className="block text-sm font-semibold text-yellow-700 mb-1">วันที่ดำเนินการเสร็จ</label>
                        <p className="text-gray-900 font-medium">
                          {new Date(selectedIssue.updatedAt).toLocaleDateString('th-TH', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                    
                    {selectedIssue.closedAt && (
                      <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <label className="block text-sm font-semibold text-green-700 mb-1">วันที่ปิดงาน</label>
                        <p className="text-gray-900 font-medium">
                          {new Date(selectedIssue.closedAt).toLocaleDateString('th-TH', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                    
                    {selectedIssue.notes && (
                      <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                        <label className="block text-sm font-semibold text-amber-700 mb-2">หมายเหตุ</label>
                        <p className="text-gray-900 leading-relaxed">{selectedIssue.notes}</p>
                      </div>
                    )}
                    
                    {selectedIssue.userFeedback && (
                      <div className={`p-4 rounded-lg border ${
                        selectedIssue.userFeedback.action === 'rejected' 
                          ? 'bg-red-50 border-red-100' 
                          : 'bg-green-50 border-green-100'
                      }`}>
                        <div className="flex items-center space-x-2 mb-2">
                          {selectedIssue.userFeedback.action === 'rejected' ? (
                            <XCircle className="w-5 h-5 text-red-500" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          )}
                          <label className={`text-sm font-semibold ${
                            selectedIssue.userFeedback.action === 'rejected' 
                              ? 'text-red-700' 
                              : 'text-green-700'
                          }`}>
                            {selectedIssue.userFeedback.action === 'rejected' ? 'ผู้ใช้ส่งกลับให้แก้ไข' : 'ผู้ใช้อนุมัติงาน'}
                          </label>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm font-medium text-gray-700">เหตุผล:</span>
                            <p className="text-gray-900 mt-1 leading-relaxed">{selectedIssue.userFeedback.reason}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700">วันที่ส่งกลับ:</span>
                            <p className="text-gray-800 text-sm">
                              {new Date(selectedIssue.userFeedback.submittedAt).toLocaleDateString('th-TH', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })} เวลา {new Date(selectedIssue.userFeedback.submittedAt).toLocaleTimeString('th-TH')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {selectedIssue.images && selectedIssue.images.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <ImageIcon className="w-5 h-5 text-purple-500" />
                    <span className="font-semibold">รูปภาพ:</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedIssue.images.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={`/assets/IssueLog/${image}`}
                          alt={`Issue ${selectedIssue.issueId} - Image ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            setSelectedImage(`/assets/IssueLog/${image}`);
                            setShowImageModal(true);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Image Modal */}
        {showImageModal && selectedImage && (
          <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-60"
            onClick={() => setShowImageModal(false)}
          >
            <div 
              className="relative max-w-4xl max-h-[90vh] p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 z-10 transition-all duration-200"
                title="ปิดรูปภาพ"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={selectedImage}
                alt="Full size"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        )}



        {/* Assign Admin Modal */}
        {showAssignModal && selectedIssueForAssign && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full border border-white/20">
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">เลือก IT Admin</h3>
                <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100 mb-6">
                  <p className="text-sm text-gray-900 mb-2">
                    เลือก IT Admin ที่จะรับผิดชอบงาน
                  </p>
                  <p className="text-lg font-semibold text-blue-700">#{selectedIssueForAssign.issueId}</p>
                </div>
                
                {itAdmins.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"></path>
                      </svg>
                    </div>
                    <p className="text-gray-800 text-lg mb-2">ไม่มี IT Admin ในระบบ</p>
                    <p className="text-gray-500 text-sm mb-6">กรุณาเพิ่ม User ที่มี role "Admin ทีม IT" ก่อนใช้งาน</p>
                    <button
                      onClick={() => {
                        setShowAssignModal(false);
                        window.open('/admin/users', '_blank');
                      }}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        จัดการ Users
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">เลือก IT Admin ที่เหมาะสม</h4>
                    {itAdmins.map((admin) => (
                      <button
                        key={admin.id}
                        onClick={() => handleAssignAdmin(admin)}
                        className="w-full p-4 text-left bg-gray-50 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                            <span className="text-blue-600 font-semibold text-sm">
                              {admin.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{admin.name}</p>
                            <p className="text-sm text-gray-600">{admin.email}</p>
                          </div>
                          <div className="ml-auto">
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && confirmAction && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full border border-white/20">
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">ยืนยันการดำเนินการ</h3>
                <button 
                  onClick={() => setShowConfirmModal(false)} 
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-6">
                  <p className="text-gray-900 text-center">
                    คุณต้องการ<span className="font-semibold text-orange-700">{confirmAction.text}</span>นี้หรือไม่?
                  </p>
                  <p className="text-sm text-gray-600 text-center mt-2">
                    การดำเนินการนี้จะเปลี่ยนสถานะงานเป็น "รอผู้ใช้ตรวจสอบ"
                  </p>
                </div>
                
                <div className="flex space-x-3 justify-end">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleConfirmAction}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    ยืนยัน
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
