'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import ConfirmationModal from './ConfirmationModal';

interface RecycleBinItem {
  _id: string;
  itemName: string;
  category: string;
  categoryId?: string;    // เพิ่ม categoryId สำหรับตรวจสอบซิมการ์ด
  serialNumber?: string;
  numberPhone?: string;   // เพิ่มเบอร์โทรศัพท์
  deleteType: 'individual_item' | 'category_bulk';
  deletedAt: string;
  deleteReason: string;
  deletedBy: string;
  deletedByName: string;
  permanentDeleteAt: string;
  isRestored: boolean;
}

interface CategoryItem {
  _id: { itemName: string; category: string };
  count: number;
  deletedAt: string;
  deleteReason: string;
  deletedBy: string;
  deletedByName: string;
  permanentDeleteAt: string;
  sampleId: string;
}

interface RecycleBinModalProps {
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

export default function RecycleBinModal({ isOpen, onClose, onInventoryRefresh }: RecycleBinModalProps) {
  const [activeTab, setActiveTab] = useState<'individual' | 'category'>('individual');
  const [individualItems, setIndividualItems] = useState<RecycleBinItem[]>([]);
  const [categoryItems, setCategoryItems] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
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

  // Fetch data when modal opens or tab changes
  useEffect(() => {
    if (isOpen) {
      fetchRecycleBinData();
    }
  }, [isOpen, activeTab, pagination.page]);

  const fetchRecycleBinData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/recycle-bin?type=${activeTab}&page=${pagination.page}&limit=${pagination.limit}`
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (activeTab === 'individual') {
          setIndividualItems(data.data);
        } else {
          setCategoryItems(data.data);
        }
        
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }));
      } else {
        toast.error('เกิดข้อผิดพลาดในการดึงข้อมูลถังขยะ');
      }
    } catch (error) {
      console.error('Error fetching recycle bin data:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (itemId: string, itemName: string) => {
    showConfirmation({
      title: '🔄 กู้คืนรายการ',
      message: `คุณต้องการกู้คืน "${itemName}" หรือไม่?`,
      confirmText: 'กู้คืน',
      confirmColor: 'green',
      icon: '♻️',
      onConfirm: () => executeRestore(itemId, itemName),
      isDangerous: false
    });
  };

  const executeRestore = async (itemId: string, itemName: string) => {
    // Set loading state in confirmation modal
    setConfirmationModal(prev => ({ ...prev, isLoading: true }));
    setRestoring(itemId);
    try {
      const response = await fetch('/api/admin/recycle-bin/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recycleBinId: itemId }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        
        // Refresh recycle bin data
        fetchRecycleBinData();
        
        // Refresh main inventory if callback provided
        if (onInventoryRefresh) {
          try {
            const refreshToast = toast.loading('🔄 กำลังอัพเดทข้อมูล inventory...');
            await onInventoryRefresh();
            toast.dismiss(refreshToast);
          } catch (error) {
            console.warn('Failed to refresh main inventory after restore:', error);
            toast.error('ข้อมูล inventory อาจไม่เป็นปัจจุบัน กรุณารีเฟรชหน้า');
          }
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'เกิดข้อผิดพลาดในการกู้คืน');
      }
    } catch (error) {
      console.error('Error restoring item:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setRestoring(null);
      closeConfirmation();
    }
  };

  const handlePermanentDelete = (itemId: string, itemName: string) => {
    showConfirmation({
      title: '⚠️ ลบถาวร - ขั้นตอนที่ 1',
      message: `คุณต้องการลบ "${itemName}" ถาวรหรือไม่?\n\n❌ การดำเนินการนี้ไม่สามารถยกเลิกได้!`,
      confirmText: 'ดำเนินการต่อ',
      confirmColor: 'red',
      icon: '⚠️',
      onConfirm: () => showSecondConfirmation(itemId, itemName),
      isDangerous: true
    });
  };

  const showSecondConfirmation = (itemId: string, itemName: string) => {
    showConfirmation({
      title: '❗ ยืนยันอีกครั้ง - ขั้นตอนสุดท้าย',
      message: `ลบ "${itemName}" ถาวรจากระบบ?\n\nข้อมูลจะหายไปตลอดกาล!`,
      confirmText: 'ลบถาวร',
      confirmColor: 'red',
      icon: '💀',
      onConfirm: () => executePermanentDelete(itemId, itemName),
      isDangerous: true
    });
  };

  const executePermanentDelete = async (itemId: string, itemName: string) => {
    // Set loading state in confirmation modal
    setConfirmationModal(prev => ({ ...prev, isLoading: true }));
    setRestoring(itemId); // Reuse restoring state for loading
    try {
      const response = await fetch('/api/admin/recycle-bin/permanent-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recycleBinId: itemId
        }),
      });

      if (response.ok) {
        toast.success(`ลบ "${itemName}" ถาวรเรียบร้อยแล้ว`);
        
        // Refresh data
        fetchRecycleBinData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'เกิดข้อผิดพลาดในการลบถาวร');
      }
    } catch (error) {
      console.error('Error permanent deleting item:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setRestoring(null);
      closeConfirmation();
    }
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

  const getStatusColor = (permanentDeleteAt: string) => {
    const days = getDaysUntilPermanentDelete(permanentDeleteAt);
    if (days <= 0) return 'text-red-600 bg-red-50';
    if (days <= 7) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="bg-gray-100 p-2 rounded-lg">
              🗑️
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">ถังขยะ</h2>
              <p className="text-sm text-gray-500">จัดการรายการที่ถูกลบ (ลบถาวรหลัง 30 วัน)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => {
              setActiveTab('individual');
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'individual'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🔧 อุปกรณ์ SN ที่ถูกลบ
          </button>
          <button
            onClick={() => {
              setActiveTab('category');
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'category'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📂 รายการอุปกรณ์ที่ถูกลบ
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-6">
              {activeTab === 'individual' ? (
                <IndividualItemsTab
                  items={individualItems}
                  onRestore={handleRestore}
                  onPermanentDelete={handlePermanentDelete}
                  restoring={restoring}
                  formatDate={formatDate}
                  getDaysUntilPermanentDelete={getDaysUntilPermanentDelete}
                  getStatusColor={getStatusColor}
                />
              ) : (
                <CategoryItemsTab
                  items={categoryItems}
                  onRestore={handleRestore}
                  onPermanentDelete={handlePermanentDelete}
                  restoring={restoring}
                  formatDate={formatDate}
                  getDaysUntilPermanentDelete={getDaysUntilPermanentDelete}
                  getStatusColor={getStatusColor}
                />
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && pagination.totalPages > 1 && (
          <div className="border-t p-4 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              แสดง {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} จาก {pagination.total} รายการ
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                ก่อนหน้า
              </button>
              <span className="px-3 py-1 text-sm">
                หน้า {pagination.page} จาก {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal */}
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
    </div>
  );
}

// Individual Items Tab Component
function IndividualItemsTab({ 
  items, 
  onRestore, 
  onPermanentDelete,
  restoring, 
  formatDate, 
  getDaysUntilPermanentDelete, 
  getStatusColor 
}: {
  items: RecycleBinItem[];
  onRestore: (id: string, name: string) => void;
  onPermanentDelete: (id: string, name: string) => void;
  restoring: string | null;
  formatDate: (date: string) => string;
  getDaysUntilPermanentDelete: (date: string) => number;
  getStatusColor: (date: string) => string;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🗑️</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">ไม่มีรายการในถังขยะ</h3>
        <p className="text-gray-500">ไม่มีอุปกรณ์ที่มี Serial Number ที่ถูกลบ</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const daysLeft = getDaysUntilPermanentDelete(item.permanentDeleteAt);
        const statusColor = getStatusColor(item.permanentDeleteAt);
        
        return (
          <div key={item._id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="font-medium text-gray-900">{item.itemName}</h3>
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                    {item.category}
                  </span>
                  {item.serialNumber && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full font-mono">
                      SN: {item.serialNumber}
                    </span>
                  )}
                  {item.numberPhone && (
                    <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full font-mono">
                      📱 {item.numberPhone}
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                  <div>
                    <span className="font-medium">วันที่ลบ:</span> {formatDate(item.deletedAt)}
                  </div>
                  <div>
                    <span className="font-medium">ลบโดย:</span> {item.deletedByName}
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium">เหตุผล:</span> {item.deleteReason}
                  </div>
                </div>

                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                  {daysLeft <= 0 ? (
                    <>⚠️ หมดอายุแล้ว - จะถูกลบถาวร</>
                  ) : daysLeft <= 7 ? (
                    <>⏰ เหลือ {daysLeft} วัน - จะถูกลบถาวร</>
                  ) : (
                    <>✅ เหลือ {daysLeft} วัน</>
                  )}
                </div>
              </div>

              <div className="ml-4 flex space-x-2">
                <button
                  onClick={() => {
                    const identifier = item.categoryId === 'cat_sim_card' && item.numberPhone 
                      ? `${item.itemName} (เบอร์: ${item.numberPhone})`
                      : item.serialNumber 
                        ? `${item.itemName} (SN: ${item.serialNumber})`
                        : item.itemName;
                    onRestore(item._id, identifier);
                  }}
                  disabled={restoring === item._id}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  {restoring === item._id ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                      <span>กำลังประมวลผล...</span>
                    </>
                  ) : (
                    <>
                      <span>♻️</span>
                      <span>กู้คืน</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    const identifier = item.categoryId === 'cat_sim_card' && item.numberPhone 
                      ? `${item.itemName} (เบอร์: ${item.numberPhone})`
                      : item.serialNumber 
                        ? `${item.itemName} (SN: ${item.serialNumber})`
                        : item.itemName;
                    onPermanentDelete(item._id, identifier);
                  }}
                  disabled={restoring === item._id}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  {restoring === item._id ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                      <span>กำลังประมวลผล...</span>
                    </>
                  ) : (
                    <>
                      <span>🗑️</span>
                      <span>ลบถาวร</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Category Items Tab Component
function CategoryItemsTab({ 
  items, 
  onRestore, 
  onPermanentDelete,
  restoring, 
  formatDate, 
  getDaysUntilPermanentDelete, 
  getStatusColor 
}: {
  items: CategoryItem[];
  onRestore: (id: string, name: string) => void;
  onPermanentDelete: (id: string, name: string) => void;
  restoring: string | null;
  formatDate: (date: string) => string;
  getDaysUntilPermanentDelete: (date: string) => number;
  getStatusColor: (date: string) => string;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📂</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">ไม่มีหมวดหมู่ในถังขยะ</h3>
        <p className="text-gray-500">ไม่มีหมวดหมู่ที่ถูกลบทั้งหมด</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const daysLeft = getDaysUntilPermanentDelete(item.permanentDeleteAt);
        const statusColor = getStatusColor(item.permanentDeleteAt);
        
        return (
          <div key={`${item._id.itemName}-${item._id.category}`} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="font-medium text-gray-900">{item._id.itemName}</h3>
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                    {item._id.category}
                  </span>
                  <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                    {item.count} รายการ
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                  <div>
                    <span className="font-medium">วันที่ลบ:</span> {formatDate(item.deletedAt)}
                  </div>
                  <div>
                    <span className="font-medium">ลบโดย:</span> {item.deletedByName}
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium">เหตุผล:</span> {item.deleteReason}
                  </div>
                </div>

                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                  {daysLeft <= 0 ? (
                    <>⚠️ หมดอายุแล้ว - จะถูกลบถาวร</>
                  ) : daysLeft <= 7 ? (
                    <>⏰ เหลือ {daysLeft} วัน - จะถูกลบถาวร</>
                  ) : (
                    <>✅ เหลือ {daysLeft} วัน</>
                  )}
                </div>
              </div>

              <div className="ml-4 flex space-x-2">
                <button
                  onClick={() => onRestore(item.sampleId, `${item._id.itemName} (${item.count} รายการ)`)}
                  disabled={restoring === item.sampleId}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  {restoring === item.sampleId ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                      <span>กำลังประมวลผล...</span>
                    </>
                  ) : (
                    <>
                      <span>♻️</span>
                      <span>กู้คืนทั้งหมด</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => onPermanentDelete(item.sampleId, `${item._id.itemName} (${item.count} รายการ)`)}
                  disabled={restoring === item.sampleId}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  {restoring === item.sampleId ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                      <span>กำลังประมวลผล...</span>
                    </>
                  ) : (
                    <>
                      <span>🗑️</span>
                      <span>ลบถาวร</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
