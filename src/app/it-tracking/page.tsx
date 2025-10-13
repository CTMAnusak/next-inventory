'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { toast } from 'react-hot-toast';
import { Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, Eye, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface IssueItem {
  _id: string;
  issueId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  office: string;
  issueCategory: string;
  customCategory?: string;
  urgency: string;
  description: string;
  status: string;
  statusText: string;
  reportDate: string;
  acceptedDate?: string;
  completedDate?: string;
  closedDate?: string;
  notes?: string;
  images?: string[];
  assignedAdmin?: {
    name: string;
    email: string;
  };
}

export default function ITTrackingPage() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<IssueItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (user) {
      fetchUserIssues();
    }
  }, [user]);

  const fetchUserIssues = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/issues');
      const data = await response.json();

      if (response.ok) {
        setIssues(data.issues);
      } else {
        toast.error(data.error || 'ไม่สามารถดึงข้อมูลได้');
        setIssues([]);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      setIssues([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = (issue: IssueItem) => {
    setSelectedIssue(issue);
    setShowDetailModal(true);
  };

  const handleApprovalAction = (action: 'approve' | 'reject', issue: IssueItem) => {
    setSelectedIssue(issue);
    setApprovalAction(action);
    setRejectionReason('');
    setShowApprovalModal(true);
  };

  const submitApproval = async () => {
    if (!selectedIssue || !approvalAction) return;

    try {
      const response = await fetch('/api/user/approve-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          issueId: selectedIssue._id,
          action: approvalAction,
          reason: rejectionReason
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        fetchUserIssues(); // Refresh the list
        setShowApprovalModal(false);
        setApprovalAction(null);
        setRejectionReason('');
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Approval error:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleRefresh = () => {
    fetchUserIssues();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-6 h-6 text-yellow-500" />;
      case 'in_progress':
        return <AlertCircle className="w-6 h-6 text-blue-500" />;
      case 'completed':
        return <AlertCircle className="w-6 h-6 text-orange-500" />;
      case 'closed':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      default:
        return <XCircle className="w-6 h-6 text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'closed':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 sm:gap-0">
            <h1 className="text-2xl font-bold text-gray-900">รายการแจ้งปัญหา IT ของคุณ</h1>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              รีเฟรช
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">กำลังโหลดข้อมูล...</span>
            </div>
          )}

          {/* Issues List */}
          {!isLoading && issues.length > 0 && (
            <div className="space-y-4">
              {issues.map((issue) => (
                <div
                  key={issue._id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {issue.issueId}
                        </h3>
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(issue.status)}`}>
                          {getStatusIcon(issue.status)}
                          <span className="ml-1">{issue.statusText}</span>
                        </div>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          issue.urgency === 'very_urgent' 
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {issue.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ'}
                        </span>
                      </div>

                      {/* ข้อมูลผู้แจ้ง */}
                      <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-gray-500">ชื่อ-นามสกุล</p>
                            <p className="text-sm font-medium text-gray-900">{issue.firstName} {issue.lastName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">เบอร์โทรศัพท์</p>
                            <p className="text-sm font-medium text-gray-900">{issue.phone}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">อีเมล</p>
                            <p className="text-sm font-medium text-gray-900">{issue.email}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-gray-600">หัวข้อปัญหา</p>
                          <p className="text-gray-900">
                            {issue.issueCategory}
                            {issue.customCategory && ` (${issue.customCategory})`}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">วันที่แจ้ง</p>
                          <p className="text-gray-900">
                            {new Date(issue.reportDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })} {' '}
                            {new Date(issue.reportDate).toLocaleTimeString('th-TH', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              timeZone: 'Asia/Bangkok'
                            })}
                          </p>
                        </div>
                      </div>
                      
                      {/* แสดงข้อมูล IT Admin ที่รับงาน */}
                      <div className="mb-3 p-3 rounded-lg border">
                        {issue.assignedAdmin && (issue.status === 'in_progress' || issue.status === 'completed' || issue.status === 'closed') ? (
                          <div className="bg-blue-50 border-blue-200 p-3 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <p className="text-sm font-medium text-blue-700">IT Admin ผู้รับผิดชอบ</p>
                            </div>
                            <p className="text-blue-900 font-semibold mt-1">
                              {issue.assignedAdmin.name}
                            </p>
                            <p className="text-blue-600 text-sm">
                              {issue.assignedAdmin.email}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-yellow-50 border-yellow-200 p-3 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-yellow-600" />
                              <p className="text-sm font-medium text-yellow-700">ผู้รับผิดชอบ</p>
                            </div>
                            <p className="text-yellow-900 font-semibold mt-1">
                              รอแอดมินรับงาน
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mb-3">
                        <p className="text-sm text-gray-600">รายละเอียด</p>
                        <p className="text-gray-900 line-clamp-2">
                          {issue.description}
                        </p>
                      </div>

                      {/* Show action buttons for completed status */}
                      {issue.status === 'completed' && (
                        <div className="flex gap-2 mt-3">
                          <button 
                            onClick={() => handleApprovalAction('approve', issue)}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            ✅ ผ่าน
                          </button>
                          <button 
                            onClick={() => handleApprovalAction('reject', issue)}
                            className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
                            ❌ ไม่ผ่าน
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="ml-4">
                      <button
                        onClick={() => handleViewDetails(issue)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        ดูรายละเอียด
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && issues.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">ไม่มีรายการแจ้งปัญหา</h3>
              <p className="mt-1 text-sm text-gray-500">
                คุณยังไม่เคยแจ้งปัญหา IT หรือเข้าสู่ระบบด้วยอีเมลอื่น
              </p>
            </div>
          )}

          {/* Detail Modal */}
          {showDetailModal && selectedIssue && (
            <div 
              className="fixed inset-0 bg-black/30 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
              onClick={() => setShowDetailModal(false)}
            >
              <div 
                className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-1">
                        รายละเอียดงาน {selectedIssue.issueId}
                      </h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border-2 ${getStatusColor(selectedIssue.status)}`}>
                          {getStatusIcon(selectedIssue.status)}
                          <span className="ml-2">{selectedIssue.statusText}</span>
                        </span>
                        <span className={`inline-flex px-3 py-1 text-sm font-bold rounded-full border-2 ${
                          selectedIssue.urgency === 'very_urgent' 
                            ? 'bg-red-50 text-red-700 border-red-300'
                            : 'bg-gray-50 text-gray-700 border-gray-300'
                        }`}>
                          ความเร่งด่วน: {selectedIssue.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* ข้อมูลผู้แจ้ง */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <div className="w-1 h-6 bg-blue-500 rounded-full mr-3"></div>
                        ข้อมูลผู้แจ้ง
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded-lg">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">ชื่อผู้แจ้ง</label>
                          <p className="text-gray-900 font-medium">{selectedIssue.firstName} {selectedIssue.lastName}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">เบอร์โทร</label>
                          <p className="text-gray-900 font-medium">{selectedIssue.phone}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">อีเมลผู้แจ้ง</label>
                          <p className="text-gray-900 font-medium">{selectedIssue.email}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">แผนก</label>
                          <p className="text-gray-900 font-medium">{selectedIssue.department}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg md:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">ออฟฟิศ/สาขา</label>
                          <p className="text-gray-900 font-medium">{selectedIssue.office}</p>
                        </div>
                      </div>
                    </div>

                    {/* IT Admin ผู้รับผิดชอบ */}
                    <div className={`p-5 rounded-xl border-2 ${
                      selectedIssue.assignedAdmin 
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' 
                        : 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200'
                    }`}>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                        <div className={`w-1 h-6 rounded-full mr-3 ${selectedIssue.assignedAdmin ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        ชื่อ IT Admin ผู้รับผิดชอบ
                      </h4>
                      {selectedIssue.assignedAdmin ? (
                        <div className="bg-white p-4 rounded-lg">
                          <p className="text-green-900 font-bold text-lg">{selectedIssue.assignedAdmin.name}</p>
                          <p className="text-green-600 text-sm mt-1">{selectedIssue.assignedAdmin.email}</p>
                        </div>
                      ) : (
                        <div className="bg-white p-4 rounded-lg flex items-center">
                          <Clock className="w-5 h-5 text-yellow-600 mr-2" />
                          <p className="text-yellow-900 font-bold">รอแอดมินรับงาน</p>
                        </div>
                      )}
                    </div>

                    {/* รายละเอียดปัญหา */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <div className="w-1 h-6 bg-purple-500 rounded-full mr-3"></div>
                        รายละเอียดปัญหา
                      </h4>
                      
                      <div className="space-y-4">
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                          <label className="block text-sm font-semibold text-purple-700 mb-2">ประเภทปัญหา / หัวข้อ</label>
                          <p className="text-gray-900 font-medium text-lg">
                            {selectedIssue.issueCategory}
                            {selectedIssue.customCategory && (
                              <span className="text-purple-600"> ({selectedIssue.customCategory})</span>
                            )}
                          </p>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">รายละเอียด</label>
                          <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{selectedIssue.description}</p>
                        </div>

                        {/* รูปภาพ */}
                        {selectedIssue.images && selectedIssue.images.length > 0 && (
                          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                            <label className="block text-sm font-semibold text-indigo-700 mb-3">รูปภาพประกอบ</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {selectedIssue.images.map((image, index) => (
                                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-indigo-200 hover:border-indigo-400 transition-colors">
                                  <img 
                                    src={image} 
                                    alt={`Issue image ${index + 1}`}
                                    className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                                    onClick={() => window.open(image, '_blank')}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timeline Section */}
                    <div className="bg-gradient-to-r from-green-50 to-teal-50 p-5 rounded-xl border border-green-200">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <div className="w-1 h-6 bg-green-500 rounded-full mr-3"></div>
                        ไทม์ไลน์
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* วันที่แจ้งงาน */}
                        <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
                          <label className="block text-sm font-semibold text-green-700 mb-1">วันที่แจ้งงาน</label>
                          <p className="text-gray-900 font-medium">
                            {new Date(selectedIssue.reportDate).toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              timeZone: 'Asia/Bangkok'
                            })}
                          </p>
                          <p className="text-gray-600 text-sm">
                            {new Date(selectedIssue.reportDate).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}
                          </p>
                        </div>
                        
                        {/* วันที่แอดมินรับงาน */}
                        <div className={`bg-white p-4 rounded-lg border-l-4 ${selectedIssue.acceptedDate ? 'border-blue-500' : 'border-gray-300'}`}>
                          <label className="block text-sm font-semibold text-blue-700 mb-1">วันที่แอดมินรับงาน</label>
                          {selectedIssue.acceptedDate ? (
                            <>
                              <p className="text-gray-900 font-medium">
                                {new Date(selectedIssue.acceptedDate).toLocaleDateString('th-TH', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  timeZone: 'Asia/Bangkok'
                                })}
                              </p>
                              <p className="text-gray-600 text-sm">
                                {new Date(selectedIssue.acceptedDate).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}
                              </p>
                            </>
                          ) : (
                            <p className="text-gray-400 font-medium">-</p>
                          )}
                        </div>

                        {/* วันที่แอดมินดำเนินการเสร็จ */}
                        <div className={`bg-white p-4 rounded-lg border-l-4 ${selectedIssue.completedDate ? 'border-purple-500' : 'border-gray-300'}`}>
                          <label className="block text-sm font-semibold text-purple-700 mb-1">วันที่แอดมินดำเนินการเสร็จ</label>
                          {selectedIssue.completedDate ? (
                            <>
                              <p className="text-gray-900 font-medium">
                                {new Date(selectedIssue.completedDate).toLocaleDateString('th-TH', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  timeZone: 'Asia/Bangkok'
                                })}
                              </p>
                              <p className="text-gray-600 text-sm">
                                {new Date(selectedIssue.completedDate).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}
                              </p>
                            </>
                          ) : (
                            <p className="text-gray-400 font-medium">-</p>
                          )}
                        </div>
                        
                        {/* วันที่ปิดงาน */}
                        <div className={`bg-white p-4 rounded-lg border-l-4 ${selectedIssue.closedDate ? 'border-emerald-500' : 'border-gray-300'}`}>
                          <label className="block text-sm font-semibold text-emerald-700 mb-1">วันที่ปิดงาน</label>
                          {selectedIssue.closedDate ? (
                            <>
                              <p className="text-gray-900 font-medium">
                                {new Date(selectedIssue.closedDate).toLocaleDateString('th-TH', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  timeZone: 'Asia/Bangkok'
                                })}
                              </p>
                              <p className="text-gray-600 text-sm">
                                {new Date(selectedIssue.closedDate).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}
                              </p>
                            </>
                          ) : (
                            <p className="text-gray-400 font-medium">-</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* หมายเหตุ */}
                    {selectedIssue.notes && (
                      <div className="bg-yellow-50 p-5 rounded-xl border border-yellow-200">
                        <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                          <div className="w-1 h-6 bg-yellow-500 rounded-full mr-3"></div>
                          หมายเหตุ
                        </h4>
                        <div className="bg-white p-4 rounded-lg">
                          <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">{selectedIssue.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                    >
                      ปิด
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Approval Modal */}
          {showApprovalModal && selectedIssue && approvalAction && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full border border-white/20">
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">
                    {approvalAction === 'approve' ? 'ยืนยันการอนุมัติ' : 'ส่งกลับให้แก้ไข'}
                  </h3>
                  <button 
                    onClick={() => setShowApprovalModal(false)} 
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-6">
                  <div className={`p-4 rounded-xl border mb-6 ${
                    approvalAction === 'approve' 
                      ? 'bg-green-50 border-green-100' 
                      : 'bg-red-50 border-red-100'
                  }`}>
                    <p className="text-gray-900 text-center mb-2">
                      <strong>งาน:</strong> {selectedIssue.issueId}
                    </p>
                    <p className="text-gray-900 text-center">
                      {approvalAction === 'approve' 
                        ? 'คุณต้องการอนุมัติผลงานนี้หรือไม่?' 
                        : 'คุณต้องการส่งกลับให้แก้ไขหรือไม่?'
                      }
                    </p>
                    
                    {approvalAction === 'reject' && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          เหตุผลที่ไม่อนุมัติ
                        </label>
                        <textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="กรุณาระบุเหตุผลที่ต้องแก้ไข..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-3 justify-end">
                    <button
                      onClick={() => setShowApprovalModal(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={submitApproval}
                      disabled={approvalAction === 'reject' && !rejectionReason.trim()}
                      className={`px-4 py-2 text-white rounded-lg transition-colors ${
                        approvalAction === 'approve'
                          ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-300'
                          : 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
                      }`}
                    >
                      {approvalAction === 'approve' ? 'อนุมัติ' : 'ส่งกลับ'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
