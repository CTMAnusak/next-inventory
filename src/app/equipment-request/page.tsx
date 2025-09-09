'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { toast } from 'react-hot-toast';
import { Search } from 'lucide-react';
import RequesterInfoForm from '@/components/RequesterInfoForm';
import DatePicker from '@/components/DatePicker';

interface RequestItem {
  itemId: string;
  quantity: number;
  serialNumber?: string;
}

interface InventoryItem {
  _id: string;
  itemName: string;
  category: string;
  price: number;
  quantity: number;
  serialNumber?: string;
}

export default function EquipmentRequestPage() {
  const { user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Form data including personal info for branch users
  const [formData, setFormData] = useState({
    requestDate: new Date().toISOString().split('T')[0], // Today's date as default
    urgency: 'normal',
    deliveryLocation: '',
    reason: '',
    // Personal info fields for branch users
    firstName: '',
    lastName: '',
    nickname: '',
    department: '',
    phone: '',
    office: '',
  });

  const [requestItem, setRequestItem] = useState<RequestItem>({
    itemId: '', quantity: 1, serialNumber: ''
  });

  // State for category-based item selection
  const [selectedCategory, setSelectedCategory] = useState<string>('');
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
      const [inventoryResponse, configResponse] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/admin/inventory/config')
      ]);
      
             if (inventoryResponse.ok) {
         const data = await inventoryResponse.json();
         const items = data.items || [];
         setInventoryItems(items);
         
         // Debug: Log inventory items
         console.log('🔍 Equipment Request - Inventory items:', items);
         console.log('🔍 Equipment Request - Items with quantity > 0:', items.filter((i: InventoryItem) => i.quantity > 0));
         
         // Group items by category
         const grouped: {[key: string]: string[]} = {};
         items.forEach((item: InventoryItem) => {
           if (item.quantity > 0) { // Only show items with available stock
             if (!grouped[item.category]) {
               grouped[item.category] = [];
             }
             if (!grouped[item.category].includes(item.itemName)) {
               grouped[item.category].push(item.itemName);
             }
           }
         });
         
         // Debug: Log grouped items
         console.log('🔍 Equipment Request - Grouped items by category:', grouped);
         setItemsByCategory(grouped);
       }
      
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setCategories(configData.categories || []);
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
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    // Clear item ID when category changes
    handleItemChange('itemId', '');
    setShowCategorySelector(false);
  };

  // Function to handle item selection from category
  const handleItemSelect = (itemId: string) => {
    handleItemChange('itemId', itemId);
    setShowCategorySelector(false);
  };

  // Helper function to get item display name from itemId
  const getItemDisplayName = (itemId: string) => {
    if (!itemId) return '';
    const inventoryItem = inventoryItems.find(i => String(i._id) === itemId);
    return inventoryItem?.itemName || '';
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsSubmitted(true);

    try {
      // Refresh inventory data before submitting
      await fetchInventoryItems();

      // Validate form using user profile data
      if (!user || !formData.requestDate || !formData.deliveryLocation || !formData.reason) {
        toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
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

      // Validate item
      if (!requestItem.itemId || !requestItem.quantity || requestItem.quantity <= 0) {
        toast.error('กรุณาเลือกอุปกรณ์และระบุจำนวนที่ถูกต้อง');
        setIsLoading(false);
        return;
      }

      // Check inventory availability
      const inventoryItem = inventoryItems.find(i => String(i._id) === requestItem.itemId);
      if (!inventoryItem) {
        toast.error('ไม่พบข้อมูลอุปกรณ์ที่เลือก');
        setIsLoading(false);
        return;
      }
      
      const availableStock = inventoryItem.quantity || 0;
      console.log(`🔍 Equipment Request - Validation: Item ${inventoryItem.itemName} available stock:`, availableStock);
      
      if (availableStock <= 0) {
        toast.error(`${inventoryItem.itemName} ไม่มีสต็อกเหลือ (คงเหลือ: 0 ชิ้น)`);
        setIsLoading(false);
        return;
      }
      
      if (availableStock < requestItem.quantity) {
        toast.error(`${inventoryItem.itemName} มีสต็อกไม่เพียงพอ (คงเหลือ: ${availableStock} ชิ้น)`);
        setIsLoading(false);
        return;
      }

      // Transform item to use itemId as primary reference
      const transformedItem = {
        itemId: requestItem.itemId, // Use itemId as primary reference
        quantity: requestItem.quantity,
        serialNumber: requestItem.serialNumber || ''
      };

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
        reason: formData.reason,
        userId: user?.id || undefined,
        items: [transformedItem]
      };

      // Debug: Log the data being sent
      console.log('🔍 Frontend - Original requestItem:', requestItem);
      console.log('🔍 Frontend - Transformed item:', transformedItem);
      console.log('🔍 Frontend - Sending request data:', JSON.stringify(requestData, null, 2));
      console.log('🔍 Frontend - User type:', user.userType);
      console.log('🔍 Frontend - Form data:', formData);

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
          reason: '',
          firstName: '',
          lastName: '',
          nickname: '',
          department: '',
          phone: '',
          office: '',
        });
        setRequestItem({ itemId: '', quantity: 1, serialNumber: '' });
        setSelectedCategory('');
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
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
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
                  onChange={(date) => setFormData(prev => ({ ...prev, requestDate: date }))}
                  placeholder="dd/mm/yyyy"
                  required
                />
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เหตุผลการเบิก *
              </label>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                placeholder="เช่น ใช้ในงานประจำ, ทดแทนของเสีย, โปรเจกต์พิเศษ"
                required
              />
            </div>

            {/* Equipment Items */}
            <div>
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
                      <span className={selectedCategory ? 'text-gray-900' : 'text-gray-500'}>
                        {selectedCategory || 'เลือกหมวดหมู่'}
                      </span>
                      <span className="text-gray-400">▼</span>
                    </button>
                    
                    {/* Category Dropdown */}
                    {showCategorySelector && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {categories.map((category) => (
                          <div
                            key={category}
                            onClick={() => handleCategorySelect(category)}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 text-gray-900"
                          >
                            {category}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: Select Item from Category */}
                {selectedCategory && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      อุปกรณ์ *
                    </label>
                    {itemsByCategory[selectedCategory] && itemsByCategory[selectedCategory].length > 0 ? (
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
                        <option value="">-- เลือกอุปกรณ์ --</option>
                        {itemsByCategory[selectedCategory].map((itemName) => {
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
                    ) : (
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 text-sm">
                        ตอนนี้ยังไม่มีอุปกรณ์ในหมวดหมู่นี้ โปรดติดต่อทีม IT
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Quantity and Serial Number */}
                {selectedCategory && (
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
                        onChange={(e) => handleItemChange('quantity', parseInt(e.target.value))}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
                          (!itemsByCategory[selectedCategory] || itemsByCategory[selectedCategory].length === 0) 
                            ? 'bg-gray-50 cursor-not-allowed' 
                            : ''
                        }`}
                        disabled={!itemsByCategory[selectedCategory] || itemsByCategory[selectedCategory].length === 0}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Serial Number (ถ้ามี)
                      </label>
                      <input
                        type="text"
                        value={requestItem.serialNumber}
                        onChange={(e) => handleItemChange('serialNumber', e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 ${
                          (!itemsByCategory[selectedCategory] || itemsByCategory[selectedCategory].length === 0) 
                            ? 'bg-gray-50 cursor-not-allowed' 
                            : ''
                        }`}
                        placeholder="ระบุ Serial Number หากมี"
                        disabled={!itemsByCategory[selectedCategory] || itemsByCategory[selectedCategory].length === 0}
                      />
                    </div>
                  </div>
                )}
              </div>


            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
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
