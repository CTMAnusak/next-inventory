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

  useEffect(() => {
    fetchUserItems();
  }, []);

  // New useEffect to handle URL parameters for pre-filling data
  useEffect(() => {
    const category = searchParams.get('category');
    const itemName = searchParams.get('itemName');
    const itemId = searchParams.get('itemId');
    const totalQuantity = searchParams.get('totalQuantity');
    const serialNumbers = searchParams.get('serialNumbers');
    const items = searchParams.get('items');
    const itemIdMap = searchParams.get('itemIdMap');

    if (category && itemName && ownedEquipment.length > 0) {
      console.log('🔗 Equipment Return - Pre-filling from URL:', { 
        category, itemName, itemId, totalQuantity, serialNumbers, items, itemIdMap 
      });
      
      // Parse detailed data
      let parsedSerialNumbers = [];
      let parsedItems = [];
      let parsedItemIdMap = {};
      
      try {
        parsedSerialNumbers = serialNumbers ? JSON.parse(serialNumbers) : [];
        parsedItems = items ? JSON.parse(items) : [];
        parsedItemIdMap = itemIdMap ? JSON.parse(itemIdMap) : {};
      } catch (e) {
        console.warn('Failed to parse URL data:', e);
      }
      
      // Prefer itemId if available, otherwise find by itemName
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
        // ถ้ามีหลายชิ้นหรือมี serial numbers หลายอัน ให้แสดงตัวเลือก
        const hasMultipleItems = parseInt(totalQuantity || '1') > 1;
        const hasMultipleSerials = parsedSerialNumbers.length > 1;
        
        if (hasMultipleItems || hasMultipleSerials) {
          // สร้าง availableOptions สำหรับ dropdown
          const availableOptions = [];
          
          // เพิ่มตัวเลือกที่มี SN
          parsedSerialNumbers.forEach(sn => {
            // ใช้ parsedItemIdMap จาก URL ก่อน แล้วค่อย fallback ไป foundItem.itemIdMap
            const actualItemId = parsedItemIdMap[sn] || foundItem.itemIdMap?.[sn] || foundItem.itemId;
            availableOptions.push({
              serialNumber: sn,
              displayName: `${itemName} (SN: ${sn})`,
              value: `sn_${sn}`,
              itemId: actualItemId,
              inventorySerialNumber: sn
            });
          });
          
          // เพิ่มตัวเลือกที่ไม่มี SN (ถ้ามี)
          const totalWithSN = parsedSerialNumbers.length;
          const totalWithoutSN = parseInt(totalQuantity || '1') - totalWithSN;
          
          for (let i = 0; i < totalWithoutSN; i++) {
            const noSnKey = `no_sn_${i + 1}`;
            // ใช้ parsedItemIdMap จาก URL ก่อน แล้วค่อย fallback ไป foundItem.itemIdMap  
            const actualItemId = parsedItemIdMap[noSnKey] || foundItem.itemIdMap?.[noSnKey] || foundItem.itemId;
            availableOptions.push({
              serialNumber: '',
              displayName: `${itemName} (ไม่มี SN) #${i + 1}`,
              value: `no_sn_${i}`,
              itemId: actualItemId,
              inventorySerialNumber: ''
            });
          }
          
          // Auto-select first option for URL prefill case  
          const defaultOption = availableOptions.length > 0 ? availableOptions[0] : null;
          
          console.log('🔧 URL Prefill - availableOptions:', availableOptions);
          console.log('🔧 URL Prefill - defaultOption:', defaultOption);
          console.log('🔧 URL Prefill - parsedItemIdMap:', parsedItemIdMap);
          
          // แจ้งเตือนครั้งเดียวเมื่อ pre-fill จาก URL
          toast.success(`พบ ${itemName} ${totalQuantity} ชิ้น กรุณาเลือกรายการที่ต้องการคืน`);
          
          setReturnItems([{
            itemId: defaultOption?.itemId || String(foundItem.itemId),
            itemName: foundItem.itemName,
            quantity: 1,
            serialNumber: defaultOption?.serialNumber || '',
            assetNumber: '',
            image: null,
            category: foundItem.category,
            inventorySerialNumber: defaultOption?.inventorySerialNumber || '',
            availableOptions: availableOptions,
            selectedOption: defaultOption?.value || '' // Auto-select first option
          }]);
        } else {
          // กรณีมีชิ้นเดียว - ใช้ actual itemId จาก parsedItems หรือ foundItem.items
          let actualItemId = String(foundItem.itemId); // fallback
          let actualSerialNumber = parsedSerialNumbers[0] || foundItem.serialNumber || '';
          
          // หา actual itemId จาก parsedItems
          if (parsedItems.length > 0) {
            const firstItem = parsedItems[0];
            actualItemId = firstItem.actualItemId || actualItemId;
            if (firstItem.serialNumbers && firstItem.serialNumbers.length > 0) {
              actualSerialNumber = firstItem.serialNumbers[0];
            }
          } else if (foundItem.items && foundItem.items.length > 0) {
            // fallback ใช้ข้อมูลจาก foundItem.items[0]
            const firstItem = foundItem.items[0];
            actualItemId = firstItem.actualItemId || actualItemId;
          }
          
          console.log('🔧 URL Prefill Single Item:', {
            originalItemId: foundItem.itemId,
            actualItemId,
            actualSerialNumber,
            parsedItems: parsedItems.length,
            foundItemItems: foundItem.items?.length || 0
          });
          
          setReturnItems([{ 
            itemId: actualItemId, 
            itemName: foundItem.itemName, 
            quantity: 1, 
            serialNumber: actualSerialNumber, 
            assetNumber: '', 
            image: null,
            category: foundItem.category,
            inventorySerialNumber: actualSerialNumber
          }]);
        }
      } else {
        // If not found in current owned equipment, try to find by exact match
        console.warn('⚠️ Item not found in owned equipment:', itemName);
        
        // Try alternative search methods
        const alternativeItem = ownedEquipment.find(equip => 
          equip.itemName.trim().toLowerCase() === itemName.trim().toLowerCase()
        );
        
        if (alternativeItem) {
          console.log('✅ Found alternative match:', alternativeItem);
          setReturnItems([{ 
            itemId: String(alternativeItem.itemId), 
            itemName: alternativeItem.itemName, 
            quantity: alternativeItem.quantity, 
            serialNumber: serialNumber || alternativeItem.serialNumber || '', 
            assetNumber: '', 
            image: null,
            category: alternativeItem.category,
            inventorySerialNumber: alternativeItem.inventorySerialNumber
          }]);
        } else {
          // Still set the itemName but warn user
          setReturnItems([{ 
            itemId: itemId || '', 
            itemName: itemName, 
            quantity: 1, 
            serialNumber: serialNumber || '', 
            assetNumber: '', 
            image: null
          }]);
          console.error('❌ Item not found in owned equipment:', itemName);
        }
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
      
      // เพิ่มรายการที่ไม่มี SN (ถ้ามี)
      const totalWithSN = serialNumbers.length;
      const totalWithoutSN = totalQuantity - totalWithSN;
      
      for (let i = 0; i < totalWithoutSN; i++) {
        const noSnKey = `no_sn_${i + 1}`;
        // Try to get actual itemId from itemIdMap, or fallback to items array, or finally equipment.itemId
        let actualItemId = equipment.itemIdMap?.[noSnKey];
        if (!actualItemId && equipment.items && equipment.items[i]) {
          actualItemId = equipment.items[i].actualItemId;
        }
        if (!actualItemId) {
          actualItemId = equipment.defaultItemId || equipment.itemId;
        }
        
        availableOptions.push({
          serialNumber: '',
          displayName: `${equipment.itemName} (ไม่มี SN) #${i + 1}`,
          value: `no_sn_${i}`,
          itemId: actualItemId,
          inventorySerialNumber: ''
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
      
      // แจ้งเตือนเฉพาะเมื่อไม่ได้มาจาก URL pre-fill
      if (!searchParams.get('itemName')) {
        if (hasSerialNumbers) {
          toast.success(`พบ ${equipment.itemName} ที่มี Serial Number กรุณาเลือกรายการที่ต้องการคืน`);
        } else {
          toast.success(`พบ ${equipment.itemName} ${totalQuantity} ชิ้น กรุณาเลือกรายการที่ต้องการคืน`);
        }
      }
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
          image: returnItemData.image || undefined
        }]
      };

      const response = await fetch('/api/equipment-return', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(returnData),
      });

      const data = await response.json();

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
      } else {
        console.error('Equipment return error:', data);
        toast.error(data.error || 'เกิดข้อผิดพลาดในการส่งข้อมูล');
        
        // Show additional error details in development
        if (data.details && process.env.NODE_ENV === 'development') {
          console.error('Error details:', data.details);
        }
      }
    } catch (error) {
      console.error('Network error:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between"
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
                                    
                                    console.log('🔄 Updated item after selection:', {
                                      selectedOption: option.value,
                                      itemId: option.itemId,
                                      serialNumber: option.serialNumber
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
                            max={returnItem.quantity || 1}
                            value={returnItem.quantity || 1}
                            onChange={(e) => handleItemChange('quantity', parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                            required
                          />
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
