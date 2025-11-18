'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Edit, Trash2, Building, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import SearchableSelect from '@/components/SearchableSelect';

interface Office {
  _id?: string;
  office_id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface OfficeManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function OfficeManagementModal({ isOpen, onClose, onRefresh }: OfficeManagementModalProps) {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [deletingOfficeId, setDeletingOfficeId] = useState<string | null>(null);
  const [editingOfficeId, setEditingOfficeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [officeToDelete, setOfficeToDelete] = useState<Office | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchOffices();
    }
  }, [isOpen]);

  const fetchOffices = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/offices?includeInactive=true');
      if (response.ok) {
        const data = await response.json();
        setOffices(data);
      } else {
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูลสาขา');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({ name: '', description: '' });
    setShowAddModal(true);
  };

  const handleEdit = async (office: Office) => {
    setEditingOfficeId(office.office_id);
    try {
      // จำลองการโหลดเล็กน้อยเพื่อให้เห็นแอนิเมชัน
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setEditingOffice(office);
      setFormData({
        name: office.name,
        description: office.description || ''
      });
      setShowEditModal(true);
    } finally {
      setEditingOfficeId(null);
    }
  };

  const handleDeleteClick = (office: Office) => {
    setOfficeToDelete(office);
    setDeleteConfirmText('');
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!officeToDelete || deleteConfirmText !== 'delete') {
      return;
    }

    setDeletingOfficeId(officeToDelete.office_id);
    setShowDeleteConfirm(false);
    try {
      const response = await fetch(`/api/admin/offices/${officeToDelete.office_id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        // แสดงข้อมูล snapshot ถ้ามี
        const snapshotInfo = data.snapshot;
        if (snapshotInfo && snapshotInfo.completed) {
          const totalSnapshotted = 
            (snapshotInfo.updated?.users || 0) +
            (snapshotInfo.updated?.requestLogs || 0) +
            (snapshotInfo.updated?.returnLogs || 0) +
            (snapshotInfo.updated?.issueLogs || 0) +
            (snapshotInfo.updated?.inventoryItems || 0) +
            (snapshotInfo.updated?.deletedUsers || 0);
          
          if (totalSnapshotted > 0) {
            toast.success(`ลบสาขาสำเร็จ (ได้ snapshot ข้อมูล ${totalSnapshotted} รายการ)`, {
              duration: 5000
            });
          } else {
            toast.success('ลบสาขาสำเร็จ');
          }
        } else {
          toast.success('ลบสาขาสำเร็จ');
        }
        fetchOffices();
        if (onRefresh) onRefresh();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาดในการลบสาขา');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setDeletingOfficeId(null);
      setOfficeToDelete(null);
      setDeleteConfirmText('');
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setOfficeToDelete(null);
    setDeleteConfirmText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ ป้องกันการ submit ซ้ำ
    if (isSubmitting) {
      console.log('⚠️ Form is already submitting, ignoring duplicate submission');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('กรุณากรอกชื่อสาขา');
      return;
    }

    const isEdit = !!editingOffice;
    const url = isEdit ? `/api/admin/offices/${editingOffice?.office_id}` : '/api/admin/offices';
    const method = isEdit ? 'PUT' : 'POST';

    setIsSubmitting(true);
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(isEdit ? 'แก้ไขสาขาสำเร็จ' : 'เพิ่มสาขาสำเร็จ');
        setShowAddModal(false);
        setShowEditModal(false);
        setEditingOffice(null);
        setFormData({ name: '', description: '' });
        fetchOffices();
        if (onRefresh) onRefresh();
      } else {
        toast.error(data.error || `เกิดข้อผิดพลาดในการ${isEdit ? 'แก้ไข' : 'เพิ่ม'}สาขา`);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'oklch(0 0 0 / 0.6)' }}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Building className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">จัดการสาขา/ออฟฟิศ</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-4 flex justify-between items-center">
              <p className="text-sm text-gray-600">จัดการข้อมูลสาขา/ออฟฟิศทั้งหมด</p>
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                เพิ่มสาขา
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Office ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">ชื่อสาขา</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">คำอธิบาย</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">สถานะ</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {offices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          ไม่มีข้อมูลสาขา
                        </td>
                      </tr>
                    ) : (
                      offices.map((office) => (
                        <tr key={office._id || office.office_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{office.office_id}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{office.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{office.description || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              office.isActive 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {office.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEdit(office)}
                                disabled={editingOfficeId === office.office_id || deletingOfficeId === office.office_id}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="แก้ไข"
                              >
                                {editingOfficeId === office.office_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Edit className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteClick(office)}
                                disabled={editingOfficeId === office.office_id || deletingOfficeId === office.office_id}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="ลบ"
                              >
                                {deletingOfficeId === office.office_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[60]" style={{ backgroundColor: 'oklch(0 0 0 / 0.6)' }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">เพิ่มสาขาใหม่</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อสาขา *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="เช่น Rasa One, CTW"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  คำอธิบาย
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)"
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  เพิ่ม
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingOffice && (
        <div className="fixed inset-0 flex items-center justify-center z-[60]" style={{ backgroundColor: 'oklch(0 0 0 / 0.6)' }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">แก้ไขสาขา</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingOffice(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อสาขา *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="เช่น Rasa One, CTW"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  คำอธิบาย
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)"
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingOffice(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && officeToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-900">
                  ยืนยันการลบสาขา
                </span>
              </div>
              <button
                onClick={handleDeleteCancel}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={deletingOfficeId === officeToDelete.office_id}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    คุณแน่ใจหรือไม่ที่จะลบสาขา "{officeToDelete.name}"?
                  </h3>
                  <div className="text-sm text-gray-600 space-y-2">
                    <p>การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
                    <p>สาขานี้จะถูกลบออกจากระบบอย่างถาวร</p>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      พิมพ์ <span className="font-mono font-bold text-red-600">delete</span> เพื่อยืนยัน:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="delete"
                      disabled={deletingOfficeId === officeToDelete.office_id}
                      autoFocus
                    />
                    {deleteConfirmText && deleteConfirmText !== 'delete' && (
                      <p className="text-red-500 text-sm mt-1">กรุณาพิมพ์ "delete" ให้ถูกต้อง</p>
                    )}
                    {deleteConfirmText === 'delete' && (
                      <p className="text-green-600 text-sm mt-1">✓ ยืนยันแล้ว</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={deletingOfficeId === officeToDelete.office_id}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmText !== 'delete' || deletingOfficeId === officeToDelete.office_id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {deletingOfficeId === officeToDelete.office_id && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                ลบสาขา
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

