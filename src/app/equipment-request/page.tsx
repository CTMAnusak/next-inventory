'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { toast } from 'react-hot-toast';
import { Search, RefreshCw } from 'lucide-react';
import RequesterInfoForm from '@/components/RequesterInfoForm';
import DatePicker from '@/components/DatePicker';

interface RequestItem {
  itemId: string;
  quantity: number;
  serialNumber?: string;
  itemNotes?: string;
}

interface InventoryItem {
  _id: string;
  itemName: string;
  category: string;
  categoryId?: string; // Add categoryId field
  price: number;
  quantity: number;
  serialNumber?: string;
}

interface ICategoryConfig {
  id: string;
  name: string;
  isSystemCategory: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function EquipmentRequestPage() {
  const { user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [categoryConfigs, setCategoryConfigs] = useState<ICategoryConfig[]>([]);
  
  // Form data including personal info for branch users
  const [formData, setFormData] = useState({
    requestDate: new Date().toISOString().split('T')[0], // Today's date as default
    urgency: 'normal',
    deliveryLocation: '',
    // Personal info fields for branch users
    firstName: '',
    lastName: '',
    nickname: '',
    department: '',
    phone: '',
    office: '',
  });

  const [requestItem, setRequestItem] = useState<RequestItem>({
    itemId: '', quantity: 1, serialNumber: '', itemNotes: ''
  });
  
  // State for available serial numbers/phone numbers
  const [availableSerialNumbers, setAvailableSerialNumbers] = useState<string[]>([]);
  const [selectedSerialNumber, setSelectedSerialNumber] = useState<string>('');

  // Multiple items support (prevent duplicates by itemId)
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  // Track currently editing item (so switching edits preserves previous)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // State for category-based item selection
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [itemsByCategory, setItemsByCategory] = useState<{[key: string]: string[]}>({});
  const [showCategorySelector, setShowCategorySelector] = useState<boolean>(false);

  useEffect(() => {
    fetchInventoryItems();
  }, []);

  // Set office in formData when user data is available
  useEffect(() => {
    if (user?.office) {
      setFormData(prev => ({
        ...prev,
        office: user.office
      }));
    }
  }, [user?.office]);

  const fetchInventoryItems = async () => {
    try {
      const configResponse = await fetch('/api/admin/inventory/config');
      
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setCategoryConfigs(configData.categoryConfigs || []);
        
        // ✅ ดึงข้อมูลอุปกรณ์ที่สามารถเบิกได้จาก API ที่กรองตามสถานะและสภาพแล้ว
        const availableResponse = await fetch('/api/equipment-request/available');
        
        if (availableResponse.ok) {
          const availableData = await availableResponse.json();
          const availableItems = availableData.availableItems || [];
          
          console.log('✅ Equipment Request - Loaded available items:', availableItems);
          
          // แปลงข้อมูลให้เป็นรูปแบบที่ UI ต้องการ
          const items = availableItems.map((item: any) => ({
            _id: item.itemMasterId,
            itemName: item.itemName,
            categoryId: item.categoryId,
            category: item.categoryId, // For backward compatibility
            quantity: item.availableQuantity,
            price: 0,
            serialNumber: item.sampleItems?.[0]?.serialNumber || ''
          }));
          
          setInventoryItems(items);
          
          // Group items by categoryId ONLY - กรองเฉพาะอุปกรณ์ที่มีสถานะ "มี" และสภาพ "ใช้งานได้"
          const grouped: {[key: string]: string[]} = {};
          availableItems.forEach((item: any) => {
            const categoryId = item.categoryId;
            
            if (categoryId && item.availableQuantity > 0) {
              if (!grouped[categoryId]) {
                grouped[categoryId] = [];
              }
              if (!grouped[categoryId].includes(item.itemName)) {
                grouped[categoryId].push(item.itemName);
              }
            }
          });
          
          console.log('✅ Equipment Request - Grouped items by category:', grouped);
          setItemsByCategory(grouped);
        }
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleItemChange = (field: keyof RequestItem, value: string | number) => {
    setRequestItem(prev => ({ ...prev, [field]: value }));
  };

  // Function to handle category selection for item
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    // Clear item ID when category changes
    handleItemChange('itemId', '');
    setShowCategorySelector(false);
  };

  // Function to handle item selection from category
  const handleItemSelect = async (itemId: string) => {
    handleItemChange('itemId', itemId);
    setShowCategorySelector(false);
    
    // ✅ ดึง Serial Numbers หรือเบอร์โทรศัพท์ที่พร้อมใช้งาน
    await fetchAvailableSerialNumbers(itemId);
  };
  
  // ✅ ฟังก์ชันดึง Serial Numbers หรือเบอร์โทรศัพท์ที่พร้อมใช้งาน
  const fetchAvailableSerialNumbers = async (itemId: string) => {
    try {
      const inventoryItem = inventoryItems.find(i => String(i._id) === itemId);
      if (!inventoryItem) {
        setAvailableSerialNumbers([]);
        setSelectedSerialNumber('');
        return;
      }
      
      // ดึงข้อมูลจาก API ที่กรองตามสถานะและสภาพแล้ว
      const response = await fetch(
        `/api/admin/equipment-reports/available-items?itemName=${encodeURIComponent(inventoryItem.itemName)}&category=${encodeURIComponent(inventoryItem.categoryId || '')}`
      );
      
      if (response.ok) {
        const data = await response.json();
        
        // ✅ ดึง Serial Numbers สำหรับอุปกรณ์ทั่วไป
        const serialNumbers = data.withSerialNumber?.map((item: any) => item.serialNumber).filter((sn: string) => sn) || [];
        
        // ✅ ดึงเบอร์โทรศัพท์สำหรับซิมการ์ด
        const phoneNumbers = data.withPhoneNumber?.map((item: any) => item.numberPhone).filter((phone: string) => phone) || [];
        
        // ✅ นับจำนวนอุปกรณ์ที่ไม่มี Serial Number/เบอร์โทร
        const countWithoutSN = data.withoutSerialNumber?.count || 0;
        
        // ใช้ข้อมูลที่มี (SN หรือเบอร์โทร)
        const hasPhoneNumbers = phoneNumbers.length > 0;
        const availableOptions: string[] = [];
        
        // ✅ ถ้ามีอุปกรณ์ที่ไม่มี SN/เบอร์โทร ให้เพิ่มตัวเลือก "ไม่มี SN" ไว้ด้านบนสุด
        if (countWithoutSN > 0 && !hasPhoneNumbers) {
          availableOptions.push(`ไม่มี Serial Number (ไม่เจาะจง) - มี ${countWithoutSN} ชิ้น`);
        } else if (countWithoutSN > 0 && hasPhoneNumbers) {
          availableOptions.push(`ไม่มีเบอร์โทรศัพท์ (ไม่เจาะจง) - มี ${countWithoutSN} ชิ้น`);
        }
        
        // ✅ จากนั้นเพิ่ม SN หรือเบอร์โทรที่มี
        if (hasPhoneNumbers) {
          availableOptions.push(...phoneNumbers);
        } else {
          availableOptions.push(...serialNumbers);
        }
        
        setAvailableSerialNumbers(availableOptions);
        
        console.log(`✅ Equipment Request - Found ${serialNumbers.length} with SN, ${phoneNumbers.length} with phone, ${countWithoutSN} without SN/phone`);
        
        // ถ้ามีตัวเลือกเดียว (และไม่ใช่ตัวเลือก "ไม่มี SN") ให้เลือกอัตโนมัติ
        if (availableOptions.length === 1 && !availableOptions[0].includes('ไม่มี')) {
          setSelectedSerialNumber(availableOptions[0]);
          handleItemChange('serialNumber', availableOptions[0]);
        } else {
          setSelectedSerialNumber('');
          handleItemChange('serialNumber', '');
        }
      } else {
        setAvailableSerialNumbers([]);
        setSelectedSerialNumber('');
      }
    } catch (error) {
      console.error('Error fetching serial numbers:', error);
      setAvailableSerialNumbers([]);
      setSelectedSerialNumber('');
    }
  };

  // Helper function to get item display name from itemId
  const getItemDisplayName = (itemId: string) => {
    if (!itemId) return '';
    const inventoryItem = inventoryItems.find(i => String(i._id) === itemId);
    return inventoryItem?.itemName || '';
  };


  // Add current selected item into list with duplicate prevention
  const addRequestItem = () => {
    if (!requestItem.itemId || !requestItem.quantity || requestItem.quantity <= 0) {
      toast.error('กรุณาเลือกอุปกรณ์และระบุจำนวนให้ถูกต้อง');
      return;
    }
    if (requestItems.some(it => it.itemId === requestItem.itemId)) {
      toast.error('ไม่สามารถเลือกอุปกรณ์ซ้ำได้');
      return;
    }
    
    // ✅ ตรวจสอบ Serial Number - ต้องเลือกจริงๆ ไม่ใช่ placeholder
    if (availableSerialNumbers.length > 0 && (!selectedSerialNumber || selectedSerialNumber === '')) {
      toast.error('กรุณาเลือกอุปกรณ์ที่มีหรือไม่มี Serial Number');
      return;
    }
    
    setRequestItems(prev => [...prev, { ...requestItem }]);
    // Reset selectors to default for next addition
    setRequestItem({ itemId: '', quantity: 1, serialNumber: '', itemNotes: '' });
    setSelectedCategoryId('');
    setShowCategorySelector(false);
    setEditingItemId(null);
  };

  const removeRequestItem = (itemId: string) => {
    setRequestItems(prev => prev.filter(it => it.itemId !== itemId));
  };

  const editRequestItem = (itemId: string) => {
    const toEdit = requestItems.find(it => it.itemId === itemId);
    if (!toEdit) return;

    // If currently editing another item and it's not in the list, put it back first
    if (
      editingItemId &&
      requestItem.itemId &&
      editingItemId !== itemId &&
      !requestItems.some(it => it.itemId === requestItem.itemId)
    ) {
      setRequestItems(prev => [...prev, { ...requestItem }]);
    }

    setRequestItem({ ...toEdit });
    const inv = inventoryItems.find(i => String(i._id) === itemId);
    if (inv?.categoryId) setSelectedCategoryId(String(inv.categoryId));
    // Remove the item being edited from list (to avoid duplicates while editing)
    setRequestItems(prev => prev.filter(it => it.itemId !== itemId));
    setEditingItemId(itemId);
  };

  // ฟังก์ชันรีเซทเฉพาะข้อมูลอุปกรณ์ที่กำลังเพิ่ม
  const resetItemForm = () => {
    setRequestItem({
      itemId: '', 
      quantity: 1, 
      serialNumber: '', 
      itemNotes: ''
    });
    setSelectedCategoryId('');
    setEditingItemId(null);
    setAvailableSerialNumbers([]);
    setSelectedSerialNumber('');
    toast.success('รีเซทรายการอุปกรณ์เรียบร้อยแล้ว');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsSubmitted(true);

    try {
      // Refresh inventory data before submitting
      await fetchInventoryItems();

      // Validate form using user profile data
      if (!user) {
        toast.error('กรุณาเข้าสู่ระบบ');
        setIsLoading(false);
        return;
      }

      // Clear previous validation errors
      setValidationErrors({});

      // Specific validation for request date
      if (!formData.requestDate || formData.requestDate.trim() === '') {
        setValidationErrors({ requestDate: 'กรุณาเลือกวันที่ต้องการเบิก' });
        toast.error('กรุณาเลือกวันที่ต้องการเบิก');
        setIsLoading(false);
        return;
      }

      // Validate delivery location
      if (!formData.deliveryLocation || formData.deliveryLocation.trim() === '') {
        toast.error('กรุณากรอกสถานที่รับอุปกรณ์');
        setIsLoading(false);
        return;
      }

      // Additional validation for branch users
      if (user.userType === 'branch') {
        if (!formData.firstName || !formData.lastName || !formData.nickname || !formData.department || !formData.phone) {
          toast.error('กรุณากรอกข้อมูลส่วนตัวให้ครบถ้วน');
          setIsLoading(false);
          return;
        }
      }

      // Validate item: only allow items from the list (not from current form)
      if (requestItems.length === 0) {
        toast.error('กรุณาเพิ่มรายการอุปกรณ์ที่ต้องการเบิกในรายการด้านล่างก่อนกดบันทึก');
        setIsLoading(false);
        return;
      }

      // Use only items from the list
      const selectedItems: RequestItem[] = [...requestItems];

      const requestData = {
        // Use user profile data for individual users, form data for branch users
        firstName: user.userType === 'individual' ? user.firstName : formData.firstName,
        lastName: user.userType === 'individual' ? user.lastName : formData.lastName,
        nickname: user.userType === 'individual' ? (user.nickname || '') : formData.nickname,
        department: user.userType === 'individual' ? (user.department || '') : formData.department,
        office: formData.office || user.office || '',
        phone: user.userType === 'individual' ? (user.phone || '') : formData.phone,
        // Form data
        requestDate: formData.requestDate,
        urgency: formData.urgency,
        deliveryLocation: formData.deliveryLocation,
        userId: user?.id || undefined,
        items: selectedItems.map(it => ({
          // API expects masterId; current UI itemId equals InventoryMaster._id from /api/inventory
          masterId: it.itemId,
          quantity: it.quantity,
          serialNumber: it.serialNumber || '',
          itemNotes: it.itemNotes || ''
        }))
      };

      // Debug: Log the data being sent

      const response = await fetch('/api/equipment-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('ส่งข้อมูลเรียบร้อยแล้ว');
        // Reset form
        setIsSubmitted(false);
        setFormData({
          requestDate: '',
          urgency: 'normal',
          deliveryLocation: '',
          firstName: '',
          lastName: '',
          nickname: '',
          department: '',
          phone: '',
          office: '',
        });
        setRequestItem({ itemId: '', quantity: 1, serialNumber: '', itemNotes: '' });
        setRequestItems([]);
        setSelectedCategoryId('');
        setShowCategorySelector(false);
      } else {
        // ไม่แสดง console.error เพื่อลดความยุ่งเหยิง
        toast.error(data.error || 'เกิดข้อผิดพลาดในการส่งข้อมูล');
      }
    } catch (error) {
      console.error('Network error:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsLoading(false);
    }
  };

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
      <div className="max-w-5xl mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl px-5 py-8 sm:p-8 border border-white/50">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">เบิกอุปกรณ์</h1>

          {/* User Profile Display */}
          <RequesterInfoForm 
            formData={{
              ...formData,
              office: formData.office || user?.office || ''
            }}
            onInputChange={handleInputChange}
            title="ข้อมูลผู้ขอเบิก"
          />

          <form onSubmit={handleSubmit} className={`space-y-6 ${isSubmitted ? 'form-submitted' : ''}`}>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  วันที่ต้องการเบิก *
                </label>
                <DatePicker
                  value={formData.requestDate}
                  onChange={(date) => {
                    setFormData(prev => ({ ...prev, requestDate: date }));
                    // Clear validation error when user selects a date
                    if (validationErrors.requestDate) {
                      setValidationErrors(prev => ({ ...prev, requestDate: '' }));
                    }
                  }}
                  placeholder="dd/mm/yyyy"
                  required
                  className={validationErrors.requestDate ? 'border-red-500 focus:ring-red-500' : ''}
                />
                {validationErrors.requestDate && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.requestDate}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ความเร่งด่วน *
                </label>
                <select
                  name="urgency"
                  value={formData.urgency}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                  required
                >
                  <option value="normal">ปกติ</option>
                  <option value="very_urgent">ด่วนมาก</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                สถานที่จัดส่ง *
              </label>
              <input
                type="text"
                name="deliveryLocation"
                value={formData.deliveryLocation}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                placeholder="เช่น ห้องทำงาน, แผนกไอที, สาขาสีลม"
                required
              />
            </div>

            {/* Removed overall reason; now using per-item reasons */}

            {/* Equipment Items */}
            <div className='mb-10'>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                รายการอุปกรณ์ที่ต้องการเบิก *
              </label>

              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                {/* Step 1: Select Category */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หมวดหมู่ *
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCategorySelector(!showCategorySelector)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between"
                    >
                      <span className={selectedCategoryId ? 'text-gray-900' : 'text-gray-500'}>
                        {selectedCategoryId ? categoryConfigs.find(c => c.id === selectedCategoryId)?.name || 'กรุณาเลือกหมวดหมู่' : 'กรุณาเลือกหมวดหมู่'}
                      </span>
                      <span className="text-gray-400">▼</span>
                    </button>
                    
                    {/* Category Dropdown */}
                    {showCategorySelector && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {categoryConfigs
                          .filter(config => !config.isSystemCategory || config.id !== 'cat_unassigned') // ไม่แสดง "ไม่ระบุ"
                          .sort((a, b) => {
                            // ใช้การเรียงลำดับแบบเดียวกับ CategoryConfigList
                            // หมวดหมู่ปกติมาก่อน ซิมการ์ดมาหลัง
                            if (a.id === 'cat_sim_card' && b.id !== 'cat_sim_card') return 1;
                            if (a.id !== 'cat_sim_card' && b.id === 'cat_sim_card') return -1;
                            return (a.order || 0) - (b.order || 0);
                          })
                          .map((config) => {
                            // ตรวจสอบว่ามีอุปกรณ์ในหมวดหมู่นี้หรือไม่ (ใช้ categoryId เท่านั้น)
                            const hasItems = itemsByCategory[config.id] && itemsByCategory[config.id].length > 0;
                            
                            
                            return (
                              <div
                                key={config.id}
                                onClick={() => handleCategorySelect(config.id)}
                                className={`px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 text-gray-900 ${
                                  !hasItems ? 'opacity-50' : ''
                                }`}
                              >
                                {config.name}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: Select Item from Category */}
                {selectedCategoryId && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      อุปกรณ์ *
                    </label>
                    {(() => {
                      return null;
                    })()}
                    {(() => {
                      // ใช้ categoryId เท่านั้น - ไม่ใช้ category name
                      const selectedCategory = categoryConfigs.find(c => c.id === selectedCategoryId);
                      const availableItems = itemsByCategory[selectedCategoryId];
                      
                      
                      if (availableItems && availableItems.length > 0) {
                        return (
                          <select
                            value={getItemDisplayName(requestItem.itemId)}
                            onChange={(e) => {
                              const selectedItem = inventoryItems.find(i => i.itemName === e.target.value);
                              if (selectedItem) {
                                handleItemSelect(String(selectedItem._id));
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                            required
                          >
                            <option value="">-- กรุณาเลือกอุปกรณ์ --</option>
                            {availableItems
                              .filter((itemName) => {
                                const firstMatch = inventoryItems.find(i => i.itemName === itemName);
                                if (!firstMatch) return true;
                                return !requestItems.some(it => it.itemId === String(firstMatch._id));
                              })
                              .map((itemName) => {
                              const availableQty = inventoryItems
                                .filter(i => i.itemName === itemName && i.quantity > 0)
                                .reduce((sum, i) => sum + i.quantity, 0);
                              return (
                                <option key={itemName} value={itemName}>
                                  {itemName} (คงเหลือ: {availableQty > 0 ? availableQty : 0} ชิ้น)
                                </option>
                              );
                            })}
                          </select>
                        );
                      } else {
                        return (
                          <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 text-sm">
                            ตอนนี้ยังไม่มีอุปกรณ์ในหมวดหมู่นี้ โปรดติดต่อทีม IT
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}

                {/* Step 3: Quantity and Serial Number */}
                {selectedCategoryId && requestItem.itemId && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        จำนวน *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={(() => {
                          if (!requestItem.itemId) return 1;
                          const inventoryItem = inventoryItems.find(i => String(i._id) === requestItem.itemId);
                          if (!inventoryItem) return 1;
                          const availableStock = inventoryItem.quantity || 0;
                          return availableStock > 0 ? availableStock : 1;
                        })()}
                        value={requestItem.quantity}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          handleItemChange('quantity', Number.isNaN(n) || n <= 0 ? 1 : n);
                        }}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                          (!itemsByCategory[selectedCategoryId] || itemsByCategory[selectedCategoryId].length === 0) 
                            ? 'bg-gray-50 cursor-not-allowed' 
                            : ''
                        }`}
                        disabled={!itemsByCategory[selectedCategoryId] || itemsByCategory[selectedCategoryId].length === 0}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {(() => {
                          // ตรวจสอบว่าเป็นซิมการ์ดหรือไม่
                          const selectedItem = inventoryItems.find(i => String(i._id) === requestItem.itemId);
                          const isSIMCard = selectedItem?.categoryId === 'cat_sim_card';
                          return isSIMCard ? 'เบอร์โทรศัพท์ (ถ้ามี)' : 'Serial Number (ถ้ามี)';
                        })()}
                      </label>
                      {availableSerialNumbers.length > 0 ? (
                        <>
                          <select
                            value={selectedSerialNumber}
                            onChange={(e) => {
                              const value = e.target.value;
                              setSelectedSerialNumber(value);
                              
                              // ✅ ถ้าเลือก "ไม่มี SN" ให้เก็บค่าพิเศษ
                              if (value.includes('ไม่มี')) {
                                handleItemChange('serialNumber', ''); // เก็บเป็นค่าว่าง
                              } else {
                                handleItemChange('serialNumber', value);
                              }
                            }}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                              (!itemsByCategory[selectedCategoryId] || itemsByCategory[selectedCategoryId].length === 0) 
                                ? 'bg-gray-50 cursor-not-allowed' 
                                : ''
                            }`}
                            disabled={!itemsByCategory[selectedCategoryId] || itemsByCategory[selectedCategoryId].length === 0}
                          >
                            <option value="">
                              {(() => {
                                const selectedItem = inventoryItems.find(i => String(i._id) === requestItem.itemId);
                                const isSIMCard = selectedItem?.categoryId === 'cat_sim_card';
                                return isSIMCard ? '-- เลือกเบอร์โทรศัพท์ --' : '-- เลือกอุปกรณ์ที่มีหรือไม่มี Serial Number --';
                              })()}
                            </option>
                            {availableSerialNumbers.map((sn) => (
                              <option key={sn} value={sn}>
                                {sn}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-green-600 mt-1">
                            ✅ พบตัวเลือกที่พร้อมใช้งาน {availableSerialNumbers.length} รายการ
                            {(() => {
                              const hasNoSNOption = availableSerialNumbers.some(sn => sn.includes('ไม่มี'));
                              if (hasNoSNOption) {
                                return ' (รวมอุปกรณ์ที่ไม่มี SN)';
                              }
                              return '';
                            })()}
                          </p>
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={requestItem.serialNumber}
                            onChange={(e) => handleItemChange('serialNumber', e.target.value)}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 ${
                              (!itemsByCategory[selectedCategoryId] || itemsByCategory[selectedCategoryId].length === 0) 
                                ? 'bg-gray-50 cursor-not-allowed' 
                                : ''
                            }`}
                            placeholder={(() => {
                              const selectedItem = inventoryItems.find(i => String(i._id) === requestItem.itemId);
                              const isSIMCard = selectedItem?.categoryId === 'cat_sim_card';
                              return isSIMCard ? 'ระบุเบอร์โทรศัพท์ หากต้องการ' : 'ระบุ Serial Number หากต้องการ';
                            })()}
                            disabled={!itemsByCategory[selectedCategoryId] || itemsByCategory[selectedCategoryId].length === 0}
                          />
                          {requestItem.itemId && (
                            <p className="text-xs text-gray-500 mt-1">
                              ℹ️ อุปกรณ์นี้ไม่มี {(() => {
                                const selectedItem = inventoryItems.find(i => String(i._id) === requestItem.itemId);
                                const isSIMCard = selectedItem?.categoryId === 'cat_sim_card';
                                return isSIMCard ? 'เบอร์โทรศัพท์' : 'Serial Number';
                              })()} ที่พร้อมใช้งาน หรือสามารถกรอกเองได้
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                {/* Item-level reason (optional) */}
                {selectedCategoryId && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      เหตุผลของรายการนี้ (ไม่บังคับ)
                    </label>
                    <input
                      type="text"
                      value={requestItem.itemNotes || ''}
                      onChange={(e) => handleItemChange('itemNotes', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                      placeholder="ระบุเหตุผลของรายการเฉพาะนี้ ถ้าต้องการ"
                    />
                  </div>
                )}
              </div>

              {/* Add to list and selected items */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addRequestItem}
                    className="px-3 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 focus:outline-none"
                  >
                    เพิ่มเข้ารายการ
                  </button>
                  <button
                    type="button"
                    onClick={resetItemForm}
                    className="px-3 py-2 bg-orange-100 text-orange-800 rounded-md hover:bg-orange-200 focus:outline-none flex items-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    รีเซทรายการ
                  </button>
                </div>
              </div>

              {/* รายการที่จะเบิก - แสดงตลอดเวลา */}
              <div className="mt-4 border border-gray-200 rounded-lg">
                <div className="p-3 font-medium text-gray-700">รายการที่จะเบิก</div>
                {requestItems.length > 0 ? (
                  <ul className="divide-y divide-gray-100">
                    {requestItems.map(item => (
                      <li key={item.itemId} className="flex items-center justify-between p-3">
                        <div className="text-gray-900">
                          {getItemDisplayName(item.itemId)} × {item.quantity}
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => editRequestItem(item.itemId)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRequestItem(item.itemId)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            ลบ
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    <div className="text-sm">ยังไม่มีรายการอุปกรณ์</div>
                    <div className="text-xs mt-1">กรุณาเลือกอุปกรณ์และกด "เพิ่มเข้ารายการ" เพื่อเพิ่มรายการที่ต้องการเบิก</div>
                  </div>
                )}
                
                {/* หมายเหตุอธิบาย */}
                <div className="px-3 pb-3">
                  <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded border-l-4 border-blue-200">
                    <div className="font-medium text-blue-800 mb-1">💡 หมายเหตุ:</div>
                    <div>เฉพาะอุปกรณ์ที่อยู่ในรายการนี้เท่านั้นที่จะถูกส่งเบิก กรุณาเพิ่มรายการอุปกรณ์ที่ต้องการเบิกให้ครบถ้วนก่อนกดบันทึก</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Submit Button */}
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    กำลังบันทึก...
                  </div>
                ) : (
                  'บันทึกการเบิกอุปกรณ์'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
