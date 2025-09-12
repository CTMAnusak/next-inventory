'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { toast } from 'react-hot-toast';
import { Search, Upload, ChevronDown } from 'lucide-react';
import RequesterInfoForm from '@/components/RequesterInfoForm';
import DatePicker from '@/components/DatePicker';

interface ReturnItem {
  itemId: string;
  itemName: string;
  quantity: number;
  serialNumber?: string;
  assetNumber?: string;
  image?: File | null;
  category?: string;
  inventorySerialNumber?: string;
  availableOptions?: Array<{
    serialNumber?: string;
    displayName: string;
    value: string;
    itemId: string;
    inventorySerialNumber?: string;
    maxQuantity?: number; // เพิ่มข้อมูลจำนวนสูงสุดสำหรับอุปกรณ์ไม่มี SN
  }>;
  selectedOption?: string;
}

interface OwnedEquipment {
  _id: string;
  itemId: string;
  itemName: string;
  category: string;
  quantity: number;
  serialNumber?: string;
  inventorySerialNumber?: string;
  displayName: string;
  displayCategory: string;
  searchText: string;
  totalQuantity?: number;
  serialNumbers?: string[];
  items?: any[];
  itemIdMap?: { [key: string]: string }; // Map serial number to actual itemId
  masterItemId?: string; // เพิ่ม masterItemId สำหรับอ้างอิง InventoryMaster
}

