'use client';

import { useState } from 'react';
import Layout from '@/components/Layout';
import { toast } from 'react-hot-toast';
import { Search, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface IssueStatus {
  issueId: string;
  status: string;
  statusText: string;
  reportDate: string;
  completedDate?: string;
  closedDate?: string;
  firstName: string;
  lastName: string;
  issueCategory: string;
  urgency: string;
  description: string;
  notes?: string;
}

export default function ITTrackingPage() {
  const [issueId, setIssueId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [issueStatus, setIssueStatus] = useState<IssueStatus | null>(null);

  const handleTrackIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!issueId.trim()) {
        toast.error('กรุณากรอก Issue ID');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/track-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ issueId: issueId.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setIssueStatus(data.issue);
        toast.success(`สถานะปัจจุบัน: ${data.issue.statusText}`);
      } else {
        toast.error(data.error || 'ไม่พบ Issue ID นี้');
        setIssueStatus(null);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      setIssueStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-6 h-6 text-yellow-500" />;
      case 'in_progress':
        return <AlertCircle className="w-6 h-6 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'closed':
        return <CheckCircle className="w-6 h-6 text-gray-500" />;
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
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">ติดตามสถานะงาน IT</h1>

          {/* Search Form */}
          <form onSubmit={handleTrackIssue} className="mb-8">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Issue ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={issueId}
                    onChange={(e) => setIssueId(e.target.value)}
                    placeholder="กรอก Issue ID เช่น IT1754894813221"
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                  />
                  <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ค้นหา...
                    </div>
                  ) : (
                    'ติดตามสถานะ'
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Issue Status Display */}
          {issueStatus && (
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  รายละเอียดงาน
                </h2>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(issueStatus.status)}`}>
                  {getStatusIcon(issueStatus.status)}
                  <span className="ml-2">{issueStatus.statusText}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Issue ID
                    </label>
                    <p className="mt-1 text-lg font-mono text-gray-900">
                      {issueStatus.issueId}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      ผู้แจ้ง
                    </label>
                    <p className="mt-1 text-gray-900">
                      {issueStatus.firstName} {issueStatus.lastName}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      หัวข้อปัญหา
                    </label>
                    <p className="mt-1 text-gray-900">{issueStatus.issueCategory}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      ความเร่งด่วน
                    </label>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      issueStatus.urgency === 'very_urgent' 
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {issueStatus.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ'}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      วันที่แจ้ง
                    </label>
                    <p className="mt-1 text-gray-900">
                      {new Date(issueStatus.reportDate).toLocaleDateString('th-TH')} {' '}
                      {new Date(issueStatus.reportDate).toLocaleTimeString('th-TH')}
                    </p>
                  </div>

                  {issueStatus.completedDate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        วันที่ดำเนินการเสร็จ
                      </label>
                      <p className="mt-1 text-gray-900">
                        {new Date(issueStatus.completedDate).toLocaleDateString('th-TH')} {' '}
                        {new Date(issueStatus.completedDate).toLocaleTimeString('th-TH')}
                      </p>
                    </div>
                  )}

                  {issueStatus.closedDate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        วันที่ปิดงาน
                      </label>
                      <p className="mt-1 text-gray-900">
                        {new Date(issueStatus.closedDate).toLocaleDateString('th-TH')} {' '}
                        {new Date(issueStatus.closedDate).toLocaleTimeString('th-TH')}
                      </p>
                    </div>
                  )}

                  {issueStatus.notes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        หมายเหตุ
                      </label>
                      <p className="mt-1 text-gray-900">{issueStatus.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700">
                  รายละเอียดปัญหา
                </label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {issueStatus.description}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info Card */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-blue-500" />
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-800">
                  คำแนะนำ
                </h4>
                <p className="text-sm text-blue-700 mt-1">
                  หากไม่พบ Issue ID ที่ต้องการ กรุณาตรวจสอบใน inbox อีเมลของคุณ 
                  หรือติดต่อทีม IT โดยตรงที่ 090-272-8102
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
