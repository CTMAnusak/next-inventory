'use client';

import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Package, PackageOpen, AlertTriangle, BarChart3, Users, Plus, X, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [showAddOwned, setShowAddOwned] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [ownedItems, setOwnedItems] = useState<Array<{ _id?: string; itemName: string; category: string; serialNumber?: string; quantity: number; firstName?: string; lastName?: string; nickname?: string; department?: string; phone?: string; source?: string; editable?: boolean }>>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState({ itemName: '', category: '', serialNumber: '', quantity: 1, firstName: '', lastName: '', nickname: '', department: '', phone: '' });
  
  // Category-first flow states
  const [selectedCategory, setSelectedCategory] = useState('');
  const [availableItems, setAvailableItems] = useState<string[]>([]);
  const [showNewItemInput, setShowNewItemInput] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [ownedLoading, setOwnedLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    // Only fetch once when user data is available and not already loaded
    if (user && user.firstName && user.lastName && user.office && !dataLoaded && !ownedLoading) {
      console.log('🔄 Dashboard - Triggering fetchOwned for first time');
      fetchOwned();
    }
  }, [user?.firstName, user?.lastName, user?.office, dataLoaded, ownedLoading]);

  const fetchOwned = async () => {
    const startTime = Date.now();
    console.log('🔄 Dashboard - Starting fetchOwned...');
    
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
      
      console.log(`🔄 Dashboard - Making API calls for userId: ${user?.id}`);
      const apiStartTime = Date.now();
      
      const ownedRes = await fetch(`/api/user/owned-equipment?${withUserId.toString()}`);
      
      console.log(`⏱️ Dashboard - API call completed: ${Date.now() - apiStartTime}ms`);
      console.log(`📡 Dashboard - API response status: ${ownedRes.status}`);
      console.log(`📡 Dashboard - API response ok: ${ownedRes.ok}`);
      
      const responseData = ownedRes.ok ? await ownedRes.json() : { items: [] };
      const ownedEquipment = responseData.items || [];
      
      console.log(`📊 Dashboard - Raw API response:`, responseData);
      console.log(`📊 Dashboard - Extracted items:`, ownedEquipment);
      
      console.log(`📊 Dashboard - Data received: ${ownedEquipment.length} owned equipment items`);
      console.log('📊 Dashboard - Owned equipment data:', ownedEquipment);
      
      // Group by itemId + serialNumber + user info and combine quantities
      const combinedMap = new Map();
      
      console.log('📊 Dashboard - Processing owned equipment:', ownedEquipment);
      
      ownedEquipment.forEach((item: any) => {
        // Include user info in the key to separate items by different users
        const key = `${item.itemId}||${item.serialNumber || ''}||${item.firstName || ''}||${item.lastName || ''}`;
        const existing = combinedMap.get(key);
        
        console.log(`🔍 Processing item: ${item.itemName} (${item.itemId}) - quantity: ${item.quantity}`);
        console.log(`🔍 Key: ${key}`);
        console.log(`🔍 Existing in map:`, existing);
        
        if (existing) {
          // Merge quantities - use totalQuantity from API
          const oldQuantity = existing.quantity;
          const itemQuantity = (item as any).totalQuantity || item.quantity || 0;
          existing.quantity += Number(itemQuantity);
          console.log(`🔍 Merged quantities: ${oldQuantity} + ${itemQuantity} = ${existing.quantity}`);
        } else {
          // Add new item - use totalQuantity from API
          const newQuantity = Number((item as any).totalQuantity || item.quantity || 0);
          combinedMap.set(key, {
            ...item,
            _id: item._id || `owned-${item.itemId}-${item.serialNumber || 'no-serial'}-${item.firstName}-${item.lastName}`,
            quantity: newQuantity,
            editable: false // All items are now from logs, not editable directly
          });
          console.log(`🔍 Added new item with quantity: ${newQuantity}`);
        }
      });
      
      const all = Array.from(combinedMap.values());
      console.log('📊 Dashboard - Final merged data (separated by user):', all);
      console.log('📊 Dashboard - Sample item structure:', all[0]);
      setOwnedItems(all);
      setDataLoaded(true); // Mark as loaded to prevent duplicate calls
      
      console.log(`✅ Dashboard - fetchOwned completed: ${Date.now() - startTime}ms (${all.length} total items)`);
    } catch (error) {
      console.error('❌ Dashboard - fetchOwned error:', error);
    }
    finally {
      setOwnedLoading(false);
    }
  };

  // Force refresh function for manual refresh
  const refreshData = async () => {
    console.log('🔄 Dashboard - Force refreshing data...');
    setDataLoaded(false); // Reset loaded flag
    await fetchOwned();
  };

  const fetchCategories = async () => {
    try {
      console.log('🔄 Dashboard - Fetching admin categories...');
      const res = await fetch('/api/admin/inventory/config');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        console.log(`📦 Dashboard - Loaded ${data.categories?.length || 0} admin categories`);
      }
    } catch (error) {
      console.error('Failed to load admin categories:', error);
    }
  };

  const fetchItemsInCategory = async (category: string) => {
    try {
      console.log(`🔄 Dashboard - Fetching items in category: ${category}`);
      const res = await fetch(`/api/categories/${encodeURIComponent(category)}/items`);
      if (res.ok) {
        const data = await res.json();
        setAvailableItems(data.items || []);
        console.log(`📦 Dashboard - Loaded ${data.items?.length || 0} items in "${category}"`);
      }
    } catch (error) {
      console.error('Failed to load category items:', error);
      setAvailableItems([]);
    }
  };

  const resetAddModal = () => {
    setForm({ itemName: '', category: '', serialNumber: '', quantity: 1, firstName: '', lastName: '', nickname: '', department: '', phone: '' });
    setSelectedCategory('');
    setAvailableItems([]);
    setShowNewItemInput(false);
    setNewItemName('');
    setNewCategoryName('');
    setShowNewCategoryInput(false);
    setEditItemId(null);
  };

  const handleCategoryChange = async (category: string) => {
    setSelectedCategory(category);
    
    if (category === 'new') {
      // For new category, don't set form.category yet
      setForm(prev => ({ ...prev, category: '' }));
      setShowNewItemInput(false);
      setNewItemName('');
      setAvailableItems([]);
    } else {
      // For existing category, set form.category immediately
      setForm(prev => ({ ...prev, category }));
      setShowNewItemInput(false);
      setNewItemName('');
      await fetchItemsInCategory(category);
    }
  };

  const handleItemSelection = (itemName: string) => {
    console.log('🔍 handleItemSelection called with:', itemName);
    console.log('🔍 Current showNewItemInput:', showNewItemInput);
    
    if (itemName === 'new') {
      console.log('🔍 Setting showNewItemInput to true');
      setShowNewItemInput(true);
      setForm(prev => ({ ...prev, itemName: 'new' }));
    } else {
      console.log('🔍 Setting showNewItemInput to false');
      setForm(prev => ({ ...prev, itemName }));
      setShowNewItemInput(false);
      setNewItemName('');
    }
  };

  const submitAddOwned = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔍 submitAddOwned - Starting validation...');
    console.log('🔍 selectedCategory:', selectedCategory);
    console.log('🔍 form.itemName:', form.itemName);
    console.log('🔍 newItemName:', newItemName);
    
    // Validate required fields
    if (!selectedCategory || selectedCategory === 'new' || (user?.userType === 'branch' && (!form.firstName || !form.lastName))) {
      console.log('❌ Validation failed: Invalid category');
      toast.error('กรุณาเลือกหมวดหมู่');
      return;
    }
    
    // For new items, validate that we have a valid category (not 'new')
    if (form.itemName === 'new' && (selectedCategory === 'new' || !selectedCategory)) {
      console.log('❌ Validation failed: Invalid category for new item');
      toast.error('กรุณาเลือกหมวดหมู่ที่ต้องการเพิ่มอุปกรณ์');
      return;
    }
    
    // For new items, validate newItemName
    if (form.itemName === 'new' && !newItemName?.trim()) {
      console.log('❌ Validation failed: Missing newItemName');
      toast.error('กรุณากรอกชื่ออุปกรณ์ใหม่');
      return;
    }
    
    // For existing items, validate itemName
    if (form.itemName !== 'new' && !form.itemName) {
      console.log('❌ Validation failed: Missing itemName');
      toast.error('กรุณาเลือกอุปกรณ์');
      return;
    }
    
    console.log('✅ All validations passed');
    try {
      console.log('🔍 Form state:', form);
      console.log('🔍 newItemName:', newItemName);
      console.log('🔍 selectedCategory:', selectedCategory);
      console.log('🔍 form.itemName:', form.itemName);
      console.log('🔍 form.category:', form.category);
      
      let itemId: string;
      
      if (form.itemName === 'new') {
        console.log('🔍 Creating new inventory item...');
        console.log('🔍 newItemName:', newItemName);
        console.log('🔍 selectedCategory:', selectedCategory);
        console.log('🔍 form.quantity:', form.quantity);
        
        // Create new inventory item first
        const newInventoryPayload = {
          itemName: newItemName || '',
          category: selectedCategory,
          serialNumber: form.serialNumber || '',
          price: 0,
          quantity: Number(form.quantity) || 1, // Use the quantity from form
          status: 'active',
          dateAdded: new Date().toISOString(),
          user_id: user?.id || undefined,
          userRole: 'user'
        };
        
        console.log('📦 Creating new inventory item:', newInventoryPayload);
        
        const inventoryRes = await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newInventoryPayload)
        });
        
        if (!inventoryRes.ok) {
          const errorData = await inventoryRes.json();
          console.error('❌ Inventory creation failed:', errorData);
          toast.error(`ไม่สามารถสร้างอุปกรณ์ใหม่ได้: ${errorData.error || 'Unknown error'}`);
          return;
        }
        
        const newInventoryData = await inventoryRes.json();
        console.log('✅ New inventory item created:', newInventoryData);
        itemId = newInventoryData.item._id;
        toast.success('สร้างอุปกรณ์ใหม่สำเร็จ');
      } else {
        // Find existing item in inventory
        const inventoryResponse = await fetch('/api/inventory');
        if (!inventoryResponse.ok) {
          toast.error('ไม่สามารถดึงข้อมูลคลังสินค้าได้');
          return;
        }
        
        const inventoryData = await inventoryResponse.json();
        const inventoryItem = inventoryData.items.find((item: any) => 
          item.itemName === form.itemName && item.category === selectedCategory
        );
        
        if (!inventoryItem) {
          toast.error('ไม่พบรายการอุปกรณ์ในคลังสินค้า');
          return;
        }
        
        itemId = inventoryItem._id;
      }

      const payload = {
        firstName: (user?.userType === 'branch' ? form.firstName : user?.firstName) || '',
        lastName: (user?.userType === 'branch' ? form.lastName : user?.lastName) || '',
        office: user?.office || '',
        userId: user?.id || undefined,
        nickname: user?.userType === 'branch' ? (form.nickname || '') : (user?.nickname || ''),
        department: user?.userType === 'branch' ? (form.department || '') : (user?.department || ''),
        phone: user?.userType === 'branch' ? (form.phone || '') : (user?.phone || ''),
        itemId: itemId,
        quantity: Number(form.quantity) || 1,
        serialNumber: form.serialNumber || undefined,
      };
      
      const res = await fetch('/api/user/owned-equipment', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'บันทึกไม่สำเร็จ');
        return;
      }
      toast.success('เพิ่มอุปกรณ์ที่มีเรียบร้อย');
      setShowAddOwned(false);
      setForm({ itemName: '', category: '', serialNumber: '', quantity: 1, firstName: '', lastName: '', nickname: '', department: '', phone: '' });
      setEditItemId(null);
      refreshData();
    } catch (error) {
      console.error('Error adding owned equipment:', error);
      toast.error('เกิดข้อผิดพลาด');
    }
  };



  const quickActions = [
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
  ];

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
          {quickActions.map((action, index) => (
            <div
              key={index}
              onClick={() => router.push(action.href)}
              className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 cursor-pointer border border-white/50 hover:scale-105 hover:bg-white/90"
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
          ))}
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
                className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${ownedLoading ? 'animate-spin' : ''}`} /> รีเฟรช
              </button>
              <button onClick={() => { resetAddModal(); setShowAddOwned(true); }} className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" /> เพิ่มอุปกรณ์ที่มี
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-md">
              <thead>
                <tr className="bg-gray-50">
                  {user?.userType === 'branch' && (
                    <>
                      <th className="px-3 py-2 text-center border-b text-gray-700">ชื่อ</th>
                      <th className="px-3 py-2 text-center border-b text-gray-700">นามสกุล</th>
                      <th className="px-3 py-2 text-center border-b text-gray-700">ชื่อเล่น</th>
                      <th className="px-3 py-2 text-center border-b text-gray-700">แผนก</th>
                      <th className="px-3 py-2 text-center border-b text-gray-700">เบอร์โทร</th>
                    </>
                  )}
                  <th className="px-3 py-2 text-center border-b text-gray-700">ชื่ออุปกรณ์</th>
                  <th className="px-3 py-2 text-center border-b text-gray-700">หมวดหมู่</th>
                  <th className="px-3 py-2 text-center border-b text-gray-700">Serial Number</th>
                  <th className="px-3 py-2 text-center border-b text-gray-700">จำนวน</th>
                  <th className="px-3 py-2 text-center border-b text-gray-700">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {ownedLoading ? (
                  <tr>
                    <td colSpan={user?.userType === 'branch' ? 10 : 5} className="px-3 py-6 text-center text-gray-500">
                      <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" /> กำลังโหลดข้อมูล
                    </td>
                  </tr>
                ) : ownedItems.length === 0 ? (
                  <tr>
                    <td colSpan={user?.userType === 'branch' ? 10 : 5} className="px-3 py-6 text-center text-gray-500">
                      ยังไม่มีอุปกรณ์ในความครอบครอง
                    </td>
                  </tr>
                ) : ownedItems.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {user?.userType === 'branch' && (
                      <>
                        <td className="px-3 py-2 text-center border-b">
                          <div className="text-gray-900">{row.firstName || '-'}</div>
                        </td>
                        <td className="px-3 py-2 text-center border-b">
                          <div className="text-gray-900">{row.lastName || '-'}</div>
                        </td>
                        <td className="px-3 py-2 text-center border-b">
                          <div className="text-gray-900">{row.nickname || '-'}</div>
                        </td>
                        <td className="px-3 py-2 text-center border-b">
                          <div className="text-gray-900">{row.department || '-'}</div>
                        </td>
                        <td className="px-3 py-2 text-center border-b">
                          <div className="text-gray-900">{row.phone || '-'}</div>
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2 text-center border-b">
                      <div className="text-gray-900">{row.itemName}</div>
                    </td>
                    <td className="px-3 py-2 text-center border-b"><div className="text-gray-900">{row.category}</div></td>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="text-gray-900">
                        {(() => {
                          const totalQuantity = (row as any).totalQuantity || row.quantity || 1;
                          const serialNumbers = (row as any).serialNumbers || [];
                          
                          // ถ้ามีชิ้นเดียว
                          if (totalQuantity === 1) {
                            if (serialNumbers.length > 0) {
                              return (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {serialNumbers[0]}
                                </span>
                              );
                            } else {
                              return <span className="text-gray-500">ไม่มี SN</span>;
                            }
                          }
                          
                          // ถ้ามีหลายชิ้น
                          const hasSerialItems = serialNumbers.length;
                          const hasNonSerialItems = totalQuantity - hasSerialItems;
                          
                          if (hasSerialItems > 0 && hasNonSerialItems > 0) {
                            // มีทั้งที่มี SN และไม่มี SN
                            return (
                              <button 
                                className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                                onClick={() => {
                                  setDetailData({
                                    itemName: row.itemName,
                                    hasSerialItems,
                                    hasNonSerialItems,
                                    serialNumbers,
                                    totalQuantity
                                  });
                                  setShowDetailModal(true);
                                }}
                              >
                                ดูรายละเอียด ({totalQuantity} ชิ้น)
                              </button>
                            );
                          } else if (hasSerialItems > 0) {
                            // มีแต่ที่มี SN
                            if (hasSerialItems === 1) {
                              return (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {serialNumbers[0]}
                                </span>
                              );
                            } else {
                              return (
                                <button 
                                  className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                                  onClick={() => {
                                    setDetailData({
                                      itemName: row.itemName,
                                      hasSerialItems,
                                      hasNonSerialItems: 0,
                                      serialNumbers,
                                      totalQuantity
                                    });
                                    setShowDetailModal(true);
                                  }}
                                >
                                  ดูรายละเอียด ({hasSerialItems} ชิ้น)
                                </button>
                              );
                            }
                          } else {
                            // มีแต่ที่ไม่มี SN
                            return <span className="text-gray-500">ไม่มี SN ({totalQuantity} ชิ้น)</span>;
                          }
                        })()}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="text-gray-900">{(row as any).totalQuantity || row.quantity}</div>
                    </td>
                    <td className="px-3 py-2 text-center border-b">
                      <div className="flex items-center justify-center gap-2">
                        {/* Return Equipment button - show for all items that have quantity > 0 */}
                        {((row as any).totalQuantity || row.quantity) > 0 ? (
                          <button
                            onClick={() => {
                              // Navigate to equipment return page with detailed data
                              const params = new URLSearchParams({
                                category: row.category || '',
                                itemName: row.itemName || '',
                                itemId: (row as any).itemId || '', // This is group ID - will be resolved in return page
                                // ส่งข้อมูลรายละเอียดสำหรับการเลือก
                                totalQuantity: ((row as any).totalQuantity || row.quantity).toString(),
                                serialNumbers: JSON.stringify((row as any).serialNumbers || []),
                                items: JSON.stringify((row as any).items || []),
                                itemIdMap: JSON.stringify((row as any).itemIdMap || {}) // ส่ง itemIdMap ด้วย
                              });
                              router.push(`/equipment-return?${params.toString()}`);
                            }}
                            className="px-3 py-1 text-orange-600 hover:text-orange-800 hover:bg-orange-50 border border-orange-200 rounded"
                          >
                            คืนอุปกรณ์
                          </button>
                        ) : (
                          // Empty space for items with 0 quantity
                          <span></span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showAddOwned && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl w-full max-w-lg p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {editItemId ? 'แก้ไขอุปกรณ์ที่มี' : 'เพิ่มอุปกรณ์ที่มี'}
                </h3>
                <button onClick={() => { resetAddModal(); setShowAddOwned(false); }} className="p-1 rounded hover:bg-gray-100"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={submitAddOwned} className="space-y-4">
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
                    value={selectedCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">เลือกหมวดหมู่</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="new">+ เพิ่มหมวดหมู่ใหม่</option>
                  </select>
                </div>

                {/* New Category Input */}
                {selectedCategory === 'new' && (
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
                {selectedCategory && selectedCategory !== 'new' && (
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number (ถ้ามี)</label>
                  <input type="text" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="กรอกถ้ามี" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำนวน *</label>
                  <input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => { setEditItemId(null); setShowAddOwned(false); setForm({ itemName: '', category: '', serialNumber: '', quantity: 1, firstName: '', lastName: '', nickname: '', department: '', phone: '' }); }} className="px-4 py-2 rounded-md border">ยกเลิก</button>
                  <button type="submit" className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">{editItemId ? 'อัพเดต' : 'บันทึก'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && detailData && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/95 backdrop-blur-md rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border border-white/20">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  รายละเอียด {detailData.itemName}
                </h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  จำนวนทั้งหมด: <span className="font-medium text-gray-900">{detailData.totalQuantity} ชิ้น</span>
                </div>
                
                {detailData.hasSerialItems > 0 && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-blue-900 mb-2">
                      มี Serial Number: {detailData.hasSerialItems} ชิ้น
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
                
                {detailData.hasNonSerialItems > 0 && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-gray-900">
                      ไม่มี Serial Number: {detailData.hasNonSerialItems} ชิ้น
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