export default function EquipmentReturnPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ownedEquipment, setOwnedEquipment] = useState<OwnedEquipment[]>([]);
  const [filteredEquipment, setFilteredEquipment] = useState<OwnedEquipment[]>([]);
  
  // Form data including personal info for branch users
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    nickname: '',
    department: '',
    phone: '',
    office: '',
    returnDate: new Date().toISOString().split('T')[0], // Today's date
  });

  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnItem, setReturnItem] = useState<ReturnItem>({
    itemId: '', 
    itemName: '', 
    quantity: 1, 
    serialNumber: '', 
    assetNumber: '', 
    image: null,
    category: '',
    inventorySerialNumber: '',
    availableOptions: undefined,
    selectedOption: ''
  });

  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState<boolean>(false);
  const [showOptionDropdown, setShowOptionDropdown] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasShownNotification, setHasShownNotification] = useState(false);
  const [maxQuantity, setMaxQuantity] = useState<number>(0); // จำนวนสูงสุดที่คืนได้
  const [remainingQuantity, setRemainingQuantity] = useState<number>(0); // จำนวนที่เหลือ

  useEffect(() => {
    fetchUserItems();
  }, []);

  // Simplified useEffect to handle URL parameters for pre-filling data
  useEffect(() => {
    const category = searchParams.get('category');
    const itemName = searchParams.get('itemName');
    const itemId = searchParams.get('itemId');

    if (category && itemName && ownedEquipment.length > 0) {
      console.log('🔗 Equipment Return - Pre-filling from URL:', { 
        category, itemName, itemId
      });
      
      // Find the equipment item by itemId or itemName
      let foundItem = null;
      if (itemId) {
        foundItem = ownedEquipment.find(equip => String(equip.itemId) === itemId);
        console.log('🔍 Found item by itemId:', foundItem);
      }
      
      if (!foundItem) {
        foundItem = ownedEquipment.find(equip => equip.itemName === itemName);
        console.log('🔍 Found item by itemName:', foundItem);
      }

      if (foundItem) {
        // Use the existing selectEquipment function to handle the selection
        // This will automatically set up the proper options and notifications
        selectEquipment(foundItem);
        
        // Show notification only once for URL prefill
        if (!hasShownNotification) {
          const totalQuantity = foundItem.totalQuantity || foundItem.quantity || 1;
          const hasSerialNumbers = foundItem.serialNumbers && foundItem.serialNumbers.length > 0;
          
          if (hasSerialNumbers) {
            toast.success(`พบ ${foundItem.itemName} ที่มี Serial Number กรุณาเลือกรายการที่ต้องการคืน`);
          } else if (totalQuantity > 1) {
            toast.success(`พบ ${foundItem.itemName} ${totalQuantity} ชิ้น กรุณาเลือกรายการที่ต้องการคืน`);
          }
          setHasShownNotification(true);
        }
      } else {
        console.warn('⚠️ Item not found in owned equipment:', itemName);
      }
    }
  }, [searchParams, ownedEquipment]);

  // Set office in formData when user data is available
  useEffect(() => {
    if (user?.office) {
      setFormData(prev => ({
        ...prev,
        office: user.office
      }));
    }
  }, [user?.office]);

  // Re-fetch user items when form data changes for branch users
  useEffect(() => {
    if (user?.userType === 'branch') {
      fetchUserItems();
    }
  }, [formData.firstName, formData.lastName, user?.userType]);

  const fetchUserItems = async () => {
    try {
      // Use appropriate data based on user type
      const firstName = user?.userType === 'individual' ? user.firstName : formData.firstName;
      const lastName = user?.userType === 'individual' ? user.lastName : formData.lastName;
      const office = user?.office || '';
      
      const params = new URLSearchParams({
        firstName: firstName || '',
        lastName: lastName || '',
        office: office,
      });
      
      if (user?.id) {
        params.set('userId', String(user.id));
      }
      
      const res = await fetch(`/api/user/owned-equipment?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const equipment: OwnedEquipment[] = data.items || [];
        setOwnedEquipment(equipment);
        setFilteredEquipment(equipment);
        console.log('📦 Fetched owned equipment:', equipment);
      }
    } catch (e) {
      console.error('Error fetching owned equipment:', e);
      setOwnedEquipment([]);
      setFilteredEquipment([]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Validation for phone number
    if (name === 'phone') {
      // Allow only numbers and limit to 10 digits
      const numbersOnly = value.replace(/[^0-9]/g, '');
      if (numbersOnly.length <= 10) {
        setFormData(prev => ({
          ...prev,
          [name]: numbersOnly
        }));
      }
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleItemChange = (field: keyof ReturnItem, value: any) => {
    console.log('🔄 handleItemChange:', { field, value });
    setReturnItem(prev => {
      const newItem = { ...prev, [field]: value };
      
      // คำนวณจำนวนที่เหลือเมื่อมีการเปลี่ยนจำนวน
      if (field === 'quantity' && maxQuantity > 0) {
        const newQuantity = parseInt(value) || 0;
        setRemainingQuantity(Math.max(0, maxQuantity - newQuantity));
      }
      
      console.log('🔄 Updated returnItem:', newItem);
      return newItem;
    });
  };

  const handleEquipmentSearch = (term: string) => {
    setSearchTerm(term);
    if (term.trim() === '') {
      setFilteredEquipment(ownedEquipment);
    } else {
      const filtered = ownedEquipment.filter(equip => 
        equip.searchText.includes(term.toLowerCase())
      );
      setFilteredEquipment(filtered);
    }
  };

  const selectEquipment = (equipment: OwnedEquipment) => {
    // Reset notification flag when selecting new equipment
    setHasShownNotification(false);
    
    // ตรวจสอบว่ามีข้อมูล totalQuantity และ serialNumbers จาก API response
    const totalQuantity = equipment.totalQuantity || equipment.quantity || 1;
    const serialNumbers = equipment.serialNumbers || [];
    
    // ตรวจสอบว่าต้องแสดง dropdown หรือไม่ (มีหลายชิ้นหรือมี SN)
    const hasMultipleItems = totalQuantity > 1;
    const hasSerialNumbers = serialNumbers.length > 0;
    const needsDropdown = hasMultipleItems || hasSerialNumbers;
    
    console.log('🔍 selectEquipment debug:', {
      itemName: equipment.itemName,
      totalQuantity,
      serialNumbers,
      hasMultipleItems,
      hasSerialNumbers,
      needsDropdown
    });
    
    if (needsDropdown) {
      // สร้าง availableOptions จากข้อมูลที่ได้
      const availableOptions = [];
      
      // เพิ่มรายการที่มี SN
      serialNumbers.forEach(sn => {
        const actualItemId = equipment.itemIdMap?.[sn] || equipment.itemId;
        availableOptions.push({
          serialNumber: sn,
          displayName: `${equipment.itemName} (SN: ${sn})`,
          value: `sn_${sn}`,
          itemId: actualItemId,
          inventorySerialNumber: sn
        });
      });
      
      // เพิ่มรายการที่ไม่มี SN (ถ้ามี) - แสดงเป็นรายการเดียวพร้อมช่องจำนวน
      const totalWithSN = serialNumbers.length;
      const totalWithoutSN = totalQuantity - totalWithSN;
      
      if (totalWithoutSN > 0) {
        // ใช้ itemId หลักสำหรับอุปกรณ์ไม่มี SN
        const actualItemId = equipment.defaultItemId || equipment.itemId;
        
        availableOptions.push({
          serialNumber: '',
          displayName: `${equipment.itemName} (ไม่มี SN)`,
          value: `no_sn_bulk`,
          itemId: actualItemId,
          inventorySerialNumber: '',
          maxQuantity: totalWithoutSN // เพิ่มข้อมูลจำนวนสูงสุด
        });
      }
      
      // ตั้งค่าให้แสดง dropdown เลือกรายการ
      console.log('🔧 Setting up multiple item selection:', {
        availableOptions,
        totalOptions: availableOptions.length,
        equipmentItemId: equipment.itemId,
        itemIdMap: equipment.itemIdMap
      });
      
      // ไม่ตั้งค่า default itemId - บังคับให้ user เลือก
      handleItemChange('itemId', ''); // ว่างเปล่า - บังคับให้เลือก
      handleItemChange('itemName', equipment.itemName);
      handleItemChange('quantity', 1);
      handleItemChange('category', equipment.category);
      handleItemChange('availableOptions', availableOptions);
      handleItemChange('selectedOption', '');
      handleItemChange('serialNumber', '');
      handleItemChange('inventorySerialNumber', '');
      
      // รีเซ็ตจำนวนสูงสุดและจำนวนที่เหลือ
      setMaxQuantity(0);
      setRemainingQuantity(0);
      
      // ลบการแจ้งเตือนซ้ำ - ไม่แจ้งเตือนเมื่อเลือกอุปกรณ์แล้ว
      // เพราะจะมีการแจ้งเตือนอีกครั้งเมื่อส่งข้อมูลสำเร็จ
    } else {
      // ไม่มี SN และมีชิ้นเดียว - ใช้ actualItemId จาก items[0]
      const actualItemId = equipment.items && equipment.items.length > 0 ? equipment.items[0].actualItemId : equipment.itemId;
      
      handleItemChange('itemId', actualItemId);
      handleItemChange('itemName', equipment.itemName);
      handleItemChange('quantity', equipment.quantity || 1);
      handleItemChange('serialNumber', equipment.serialNumber || ''); // Ensure SN is set for single item with SN
      handleItemChange('category', equipment.category);
      handleItemChange('inventorySerialNumber', equipment.serialNumber || '');
      handleItemChange('availableOptions', undefined);
      handleItemChange('selectedOption', '');
      
      console.log('🔧 Set up single item:', {
        itemId: actualItemId,
        itemName: equipment.itemName,
        serialNumber: equipment.serialNumber || '',
        originalEquipmentId: equipment.itemId
      });
    }
    
    setShowEquipmentDropdown(false);
    setSearchTerm('');
    setFilteredEquipment(ownedEquipment);
  };

  const handleFileChange = (file: File | null) => {
    handleItemChange('image', file);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'ReturnLog');

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    return data.filename;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsSubmitted(true);

    try {
      // Validate form
      if (!formData.returnDate) {
        toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
        setIsLoading(false);
        return;
      }

      // Additional validation for branch users
      if (user?.userType === 'branch') {
        if (!formData.firstName || !formData.lastName || !formData.nickname || !formData.department || !formData.phone) {
          toast.error('กรุณากรอกข้อมูลส่วนตัวให้ครบถ้วน');
          setIsLoading(false);
          return;
        }
      }

      // Validate phone number if provided (must be exactly 10 digits)
      if (formData.phone && formData.phone.length !== 10) {
        toast.error('เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น');
        setIsLoading(false);
        return;
      }

      // Validate item
      console.log('🔍 Validating item:', { 
        itemName: returnItem.itemName, 
        itemId: returnItem.itemId, 
        quantity: returnItem.quantity,
        availableOptions: returnItem.availableOptions?.length,
        selectedOption: returnItem.selectedOption
      });
      
      // ตรวจสอบว่ามีข้อมูลพื้นฐาน
      if (!returnItem.itemName || !returnItem.itemId || returnItem.itemId === 'undefined' || returnItem.quantity <= 0) {
        console.log('❌ Item failed basic validation');
        toast.error('กรุณาเลือกอุปกรณ์และรายการที่ต้องการคืนให้ครบถ้วน');
        setIsLoading(false);
        return;
      }
      
      // ตรวจสอบจำนวนไม่เกินที่ครอบครอง (สำหรับอุปกรณ์ไม่มี SN)
      if (maxQuantity > 0 && returnItem.quantity > maxQuantity) {
        console.log('❌ Quantity exceeds maximum allowed');
        toast.error(`จำนวนที่ต้องการคืนเกินจำนวนที่ครอบครอง (สูงสุด ${maxQuantity} ชิ้น)`);
        setIsLoading(false);
        return;
      }
      
      // ถ้ามี availableOptions ต้องเลือก selectedOption ด้วย
      if (returnItem.availableOptions && returnItem.availableOptions.length > 0) {
        if (!returnItem.selectedOption || returnItem.selectedOption.length === 0) {
          console.log('❌ Item failed selectedOption validation');
          toast.error('กรุณาเลือกรายการอุปกรณ์ที่ต้องการคืน');
          setIsLoading(false);
          return;
        }
      }
      
      console.log('✅ Item passed validation');

      // Upload image and prepare return data
      let imagePath = '';
      if (returnItem.image) {
        try {
          imagePath = await uploadImage(returnItem.image);
        } catch (error) {
          console.error('Image upload failed:', error);
          // Continue without image if upload fails
        }
      }

      // ใช้ Serial Number และ ItemId ที่ถูกต้องจากการเลือก
      let finalSerialNumber = '';
      let finalItemId = returnItem.itemId; // Default to current itemId
      
      if (returnItem.availableOptions && returnItem.selectedOption) {
        // หา Serial Number และ ItemId จาก option ที่เลือก
        const selectedOption = returnItem.availableOptions.find(opt => opt.value === returnItem.selectedOption);
        finalSerialNumber = selectedOption?.serialNumber || '';
        finalItemId = selectedOption?.itemId || returnItem.itemId; // Use actual itemId from option
        console.log('🔍 Using data from selected option:', {
          selectedOption: returnItem.selectedOption,
          serialNumber: finalSerialNumber,
          itemId: finalItemId,
          availableOptions: returnItem.availableOptions
        });
      } else {
        // ใช้ Serial Number ที่มีอยู่แล้ว (กรณีมีชิ้นเดียว)
        finalSerialNumber = returnItem.serialNumber || '';
        console.log('🔍 Using existing data:', { 
          serialNumber: finalSerialNumber, 
          itemId: finalItemId 
        });
      }

      const returnItemData = {
        itemId: finalItemId, // Use correct actual itemId
        itemName: returnItem.itemName,
        quantity: returnItem.quantity,
        serialNumber: finalSerialNumber || undefined,
        assetNumber: returnItem.assetNumber || undefined,
        image: imagePath || undefined,
      };

      console.log('🔄 Final return item data:', returnItemData);


      const returnData = {
        // Use user profile data for individual users, form data for branch users
        firstName: user?.userType === 'individual' ? user.firstName : formData.firstName,
        lastName: user?.userType === 'individual' ? user.lastName : formData.lastName,
        nickname: user?.userType === 'individual' ? (user.nickname || '') : formData.nickname,
        department: user?.userType === 'individual' ? (user.department || '') : formData.department,
        office: user?.office || '',
        phone: user?.userType === 'individual' ? (user.phone || '') : formData.phone,
        returnDate: formData.returnDate,
        items: [{
          itemId: returnItemData.itemId, // Use itemId as primary reference
          quantity: returnItemData.quantity,
          serialNumber: returnItemData.serialNumber || '',
          assetNumber: returnItemData.assetNumber || '',
          image: returnItemData.image || undefined,
          masterItemId: returnItem.masterItemId // เพิ่ม masterItemId
        }]
      };

      // Add timeout and retry logic
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      let response;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          response = await fetch('/api/equipment-return', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(returnData),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          break; // Success, exit retry loop
          
        } catch (fetchError) {
          retryCount++;
          console.warn(`⚠️ Fetch attempt ${retryCount} failed:`, fetchError.message);
          
          if (retryCount > maxRetries) {
            clearTimeout(timeoutId);
            throw fetchError; // Re-throw after max retries
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      console.log('📊 Response status:', response.status, response.statusText);

      let data;
      try {
        data = await response.json();
        console.log('📝 Response data:', data);
      } catch (jsonError) {
        console.error('❌ Failed to parse JSON response:', jsonError);
        const textResponse = await response.text();
        console.error('📄 Raw response:', textResponse);
        
        toast.error('เซิร์ฟเวอร์ตอบกลับในรูปแบบที่ไม่ถูกต้อง');
        return;
      }

      if (response.ok) {
        toast.success('ส่งข้อมูลเรียบร้อยแล้ว');
        // Reset form
        setIsSubmitted(false);
        setFormData({
          firstName: '',
          lastName: '',
          nickname: '',
          department: '',
          phone: '',
          office: '',
          returnDate: new Date().toISOString().split('T')[0],
        });
        setReturnItem({
          itemId: '', 
          itemName: '', 
          quantity: 1, 
          serialNumber: '', 
          assetNumber: '', 
          image: null,
          category: '',
          inventorySerialNumber: '',
          availableOptions: undefined,
          selectedOption: ''
        });
        setMaxQuantity(0);
        setRemainingQuantity(0);
      } else {
        console.error('❌ Equipment return error:', {
          status: response.status,
          statusText: response.statusText,
          data: data
        });
        
        // More specific error messages
        if (response.status === 400) {
          toast.error(data?.error || 'ข้อมูลที่ส่งไม่ถูกต้อง');
        } else if (response.status === 401) {
          toast.error('กรุณาเข้าสู่ระบบใหม่');
        } else if (response.status === 500) {
          toast.error('เกิดข้อผิดพลาดในเซิร์ฟเวอร์');
        } else {
          toast.error(data?.error || `เกิดข้อผิดพลาด (${response.status})`);
        }
        
        // Show additional error details in development
        if (data?.details && process.env.NODE_ENV === 'development') {
          console.error('🔍 Error details:', data.details);
        }
      }
    } catch (error) {
      console.error('❌ Network/Unexpected error:', error);
      console.error('🔍 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        toast.error('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
      } else {
        toast.error('เกิดข้อผิดพลาดที่ไม่คาดคิด');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">คืนอุปกรณ์</h1>

          {/* User Profile Display */}
          <RequesterInfoForm 
            formData={{
              ...formData,
              office: formData.office || user?.office || ''
            }}
            onInputChange={handleInputChange}
            title="ข้อมูลผู้คืนอุปกรณ์"
          />

          <form onSubmit={handleSubmit} className={`space-y-6 ${isSubmitted ? 'form-submitted' : ''}`}>
            {/* Return Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วันที่คืน *
              </label>
              <DatePicker
                value={formData.returnDate}
                onChange={(date) => setFormData(prev => ({ ...prev, returnDate: date }))}
                placeholder="dd/mm/yyyy"
                required
              />
            </div>

            {/* Return Items */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                รายการอุปกรณ์ที่ต้องการคืน *
              </label>

              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                  {/* Equipment Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      อุปกรณ์ *
                    </label>
                    <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowEquipmentDropdown(!showEquipmentDropdown)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between cursor-pointer"
                        >
                        <span className={returnItem.itemName ? 'text-gray-900' : 'text-gray-500'}>
                          {returnItem.itemName || 'เลือกอุปกรณ์'}
                        </span>
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      </button>
                      
                      {/* Equipment Dropdown */}
                      {showEquipmentDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                          {/* Search Input */}
                          <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <input
                                type="text"
                                placeholder="ค้นหาอุปกรณ์..."
                                value={searchTerm}
                                onChange={(e) => handleEquipmentSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              />
                            </div>
                          </div>
                          
                          {/* Equipment List */}
                          <div className="max-h-48 overflow-auto">
                            {filteredEquipment.length > 0 ? (
                              filteredEquipment.map((equipment) => (
                                <div
                                  key={equipment._id}
                                  onClick={() => selectEquipment(equipment)}
                                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100"
                                >
                                  <div className="font-medium text-gray-900">{equipment.displayName}</div>
                                  <div className="text-sm text-gray-600">
                                    {equipment.displayCategory} • จำนวน: {equipment.quantity}
                                    {equipment.serialNumber && ` • S/N: ${equipment.serialNumber}`}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-4 text-center text-gray-500">
                                {searchTerm ? 'ไม่พบอุปกรณ์ที่ค้นหา' : 'ตอนนี้คุณยังไม่มีอุปกรณ์'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Item Selection Dropdown - แสดงเมื่อมีหลายตัวเลือก */}
                  {(() => {
                    console.log('🔍 Checking dropdown display:', {
                      itemName: returnItem.itemName,
                      availableOptions: returnItem.availableOptions,
                      shouldShow: returnItem.availableOptions && returnItem.availableOptions.length > 0
                    });
                    return returnItem.availableOptions && returnItem.availableOptions.length > 0;
                  })() && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        เลือกรายการที่ต้องการคืน *
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowOptionDropdown(!showOptionDropdown)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between cursor-pointer"
                        >
                          <span className={returnItem.selectedOption ? 'text-gray-900' : 'text-gray-500'}>
                            {returnItem.selectedOption 
                              ? returnItem.availableOptions?.find(opt => opt.value === returnItem.selectedOption)?.displayName 
                              : 'เลือกรายการที่ต้องการคืน'}
                          </span>
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        </button>
                        
                        {/* Option Selection Dropdown */}
                        {showOptionDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            <div className="max-h-48 overflow-auto">
                              {returnItem.availableOptions?.map((option) => (
                                <div
                                  key={option.value}
                                  onClick={() => {
                                    handleItemChange('selectedOption', option.value);
                                    handleItemChange('serialNumber', option.serialNumber || '');
                                    handleItemChange('inventorySerialNumber', option.serialNumber || '');
                                    handleItemChange('itemId', option.itemId);
                                    
                                    // ตั้งค่าจำนวนสูงสุดและจำนวนที่เหลือสำหรับอุปกรณ์ไม่มี SN
                                    if (option.value === 'no_sn_bulk' && option.maxQuantity) {
                                      setMaxQuantity(option.maxQuantity);
                                      setRemainingQuantity(option.maxQuantity - 1); // เริ่มต้นที่ 1 ชิ้น
                                    } else {
                                      setMaxQuantity(0);
                                      setRemainingQuantity(0);
                                    }
                                    
                                    console.log('🔄 Updated item after selection:', {
                                      selectedOption: option.value,
                                      itemId: option.itemId,
                                      serialNumber: option.serialNumber,
                                      maxQuantity: option.maxQuantity
                                    });
                                    setShowOptionDropdown(false);
                                  }}
                                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="font-medium text-gray-900">{option.displayName}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Equipment Details (shown when equipment is selected) */}
                  {returnItem.itemName && (
                    <>
                      {/* Category (locked) */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          หมวดหมู่
                        </label>
                        <input
                          type="text"
                          value={returnItem.category || ''}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 cursor-not-allowed"
                          disabled
                        />
                      </div>

                      {/* Quantity, Serial Number, Asset Number */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            จำนวน *
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={maxQuantity > 0 ? maxQuantity : (returnItem.quantity || 1)}
                            value={returnItem.quantity || 1}
                            onChange={(e) => handleItemChange('quantity', parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                            required
                          />
                          {/* แสดงข้อความจำนวนสูงสุดและจำนวนที่เหลือสำหรับอุปกรณ์ไม่มี SN */}
                          {maxQuantity > 0 && (
                            <div className="mt-1 text-sm text-gray-600">
                              คืนอุปกรณ์ได้สูงสุด {maxQuantity} ชิ้น  ต้องการคืน {returnItem.quantity || 1} ชิ้น เหลือ {remainingQuantity} ชิ้น
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Serial Number
                          </label>
                          <input
                            type="text"
                            value={returnItem.serialNumber || ''}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 cursor-not-allowed"
                            disabled
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            เลขทรัพย์สิน (ถ้ามี)
                          </label>
                          <input
                            type="text"
                            value={returnItem.assetNumber || ''}
                            onChange={(e) => handleItemChange('assetNumber', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                            placeholder="ระบุเลขทรัพย์สิน หากมี"
                          />
                        </div>
                      </div>

                      {/* Image Upload */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          อัปโหลดรูปภาพ
                        </label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                          <div className="space-y-1 text-center">
                            {returnItem.image ? (
                              <div>
                                <div className="text-sm text-gray-600 mb-2">
                                  ไฟล์ที่เลือก: {returnItem.image.name}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleFileChange(null)}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  ลบไฟล์
                                </button>
                              </div>
                            ) : (
                              <>
                                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                <div className="flex text-sm text-gray-600">
                                  <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                    <span>เลือกไฟล์</span>
                                    <input
                                      type="file"
                                      className="sr-only"
                                      accept="image/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        handleFileChange(file);
                                      }}
                                    />
                                  </label>
                                  <p className="pl-1">หรือลากไฟล์มาวาง</p>
                                </div>
                                <p className="text-xs text-gray-500">
                                  PNG, JPG, GIF ขนาดไม่เกิน 10MB
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
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
                  'บันทึกการคืน'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
