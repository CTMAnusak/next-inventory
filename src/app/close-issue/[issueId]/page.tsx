'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, XCircle, AlertTriangle, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { handleAuthError } from '@/lib/auth-error-handler';
import AuthGuard from '@/components/AuthGuard';

interface ITIssue {
  _id: string;
  issueId: string;
  firstName: string;
  lastName: string;
  issueCategory: string;
  description: string;
  status: string;
  submittedAt: string;
  updatedAt?: string;
}

export default function CloseIssuePage() {
  const params = useParams();
  const issueId = params.issueId as string;
  
  const [issue, setIssue] = useState<ITIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showNotCloseForm, setShowNotCloseForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (issueId) {
      fetchIssue();
    }
  }, [issueId]);

  const fetchIssue = async () => {
    try {
      const response = await fetch(`/api/close-issue/${issueId}`);
      
      // ✅ จัดการ 401/403 error - เด้งออกจากระบบทันที
      if (handleAuthError(response)) {
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        setIssue(data);
        
        // Check if already completed
        if (data.status === 'completed') {
          setCompleted(true);
        }
      } else {
        toast.error('ไม่พบ Issue ID ที่ระบุ');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseIssue = async () => {
    if (!confirm('คุณต้องการปิดงานนี้หรือไม่?')) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/close-issue/${issueId}/close`, {
        method: 'POST',
      });

      // ✅ จัดการ 401/403 error - เด้งออกจากระบบทันที
      if (handleAuthError(response)) {
        return;
      }

      if (response.ok) {
        toast.success('ปิดงานเรียบร้อยแล้ว');
        setCompleted(true);
      } else {
        const data = await response.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNotCloseIssue = async () => {
    if (!notes.trim()) {
      toast.error('กรุณากรอกหมายเหตุ');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/close-issue/${issueId}/not-close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      });

      // ✅ จัดการ 401/403 error - เด้งออกจากระบบทันที
      if (handleAuthError(response)) {
        return;
      }

      if (response.ok) {
        toast.success('บันทึกหมายเหตุเรียบร้อยแล้ว');
        setCompleted(true);
      } else {
        const data = await response.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">ไม่พบ Issue ID</h1>
          <p className="text-gray-600">กรุณาตรวจสอบลิงค์และลองใหม่อีกครั้ง</p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">ขอบคุณที่ไว้ใจให้ทีม IT Support ดูแล</h1>
          <p className="text-gray-600">กรุณาคลิกปิดหน้าเว็บ</p>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-semibold text-gray-900 mb-4">การจัดการงาน IT</h1>
              <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full">
                <span className="font-semibold">Issue ID: {issue.issueId}</span>
              </div>
            </div>

          {/* Issue Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">รายละเอียดงาน</h2>
            <div className="space-y-3">
              <div>
                <span className="font-medium text-gray-700">ผู้แจ้ง:</span>
                <span className="ml-2 text-gray-900">{issue.firstName} {issue.lastName}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">หัวข้อปัญหา:</span>
                <span className="ml-2 text-gray-900">{issue.issueCategory}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">รายละเอียด:</span>
                <div className="mt-2 p-3 bg-white rounded border">
                  <p className="text-gray-900">{issue.description}</p>
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700">วันที่แจ้ง:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(issue.submittedAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
                </span>
              </div>
              {issue.updatedAt && (
                <div>
                  <span className="font-medium text-gray-700">วันที่ดำเนินการเสร็จ:</span>
                  <span className="ml-2 text-gray-900">
                    {new Date(issue.updatedAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Section */}
          {!showNotCloseForm ? (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  ทีม IT Support ได้ดำเนินการแก้ไขปัญหาของคุณแล้ว
                </h3>
                <p className="text-gray-600 mb-6">
                  กรุณาเลือกการดำเนินการต่อไป
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleCloseIssue}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>{actionLoading ? 'กำลังดำเนินการ...' : 'ยืนยันปิดงาน'}</span>
                </button>

                <button
                  onClick={() => setShowNotCloseForm(true)}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-yellow-600 text-white rounded-xl hover:bg-yellow-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle className="w-5 h-5" />
                  <span>ยืนยันไม่ปิดงาน</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <hr className="border-gray-300" />
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  เหตุผลที่ไม่ปิดงาน
                </h3>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                  rows={4}
                  placeholder="กรุณาระบุเหตุผลที่ยังไม่สามารถปิดงานได้..."
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setShowNotCloseForm(false)}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ยกเลิก
                </button>

                <button
                  onClick={handleNotCloseIssue}
                  disabled={actionLoading || !notes.trim()}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-yellow-600 text-white rounded-xl hover:bg-yellow-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                  <span>{actionLoading ? 'กำลังส่ง...' : 'ยืนยันไม่ปิดงาน'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </AuthGuard>
  );
}
