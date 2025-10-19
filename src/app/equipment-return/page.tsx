'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { toast } from 'react-hot-toast';
import { Search, Upload, ChevronDown, RefreshCw } from 'lucide-react';
import RequesterInfoForm from '@/components/RequesterInfoForm';
import DatePicker from '@/components/DatePicker';
import { handleAuthError } from '@/lib/auth-error-handler';
import AuthGuard from '@/components/AuthGuard';

interface ReturnItem {
  itemId: string;
  itemName: string;
  quantity: number;
  serialNumber?: string;
  numberPhone?: string;
  assetNumber?: string;
  image?: File | null;
  category?: string;
  categoryId?: string;
  inventorySerialNumber?: string;
  availableOptions?: Array<{
    serialNumber?: string;
    numberPhone?: string;
    displayName: string;
    value: string;
    itemId: string;
    inventorySerialNumber?: string;
    maxQuantity?: number; // เพิ่มข้อมูลจำนวนสูงสุดสำหรับอุปกรณ์ไม่มี SN
  }>;
  selectedOption?: string;
  itemNotes?: string;
  statusOnReturn?: string; // สถานะอุปกรณ์เมื่อคืน
  conditionOnReturn?: string; // สภาพอุปกรณ์เมื่อคืน
  // ข้อมูลผู้คืนอุปกรณ์ของรายการนี้
  returnerFirstName?: string;
  returnerLastName?: string;
  returnerNickname?: string;
  returnerDepartment?: string;
  returnerPhone?: string;
  returnerOffice?: string;
}

interface OwnedEquipment {
  _id: string;
  itemId: string;
  itemName: string;
  category: string;
  categoryId?: string;
  quantity: number;
  serialNumber?: string;
  numberPhone?: string;
  inventorySerialNumber?: string;
  displayName: string;
  displayCategory: string;
  searchText: string;
  totalQuantity?: number;
  serialNumbers?: string[];
  numberPhones?: string[];
  items?: any[];
  itemIdMap?: { [key: string]: string }; // Map serial number to actual itemId
  masterItemId?: string; // เพิ่ม masterItemId สำหรับอ้างอิง InventoryMaster
  defaultItemId?: string; // เพิ่ม defaultItemId สำหรับอุปกรณ์ไม่มี SN
  // เพิ่มข้อมูลสถานะและสภาพ
  statusId?: string;
  statusName?: string;
  conditionId?: string;
  conditionName?: string;
  // เพิ่มข้อมูลผู้ครอบครอง
  firstName?: string;
  lastName?: string;
  nickname?: string;
  department?: string;
  phone?: string;
  office?: string;
}

