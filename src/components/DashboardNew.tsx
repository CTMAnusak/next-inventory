'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Package, PackageOpen, AlertTriangle, BarChart3, Users, Plus, X, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { enableDragScroll } from '@/lib/drag-scroll';

interface ICategoryConfig {
  id: string;
  name: string;
  isSystemCategory: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

interface IStatusConfig {
  id: string;
  name: string;
  order: number;
  isSystemConfig: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface IConditionConfig {
  id: string;
  name: string;
  order: number;
  isSystemConfig: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface IItemMaster {
  _id: string;
  itemName: string;
  categoryId: string;
  // hasSerialNumber removed - use itemDetails.withSerialNumber > 0 instead
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IOwnedItem {
  _id: string;
  itemMasterId: string;
  serialNumber?: string;
  numberPhone?: string;
  statusId: string;
  conditionId: string;
  currentOwnership: {
    ownerType: 'user_owned';
    userId: string;
    ownedSince: Date;
  };
  sourceInfo: {
    addedBy: 'user';
    addedByUserId: string;
    dateAdded: Date;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  // Populated fields
  itemName?: string;
  categoryId?: string;
  statusName?: string;
  conditionName?: string;
  statusColor?: string;
  conditionColor?: string;
}

export default function DashboardNew() {
  const { user, loading } = useAuth();
  const [showAddOwned, setShowAddOwned] = useState(false);
  const [ownedItems, setOwnedItems] = useState<IOwnedItem[]>([]);
  const [categoryConfigs, setCategoryConfigs] = useState<ICategoryConfig[]>([]);
  const [statusConfigs, setStatusConfigs] = useState<IStatusConfig[]>([]);
  const [conditionConfigs, setConditionConfigs] = useState<IConditionConfig[]>([]);
  const [itemMasters, setItemMasters] = useState<IItemMaster[]>([]);
  
  // Form states
  const [form, setForm] = useState({
    itemName: '',
    categoryId: '',
    itemMasterId: '',
    serialNumber: '',
    numberPhone: '',
    statusId: 'status_available',
    conditionId: 'cond_working',
    quantity: 1,
    notes: ''
  });
  
  // UI states
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [availableItems, setAvailableItems] = useState<IItemMaster[]>([]);
  const [showNewItemInput, setShowNewItemInput] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [ownedLoading, setOwnedLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Drag scroll ref
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConfigurations();
    fetchOwnedItems();
  }, []);

  useEffect(() => {
    if (selectedCategoryId) {
      fetchItemMastersByCategory(selectedCategoryId);
    }
  }, [selectedCategoryId]);

  // Initialize drag scrolling
  useEffect(() => {
    const element = tableContainerRef.current;
    if (!element) return;

    const cleanup = enableDragScroll(element);
    return cleanup;
  }, [ownedItems]);

  const fetchConfigurations = async () => {
    try {
      const response = await fetch('/api/admin/inventory-config');
      if (response.ok) {
        const data = await response.json();
        setCategoryConfigs(data.categories || []);
        setStatusConfigs(data.statuses || []);
        setConditionConfigs(data.conditions || []);
      }
    } catch (error) {
      console.error('Error fetching configurations:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดการตั้งค่า');
    }
  };

  const fetchItemMastersByCategory = async (categoryId: string) => {
    try {
      const response = await fetch(`/api/admin/item-masters?categoryId=${categoryId}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setAvailableItems(data.itemMasters || []);
      }
    } catch (error) {
      console.error('Error fetching item masters:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดรายการอุปกรณ์');
    }
  };

  const fetchOwnedItems = async () => {
    setOwnedLoading(true);
    try {
      // เพิ่ม query parameters ที่จำเป็น
      const params = new URLSearchParams();
      if (user?.firstName) params.set('firstName', user.firstName);
      if (user?.lastName) params.set('lastName', user.lastName);
      if (user?.office) params.set('office', user.office);
      if (user?.id) params.set('userId', String(user.id));
      
      const response = await fetch(`/api/user/owned-equipment?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setOwnedItems(data.items || []);
      } else {
        console.error('Error response:', response.status, response.statusText);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูลอุปกรณ์');
      }
    } catch (error) {
      console.error('Error fetching owned items:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setOwnedLoading(false);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setForm(prev => ({ ...prev, categoryId, itemMasterId: '', itemName: '' }));
    setShowNewItemInput(false);
    setNewItemName('');
  };

  const handleItemMasterChange = (itemMasterId: string) => {
    const selectedItem = availableItems.find(item => item._id === itemMasterId);
    setForm(prev => ({
      ...prev,
      itemMasterId,
      itemName: selectedItem?.itemName || '',
      serialNumber: '',
      numberPhone: ''
    }));
  };

  const handleAddNewItem = () => {
    if (!newItemName.trim()) {
      toast.error('กรุณาระบุชื่ออุปกรณ์');
      return;
    }
    
    setForm(prev => ({
      ...prev,
      itemName: newItemName.trim(),
      itemMasterId: '',
      serialNumber: '',
      numberPhone: ''
    }));
    setShowNewItemInput(false);
    setNewItemName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ ป้องกันการ submit ซ้ำ
    if (isSubmitting) {
      console.log('⚠️ Form is already submitting, ignoring duplicate submission');
      return;
    }
    
    if (!form.itemName || !form.categoryId) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const requestData = {
        itemName: form.itemName,
        categoryId: form.categoryId,
        serialNumber: form.serialNumber || undefined,
        numberPhone: form.numberPhone || undefined,
        statusId: form.statusId,
        conditionId: form.conditionId,
        quantity: form.quantity,
        notes: form.notes || undefined
      };

      const response = await fetch('/api/user/owned-equipment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || 'เพิ่มอุปกรณ์เรียบร้อยแล้ว');
        
        // Reset form
        setForm({
          itemName: '',
          categoryId: '',
          itemMasterId: '',
          serialNumber: '',
          numberPhone: '',
          statusId: 'status_available',
          conditionId: 'cond_working',
          quantity: 1,
          notes: ''
        });
        setSelectedCategoryId('');
        setAvailableItems([]);
        setShowAddOwned(false);
        
        // Refresh owned items
        await fetchOwnedItems();
      } else {
        const error = await response.json();
        toast.error(error.error || 'เกิดข้อผิดพลาดในการเพิ่มอุปกรณ์');
      }
    } catch (error) {
      console.error('Error adding owned equipment:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusConfig = (statusId: string) => {
    return statusConfigs.find(s => s.id === statusId);
  };

  const getConditionConfig = (conditionId: string) => {
    return conditionConfigs.find(c => c.id === conditionId);
  };

  const getCategoryConfig = (categoryId: string) => {
    return categoryConfigs.find(c => c.id === categoryId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">จัดการอุปกรณ์ของคุณ</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">อุปกรณ์ทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900">{ownedItems.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <PackageOpen className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">ใช้งานได้</p>
                <p className="text-2xl font-bold text-gray-900">
                  {ownedItems.filter(item => item.conditionId === 'cond_working').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">ชำรุด</p>
                <p className="text-2xl font-bold text-gray-900">
                  {ownedItems.filter(item => item.conditionId === 'cond_damaged').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Add Equipment Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddOwned(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มอุปกรณ์ที่มี
          </button>
        </div>

        {/* Owned Items Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">อุปกรณ์ของคุณ</h3>
          </div>
          
          <div className="overflow-x-auto" ref={tableContainerRef}>
            <table className="min-w-[140%] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ชื่ออุปกรณ์
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    หมวดหมู่
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Serial Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    สภาพ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    สถานะ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    วันที่เพิ่ม
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ownedLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                    </td>
                  </tr>
                ) : ownedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      ไม่มีอุปกรณ์
                    </td>
                  </tr>
                ) : (
                  ownedItems.map((item) => {
                    const statusConfig = getStatusConfig(item.statusId);
                    const conditionConfig = getConditionConfig(item.conditionId);
                    const categoryConfig = getCategoryConfig(item.categoryId || '');
                    
                    return (
                      <tr key={item._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.itemName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {categoryConfig?.name || 'ไม่ระบุ'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.serialNumber || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {statusConfig?.name || 'ไม่ระบุ'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {conditionConfig?.name || 'ไม่ระบุ'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(item.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Owned Equipment Modal */}
        {showAddOwned && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">เพิ่มอุปกรณ์ที่มี</h3>
                  <button
                    onClick={() => setShowAddOwned(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Category Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      หมวดหมู่ *
                    </label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">เลือกหมวดหมู่</option>
                      {categoryConfigs
                        .filter(config => !config.isSystemCategory || config.id !== 'cat_unassigned') // ไม่แสดง "ไม่ระบุ"
                        .sort((a, b) => {
                          // ใช้การเรียงลำดับแบบเดียวกับ CategoryConfigList
                          // หมวดหมู่ปกติมาก่อน ซิมการ์ดมาหลัง
                          if (a.id === 'cat_sim_card' && b.id !== 'cat_sim_card') return 1;
                          if (a.id !== 'cat_sim_card' && b.id === 'cat_sim_card') return -1;
                          return (a.order || 0) - (b.order || 0);
                        })
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Item Selection */}
                  {selectedCategoryId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        อุปกรณ์
                      </label>
                      <div className="space-y-2">
                        <select
                          value={form.itemMasterId}
                          onChange={(e) => handleItemMasterChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">เลือกอุปกรณ์ที่มีอยู่</option>
                          {availableItems.map((item) => (
                            <option key={item._id} value={item._id}>
                              {item.itemName}
                            </option>
                          ))}
                        </select>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setShowNewItemInput(true)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            + เพิ่มอุปกรณ์ใหม่
                          </button>
                        </div>
                        
                        {showNewItemInput && (
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              value={newItemName}
                              onChange={(e) => setNewItemName(e.target.value)}
                              placeholder="ชื่ออุปกรณ์ใหม่"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={handleAddNewItem}
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                              เพิ่ม
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Item Name (if new item) */}
                  {form.itemName && !form.itemMasterId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ชื่ออุปกรณ์ *
                      </label>
                      <input
                        type="text"
                        value={form.itemName}
                        onChange={(e) => setForm(prev => ({ ...prev, itemName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  )}

                  {/* Serial Number or Phone Number */}
                  {selectedCategoryId === 'cat_sim_card' ? (
                    /* Phone Number for SIM cards */
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        เบอร์โทรศัพท์
                      </label>
                      <input
                        type="text"
                        value={form.numberPhone}
                        onChange={(e) => setForm(prev => ({ ...prev, numberPhone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="ระบุเบอร์โทรศัพท์ (10 หลัก)"
                        maxLength={10}
                      />
                    </div>
                  ) : (
                    /* Serial Number for other categories */
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Serial Number
                      </label>
                      <input
                        type="text"
                        value={form.serialNumber}
                        onChange={(e) => setForm(prev => ({ ...prev, serialNumber: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="ระบุ Serial Number (ถ้ามี)"
                      />
                    </div>
                  )}

                  {/* Status Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      สภาพอุปกรณ์
                    </label>
                    <select
                      value={form.statusId}
                      onChange={(e) => setForm(prev => ({ ...prev, statusId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {statusConfigs.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Condition Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      สถานะอุปกรณ์
                    </label>
                    <select
                      value={form.conditionId}
                      onChange={(e) => setForm(prev => ({ ...prev, conditionId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {conditionConfigs.map((condition) => (
                        <option key={condition.id} value={condition.id}>
                          {condition.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      จำนวน
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.quantity}
                      onChange={(e) => setForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      หมายเหตุ
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
                    />
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddOwned(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
