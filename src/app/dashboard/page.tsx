'use client';

import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Package, PackageOpen, AlertTriangle, BarChart3, Users, Plus, X, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { enableDragScroll } from '@/lib/drag-scroll';

interface ICategoryConfig {
  id: string;
  name: string;
  isSpecial: boolean;
  isSystemCategory: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [showAddOwned, setShowAddOwned] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [ownedItems, setOwnedItems] = useState<Array<{ _id?: string; itemName: string; category: string; categoryId?: string; serialNumber?: string; quantity: number; firstName?: string; lastName?: string; nickname?: string; department?: string; phone?: string; statusId?: string; conditionId?: string; statusName?: string; conditionName?: string; currentOwnership?: { ownedSince?: string | Date }; sourceInfo?: { dateAdded?: string | Date }; createdAt?: string | Date; source?: string; editable?: boolean }>>([]);
  const [categoryConfigs, setCategoryConfigs] = useState<ICategoryConfig[]>([]);
  const [statusConfigs, setStatusConfigs] = useState<any[]>([]);
  const [conditionConfigs, setConditionConfigs] = useState<any[]>([]);
  const [form, setForm] = useState({ itemName: '', categoryId: '', serialNumber: '', quantity: 1, firstName: '', lastName: '', nickname: '', department: '', phone: '', status: '', condition: '', notes: '' });
  
