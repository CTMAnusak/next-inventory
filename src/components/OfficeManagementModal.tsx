'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Edit, Trash2, Building, Loader2 } from 'lucide-react';
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

  const handleEdit = (office: Office) => {
    setEditingOffice(office);
    setFormData({
      name: office.name,
      description: office.description || ''
    });
    setShowEditModal(true);
  };

  const handleDelete = async (officeId: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบสาขานี้?')) {
      return;
    }

    setDeletingOfficeId(officeId);
    try {
      const response = await fetch(`/api/admin/offices/${officeId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('ลบสาขาสำเร็จ');
        fetchOffices();
        if (onRefresh) onRefresh();
      } else {
        if (data.usage) {
          toast.error(`ไม่สามารถลบได้: มีการใช้งานอยู่ (ผู้ใช้: ${data.usage.users}, รายการเบิก: ${data.usage.requestLogs}, รายการคืน: ${data.usage.returnLogs})`, {
            duration: 5000
          });
        } else {
          toast.error(data.error || 'เกิดข้อผิดพลาดในการลบสาขา');
        }
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setDeletingOfficeId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('กรุณากรอกชื่อสาขา');
      return;
    }

    const isEdit = !!editingOffice;
    const url = isEdit ? `/api/admin/offices/${editingOffice?.office_id}` : '/api/admin/offices';
    const method = isEdit ? 'PUT' : 'POST';

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
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="แก้ไข"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(office.office_id)}
                                disabled={deletingOfficeId === office.office_id}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

