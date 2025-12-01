'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { ChevronDown, ChevronUp, RotateCcw, Trash2, Calendar, User, Package } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

interface RecycleBinItem {
  _id: string;
  serialNumber?: string;
  numberPhone?: string;
  originalData: any;
}

interface GroupedRecycleBinItem {
  _id: string; // inventoryMasterId
  itemName: string;
  category: string;
  categoryId: string;
  categoryName?: string; // เพิ่มฟิลด์สำหรับชื่อหมวดหมู่
  deleteType: 'individual_item' | 'bulk_delete';
  deletedAt: string;
  deleteReason: string;
  deletedBy: string;
  deletedByName: string;
  permanentDeleteAt: string;
  totalItems: number;
  items: RecycleBinItem[];
}

interface GroupedRecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInventoryRefresh?: () => Promise<void>;
}

// Confirmation Modal Interface
interface ConfirmationModalData {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  confirmColor: 'green' | 'red' | 'blue';
  icon: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
  isLoading?: boolean;
}

export default function GroupedRecycleBinModal({ isOpen, onClose, onInventoryRefresh }: GroupedRecycleBinModalProps) {
  const [groupedItems, setGroupedItems] = useState<GroupedRecycleBinItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [restoring, setRestoring] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  // Confirmation Modal State
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalData>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    confirmColor: 'blue',
    icon: '',
    onConfirm: () => {},
    onCancel: () => {},
    isDangerous: false,
    isLoading: false
  });

  // Helper function to show confirmation modal
  const showConfirmation = (config: Omit<ConfirmationModalData, 'isOpen' | 'onCancel'>) => {
    setConfirmationModal({
      ...config,
      isOpen: true,
      onCancel: () => setConfirmationModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  // Helper function to close confirmation modal
  const closeConfirmation = () => {
    setConfirmationModal(prev => ({ ...prev, isOpen: false }));
  };

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchGroupedRecycleBinData();
    }
  }, [isOpen, pagination.page]);

  const fetchGroupedRecycleBinData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/recycle-bin?grouped=true&page=${pagination.page}&limit=${pagination.limit}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setGroupedItems(data.data);
        
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }));
      } else {
        toast.error('เกิดข้อผิดพลาดในการดึงข้อมูลถังขยะ');
      }
    } catch (error) {
      console.error('Error fetching grouped recycle bin data:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleGroupRestore = (group: GroupedRecycleBinItem) => {
    const itemDetails = getItemTypeBreakdown(group.items);
    const detailsText = [
      itemDetails.withSerialNumber > 0 ? `• อุปกรณ์ที่มี SN: ${itemDetails.withSerialNumber} ชิ้น` : '',
      itemDetails.withPhoneNumber > 0 ? `• ซิมการ์ด: ${itemDetails.withPhoneNumber} ชิ้น` : '',
      itemDetails.other > 0 ? `• อุปกรณ์อื่นๆ: ${itemDetails.other} ชิ้น` : ''
    ].filter(Boolean).join('\n');

    showConfirmation({
      title: '🔄 กู้คืนรายการทั้งหมด',
      message: `คุณต้องการกู้คืน "${group.itemName}" ทั้งหมด ${group.totalItems} ชิ้น หรือไม่?\n\n📋 รายละเอียด:\n${detailsText}`,
      confirmText: 'กู้คืนทั้งหมด',
      confirmColor: 'green',
      icon: '♻️',
      onConfirm: () => executeGroupRestore(group),
      isDangerous: false
    });
  };

  const executeGroupRestore = async (group: GroupedRecycleBinItem) => {
    setConfirmationModal(prev => ({ ...prev, isLoading: true }));
    setRestoring(group._id);
    try {
      const response = await fetch('/api/admin/recycle-bin/group-restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inventoryMasterId: group._id }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        
        // Refresh recycle bin data
        fetchGroupedRecycleBinData();
        
        // Refresh main inventory if callback provided
        if (onInventoryRefresh) {
          try {
            const refreshToast = toast.loading('🔄 กำลังอัพเดทข้อมูล inventory...');
            await onInventoryRefresh();
            toast.dismiss(refreshToast);
          } catch (error) {
            console.warn('Failed to refresh main inventory after restore:', error);
            toast('ข้อมูล inventory อาจไม่เป็นปัจจุบัน กรุณารีเฟรชหน้า', { icon: '⚠️' });
          }
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'เกิดข้อผิดพลาดในการกู้คืน');
      }
    } catch (error) {
      console.error('Error restoring group:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setRestoring(null);
      closeConfirmation();
    }
  };

  const handleGroupPermanentDelete = (group: GroupedRecycleBinItem) => {
    const itemDetails = getItemTypeBreakdown(group.items);
    const detailsText = [
      itemDetails.withSerialNumber > 0 ? `• อุปกรณ์ที่มี SN: ${itemDetails.withSerialNumber} ชิ้น` : '',
      itemDetails.withPhoneNumber > 0 ? `• ซิมการ์ด: ${itemDetails.withPhoneNumber} ชิ้น` : '',
      itemDetails.other > 0 ? `• อุปกรณ์อื่นๆ: ${itemDetails.other} ชิ้น` : ''
    ].filter(Boolean).join('\n');

    showConfirmation({
      title: '⚠️ ลบถาวรทั้งหมด - ขั้นตอนที่ 1',
      message: `คุณต้องการลบ "${group.itemName}" ทั้งหมด ${group.totalItems} ชิ้น ถาวรหรือไม่?\n\n📋 รายละเอียด:\n${detailsText}\n\n❌ การดำเนินการนี้ไม่สามารถยกเลิกได้!`,
      confirmText: 'ดำเนินการต่อ',
      confirmColor: 'red',
      icon: '⚠️',
      onConfirm: () => showSecondConfirmation(group),
      isDangerous: true
    });
  };

  const showSecondConfirmation = (group: GroupedRecycleBinItem) => {
    showConfirmation({
      title: '🚨 ยืนยันการลบถาวร - ขั้นตอนสุดท้าย',
      message: `กรุณายืนยันอีกครั้ง:\n\nคุณต้องการลบ "${group.itemName}" ทั้งหมด ${group.totalItems} ชิ้น ออกจากระบบถาวรหรือไม่?\n\n⚠️ ข้อมูลจะหายไปตลอดกาล!`,
      confirmText: 'ลบถาวร',
      confirmColor: 'red',
      icon: '💀',
      onConfirm: () => executeGroupPermanentDelete(group),
      isDangerous: true
    });
  };

  const executeGroupPermanentDelete = async (group: GroupedRecycleBinItem) => {
    setConfirmationModal(prev => ({ ...prev, isLoading: true }));
    try {
      const response = await fetch('/api/admin/recycle-bin/group-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inventoryMasterId: group._id }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        
        // Refresh recycle bin data
        fetchGroupedRecycleBinData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'เกิดข้อผิดพลาดในการลบ');
      }
    } catch (error) {
      console.error('Error permanently deleting group:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      closeConfirmation();
    }
  };

  const getItemTypeBreakdown = (items: RecycleBinItem[]) => {
    return {
      withSerialNumber: items.filter(item => item.serialNumber).length,
      withPhoneNumber: items.filter(item => item.numberPhone).length,
      other: items.filter(item => !item.serialNumber && !item.numberPhone).length
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysUntilPermanentDelete = (permanentDeleteAt: string) => {
    const now = new Date();
    const deleteDate = new Date(permanentDeleteAt);
    const diffTime = deleteDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-pink-600 rounded-t-2xl p-6 text-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold">🗑️ ถังขยะ</h2>
                  <p className="text-red-100 text-sm">จัดการรายการอุปกรณ์ที่ถูกลบ (รอกู้คืนภายใน 30 วัน)</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-white text-4xl pb-2">×</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col p-7">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                </div>
              </div>
            ) : groupedItems.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">ถังขยะว่างเปล่า</p>
                  <p className="text-sm">ไม่มีรายการที่ถูกลบ</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-4">
                  {groupedItems.map((group) => {
                    const isExpanded = expandedGroups.has(group._id);
                    const itemDetails = getItemTypeBreakdown(group.items);
                    const daysLeft = getDaysUntilPermanentDelete(group.permanentDeleteAt);
                    
                    return (
                      <div key={group._id} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                        {/* Group Header */}
                        <div className="p-4 bg-white border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center mb-2">
                                <h3 className="text-lg font-semibold text-gray-900 mr-3">
                                  🗑️ {group.itemName} <span className="text-black text-base font-normal">(หมวดหมู่ : {group.categoryName || group.category})</span>
                                </h3>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  group.deleteType === 'bulk_delete' 
                                    ? 'bg-orange-100 text-orange-800' 
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {group.deleteType === 'bulk_delete' ? 'ลบทั้งหมด' : 'ลบรายการเดียว'}
                                </span>
                                <span className="ml-2 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                                  รวม {group.totalItems} ชิ้น
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                                <div className="flex items-center">
                                  <Calendar className="w-4 h-4 mr-2" />
                                  {formatDate(group.deletedAt)}
                                </div>
                                <div className="flex items-center">
                                  <User className="w-4 h-4 mr-2" />
                                  {group.deletedByName}
                                </div>
                                <div className="flex items-center">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    daysLeft > 7 ? 'bg-green-100 text-green-800' :
                                    daysLeft > 3 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    เหลือ {daysLeft} วัน
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={() => handleGroupRestore(group)}
                                disabled={restoring === group._id}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center disabled:opacity-50"
                              >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                {restoring === group._id ? 'กำลังกู้คืน...' : 'กู้คืน'}
                              </button>
                              
                              <button
                                onClick={() => handleGroupPermanentDelete(group)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                ลบถาวร
                              </button>
                              
                              <button
                                onClick={() => toggleGroupExpansion(group._id)}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-4 h-4 mr-2" />
                                    ซ่อน
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-4 h-4 mr-2" />
                                    ดูรายละเอียด
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                          
                          {/* Delete Reason */}
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">เหตุผล:</span> {group.deleteReason}
                            </p>
                          </div>
                        </div>
                        
                        {/* Expandable Details */}
                        {isExpanded && (
                          <div className="p-4 bg-gray-50">
                            <h4 className="font-medium text-gray-900 mb-3">📋 รายละเอียดอุปกรณ์:</h4>
                            
                            <div className="space-y-3 mb-4 text-sm">
                              {itemDetails.other > 0 && (
                                <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3 rounded-r-lg">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-amber-800">📦 อุปกรณ์ที่ไม่มี SN/เบอร์</div>
                                    <div className="text-amber-600">{itemDetails.other} ชิ้น</div>
                                  </div>
                                </div>
                              )}
                              
                              {itemDetails.withSerialNumber > 0 && (
                                <div className="bg-purple-50 border-l-4 border-purple-400 px-4 py-3 rounded-r-lg">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-purple-800">📱 อุปกรณ์ที่มี SN</div>
                                    <div className="text-purple-600">{itemDetails.withSerialNumber} ชิ้น</div>
                                  </div>
                                </div>
                              )}
                              
                              {itemDetails.withPhoneNumber > 0 && (
                                <div className="bg-emerald-50 border-l-4 border-emerald-400 px-4 py-3 rounded-r-lg">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-emerald-800">📞 ซิมการ์ด</div>
                                    <div className="text-emerald-600">{itemDetails.withPhoneNumber} ชิ้น</div>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* Detailed Item List - แสดงรายการ SN/เบอร์โทรในแถวเดียวกัน */}
                            <div className="space-y-3">
                              {/* อุปกรณ์ที่มี SN */}
                              {itemDetails.withSerialNumber > 0 && (
                                <div className="bg-white p-3 rounded-lg border border-gray-200 text-sm">
                                  <div className="flex flex-wrap gap-2">
                                    {group.items
                                      .filter(item => item.serialNumber)
                                      .map((item) => (
                                        <span key={item._id} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                          SN: {item.serialNumber}
                                        </span>
                                      ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* ซิมการ์ด */}
                              {itemDetails.withPhoneNumber > 0 && (
                                <div className="bg-white p-3 rounded-lg border border-gray-200 text-sm">
                                  <div className="flex flex-wrap gap-2">
                                    {group.items
                                      .filter(item => item.numberPhone)
                                      .map((item, index) => (
                                        <span key={item._id} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                          #{index + 1} 📞 {item.numberPhone}
                                        </span>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="border-t border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    แสดง {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} จาก {pagination.total} รายการ
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ก่อนหน้า
                    </button>
                    <span className="px-3 py-2 bg-red-100 text-red-800 rounded-lg font-medium">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        title={confirmationModal.title}
        message={confirmationModal.message}
        confirmText={confirmationModal.confirmText}
        confirmColor={confirmationModal.confirmColor}
        icon={confirmationModal.icon}
        onConfirm={confirmationModal.onConfirm}
        onCancel={confirmationModal.onCancel}
        isDangerous={confirmationModal.isDangerous}
        isLoading={confirmationModal.isLoading}
      />
    </>
  );
}