  // Category-first flow states
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [availableItems, setAvailableItems] = useState<string[]>([]);
  const [showNewItemInput, setShowNewItemInput] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [ownedLoading, setOwnedLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Drag scroll ref
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  // Initialize drag scrolling
  useEffect(() => {
    const element = tableContainerRef.current;
    if (!element) return;

    const cleanup = enableDragScroll(element);
    return cleanup;
  }, []);

  const fetchOwned = useCallback(async () => {
    try {
      setOwnedLoading(true);
      const params = new URLSearchParams({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        office: user?.office || '',
      });
      // Merge holdings computed from request/return logs with manually added owned items
      const withUserId = new URLSearchParams(params);
      if (user?.id) withUserId.set('userId', String(user.id));
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const ownedRes = await fetch(`/api/user/owned-equipment?${withUserId.toString()}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const responseData = ownedRes.ok ? await ownedRes.json() : { items: [] };
      const ownedEquipment = responseData.items || [];
      // Show each owned item as an individual row (no grouping/combining)
      setOwnedItems(ownedEquipment);
      setDataLoaded(true); // Mark as loaded to prevent duplicate calls
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('การโหลดข้อมูลใช้เวลานานเกินไป กรุณาลองใหม่');
        console.error('❌ Dashboard - fetchOwned timeout');
      } else {
        console.error('❌ Dashboard - fetchOwned error:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      }
    } finally {
      setOwnedLoading(false);
    }
  }, [user?.firstName, user?.lastName, user?.office, user?.id]);

  useEffect(() => {
    // Only fetch once when user data is available and not already loaded
    if (user && user.firstName && user.lastName && user.office && !dataLoaded && !ownedLoading) {
      fetchOwned();
    }
  }, [user?.firstName, user?.lastName, user?.office, dataLoaded, ownedLoading, fetchOwned]);

  // Force refresh function for manual refresh
  const refreshData = useCallback(async () => {
    setDataLoaded(false); // Reset loaded flag
    await fetchOwned();
  }, [fetchOwned]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/inventory/config');
      if (res.ok) {
        const data = await res.json();
        setCategoryConfigs(data.categoryConfigs || []);
        setStatusConfigs(data.statusConfigs || []);
        setConditionConfigs(data.conditionConfigs || []);
      }
    } catch (error) {
      console.error('Failed to load admin categories:', error);
    }
  };

  const fetchItemsInCategory = async (categoryId: string) => {
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(categoryId)}/items`);
      if (res.ok) {
        const data = await res.json();
        setAvailableItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to load category items:', error);
      setAvailableItems([]);
    }
  };

  // Helper functions to convert IDs to names
  const getCategoryName = (categoryId: string) => {
    const category = categoryConfigs.find(c => c.id === categoryId);
    return category?.name || categoryId;
  };

  const getStatusName = (statusId: string) => {
    const status = statusConfigs.find(s => s.id === statusId);
    return status?.name || statusId;
  };

  const getConditionName = (conditionId: string) => {
    const condition = conditionConfigs.find(c => c.id === conditionId);
    return condition?.name || conditionId;
  };

  const resetAddModal = () => {
    setForm({ itemName: '', categoryId: '', serialNumber: '', quantity: 1, firstName: '', lastName: '', nickname: '', department: '', phone: '', status: '', condition: '', notes: '' });
    setSelectedCategoryId('');
    setAvailableItems([]);
    setShowNewItemInput(false);
    setNewItemName('');
    setNewCategoryName('');
    setShowNewCategoryInput(false);
    setEditItemId(null);
  };

  const handleCategoryChange = async (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    
    if (categoryId === 'new') {
      // For new category, don't set form.categoryId yet
      setForm(prev => ({ ...prev, categoryId: '' }));
      setShowNewItemInput(false);
      setNewItemName('');
      setAvailableItems([]);
    } else {
      // For existing category, set form.categoryId immediately
      setForm(prev => ({ ...prev, categoryId }));
      setShowNewItemInput(false);
      setNewItemName('');
      await fetchItemsInCategory(categoryId);
    }
  };

  const handleItemSelection = (itemName: string) => {
    if (itemName === 'new') {
      setShowNewItemInput(true);
      setForm(prev => ({ ...prev, itemName: 'new' }));
    } else {
      setForm(prev => ({ ...prev, itemName }));
      setShowNewItemInput(false);
      setNewItemName('');
    }
  };

  const submitAddOwned = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Set loading state
    setIsSubmitting(true);
    
    // Check if user is available
    if (!user || !user.id) {
      toast.error('กรุณาเข้าสู่ระบบใหม่');
      setIsSubmitting(false);
      return;
    }
    
    // Handle edit mode
    if (editItemId) {
      try {
        console.log('🔍 Editing item with ID:', editItemId);
        console.log('🔍 Form data:', form);
        
        // Call API to update the item
        const updateData = {
          serialNumber: form.serialNumber || '',
          numberPhone: form.phone || '',
          statusId: form.status || 'status_available',
          conditionId: form.condition || 'cond_working',
          notes: form.notes || ''
        };
        
        const response = await fetch(`/api/inventory/${editItemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'การแก้ไขล้มเหลว');
        }
        
        const result = await response.json();
        console.log('✅ Edit successful:', result);
        
        toast.success('แก้ไขข้อมูลอุปกรณ์เรียบร้อย');
        setShowAddOwned(false);
        resetAddModal();
        refreshData();
        return;
      } catch (error) {
        console.error('Error editing owned equipment:', error);
        toast.error(`เกิดข้อผิดพลาดในการแก้ไข: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    
    // Validate required fields
    if (!selectedCategoryId || selectedCategoryId === 'new' || (user?.userType === 'branch' && (!form.firstName || !form.lastName))) {
      toast.error('กรุณาเลือกหมวดหมู่');
      setIsSubmitting(false);
      return;
    }
    
    // For new items, validate that we have a valid category (not 'new')
    if (form.itemName === 'new' && (selectedCategoryId === 'new' || !selectedCategoryId)) {
      toast.error('กรุณาเลือกหมวดหมู่ที่ต้องการเพิ่มอุปกรณ์');
      setIsSubmitting(false);
      return;
    }
    
    // For new items, validate newItemName
    if (form.itemName === 'new' && !newItemName?.trim()) {
      toast.error('กรุณากรอกชื่ออุปกรณ์ใหม่');
      setIsSubmitting(false);
      return;
    }
    
    // For existing items, validate itemName
    if (form.itemName !== 'new' && !form.itemName) {
      toast.error('กรุณาเลือกอุปกรณ์');
      setIsSubmitting(false);
      return;
    }
    
    try {
      let itemId: string;
      
      if (form.itemName === 'new') {
        
        // Create new inventory item first
        const newInventoryPayload = {
          itemName: newItemName || '',
          categoryId: selectedCategoryId,
          serialNumber: form.serialNumber || '',
          price: 0,
          quantity: 1,
          status: 'active',
          statusId: form.status || 'status_available',
          conditionId: form.condition || undefined,
          notes: form.notes || undefined,
          dateAdded: new Date().toISOString(),
          user_id: user?.id || undefined,
          userRole: 'user'
        };
        
        const inventoryRes = await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newInventoryPayload)
        });
        
        if (!inventoryRes.ok) {
          const errorData = await inventoryRes.json();
          console.error('❌ Inventory creation failed:', errorData);
          toast.error(`ไม่สามารถสร้างอุปกรณ์ใหม่ได้: ${errorData.error || 'Unknown error'}`);
          setIsSubmitting(false);
          return;
        }
        
        const newInventoryData = await inventoryRes.json();
        
        // Check if the response has the expected structure
        if (!newInventoryData.items || !Array.isArray(newInventoryData.items) || newInventoryData.items.length === 0) {
          console.error('❌ Invalid response structure:', newInventoryData);
          toast.error('ไม่สามารถสร้างอุปกรณ์ใหม่ได้ - โครงสร้างข้อมูลไม่ถูกต้อง');
          setIsSubmitting(false);
          return;
        }
        
        // Use the first created item's ID
        itemId = newInventoryData.items[0]._id;
        // Remove duplicate toast - will show unified success message later
      } else {
        // Find existing item in inventory using the same API as dropdown
        const categoryItemsResponse = await fetch(`/api/categories/${encodeURIComponent(selectedCategoryId)}/items`);
        if (!categoryItemsResponse.ok) {
          toast.error('ไม่สามารถดึงข้อมูลคลังสินค้าได้');
          return;
        }
        
        const categoryItemsData = await categoryItemsResponse.json();
        
        // Check if the item exists in the category
        const itemExists = categoryItemsData.items && categoryItemsData.items.includes(form.itemName);
        
        if (!itemExists) {
          console.log('❌ Item not found in category items:', { itemName: form.itemName, categoryId: selectedCategoryId });
          toast.error('ไม่พบรายการอุปกรณ์ในคลังสินค้า');
          return;
        }
        
        // Get the actual inventory item details
        const inventoryResponse = await fetch('/api/inventory');
        if (!inventoryResponse.ok) {
          toast.error('ไม่สามารถดึงข้อมูลคลังสินค้าได้');
          return;
        }
        
        const inventoryData = await inventoryResponse.json();
        
        const inventoryItem = inventoryData.items?.find((item: any) => 
          item.itemName === form.itemName && item.categoryId === selectedCategoryId
        );
        
        if (!inventoryItem) {
          console.log('❌ Item not found in inventory details:', { itemName: form.itemName, categoryId: selectedCategoryId });
          toast.error('ไม่พบรายการอุปกรณ์ในคลังสินค้า');
          return;
        }
        
        if (!inventoryItem._id) {
          console.error('❌ Inventory item missing _id:', inventoryItem);
          toast.error('ข้อมูลอุปกรณ์ไม่สมบูรณ์');
          return;
        }
        
        itemId = inventoryItem._id;
      }

      // For new items created through /api/inventory, we don't need to call /api/user/owned-equipment
      // because the item is already created as user_owned in the new system
      if (form.itemName === 'new') {
        // Success message will be shown below - no duplicate toast here
      } else {
        // For existing items, we still need to call the owned-equipment API
        const payload = {
          itemName: form.itemName,
          categoryId: selectedCategoryId,
          quantity: 1,
          serialNumber: form.serialNumber || undefined,
          statusId: form.status || undefined,
          conditionId: form.condition || undefined,
          notes: form.notes || undefined,
        };
        
        const res = await fetch('/api/user/owned-equipment', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload) 
        });
        
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'บันทึกไม่สำเร็จ');
          setIsSubmitting(false);
          return;
        }
        // Success message will be shown below - no duplicate toast here
      }
      