export default function EquipmentReturnPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [ownedEquipment, setOwnedEquipment] = useState<OwnedEquipment[]>([]);
  const [filteredEquipment, setFilteredEquipment] = useState<OwnedEquipment[]>([]);
  const [isLoadingEquipment, setIsLoadingEquipment] = useState(false);
  
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [returnItem, setReturnItem] = useState<ReturnItem>({
    itemId: '', 
    itemName: '', 
    quantity: 1, 
    serialNumber: '', 
    numberPhone: '',
    assetNumber: '', 
    image: null,
    category: '',
    categoryId: '',
    inventorySerialNumber: '',
    availableOptions: undefined,
    selectedOption: '',
    itemNotes: '',
    statusOnReturn: 'status_available',
    conditionOnReturn: 'cond_working',
    returnerFirstName: '',
    returnerLastName: '',
    returnerNickname: '',
    returnerDepartment: '',
    returnerPhone: '',
    returnerOffice: ''
  });

  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState<boolean>(false);
  const [showOptionDropdown, setShowOptionDropdown] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasShownNotification, setHasShownNotification] = useState(false);
  const [maxQuantity, setMaxQuantity] = useState<number>(0); // จำนวนสูงสุดที่คืนได้
  const [remainingQuantity, setRemainingQuantity] = useState<number>(0); // จำนวนที่เหลือ
  
  // Config data for status and condition
  const [statusConfigs, setStatusConfigs] = useState<any[]>([]);
  const [conditionConfigs, setConditionConfigs] = useState<any[]>([]);

  useEffect(() => {
    fetchUserItems();
    fetchConfigs();
  }, []);

  // Cleanup object URLs on component unmount
  useEffect(() => {
    return () => {
      if (returnItem.image) {
        URL.revokeObjectURL(URL.createObjectURL(returnItem.image));
      }
    };
  }, [returnItem.image]);

  // Load personal info from URL parameters for branch users
  useEffect(() => {
    const firstName = searchParams.get('firstName');
    const lastName = searchParams.get('lastName');
    const nickname = searchParams.get('nickname');
    const department = searchParams.get('department');
    const phone = searchParams.get('phone');
    
    // Pre-fill form data if parameters are provided (for branch users)
    if (firstName || lastName) {
      setFormData(prev => ({
        ...prev,
        firstName: firstName || prev.firstName,
        lastName: lastName || prev.lastName,
        nickname: nickname || prev.nickname,
        department: department || prev.department,
        phone: phone || prev.phone,
      }));
    }
  }, [searchParams]);

  // Simplified useEffect to handle URL parameters for pre-filling data
  useEffect(() => {
    const category = searchParams.get('category');
    const itemName = searchParams.get('itemName');
    const itemId = searchParams.get('itemId');
    const id = searchParams.get('id'); // support linking with ?id=
    // ✅ ดึง serialNumber และ numberPhone จาก URL
    const urlSerialNumber = searchParams.get('serialNumber');
    const urlNumberPhone = searchParams.get('numberPhone');

    if ((category || itemName || itemId || id) && ownedEquipment.length > 0) {
      
      
      // Find the equipment item by itemId or itemName
      let foundItem: OwnedEquipment | null = null;
      // Prefer id param when provided
      if (id && !foundItem) {
        // match by _id, itemId, or nested actualItemId
        foundItem = ownedEquipment.find(equip =>
          String(equip._id) === id ||
          String(equip.itemId) === id ||
          (Array.isArray(equip.items) && equip.items.some((it: any) => String(it.actualItemId) === id))
        ) || null;
      }
      if (itemId && !foundItem) {
        foundItem = ownedEquipment.find(equip => String(equip.itemId) === itemId) || null;
      }
      
      if (!foundItem && itemName) {
        foundItem = ownedEquipment.find(equip => equip.itemName === itemName) || null;
      }

      if (foundItem) {
        // ✅ ตรวจสอบว่ามีการส่ง serialNumber หรือ numberPhone มาหรือไม่
        // ถ้ามี = กดจากปุ่ม "คืน" ในตาราง → ไม่แสดง dropdown และล็อคค่า
        const isFromTableAction = !!(urlSerialNumber || urlNumberPhone);
        
        if (isFromTableAction) {
          // กรณีที่ 1 & 2: กดจากปุ่ม "คืน" ในตาราง
          // ไม่แสดง dropdown และล็อคค่า SN/เบอร์
          handleItemChange('itemId', foundItem._id || foundItem.itemId);
          handleItemChange('itemName', foundItem.itemName);
          handleItemChange('quantity', 1);
          handleItemChange('serialNumber', urlSerialNumber || '');
          handleItemChange('numberPhone', urlNumberPhone || '');
          handleItemChange('category', foundItem.category);
          handleItemChange('categoryId', foundItem.categoryId);
          handleItemChange('inventorySerialNumber', urlSerialNumber || '');
          handleItemChange('availableOptions', undefined); // ✅ ไม่แสดง dropdown
          handleItemChange('selectedOption', '');
          handleItemChange('statusOnReturn', (foundItem as any).statusId || 'status_available');
          handleItemChange('conditionOnReturn', (foundItem as any).conditionId || 'cond_working');
        } else {
          // กรณีที่ 3: เข้ามาจากเมนู (ไม่มีการส่ง SN/เบอร์มา)
          // ใช้ logic เดิม - แสดง dropdown ตามปกติ
          selectEquipment(foundItem);
        }
        
        // Show notification only once for URL prefill
        if (!hasShownNotification) {
          const totalQuantity = foundItem.totalQuantity || foundItem.quantity || 1;
          const hasSerialNumbers = foundItem.serialNumbers && foundItem.serialNumbers.length > 0;
          
          // Removed notification toasts as requested
          // if (hasSerialNumbers) {
          //   toast.success(`พบ ${foundItem.itemName} ที่มี Serial Number กรุณาเลือกรายการที่ต้องการคืน`);
          // } else if (totalQuantity > 1) {
          //   toast.success(`พบ ${foundItem.itemName} ${totalQuantity} ชิ้น กรุณาเลือกรายการที่ต้องการคืน`);
          // }
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

  // Update filtered equipment when returnItems change
  useEffect(() => {
    if (ownedEquipment.length > 0) {
      const availableEquipment = ownedEquipment.filter(equip => {
        const isAlreadyAdded = returnItems.some(returnItem => 
          returnItem.itemId === equip._id || 
          (returnItem.serialNumber && returnItem.serialNumber === equip.serialNumber)
        );
        return !isAlreadyAdded;
      });
      
      // Apply search filter if there's a search term
      if (searchTerm.trim() === '') {
        setFilteredEquipment(availableEquipment);
      } else {
        const filtered = availableEquipment.filter(equip => 
          equip.searchText.includes(searchTerm.toLowerCase())
        );
        setFilteredEquipment(filtered);
      }
    }
  }, [returnItems, ownedEquipment, searchTerm]);

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/inventory-config');
      if (response.ok) {
        const data = await response.json();
        setStatusConfigs(data.statusConfigs || []);
        setConditionConfigs(data.conditionConfigs || []);
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
    }
  };

  const fetchUserItems = async () => {
    try {
      setIsLoadingEquipment(true);
      // Use appropriate data based on user type
      const firstName = user?.userType === 'individual' ? user.firstName : formData.firstName;
      const lastName = user?.userType === 'individual' ? user.lastName : formData.lastName;
      const office = user?.office || '';
      
      console.log('🔍 Fetching user items with params:', { firstName, lastName, office, userId: user?.id });
      
      const params = new URLSearchParams({
        firstName: firstName || '',
        lastName: lastName || '',
        office: office,
        excludePendingReturns: 'true', // ✅ กรองอุปกรณ์ที่มี pending return ออก
      });
      
      if (user?.id) {
        params.set('userId', String(user.id));
      }
      
      const res = await fetch(`/api/user/owned-equipment?${params.toString()}`);
      
      // ✅ จัดการ 401/403 error - เด้งออกจากระบบทันที
      if (handleAuthError(res)) {
        return;
      }
      
      if (res.ok) {
        const data = await res.json();
        console.log('🔍 API Response:', data);
        
        // ประมวลผลข้อมูลให้เป็นรูปแบบที่ UI ต้องการ
        const processedEquipment: OwnedEquipment[] = (data.items || []).map((item: any) => {
          const displayName = item.itemName || 'ไม่ระบุชื่อ';
          const displayCategory = item.category || 'ไม่ระบุหมวดหมู่';
          const searchText = `${displayName} ${displayCategory} ${item.serialNumber || ''} ${item.numberPhone || ''}`.toLowerCase();
          
          return {
            _id: item._id,
            itemId: item._id, // ใช้ _id เป็น itemId
            itemName: displayName,
            category: displayCategory,
            categoryId: item.categoryId,
            quantity: 1, // แต่ละรายการมี 1 ชิ้น
            serialNumber: item.serialNumber,
            numberPhone: item.numberPhone,
            inventorySerialNumber: item.serialNumber,
            displayName: displayName,
            displayCategory: displayCategory,
            searchText: searchText,
            totalQuantity: 1,
            serialNumbers: item.serialNumber ? [item.serialNumber] : [],
            numberPhones: item.numberPhone ? [item.numberPhone] : [],
            items: [{
              actualItemId: item._id,
              serialNumber: item.serialNumber,
              numberPhone: item.numberPhone
            }],
            itemIdMap: item.serialNumber ? { [item.serialNumber]: item._id } : {},
            masterItemId: item.itemMasterId,
            // เพิ่มข้อมูลสถานะและสภาพ
            statusId: item.statusId,
            statusName: item.statusName,
            conditionId: item.conditionId,
            conditionName: item.conditionName,
            // ✅ เพิ่มข้อมูลผู้ครอบครอง
            firstName: item.firstName,
            lastName: item.lastName,
            nickname: item.nickname,
            department: item.department,
            phone: item.phone,
            office: item.office
          };
        });
        
        console.log('🔍 Processed equipment:', processedEquipment);
        setOwnedEquipment(processedEquipment);
        
        // Filter out equipment that's already in the return list
        const availableEquipment = processedEquipment.filter(equip => {
          const isAlreadyAdded = returnItems.some(returnItem => 
            returnItem.itemId === equip._id || 
            (returnItem.serialNumber && returnItem.serialNumber === equip.serialNumber)
          );
          return !isAlreadyAdded;
        });
        setFilteredEquipment(availableEquipment);
      } else {
        console.error('❌ API Error:', res.status, res.statusText);
      }
    } catch (e) {
      console.error('Error fetching owned equipment:', e);
      setOwnedEquipment([]);
      setFilteredEquipment([]);
    } finally {
      setIsLoadingEquipment(false);
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
    setReturnItem(prev => {
      const newItem = { ...prev, [field]: value };
      
      // คำนวณจำนวนที่เหลือเมื่อมีการเปลี่ยนจำนวน
      if (field === 'quantity' && maxQuantity > 0) {
        const newQuantity = parseInt(value) || 0;
        setRemainingQuantity(Math.max(0, maxQuantity - newQuantity));
      }
      
      return newItem;
    });
  };

  const handleEquipmentSearch = (term: string) => {
    setSearchTerm(term);
    
    // Filter out equipment that's already in the return list
    const availableEquipment = ownedEquipment.filter(equip => {
      const isAlreadyAdded = returnItems.some(returnItem => 
        returnItem.itemId === equip._id || 
        (returnItem.serialNumber && returnItem.serialNumber === equip.serialNumber)
      );
      return !isAlreadyAdded;
    });
    
    if (term.trim() === '') {
      setFilteredEquipment(availableEquipment);
    } else {
      const filtered = availableEquipment.filter(equip => 
        equip.searchText.includes(term.toLowerCase())
      );
      setFilteredEquipment(filtered);
    }
  };

  const selectEquipment = (equipment: OwnedEquipment) => {
    // Reset notification flag when selecting new equipment
    setHasShownNotification(false);
    
    // ✅ ดึงข้อมูลผู้ครอบครองมาใส่ในฟอร์ม (สำหรับผู้ใช้ประเภท branch)
    if (user?.userType === 'branch') {
      setFormData(prev => ({
        ...prev,
        firstName: equipment.firstName || prev.firstName,
        lastName: equipment.lastName || prev.lastName,
        nickname: equipment.nickname || prev.nickname,
        department: equipment.department || prev.department,
        phone: equipment.phone || prev.phone,
      }));
    }
    
    // ✅ เก็บข้อมูลผู้คืนไว้ใน returnItem เพื่อใช้ตอนเพิ่มเข้ารายการ
    handleItemChange('returnerFirstName', equipment.firstName || '');
    handleItemChange('returnerLastName', equipment.lastName || '');
    handleItemChange('returnerNickname', equipment.nickname || '');
    handleItemChange('returnerDepartment', equipment.department || '');
    handleItemChange('returnerPhone', equipment.phone || '');
    handleItemChange('returnerOffice', equipment.office || '');
    
    // ตรวจสอบว่ามีข้อมูล totalQuantity และ serialNumbers จาก API response
    const totalQuantity = equipment.totalQuantity || equipment.quantity || 1;
    const serialNumbers = equipment.serialNumbers || [];
    
    // ตรวจสอบว่าต้องแสดง dropdown หรือไม่ (มีหลายชิ้นหรือมี SN)
    const hasMultipleItems = totalQuantity > 1;
    const hasSerialNumbers = serialNumbers.length > 0;
    const needsDropdown = hasMultipleItems || hasSerialNumbers;
    
    
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
      
      // เพิ่มรายการที่มีเบอร์โทรศัพท์ (สำหรับซิมการ์ด)
      const numberPhones = equipment.numberPhones || [];
      numberPhones.forEach(phone => {
        const actualItemId = equipment.itemIdMap?.[phone] || equipment.itemId;
        availableOptions.push({
          numberPhone: phone,
          displayName: `${equipment.itemName} (เบอร์: ${phone})`,
          value: `phone_${phone}`,
          itemId: actualItemId,
          inventorySerialNumber: ''
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
      // ถ้ามีตัวเลือกเดียว ให้เลือกให้อัตโนมัติ
      if (availableOptions.length === 1) {
        const only = availableOptions[0];
        handleItemChange('itemId', only.itemId);
        handleItemChange('itemName', equipment.itemName);
        handleItemChange('quantity', 1);
        handleItemChange('category', equipment.category);
        handleItemChange('categoryId', equipment.categoryId);
        handleItemChange('availableOptions', availableOptions);
        handleItemChange('selectedOption', only.value);
        handleItemChange('serialNumber', only.serialNumber || '');
        handleItemChange('numberPhone', only.numberPhone || '');
        handleItemChange('inventorySerialNumber', only.serialNumber || '');
        // ดึงค่าสถานะและสภาพจากอุปกรณ์
        handleItemChange('statusOnReturn', (equipment as any).statusId || 'status_available');
        handleItemChange('conditionOnReturn', (equipment as any).conditionId || 'cond_working');
        if (only.value === 'no_sn_bulk' && only.maxQuantity) {
          setMaxQuantity(only.maxQuantity);
          setRemainingQuantity(Math.max(0, only.maxQuantity - 1));
        } else {
          setMaxQuantity(0);
          setRemainingQuantity(0);
        }
      } else {
        // ไม่ตั้งค่า default itemId - บังคับให้ user เลือก
        handleItemChange('itemId', '');
        handleItemChange('itemName', equipment.itemName);
        handleItemChange('quantity', 1);
        handleItemChange('category', equipment.category);
        handleItemChange('categoryId', equipment.categoryId);
        handleItemChange('availableOptions', availableOptions);
        handleItemChange('selectedOption', '');
        handleItemChange('serialNumber', '');
        handleItemChange('numberPhone', '');
        handleItemChange('inventorySerialNumber', '');
        // ดึงค่าสถานะและสภาพจากอุปกรณ์
        handleItemChange('statusOnReturn', (equipment as any).statusId || 'status_available');
        handleItemChange('conditionOnReturn', (equipment as any).conditionId || 'cond_working');
      }
      
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
      handleItemChange('numberPhone', equipment.numberPhone || ''); // Ensure phone number is set
      handleItemChange('category', equipment.category);
      handleItemChange('categoryId', equipment.categoryId);
      handleItemChange('inventorySerialNumber', equipment.serialNumber || '');
      handleItemChange('availableOptions', undefined);
      handleItemChange('selectedOption', '');
      // ดึงค่าสถานะและสภาพจากอุปกรณ์
      handleItemChange('statusOnReturn', (equipment as any).statusId || 'status_available');
      handleItemChange('conditionOnReturn', (equipment as any).conditionId || 'cond_working');
      
      
    }
    
    setShowEquipmentDropdown(false);
    setSearchTerm('');
    setFilteredEquipment(ownedEquipment);
  };

  // Add selected return item to list with duplicate prevention (by itemId or selected option)
  const addReturnItem = () => {
    console.log('🔍 addReturnItem validation:', {
      itemId: returnItem.itemId,
      itemName: returnItem.itemName,
      selectedOption: returnItem.selectedOption,
      availableOptions: returnItem.availableOptions?.length || 0
    });
    
    if (!returnItem.itemId || !returnItem.itemName) {
      console.log('❌ Validation failed:', { itemId: returnItem.itemId, itemName: returnItem.itemName });
      toast.error('กรุณาเลือกอุปกรณ์');
      return;
    }
    // use itemId + serial to prevent duplicates
    const key = `${returnItem.itemId}-${returnItem.serialNumber || ''}-${returnItem.selectedOption || ''}`;
    const exists = returnItems.some(it => `${it.itemId}-${it.serialNumber || ''}-${it.selectedOption || ''}` === key);
    if (exists) {
      toast.error('เลือกรายการซ้ำไม่ได้');
      return;
    }
    // ✅ เก็บข้อมูลผู้คืนจาก formData ลงในรายการ (สำหรับผู้ใช้ประเภท branch)
    const itemToAdd = { ...returnItem };
    if (user?.userType === 'branch') {
      itemToAdd.returnerFirstName = formData.firstName || returnItem.returnerFirstName;
      itemToAdd.returnerLastName = formData.lastName || returnItem.returnerLastName;
      itemToAdd.returnerNickname = formData.nickname || returnItem.returnerNickname;
      itemToAdd.returnerDepartment = formData.department || returnItem.returnerDepartment;
      itemToAdd.returnerPhone = formData.phone || returnItem.returnerPhone;
      itemToAdd.returnerOffice = formData.office || returnItem.returnerOffice;
    }
    
    setReturnItems(prev => [...prev, itemToAdd]);
    
    // รีเซ็ทฟอร์มหลังจากเพิ่มรายการสำเร็จ
    setReturnItem({
      itemId: '', 
      itemName: '', 
      quantity: 1, 
      serialNumber: '', 
      numberPhone: '',
      assetNumber: '', 
      image: null,
      category: '',
      categoryId: '',
      inventorySerialNumber: '',
      availableOptions: undefined,
      selectedOption: '',
      itemNotes: '',
      statusOnReturn: 'status_available',
      conditionOnReturn: 'cond_working',
      returnerFirstName: '',
      returnerLastName: '',
      returnerNickname: '',
      returnerDepartment: '',
      returnerPhone: '',
      returnerOffice: ''
    });
    setEditingIndex(null);
    setMaxQuantity(0);
    setRemainingQuantity(0);
    
    toast.success('เพิ่มรายการเรียบร้อยแล้ว');
  };

  const removeReturnItem = (idx: number) => {
    setReturnItems(prev => prev.filter((_, i) => i !== idx));
  };

  const editReturnItem = (idx: number) => {
    const toEdit = returnItems[idx];
    if (!toEdit) return;

    // If editing another item and it's not already in list, push it back
    if (
      editingIndex !== null &&
      editingIndex !== idx
    ) {
      const key = `${returnItem.itemId}-${returnItem.serialNumber || ''}-${returnItem.selectedOption || ''}`;
      const exists = returnItems.some((it, i) => i !== idx && `${it.itemId}-${it.serialNumber || ''}-${it.selectedOption || ''}` === key);
      if (returnItem.itemId && !exists) {
        setReturnItems(prev => {
          const copy = [...prev];
          // put back the current editing item at its previous position if possible
          copy.splice(editingIndex, 0, { ...returnItem });
          return copy.filter((_, i) => i !== (idx + 1));
        });
      }
    }

    setReturnItem({ ...toEdit });
    setReturnItems(prev => prev.filter((_, i) => i !== idx));
    setEditingIndex(idx);
    
    // ✅ นำข้อมูลผู้คืนของรายการที่แก้ไขมาแสดงในฟอร์ม (สำหรับผู้ใช้ประเภท branch)
    if (user?.userType === 'branch' && toEdit.returnerFirstName) {
      setFormData(prev => ({
        ...prev,
        firstName: toEdit.returnerFirstName || prev.firstName,
        lastName: toEdit.returnerLastName || prev.lastName,
        nickname: toEdit.returnerNickname || prev.nickname,
        department: toEdit.returnerDepartment || prev.department,
        phone: toEdit.returnerPhone || prev.phone,
      }));
    }
  };

  const handleFileChange = (file: File | null) => {
    // Clean up previous object URL to prevent memory leaks
    if (returnItem.image) {
      URL.revokeObjectURL(URL.createObjectURL(returnItem.image));
    }
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

  // ฟังก์ชันรีเซทเฉพาะข้อมูลอุปกรณ์ที่กำลังเพิ่ม
  const resetItemForm = () => {
    setReturnItem({
      itemId: '', 
      itemName: '', 
      quantity: 1, 
      serialNumber: '', 
      numberPhone: '',
      assetNumber: '', 
      image: null,
      category: '',
      categoryId: '',
      inventorySerialNumber: '',
      availableOptions: undefined,
      selectedOption: '',
      itemNotes: '',
      statusOnReturn: 'status_available',
      conditionOnReturn: 'cond_working',
      returnerFirstName: '',
      returnerLastName: '',
      returnerNickname: '',
      returnerDepartment: '',
      returnerPhone: '',
      returnerOffice: ''
    });
    setEditingIndex(null);
    setSearchTerm('');
    setMaxQuantity(0);
    setRemainingQuantity(0);
    toast.success('รีเซทรายการอุปกรณ์เรียบร้อยแล้ว');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsSubmitted(true);

    try {
      // Clear previous validation errors
      setValidationErrors({});

      // Specific validation for return date
      if (!formData.returnDate || formData.returnDate.trim() === '') {
        setValidationErrors({ returnDate: 'กรุณาเลือกวันที่คืนอุปกรณ์' });
        toast.error('กรุณาเลือกวันที่คืนอุปกรณ์');
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

      // Validate items - ต้องมีรายการในรายการที่จะคืนเท่านั้น
      if (returnItems.length === 0) {
        console.log('❌ No items in return list');
        toast.error('กรุณาเพิ่มรายการอุปกรณ์ที่ต้องการคืนในรายการด้านล่างก่อนกดบันทึก');
        setIsLoading(false);
        return;
      }
      




      // Build items array - ใช้เฉพาะรายการในลิสต์เท่านั้น
      let itemsArrayInput = [...returnItems];

      // Upload images for all items first
      const itemsWithUploadedImages = await Promise.all(
        itemsArrayInput.map(async (ri) => {
          let imagePath = '';
          if (ri.image && ri.image instanceof File) {
            try {
              imagePath = await uploadImage(ri.image);
            } catch (error) {
              console.error('Image upload failed for item:', ri.itemName, error);
              // Continue without image if upload fails
            }
          }
          
          // For options-based selection, prefer option-derived ids
          const selectedOption = ri.availableOptions?.find(opt => opt.value === ri.selectedOption);
          const finalId = selectedOption?.itemId || ri.itemId;
          const finalSN = selectedOption?.serialNumber || ri.serialNumber || '';
          
          // For SIM cards, prefer numberPhone over serialNumber
          const finalPhone = selectedOption?.numberPhone || ri.numberPhone || '';
          
          return {
            itemId: finalId,
            quantity: ri.quantity,
            serialNumber: finalSN || '',
            numberPhone: finalPhone || '',
            assetNumber: ri.assetNumber || '',
            image: imagePath || undefined,
            masterItemId: (ri as any).masterItemId,
            itemNotes: ri.itemNotes || '',
            statusOnReturn: ri.statusOnReturn || 'status_available',
            conditionOnReturn: ri.conditionOnReturn || 'cond_working'
          };
        })
      );

      const returnData = {
        // Use user profile data for individual users, form data for branch users
        firstName: user?.userType === 'individual' ? user.firstName : formData.firstName,
        lastName: user?.userType === 'individual' ? user.lastName : formData.lastName,
        nickname: user?.userType === 'individual' ? (user.nickname || '') : formData.nickname,
        department: user?.userType === 'individual' ? (user.department || '') : formData.department,
        office: user?.office || '',
        phone: user?.userType === 'individual' ? (user.phone || '') : formData.phone,
        returnDate: formData.returnDate,
        items: itemsWithUploadedImages
      };

      // Add timeout and retry logic
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      let response: Response | undefined;
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
          const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
          console.warn(`⚠️ Fetch attempt ${retryCount} failed:`, errorMessage);
          
          if (retryCount > maxRetries) {
            clearTimeout(timeoutId);
            throw fetchError; // Re-throw after max retries
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      if (!response) {
        toast.error('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('❌ Failed to parse JSON response:', jsonError);
        const textResponse = await response.text();
        console.error('📄 Raw response:', textResponse);
        
        toast.error('เซิร์ฟเวอร์ตอบกลับในรูปแบบที่ไม่ถูกต้อง');
        return;
      }

      if (response.ok) {
        toast.success('ส่งข้อมูลเรียบร้อยแล้ว');
        
        // Redirect to clean URL without query parameters
        router.push('/equipment-return');
        
        // Reset form immediately
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
        
        setReturnItems([]); // รีเซ็ตรายการที่จะคืน
        
        // รีเซ็ตฟอร์มอุปกรณ์เหมือนกดปุ่มรีเซทรายการ
        setReturnItem({
          itemId: '', 
          itemName: '', 
          quantity: 1, 
          serialNumber: '', 
          numberPhone: '',
          assetNumber: '', 
          image: null,
          category: '',
          categoryId: '',
          inventorySerialNumber: '',
          availableOptions: undefined,
          selectedOption: '',
          itemNotes: '',
          statusOnReturn: 'status_available',
          conditionOnReturn: 'cond_working',
          returnerFirstName: '',
          returnerLastName: '',
          returnerNickname: '',
          returnerDepartment: '',
          returnerPhone: '',
          returnerOffice: ''
        });
        setEditingIndex(null);
        setSearchTerm('');
        setMaxQuantity(0);
        setRemainingQuantity(0);
        setShowEquipmentDropdown(false);
        setShowOptionDropdown(false);
        setFilteredEquipment([]);
        setHasShownNotification(false);
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
      
      if (error instanceof Error) {
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
      } else {
        console.error('🔍 Unknown error:', error);
        toast.error('เกิดข้อผิดพลาดที่ไม่คาดคิด');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthGuard>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl px-5 py-8 sm:p-8 border border-white/50">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">คืนอุปกรณ์</h1>

          {/* User Profile Display */}
          <RequesterInfoForm 
            formData={{
              ...formData,
              office: formData.office || user?.office || ''
            }}
            onInputChange={handleInputChange}
            title="ข้อมูลผู้คืนอุปกรณ์"
            lockPersonalInfo={!!(formData.firstName && formData.lastName)} // Lock if data is pre-filled from URL
          />

          <form onSubmit={handleSubmit} className={`space-y-6 ${isSubmitted ? 'form-submitted' : ''}`}>
            {/* Return Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วันที่คืน *
              </label>
              <DatePicker
                value={formData.returnDate}
                onChange={(date) => {
                  setFormData(prev => ({ ...prev, returnDate: date }));
                  // Clear validation error when user selects a date
                  if (validationErrors.returnDate) {
                    setValidationErrors(prev => ({ ...prev, returnDate: '' }));
                  }
                }}
                placeholder="dd/mm/yyyy"
                required
                className={validationErrors.returnDate ? 'border-red-500 focus:ring-red-500' : ''}
              />
              {validationErrors.returnDate && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.returnDate}</p>
              )}
            </div>


            {/* Return Items */}
            <div className='mb-10'>
              <label className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                รายการอุปกรณ์ที่ต้องการคืน *
                {isLoadingEquipment && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
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
                                    {(equipment.firstName || equipment.lastName) && 
                                      ` , ชื่อ-นามสกุล: ${equipment.firstName || ''} ${equipment.lastName || ''}`
                                    }
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
                  {returnItem.availableOptions && returnItem.availableOptions.length > 0 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        เลือกรายการที่ต้องการคืน *
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowOptionDropdown(!showOptionDropdown)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between cursor-pointer ${
                            !returnItem.selectedOption 
                              ? 'border-red-300 bg-red-50 text-red-500' 
                              : 'border-gray-300 text-gray-900'
                          }`}
                        >
                          <span className={returnItem.selectedOption ? 'text-gray-900' : 'text-red-500'}>
                            {returnItem.selectedOption 
                              ? returnItem.availableOptions?.find(opt => opt.value === returnItem.selectedOption)?.displayName 
                              : '⚠️ กรุณาเลือกรายการที่ต้องการคืน'}
                          </span>
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        </button>
                        {!returnItem.selectedOption && (
                          <p className="mt-1 text-sm text-red-600">
                            ⚠️ กรุณาเลือกรายการอุปกรณ์ที่ต้องการคืนจากรายการด้านบน
                          </p>
                        )}
                        
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
                                    handleItemChange('numberPhone', option.numberPhone || '');
                                    handleItemChange('inventorySerialNumber', option.serialNumber || '');
                                    handleItemChange('itemId', option.itemId);
                                    
                                    // ดึงค่าสถานะและสภาพจากอุปกรณ์ที่เลือก
                                    const selectedEquipment = ownedEquipment.find(equip => 
                                      equip.itemId === option.itemId || equip._id === option.itemId
                                    );
                                    if (selectedEquipment) {
                                      handleItemChange('statusOnReturn', (selectedEquipment as any).statusId || 'status_available');
                                      handleItemChange('conditionOnReturn', (selectedEquipment as any).conditionId || 'cond_working');
                                    }
                                    
                                    // ตั้งค่าจำนวนสูงสุดและจำนวนที่เหลือสำหรับอุปกรณ์ไม่มี SN
                                    if (option.value === 'no_sn_bulk' && option.maxQuantity) {
                                      setMaxQuantity(option.maxQuantity);
                                      setRemainingQuantity(option.maxQuantity - 1); // เริ่มต้นที่ 1 ชิ้น
                                    } else {
                                      setMaxQuantity(0);
                                      setRemainingQuantity(0);
                                    }
                                    
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

                      {/* Quantity, Serial Number/Phone Number, Asset Number */}
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 cursor-not-allowed"
                            disabled
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
                            {returnItem.category?.toLowerCase().includes('ซิมการ์ด') 
                              ? 'เบอร์โทรศัพท์' 
                              : 'Serial Number'}
                          </label>
                          <input
                            type="text"
                            value={
                              returnItem.category?.toLowerCase().includes('ซิมการ์ด')
                                ? (returnItem.numberPhone || '')
                                : (returnItem.serialNumber || '')
                            }
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

                      {/* Status and Condition */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            สถานะอุปกรณ์ *
                          </label>
                          <select
                            value={returnItem.statusOnReturn || 'status_available'}
                            onChange={(e) => handleItemChange('statusOnReturn', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                            required
                          >
                            {statusConfigs.map((status) => (
                              <option key={status.id} value={status.id}>
                                {status.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            สภาพอุปกรณ์ *
                          </label>
                          <select
                            value={returnItem.conditionOnReturn || 'cond_working'}
                            onChange={(e) => handleItemChange('conditionOnReturn', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                            required
                          >
                            {conditionConfigs.map((condition) => (
                              <option key={condition.id} value={condition.id}>
                                {condition.name}
                              </option>
                            ))}
                          </select>
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
                              <div className="w-full">
                                <div className="text-sm text-gray-600 mb-2">
                                  ไฟล์ที่เลือก: {returnItem.image.name}
                                </div>
                                {/* แสดงรูปภาพที่อัพโหลด */}
                                <div className="mb-3">
                                  <img
                                    src={URL.createObjectURL(returnItem.image)}
                                    alt="รูปภาพที่อัพโหลด"
                                    className="max-w-full max-h-48 mx-auto rounded-lg shadow-sm border border-gray-200"
                                    style={{ maxWidth: '300px', maxHeight: '200px', objectFit: 'contain' }}
                                  />
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

                      {/* Item-level reason (optional) */}
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          เหตุผลของรายการนี้ (ไม่บังคับ)
                        </label>
                        <input
                          type="text"
                          value={returnItem.itemNotes || ''}
                          onChange={(e) => handleItemChange('itemNotes', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                          placeholder="ระบุเหตุผลของรายการเฉพาะนี้ ถ้าต้องการ"
                        />
                      </div>
                    </>
                  )}
                </div>
                {/* Add to list and show selected list */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addReturnItem}
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

                {/* รายการที่จะคืน - แสดงตลอดเวลา */}
                <div className="mt-4 border border-gray-200 rounded-lg">
                  <div className="p-3 font-medium text-gray-700">รายการที่จะคืน</div>
                  {returnItems.length > 0 ? (
                    <ul className="divide-y divide-gray-100">
                      {returnItems.map((it, idx) => (
                        <li key={`${it.itemId}-${it.serialNumber || it.numberPhone || idx}`} className="flex items-center justify-between p-3">
                          <div className="text-gray-900">
                            <div>
                              {it.itemName} 
                              {it.category?.toLowerCase().includes('ซิมการ์ด') 
                                ? (it.numberPhone ? ` (เบอร์: ${it.numberPhone})` : '') 
                                : (it.serialNumber ? ` (SN: ${it.serialNumber})` : '')} 
                              × {it.quantity}
                            </div>
                            {/* แสดงข้อมูลผู้คืนของรายการนี้ (สำหรับผู้ใช้ประเภท branch) */}
                            {user?.userType === 'branch' && (it.returnerFirstName || it.returnerLastName) && (
                              <div className="text-sm text-gray-600 mt-1">
                                ผู้คืน: {it.returnerFirstName} {it.returnerLastName}
                                {it.returnerNickname && ` (${it.returnerNickname})`}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => editReturnItem(idx)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              แก้ไข
                            </button>
                            <button
                              type="button"
                              onClick={() => removeReturnItem(idx)}
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
                      <div className="text-xs mt-1">กรุณาเลือกอุปกรณ์และกด "เพิ่มเข้ารายการ" เพื่อเพิ่มรายการที่ต้องการคืน</div>
                    </div>
                  )}
                  
                  {/* หมายเหตุอธิบาย */}
                  <div className="px-3 pb-3">
                    <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded border-l-4 border-blue-200">
                      <div className="font-medium text-blue-800 mb-1">💡 หมายเหตุ:</div>
                      <div>เฉพาะอุปกรณ์ที่อยู่ในรายการนี้เท่านั้นที่จะถูกส่งคืน กรุณาเพิ่มรายการอุปกรณ์ที่ต้องการคืนให้ครบถ้วนก่อนกดบันทึก</div>
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
                  'บันทึกการคืน'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
    </AuthGuard>
  );
}
