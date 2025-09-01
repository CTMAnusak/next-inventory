'use client';

import { useState, useEffect } from 'react';
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
  Image as ImageIcon
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
  status: 'pending' | 'in_progress' | 'completed';
  images?: string[];
  notes?: string;
  submittedAt: string;
  updatedAt?: string;
  completedAt?: string;
  closedAt?: string;
}

type TabType = 'pending' | 'in_progress' | 'completed';

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

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

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

  useEffect(() => {
    fetchIssues();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [issues, activeTab, searchTerm, urgencyFilter, categoryFilter, dateFilter]);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/it-reports');
      if (response.ok) {
        const data = await response.json();
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
        new Date(issue.submittedAt).toISOString().split('T')[0] === dateFilter;

      return matchesSearch && matchesUrgency && matchesCategory && matchesDate;
    });

    // Sort by urgency and date
    filtered.sort((a, b) => {
      // First by urgency (very_urgent first)
      if (a.urgency === 'very_urgent' && b.urgency === 'normal') return -1;
      if (a.urgency === 'normal' && b.urgency === 'very_urgent') return 1;
      
      // Then by submission date (newest first)
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });

    setFilteredIssues(filtered);
    setCurrentPage(1);
  };

  const handleSendWork = async (issueId: string) => {
    if (!confirm('คุณต้องการส่งงานนี้หรือไม่?')) return;

    try {
      const response = await fetch(`/api/admin/it-reports/${issueId}/send-work`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('ส่งงานเรียบร้อยแล้ว');
        await fetchIssues();
      } else {
        const data = await response.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleViewDetails = (issue: ITIssue) => {
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
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">ดำเนินการแล้ว</span>;
      case 'completed':
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
      <div className="max-w-7xl mx-auto">
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

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6 overflow-x-auto overflow-y-hidden">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'pending', label: 'รอดำเนินการ', icon: Clock, count: issues.filter(i => i.status === 'pending').length },
                { key: 'in_progress', label: 'ดำเนินการแล้ว', icon: CheckCircle, count: issues.filter(i => i.status === 'in_progress').length },
                { key: 'completed', label: 'ปิดงาน', icon: XCircle, count: issues.filter(i => i.status === 'completed').length },
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

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    วันที่แจ้ง
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ความเร่งด่วน
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issue ID
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ชื่อ
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    เบอร์โทร
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    อีเมล
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    หัวข้อปัญหา
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    รายละเอียด
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    สถานะงาน
                  </th>
                  {activeTab === 'pending' && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ส่งงาน
                    </th>
                  )}
                  {activeTab !== 'pending' && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      วันที่ดำเนินการเสร็จ
                    </th>
                  )}
                  {activeTab === 'completed' && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      วันที่ปิดงาน
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
                {currentItems.map((issue) => (
                  <tr 
                    key={issue._id} 
                    className={issue.urgency === 'very_urgent' ? 'bg-yellow-50' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {new Date(issue.submittedAt).toLocaleDateString('th-TH')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getUrgencyBadge(issue.urgency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 text-center">
                      {issue.issueId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {issue.firstName} {issue.lastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {issue.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {issue.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {issue.issueCategory}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleViewDetails(issue)}
                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-sm"
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
                          onClick={() => handleSendWork(issue._id)}
                          className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                        >
                          <Send className="w-4 h-4" />
                          <span>ส่งงาน</span>
                        </button>
                      </td>
                    )}
                    {activeTab !== 'pending' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {issue.updatedAt ? new Date(issue.updatedAt).toLocaleDateString('th-TH') : '-'}
                      </td>
                    )}
                    {activeTab === 'completed' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {issue.closedAt ? new Date(issue.closedAt).toLocaleDateString('th-TH') : '-'}
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <span className="font-semibold">ความเร่งด่วน:</span>
                    {getUrgencyBadge(selectedIssue.urgency)}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    <span className="font-semibold">สถานะงาน:</span>
                    {getStatusBadge(selectedIssue.status)}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <span className="font-semibold">อัปเดตสถานะล่าสุดเมื่อ:</span>
                    <span>{new Date(selectedIssue.updatedAt || selectedIssue.submittedAt).toLocaleDateString('th-TH')}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-green-500" />
                    <span className="font-semibold">วันที่แจ้ง:</span>
                    <span>{new Date(selectedIssue.submittedAt).toLocaleDateString('th-TH')}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-purple-500" />
                    <span className="font-semibold">Issue ID:</span>
                    <span className="text-blue-600 font-mono">{selectedIssue.issueId}</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <User className="w-5 h-5 text-blue-500" />
                    <span className="font-semibold">ชื่อ:</span>
                    <span>{selectedIssue.firstName} {selectedIssue.lastName} ({selectedIssue.nickname})</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">สาขา:</span>
                    <span>{selectedIssue.office}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Phone className="w-5 h-5 text-green-500" />
                    <span className="font-semibold">เบอร์โทร:</span>
                    <span>{selectedIssue.phone}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Mail className="w-5 h-5 text-red-500" />
                    <span className="font-semibold">อีเมล:</span>
                    <span>{selectedIssue.email}</span>
                  </div>
                  
                  <div>
                    <span className="font-semibold">ประเภทปัญหา:</span>
                    <span className="ml-2">{selectedIssue.issueCategory}</span>
                    {selectedIssue.customCategory && (
                      <span className="ml-2 text-gray-600">({selectedIssue.customCategory})</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <span className="font-semibold">รายละเอียดปัญหา:</span>
                <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedIssue.description}</p>
                </div>
              </div>
              
              {selectedIssue.updatedAt && (
                <div className="mt-4">
                  <span className="font-semibold">วันที่ดำเนินการเสร็จ:</span>
                  <span className="ml-2">{new Date(selectedIssue.updatedAt).toLocaleDateString('th-TH')}</span>
                </div>
              )}
              
              {selectedIssue.closedAt && (
                <div className="mt-4">
                  <span className="font-semibold">วันที่ปิดงาน:</span>
                  <span className="ml-2">{new Date(selectedIssue.closedAt).toLocaleDateString('th-TH')}</span>
                </div>
              )}
              
              {selectedIssue.notes && (
                <div className="mt-4">
                  <span className="font-semibold">หมายเหตุ:</span>
                  <div className="mt-2 p-4 bg-yellow-50 rounded-lg">
                    <p className="text-gray-700">{selectedIssue.notes}</p>
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
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60">
            <div className="relative max-w-4xl max-h-[90vh] p-4">
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
              >
                <X className="w-8 h-8" />
              </button>
              <img
                src={selectedImage}
                alt="Full size"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