      // Unified success message for both new and existing items
      toast.success('เพิ่มอุปกรณ์ที่มีเรียบร้อย');
      
      // Reset form and close modal
      setShowAddOwned(false);
      resetAddModal();
      refreshData();
    } catch (error) {
      console.error('Error adding owned equipment:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      // Always reset loading state
      setIsSubmitting(false);
    }
  };



  const quickActions = useMemo(() => [
    {
      title: 'เบิกอุปกรณ์',
      description: 'ยื่นคำขอเบิกอุปกรณ์จากคลัง',
      icon: Package,
      href: '/equipment-request',
      color: 'bg-blue-500',
    },
    {
      title: 'คืนอุปกรณ์',
      description: 'ยื่นคำขอเบิกอุปกรณ์จากคลัง',
      icon: PackageOpen,
      href: '/equipment-return',
      color: 'bg-orange-500',
    },
    {
      title: 'แจ้งปัญหา IT',
      description: 'แจ้งปัญหาเทคนิคหรือขอความช่วยเหลือ',
      icon: AlertTriangle,
      href: '/it-report',
      color: 'bg-red-500',
    },
    {
      title: 'ติดตามสถานะ',
      description: 'ตรวจสอบสถานะการแจ้งงาน IT',
      icon: BarChart3,
      href: '/it-tracking',
      color: 'bg-green-500',
    },
    {
      title: 'ติดต่อทีม IT',
      description: 'ข้อมูลการติดต่อทีม IT',
      icon: Users,
      href: '/contact',
      color: 'bg-purple-500',
    },
  ], []);

  // Prevent hydration mismatch - wait for auth to load
  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ยินดีต้อนรับสู่ระบบจัดการคลังสินค้า
          </h1>
          <p className="text-gray-600">
            เลือกเมนูที่ต้องการใช้งาน
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 min-[550px]:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {quickActions.map((action, index) => {
            // Determine data-tutorial attribute based on action title
            let dataTutorial = '';
            if (action.title === 'เบิกอุปกรณ์') dataTutorial = 'equipment-request-card';
            else if (action.title === 'คืนอุปกรณ์') dataTutorial = 'equipment-return-card';
            else if (action.title === 'แจ้งปัญหา IT') dataTutorial = 'it-report-card';
            else if (action.title === 'ติดตามสถานะ') dataTutorial = 'it-tracking-card';
            else if (action.title === 'ติดต่อทีม IT') dataTutorial = 'contact-it-card';
            
            return (
              <div
                key={index}
                onClick={() => router.push(action.href)}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 cursor-pointer border border-white/50 hover:scale-105 hover:bg-white/90"
                data-tutorial={dataTutorial || undefined}
              >
                <div className="flex items-start">
                  <div className={`${action.color} p-3 rounded-lg`}>
                    <action.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900 leading-none">
                      {action.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {action.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Important Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/50">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            ข้อมูลสำคัญ
          </h2>
          <div className="flex items-center justify-between mb-4">
            <div className="text-2xl font-bold text-blue-600">{
              (user?.userType === 'branch'
                ? `ทรัพย์สินที่มี ของ สาขา${user?.office || ''}`
                : `ทรัพย์สินที่มี ของ ${[user?.firstName, user?.lastName].filter(Boolean).join(' ')}`
              ).trim()
            }</div>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshData}
                disabled={ownedLoading}
                className="inline-flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${ownedLoading ? 'animate-spin' : ''}`} /> รีเฟรช
              </button>
              <button 
                onClick={() => { resetAddModal(); setShowAddOwned(true); }} 
                className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                data-tutorial="add-equipment"
              >
                <Plus className="h-4 w-4 mr-2" /> เพิ่มอุปกรณ์ที่มี
              </button>
            </div>
          </div>
          <div ref={tableContainerRef} className="table-container">
            <table className="min-w-full border border-gray-200 rounded-md">
              <thead>
                <tr className="bg-blue-600">
                  <th className="px-3 py-2 text-center border-b text-white">วันที่เพิ่ม</th>
                  <th className="px-3 py-2 text-center border-b text-white">ชื่อ</th>
                  <th className="px-3 py-2 text-center border-b text-white">นามสกุล</th>
                  <th className="px-3 py-2 text-center border-b text-white">ชื่อเล่น</th>
                  <th className="px-3 py-2 text-center border-b text-white">แผนก</th>
                  <th className="px-3 py-2 text-center border-b text-white">ออฟฟิศ/สาขา</th>
                  <th className="px-3 py-2 text-center border-b text-white">เบอร์โทร</th>
                  <th className="px-3 py-2 text-center border-b text-white">ชื่ออุปกรณ์</th>
                  <th className="px-3 py-2 text-center border-b text-white">หมวดหมู่</th>
                  <th className="px-3 py-2 text-center border-b text-white">สภาพ</th>
                  <th className="px-3 py-2 text-center border-b text-white">สถานะ</th>
                  <th className="px-3 py-2 text-center border-b text-white">รายละเอียด</th>
                  <th className="px-3 py-2 text-center border-b text-white">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {ownedLoading ? (
                  <tr>
                    <td colSpan={13} className="px-3 py-6 text-center text-gray-500">
                      <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" /> กำลังโหลดข้อมูล
                    </td>
                  </tr>
                ) : ownedItems.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-3 py-6 text-center text-gray-500">
                      ยังไม่มีอุปกรณ์ในความครอบครอง
                    </td>
                  </tr>
                ) : ownedItems.map((row, idx) => (
                  <tr key={idx} className={`hover:bg-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'}`}>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="text-gray-900">
                        {(() => {
                          const dateValue = (row as any)?.currentOwnership?.ownedSince || (row as any)?.sourceInfo?.dateAdded || (row as any)?.createdAt;
                          if (!dateValue) return '-';
                          const d = new Date(dateValue);
                          if (isNaN(d.getTime())) return '-';
                          return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
                        })()}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="text-gray-900">
                        {user?.userType === 'branch' 
                          ? (row.firstName || '-')
                          : (user?.firstName || '-')
                        }
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="text-gray-900">
                        {user?.userType === 'branch' 
                          ? (row.lastName || '-')
                          : (user?.lastName || '-')
                        }
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="text-gray-900">
                        {user?.userType === 'branch' 
                          ? (row.nickname || '-')
                          : (user?.nickname || '-')
                        }
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="text-gray-900">
                        {user?.userType === 'branch' 
                          ? (row.department || '-')
                          : (user?.department || '-')
                        }
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="text-gray-900">{user?.office || '-'}</div>
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="text-gray-900">
                        {user?.userType === 'branch' 
                          ? (row.phone || '-')
                          : (user?.phone || '-')
                        }
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="text-gray-900">{row.itemName}</div>
                    </td>
                    <td className="px-3 py-2 text-center border-b"><div className="text-gray-900">{getCategoryName(row.categoryId || (row as any).categoryId || row.category)}</div></td>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="text-gray-900">
                        {row.conditionId ? getConditionName(row.conditionId) : ((row as any).conditionName || '-')}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="text-gray-900">
                        {row.statusId ? getStatusName(row.statusId) : ((row as any).statusName || '-')}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="text-gray-900">
                        {(() => {
                          const totalQuantity = 1;
                          const serialNumbers = ((row as any).serialNumber ? [(row as any).serialNumber] : ((row as any).serialNumbers || []));
                          const phoneNumbers = ((row as any).numberPhone ? [(row as any).numberPhone] : ((row as any).phoneNumbers || []));
                          const isSimCard = row.categoryId === 'cat_sim_card';
                          
                          // ถ้ามีชิ้นเดียว
                          if (totalQuantity === 1) {
                            if (isSimCard && phoneNumbers.length > 0) {
                              // แสดงเบอร์โทรศัพท์สำหรับซิมการ์ด
                              return (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                  {phoneNumbers[0]}
                                </span>
                              );
                            } else if (serialNumbers.length > 0) {
                              // แสดง Serial Number สำหรับอุปกรณ์ทั่วไป
                              return (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {serialNumbers[0]}
                                </span>
                              );
                            } else {
                              // ไม่มี SN หรือ Phone Number
                              return <span className="text-gray-500">1 ชิ้น (อุปกรณ์ทั่วไป)</span>;
                            }
                          }
                          
                          // ถ้ามีหลายชิ้น
                          const hasSerialItems = serialNumbers.length;
                          const hasPhoneItems = phoneNumbers.length;
                          const hasSpecialItems = hasSerialItems + hasPhoneItems; // รวม SN และ Phone Number
                          const hasNonSpecialItems = totalQuantity - hasSpecialItems;
                          
                          if (hasSpecialItems > 0 && hasNonSpecialItems > 0) {
                            // มีทั้งที่มี SN/Phone และไม่มี SN/Phone
                            return (
                              <button 
                                className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                                onClick={() => {
                                  const detailDataObj = {
                                    itemName: row.itemName,
                                    categoryId: row.categoryId || row.category,
                                    categoryName: getCategoryName(row.categoryId || row.category),
                                    hasSerialItems,
                                    hasPhoneItems,
                                    hasNonSpecialItems: hasNonSpecialItems,
                                    serialNumbers,
                                    phoneNumbers,
                                    totalQuantity
                                  };
                                  setDetailData(detailDataObj);
                                  setShowDetailModal(true);
                                }}
                              >
                                ดูรายละเอียด
                              </button>
                            );
                          } else if (hasSpecialItems > 0) {
                            // มีแต่ที่มี SN หรือ Phone Number
                            if (hasSpecialItems === 1) {
                              if (isSimCard && phoneNumbers.length > 0) {
                                return (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                    {phoneNumbers[0]}
                                  </span>
                                );
                              } else if (serialNumbers.length > 0) {
                                return (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    {serialNumbers[0]}
                                  </span>
                                );
                              }
                            } else {
                              return (
                                <button 
                                  className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 transition-colors cursor-pointer"
                                  onClick={() => {
                                    setDetailData({
                                      itemName: row.itemName,
                                      categoryId: row.categoryId || row.category,
                                      categoryName: getCategoryName(row.categoryId || row.category),
                                      hasSerialItems,
                                      hasPhoneItems,
                                      hasNonSpecialItems: 0,
                                      serialNumbers,
                                      phoneNumbers,
                                      totalQuantity
                                    });
                                    setShowDetailModal(true);
                                  }}
                                >
                                  ดูรายละเอียด
                                </button>
                              );
                            }
                          } else {
                            // มีแต่ที่ไม่มี SN หรือ Phone Number
                            return <span className="text-gray-500">{totalQuantity} ชิ้น (อุปกรณ์ทั่วไป)</span>;
                          }
                        })()}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {/* Edit button */}
                        <button
                          onClick={async () => {
                            try {
                              // Set edit mode
                              setEditItemId(row._id || '');
                              
                              // Fetch detailed item data from API
                              const itemId = row._id || (row as any).itemId;
                              if (itemId) {
                                const response = await fetch(`/api/inventory/${itemId}`);
                                if (response.ok) {
                                  const itemData = await response.json();
                                  console.log('🔍 Fetched item data for edit:', itemData);
                                  
                                  const formData = {
                                    itemName: itemData.itemName || row.itemName,
                                    categoryId: itemData.categoryId || row.categoryId || row.category,
                                    serialNumber: itemData.serialNumber || row.serialNumber || '',
                                    quantity: itemData.quantity || row.quantity || 1,
                                    firstName: row.firstName || '',
                                    lastName: row.lastName || '',
                                    nickname: row.nickname || '',
                                    department: row.department || '',
                                    phone: row.phone || '',
                                    status: itemData.statusId || row.statusId || '',
                                    condition: itemData.conditionId || row.conditionId || '',
                                    notes: itemData.notes || row.notes || ''
                                  };
                                  console.log('🔍 Setting form data:', formData);
                                  
                                  setForm(formData);
                                  setSelectedCategoryId(itemData.categoryId || row.categoryId || row.category);
                                  // Fetch items in category for dropdown
                                  await fetchItemsInCategory(itemData.categoryId || row.categoryId || row.category);
                                } else {
                                  // Fallback to row data if API fails
                                  setForm({
                                    itemName: row.itemName,
                                    categoryId: row.categoryId || row.category,
                                    serialNumber: row.serialNumber || '',
                                    quantity: row.quantity || 1,
                                    firstName: row.firstName || '',
                                    lastName: row.lastName || '',
                                    nickname: row.nickname || '',
                                    department: row.department || '',
                                    phone: row.phone || '',
                                    status: row.statusId || '',
                                    condition: row.conditionId || '',
                                    notes: row.notes || ''
                                  });
                                  setSelectedCategoryId(row.categoryId || row.category);
                                  // Fetch items in category for dropdown
                                  await fetchItemsInCategory(row.categoryId || row.category);
                                }
                              } else {
                                // Fallback to row data if no ID
                                setForm({
                                  itemName: row.itemName,
                                  categoryId: row.categoryId || row.category,
                                  serialNumber: row.serialNumber || '',
                                  quantity: row.quantity || 1,
                                  firstName: row.firstName || '',
                                  lastName: row.lastName || '',
                                  nickname: row.nickname || '',
                                  department: row.department || '',
                                  phone: row.phone || '',
                                  status: row.statusId || '',
                                  condition: row.conditionId || '',
                                  notes: row.notes || ''
                                });
                                setSelectedCategoryId(row.categoryId || row.category);
                                // Fetch items in category for dropdown
                                await fetchItemsInCategory(row.categoryId || row.category);
                              }
                              
                              setShowAddOwned(true);
                            } catch (error) {
                              console.error('Error fetching item data for edit:', error);
                              toast.error('ไม่สามารถดึงข้อมูลอุปกรณ์ได้');
                            }
                          }}
                          className="px-3 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded"
                        >
                          แก้ไข
                        </button>
                        
                        {/* Return Equipment button - temporarily show always for debugging */}
                        <button
                          onClick={() => {
                            // Debug: log the data we're sending
                            console.log('🔍 Return button clicked:', { 
                              id: row._id, 
                              itemId: (row as any).itemId,
                              itemName: row.itemName,
                              totalQuantity: (row as any).totalQuantity,
                              quantity: row.quantity
                            });
                            // Navigate to equipment return page with ID only
                            router.push(`/equipment-return?id=${row._id || (row as any).itemId}`);
                          }}
                          className="px-3 py-1 text-xs text-orange-600 hover:text-orange-800 hover:bg-orange-50 border border-orange-200 rounded"
                        >
                          คืน
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showAddOwned && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border-0 flex flex-col">
              {/* Header - Fixed */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">
                    {editItemId ? 'แก้ไขอุปกรณ์ที่มี' : 'เพิ่มอุปกรณ์ที่มี'}
                  </h3>
                  <button 
                    onClick={() => { resetAddModal(); setShowAddOwned(false); }} 
                    className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all duration-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                <form onSubmit={submitAddOwned} className="space-y-5">
                {user?.userType === 'branch' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ *</label>
                        <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="ชื่อผู้รับอุปกรณ์" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">นามสกุล *</label>
                        <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="นามสกุลผู้รับอุปกรณ์" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อเล่น</label>
                        <input type="text" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">แผนก</label>
                        <input type="text" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
                        <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0XXXXXXXXX" />
                      </div>
                    </div>
                  </>
                )}

                {/* Step 1: Select Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่ *</label>
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
                      .map((config) => (
                      <option key={config.id} value={config.id}>
                        {config.name}
                      </option>
                    ))}
                    <option value="new">+ เพิ่มหมวดหมู่ใหม่</option>
                  </select>
                </div>

                {/* New Category Input */}
                {selectedCategoryId === 'new' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหมวดหมู่ใหม่ *</label>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => {
                        setNewCategoryName(e.target.value);
                        setForm(prev => ({ ...prev, category: e.target.value }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="ระบุชื่อหมวดหมู่ใหม่"
                      required
                    />
                  </div>
                )}

                {/* Step 2: Select Item (only if category is selected) */}
                {selectedCategoryId && selectedCategoryId !== 'new' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">อุปกรณ์ *</label>
                    <select
                      value={showNewItemInput ? 'new' : form.itemName}
                      onChange={(e) => handleItemSelection(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">เลือกอุปกรณ์</option>
                      {availableItems.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                      <option value="new">+ เพิ่มอุปกรณ์ใหม่</option>
                    </select>
                  </div>
                )}

                {/* New Item Input */}
                {showNewItemInput && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่ออุปกรณ์ใหม่ *</label>
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="ระบุชื่ออุปกรณ์ใหม่"
                      required
                    />
                  </div>
                )}

                {/* Step 3: Additional fields (only show after category and item are selected) */}
                {((selectedCategoryId && selectedCategoryId !== 'new' && form.itemName) || 
                  (selectedCategoryId === 'new' && newCategoryName) || 
                  showNewItemInput) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number (ถ้ามี)</label>
                      <input type="text" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="กรอกถ้ามี" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">จำนวน *</label>
                      <input type="number" min={1} max={1} value={1} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed" />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">เลือกสถานะ</option>
                        {statusConfigs.map((config) => (
                          <option key={config.id} value={config.id}>
                            {config.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">สภาพอุปกรณ์</label>
                      <select
                        value={form.condition}
                        onChange={(e) => setForm({ ...form, condition: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">เลือกสภาพอุปกรณ์</option>
                        {conditionConfigs.map((config) => (
                          <option key={config.id} value={config.id}>
                            {config.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                      <textarea
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
                      />
                    </div>
                  </>
                )}
                
                {/* Footer - Fixed */}
                <div className="flex justify-end gap-3 pt-4">
                  {/* Show buttons only when required fields are filled */}
                  {((selectedCategoryId && selectedCategoryId !== 'new' && form.itemName) || 
                    (selectedCategoryId === 'new' && newCategoryName) || 
                    showNewItemInput) && (
                    <>
                      <button 
                        type="button" 
                        onClick={() => { setEditItemId(null); setShowAddOwned(false); resetAddModal(); }} 
                        className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium"
                      >
                        ยกเลิก
                      </button>
                      <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl ${
                          isSubmitting 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                        }`}
                      >
                        {isSubmitting ? (
                          <div className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            กำลังบันทึก...
                          </div>
                        ) : (
                          editItemId ? 'อัพเดต' : 'บันทึก'
                        )}
                      </button>
                    </>
                  )}
                </div>
              </form>
              </div>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && detailData && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden border-0 flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">
                    รายละเอียด {detailData.itemName}
                  </h3>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all duration-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
              
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  จำนวนทั้งหมด: <span className="font-medium text-gray-900">{detailData.totalQuantity} ชิ้น</span>
                </div>
                
                {/* แสดงหมวดหมู่ */}
                {detailData.categoryName && (
                  <div className="text-sm text-gray-600">
                    หมวดหมู่: <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {detailData.categoryName}
                    </span>
                  </div>
                )}
                
                {/* แสดงอุปกรณ์ที่ไม่มี SN/เบอร์ - ลำดับแรก */}
                {detailData.hasNonSpecialItems > 0 && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-gray-900">
                      อุปกรณ์ที่ไม่มี SN/เบอร์: {detailData.hasNonSpecialItems} ชิ้น
                    </div>
                  </div>
                )}

                {/* แสดง Serial Numbers */}
                {detailData.hasSerialItems > 0 && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-blue-900 mb-2">
                      อุปกรณ์ที่มี SN: {detailData.hasSerialItems} ชิ้น
                    </div>
                    <div className="space-y-1">
                      {detailData.serialNumbers.map((sn: string, idx: number) => (
                        <div key={idx} className="text-sm text-blue-800 bg-blue-100 px-2 py-1 rounded">
                          • {sn}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* แสดง Phone Numbers สำหรับซิมการ์ด */}
                {detailData.hasPhoneItems > 0 && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-green-900 mb-2">
                      เบอร์โทรศัพท์ (ซิมการ์ด): {detailData.hasPhoneItems} ชิ้น
                    </div>
                    <div className="space-y-1">
                      {detailData.phoneNumbers?.map((phone: string, idx: number) => (
                        <div key={idx} className="text-sm text-green-800 bg-green-100 px-2 py-1 rounded">
                          • {phone}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              
              {/* Footer */}
              <div className="flex justify-end p-6 border-t border-gray-200 bg-white">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
                >
                  ปิด
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
