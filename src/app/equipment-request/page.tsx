'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { toast } from 'react-hot-toast';
import { Search, RefreshCw, ChevronDown } from 'lucide-react';
import RequesterInfoForm from '@/components/RequesterInfoForm';
import DatePicker from '@/components/DatePicker';
import { handleAuthError } from '@/lib/auth-error-handler';
import AuthGuard from '@/components/AuthGuard';

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
  isAvailable?: boolean; // ✅ เพิ่ม flag เพื่อบอกว่าพร้อมเบิกหรือไม่
  hasPendingRequest?: boolean; // ✅ เก็บ flag hasPendingRequest จาก API (เฉพาะผู้ใช้คนนี้)
  pendingQuantity?: number; // ✅ เก็บจำนวนที่ผู้ใช้คนนี้รออนุมัติ
  totalPendingQuantity?: number; // ✅ เก็บจำนวนรวมที่ทุกคนรออนุมัติ
  availableAfterPending?: number; // ✅ เก็บจำนวนที่พร้อมเบิกจริงๆ (หัก pending ของทุกคนออก)
  pendingRequestId?: string | null; // ✅ เก็บ requestId ที่รออนุมัติ
}

interface PendingRequestItem {
  masterId: string;
  quantity: number;
  serialNumbers?: string[];
  requestedPhoneNumbers?: string[];
}

interface PendingRequest {
  _id: string;
  status: string;
  userId?: string; // ✅ เพิ่ม userId เพื่อเช็คว่าเป็น request ของผู้ใช้คนนี้หรือไม่
  items: PendingRequestItem[];
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
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [categoryConfigs, setCategoryConfigs] = useState<ICategoryConfig[]>([]);
  const [isLoadingEquipment, setIsLoadingEquipment] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const dataLoadedRef = useRef(false);
  // ✅ เพิ่ม ref เพื่อป้องกันการ submit ซ้ำจาก React Strict Mode
  const isSubmittingRef = useRef(false);
  
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
    email: '',
    office: '',
    officeId: '', // 🆕 Office ID สำหรับอ้างอิง
  });

  const [requestItem, setRequestItem] = useState<RequestItem>({
    itemId: '', quantity: 1, serialNumber: '', itemNotes: ''
  });
  
  // State for available serial numbers/phone numbers
  const [availableSerialNumbers, setAvailableSerialNumbers] = useState<string[]>([]);
  const [selectedSerialNumber, setSelectedSerialNumber] = useState<string>('');
  const [isLoadingSerialNumbers, setIsLoadingSerialNumbers] = useState<boolean>(false);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  // Multiple items support (prevent duplicates by itemId)
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  // Track currently editing item (so switching edits preserves previous)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // State for category-based item selection
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [itemsByCategory, setItemsByCategory] = useState<{[key: string]: string[]}>({});
  const [showCategorySelector, setShowCategorySelector] = useState<boolean>(false);
  const [showItemSelector, setShowItemSelector] = useState<boolean>(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState<string>('');
  const [itemSearchTerm, setItemSearchTerm] = useState<string>('');

  // ✅ Reset data loaded flag when pathname changes (navigation to this page)
  useEffect(() => {
    dataLoadedRef.current = false;
  }, [pathname]);

  useEffect(() => {
    // ✅ รอให้ user โหลดเสร็จก่อนเรียก fetchInventoryItems
    // เพื่อให้แน่ใจว่า userId จะถูกส่งไปที่ API
    if (!loading && user && !dataLoadedRef.current) {
      dataLoadedRef.current = true;
      fetchInventoryItems();
    }
  }, [pathname, loading, user]);

  // Set office in formData when user data is available
  useEffect(() => {
    if (user?.userType === 'branch') {
      // 🆕 สำหรับผู้ใช้ประเภทสาขา: ล็อค officeId และ officeName จากบัญชีที่ล็อคอินอยู่
      setFormData(prev => ({
        ...prev,
        office: user.officeName || user.office || '',
        officeId: user.officeId || ''
      }));
    } else if (user?.officeName) {
      setFormData(prev => ({
        ...prev,
        office: user.officeName
      }));
    } else if (user?.office) {
      setFormData(prev => ({
        ...prev,
        office: user.office || ''
      }));
    }
  }, [user?.userType, user?.officeName, user?.office, user?.officeId]);

  const fetchInventoryItems = async () => {
    try {
      setIsLoadingEquipment(true);
      
      // ✅ สร้าง URL พร้อม userId และ cache-busting parameter
      const availableUrl = new URL('/api/equipment-request/available', window.location.origin);
      // ✅ ใช้ user.id (ซึ่งตรงกับ user_id จาก database) หรือ user.user_id ถ้ามี
      const userIdToSend = user?.id || user?.user_id;
      if (userIdToSend) {
        availableUrl.searchParams.set('userId', String(userIdToSend));
        console.log('🔍 Fetching available items with userId:', userIdToSend);
      } else {
        console.warn('⚠️ No userId available for fetching pending requests');
      }
      availableUrl.searchParams.set('_t', Date.now().toString()); // Cache-busting
      
      // ✅ Fetch all APIs in parallel for better performance
      const [configResponse, availableResponse, pendingResponse] = await Promise.all([
        fetch('/api/admin/inventory/config'),
        fetch(availableUrl.toString()),
        fetch('/api/admin/equipment-reports/requests')
      ]);
      
      // ✅ จัดการ 401/403 error - เด้งออกจากระบบทันที
      if (handleAuthError(configResponse) || handleAuthError(availableResponse) || handleAuthError(pendingResponse)) {
        return;
      }
      
      // Process config response
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setCategoryConfigs(configData.categoryConfigs || []);
      }
      
      // Process pending requests response
      if (pendingResponse.ok) {
        const allRequests = await pendingResponse.json();
        // กรองเฉพาะคำขอเบิกที่รออนุมัติ
        const pending = allRequests.filter((req: PendingRequest) => req.status === 'pending');
        setPendingRequests(pending);
        console.log('✅ Equipment Request - Loaded pending requests:', pending.length);
      }
      
      // Process available items response
      if (availableResponse.ok) {
        const availableData = await availableResponse.json();
        const availableItems = availableData.availableItems || [];
        
        console.log('✅ Equipment Request - Loaded available items:', availableItems);
        
        // แปลงข้อมูลให้เป็นรูปแบบที่ UI ต้องการ
        const items = availableItems.map((item: any) => {
          const mappedItem = {
          _id: item.itemMasterId,
          itemName: item.itemName,
          categoryId: item.categoryId,
          category: item.categoryId, // For backward compatibility
            quantity: item.availableQuantity, // จำนวนที่มีในคลัง
          price: 0,
          serialNumber: item.sampleItems?.[0]?.serialNumber || '',
            isAvailable: item.isAvailable === true, // ✅ เก็บ flag isAvailable จาก API (ถ้าไม่มีค่าให้เป็น false)
            hasPendingRequest: item.hasPendingRequest === true, // ✅ เก็บ flag hasPendingRequest จาก API (เฉพาะผู้ใช้คนนี้)
            pendingQuantity: item.pendingQuantity || 0, // ✅ เก็บจำนวนที่ผู้ใช้คนนี้รออนุมัติ
            totalPendingQuantity: item.totalPendingQuantity || 0, // ✅ เก็บจำนวนรวมที่ทุกคนรออนุมัติ
            availableAfterPending: item.availableAfterPending || 0, // ✅ เก็บจำนวนที่พร้อมเบิกจริงๆ (หัก pending ของทุกคนออก)
            pendingRequestId: item.pendingRequestId || null // ✅ เก็บ requestId ที่รออนุมัติ
          };
          
          // ✅ Debug log เพื่อตรวจสอบข้อมูล pending
          if (mappedItem.hasPendingRequest || mappedItem.totalPendingQuantity > 0) {
            console.log(`🔍 Item with pending request: ${mappedItem.itemName}`, {
              hasPendingRequest: mappedItem.hasPendingRequest,
              pendingQuantity: mappedItem.pendingQuantity,
              totalPendingQuantity: mappedItem.totalPendingQuantity,
              availableAfterPending: mappedItem.availableAfterPending,
              pendingRequestId: mappedItem.pendingRequestId,
              itemMasterId: mappedItem._id
            });
          }
          
          return mappedItem;
        });
        
        setInventoryItems(items);
        
        // Group items by categoryId - รวมอุปกรณ์ที่พร้อมเบิกและไม่พร้อมเบิก
        const grouped: {[key: string]: string[]} = {};
        availableItems.forEach((item: any) => {
          const categoryId = item.categoryId;
          
          // ✅ แก้ไข: รวมอุปกรณ์ทั้งหมด (รวมที่ availableQuantity = 0)
          if (categoryId) {
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
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setIsLoadingEquipment(false);
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
    // ไม่ให้แก้ไข quantity - ล็อคไว้ที่ 1
    if (field === 'quantity') {
      setRequestItem(prev => ({ ...prev, [field]: 1 }));
    } else {
      setRequestItem(prev => ({ ...prev, [field]: value }));
    }
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
    setLoadingItemId(itemId); // เริ่มแสดงการโหลด
    handleItemChange('itemId', itemId);
    
    // ✅ ดึง Serial Numbers หรือเบอร์โทรศัพท์ที่พร้อมใช้งาน
    await fetchAvailableSerialNumbers(itemId);
    
    // เมื่อโหลดเสร็จแล้วจึงปิด dropdown
    setShowItemSelector(false);
    setLoadingItemId(null); // หยุดแสดงการโหลด
  };
  
  // ✅ ฟังก์ชันดึง Serial Numbers หรือเบอร์โทรศัพท์ที่พร้อมใช้งาน
  const fetchAvailableSerialNumbers = async (itemId: string) => {
    try {
      setIsLoadingSerialNumbers(true);
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
      
      // ✅ จัดการ 401/403 error - เด้งออกจากระบบทันที
      if (handleAuthError(response)) {
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        
        console.log('🔍 Equipment Request - API Response for Serial Numbers:', {
          itemName: inventoryItem.itemName,
          withSerialNumber: data.withSerialNumber?.length || 0,
          withPhoneNumber: data.withPhoneNumber?.length || 0,
          withoutSerialNumber: data.withoutSerialNumber?.count || 0,
          rawData: data
        });
        
        // ✅ ดึง Serial Numbers สำหรับอุปกรณ์ทั่วไป (กรองเฉพาะที่มี serialNumber จริงๆ)
        const serialNumbers = data.withSerialNumber
          ?.filter((item: any) => item.serialNumber && item.serialNumber.trim() !== '')
          .map((item: any) => item.serialNumber) || [];
        
        // ✅ ดึงเบอร์โทรศัพท์สำหรับซิมการ์ด (จาก withSerialNumber หรือ withPhoneNumber)
        const phoneNumbersFromWithSN = data.withSerialNumber
          ?.filter((item: any) => item.numberPhone && item.numberPhone.trim() !== '')
          .map((item: any) => item.numberPhone) || [];
        const phoneNumbersFromWithPhone = data.withPhoneNumber?.map((item: any) => item.numberPhone).filter((phone: string) => phone) || [];
        // รวมเบอร์โทรศัพท์ทั้งหมด (ไม่ให้ซ้ำ)
        const phoneNumbers = [...new Set([...phoneNumbersFromWithSN, ...phoneNumbersFromWithPhone])];
        
        // ✅ นับจำนวนอุปกรณ์ที่ไม่มี Serial Number/เบอร์โทร
        const countWithoutSN = data.withoutSerialNumber?.count || 0;
        
        console.log('🔍 Equipment Request - Extracted data:', {
          serialNumbers,
          phoneNumbers,
          countWithoutSN
        });
        
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
        
        console.log('🔍 Equipment Request - Available options before filtering:', availableOptions);
        
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
    } finally {
      setIsLoadingSerialNumbers(false);
    }
  };

  // Helper function to get item display name from itemId
  const getItemDisplayName = (itemId: string) => {
    if (!itemId) return '';
    const inventoryItem = inventoryItems.find(i => String(i._id) === itemId);
    return inventoryItem?.itemName || '';
  };

  // ✅ ฟังก์ชันเช็คว่าอุปกรณ์อยู่ในรายการรออนุมัติหรือไม่ (เฉพาะผู้ใช้คนนี้)
  // ใช้สำหรับเช็คว่าผู้ใช้คนนี้เบิกซ้ำหรือไม่
  const isItemPendingApproval = (itemId: string, serialNumber?: string): boolean => {
    if (!itemId) return false;
    
    const currentUserId = user?.id || user?.user_id;
    if (!currentUserId) return false; // ถ้าไม่มี userId ให้ return false
    
    const selectedItem = inventoryItems.find(i => String(i._id) === itemId);
    const isSIMCard = selectedItem?.categoryId === 'cat_sim_card';
    
    // ✅ เช็คเฉพาะ pending requests ของผู้ใช้คนนี้เท่านั้น
    for (const request of pendingRequests) {
      // ✅ เช็คว่า request นี้เป็นของผู้ใช้คนนี้หรือไม่
      const requestUserId = request.userId || (request as any).userId;
      if (String(requestUserId) !== String(currentUserId)) {
        continue; // ข้าม request ของผู้ใช้อื่น
      }
      
      for (const item of request.items) {
        // เช็คว่า masterId ตรงกัน
        if (item.masterId === itemId) {
          // ถ้ามี serial number หรือ phone number
          if (serialNumber) {
            // สำหรับซิมการ์ด ให้เช็ค requestedPhoneNumbers
            if (isSIMCard && item.requestedPhoneNumbers && item.requestedPhoneNumbers.length > 0) {
              if (item.requestedPhoneNumbers.includes(serialNumber)) {
                return true;
              }
            }
            // สำหรับอุปกรณ์ทั่วไป ให้เช็ค serialNumbers
            else if (!isSIMCard && item.serialNumbers && item.serialNumbers.length > 0) {
              if (item.serialNumbers.includes(serialNumber)) {
                return true;
              }
            }
          }
          // ถ้าไม่มี serial number (อุปกรณ์ที่ไม่มี SN)
          else {
            // ถ้า item ใน pending request ไม่มี serialNumbers/requestedPhoneNumbers หรือเป็น array ว่าง
            // แสดงว่ารออนุมัติอุปกรณ์ที่ไม่มี SN
            if (isSIMCard) {
              if (!item.requestedPhoneNumbers || item.requestedPhoneNumbers.length === 0) {
                return true;
              }
            } else {
              if (!item.serialNumbers || item.serialNumbers.length === 0) {
                return true;
              }
            }
          }
        }
      }
    }
    
    return false;
  };

  // ✅ ฟังก์ชันเช็คว่า SN/เบอร์ อยู่ในรายการรออนุมัติหรือไม่ (ของทุกคน)
  // ใช้สำหรับกรอง dropdown - กรอง SN/เบอร์ที่ pending ของทุกคนออก
  const isSerialNumberPendingByAnyone = (itemId: string, serialNumber: string): boolean => {
    if (!itemId || !serialNumber) return false;
    
    const selectedItem = inventoryItems.find(i => String(i._id) === itemId);
    const isSIMCard = selectedItem?.categoryId === 'cat_sim_card';
    
    // ✅ เช็ค pending requests ของทุกคน
    for (const request of pendingRequests) {
      for (const item of request.items) {
        // เช็คว่า masterId ตรงกัน
        if (item.masterId === itemId) {
          // สำหรับซิมการ์ด ให้เช็ค requestedPhoneNumbers
          if (isSIMCard && item.requestedPhoneNumbers && item.requestedPhoneNumbers.length > 0) {
            if (item.requestedPhoneNumbers.includes(serialNumber)) {
              return true; // เบอร์นี้ถูก pending โดยใครบางคน
            }
          }
          // สำหรับอุปกรณ์ทั่วไป ให้เช็ค serialNumbers
          else if (!isSIMCard && item.serialNumbers && item.serialNumbers.length > 0) {
            if (item.serialNumbers.includes(serialNumber)) {
              return true; // SN นี้ถูก pending โดยใครบางคน
            }
          }
        }
      }
    }
    
    return false;
  };

  // ✅ ฟังก์ชันนับจำนวนอุปกรณ์ที่รออนุมัติ (สำหรับอุปกรณ์ที่ไม่มี SN) - เฉพาะผู้ใช้คนนี้
  const getPendingQuantity = (itemId: string): number => {
    if (!itemId) return 0;
    
    const currentUserId = user?.id || user?.user_id;
    if (!currentUserId) return 0; // ถ้าไม่มี userId ให้ return 0
    
    const selectedItem = inventoryItems.find(i => String(i._id) === itemId);
    const isSIMCard = selectedItem?.categoryId === 'cat_sim_card';
    
    let pendingCount = 0;
    
    // ✅ เช็คเฉพาะ pending requests ของผู้ใช้คนนี้เท่านั้น
    for (const request of pendingRequests) {
      // ✅ เช็คว่า request นี้เป็นของผู้ใช้คนนี้หรือไม่
      const requestUserId = request.userId || (request as any).userId;
      if (String(requestUserId) !== String(currentUserId)) {
        continue; // ข้าม request ของผู้ใช้อื่น
      }
      
      for (const item of request.items) {
        // เช็คว่า masterId ตรงกัน
        if (item.masterId === itemId) {
          // นับเฉพาะอุปกรณ์ที่ไม่มี SN/เบอร์
          if (isSIMCard) {
            if (!item.requestedPhoneNumbers || item.requestedPhoneNumbers.length === 0) {
              pendingCount += item.quantity || 1;
            }
          } else {
            if (!item.serialNumbers || item.serialNumbers.length === 0) {
              pendingCount += item.quantity || 1;
            }
          }
        }
      }
    }
    
    return pendingCount;
  };

  // ✅ ฟังก์ชันนับจำนวน Serial Numbers/Phone Numbers ที่รออนุมัติ - เฉพาะผู้ใช้คนนี้
  const getPendingSerialNumbers = (itemId: string): string[] => {
    if (!itemId) return [];
    
    const currentUserId = user?.id || user?.user_id;
    if (!currentUserId) return []; // ถ้าไม่มี userId ให้ return []
    
    const selectedItem = inventoryItems.find(i => String(i._id) === itemId);
    const isSIMCard = selectedItem?.categoryId === 'cat_sim_card';
    
    const pendingSNs: string[] = [];
    
    // ✅ เช็คเฉพาะ pending requests ของผู้ใช้คนนี้เท่านั้น
    for (const request of pendingRequests) {
      // ✅ เช็คว่า request นี้เป็นของผู้ใช้คนนี้หรือไม่
      const requestUserId = request.userId || (request as any).userId;
      if (String(requestUserId) !== String(currentUserId)) {
        continue; // ข้าม request ของผู้ใช้อื่น
      }
      
      for (const item of request.items) {
        if (item.masterId === itemId) {
          // สำหรับซิมการ์ด ให้ดึง requestedPhoneNumbers
          if (isSIMCard && item.requestedPhoneNumbers && item.requestedPhoneNumbers.length > 0) {
            pendingSNs.push(...item.requestedPhoneNumbers);
          }
          // สำหรับอุปกรณ์ทั่วไป ให้ดึง serialNumbers
          else if (!isSIMCard && item.serialNumbers && item.serialNumbers.length > 0) {
            pendingSNs.push(...item.serialNumbers);
          }
        }
      }
    }
    
    return pendingSNs;
  };

  // ✅ ฟังก์ชันเช็คว่าอุปกรณ์ไหนที่รออนุมัติทั้งหมด (ทุกชิ้นรออนุมัติหมด)
  const isAllItemsPending = (itemId: string): boolean => {
    if (!itemId) return false;
    
    const selectedItem = inventoryItems.find(i => String(i._id) === itemId);
    if (!selectedItem) return false;
    
    const availableQty = selectedItem.quantity || 0;
    const pendingQty = getPendingQuantity(itemId);
    const pendingSNs = getPendingSerialNumbers(itemId);
    
    // ถ้าจำนวนที่รออนุมัติ >= จำนวนที่มีอยู่ แสดงว่าไม่สามารถเบิกเพิ่มได้
    // หรือถ้ามี Serial Numbers และ SN ทั้งหมดรออนุมัติหมด
    if (pendingSNs.length > 0 && pendingSNs.length >= availableQty) {
      return true;
    }
    
    return pendingQty >= availableQty;
  };


  // Add current selected item into list with duplicate prevention
  const addRequestItem = () => {
    if (!requestItem.itemId) {
      toast.error('กรุณาเลือกอุปกรณ์');
      return;
    }
    if (requestItems.some(it => it.itemId === requestItem.itemId)) {
      toast.error('ไม่สามารถเลือกอุปกรณ์ซ้ำได้');
      return;
    }
    
    // ✅ ตรวจสอบว่าผู้ใช้คนนี้มี pending request สำหรับอุปกรณ์นี้หรือไม่
    const selectedItem = inventoryItems.find(i => String(i._id) === requestItem.itemId);
    if (!selectedItem) {
      toast.error('ไม่พบข้อมูลอุปกรณ์');
      return;
    }
    
    const isSIMCard = selectedItem.categoryId === 'cat_sim_card';
    const hasPendingRequest = selectedItem?.hasPendingRequest === true;
    
    // ✅ กรณีที่ 1: อุปกรณ์ที่ไม่มี SN/เบอร์ (serialNumber เป็นค่าว่าง)
    if (!requestItem.serialNumber || requestItem.serialNumber.trim() === '') {
      // เช็ค hasPendingRequest (เฉพาะผู้ใช้คนนี้)
      if (hasPendingRequest) {
        toast.error('อุปกรณ์นี้อยู่ในรายการรออนุมัติการเบิกอยู่แล้ว');
        return;
      }
    }
    // ✅ กรณีที่ 2: อุปกรณ์ที่มี SN (สำหรับอุปกรณ์ทั่วไป)
    else if (!isSIMCard) {
      // เช็คว่า SN นี้รออนุมัติหรือไม่ (เฉพาะผู้ใช้คนนี้)
    const isPending = isItemPendingApproval(requestItem.itemId, requestItem.serialNumber);
    if (isPending) {
        toast.error('Serial Number นี้อยู่ในรายการรออนุมัติการเบิกอยู่แล้ว');
      return;
      }
    }
    // ✅ กรณีที่ 3: อุปกรณ์ที่มีเบอร์ (สำหรับซิมการ์ด)
    else if (isSIMCard) {
      // เช็คว่าเบอร์นี้รออนุมัติหรือไม่ (เฉพาะผู้ใช้คนนี้)
      const isPending = isItemPendingApproval(requestItem.itemId, requestItem.serialNumber);
      if (isPending) {
        toast.error('เบอร์โทรศัพท์นี้อยู่ในรายการรออนุมัติการเบิกอยู่แล้ว');
        return;
      }
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
    // Reset serial number states
    setAvailableSerialNumbers([]);
    setSelectedSerialNumber('');
    setLoadingItemId(null);
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
    setLoadingItemId(null);
    toast.success('รีเซทรายการอุปกรณ์เรียบร้อยแล้ว');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ ป้องกันการ submit ซ้ำ (ใช้ ref เพื่อป้องกัน React Strict Mode)
    if (isLoading || isSubmittingRef.current) {
      console.log('⚠️ Form is already submitting, ignoring duplicate submission', {
        isLoading,
        isSubmittingRef: isSubmittingRef.current
      });
      return;
    }
    
    // ✅ Set ref flag ทันทีเพื่อป้องกันการเรียกซ้ำ
    isSubmittingRef.current = true;
    
    // ✅ Set loading state ทันทีเพื่อป้องกันการกดซ้ำ
    setIsLoading(true);
    setIsSubmitted(true);
    
    console.log('📧 [handleSubmit] Starting form submission');

    try {
      // Refresh inventory data before submitting
      await fetchInventoryItems();

      // ✅ ตรวจสอบว่ามีการ submit ซ้ำหรือไม่ (ป้องกัน double-click)
      if (!isSubmittingRef.current) {
        console.log('⚠️ Submit was cancelled, aborting');
        setIsLoading(false);
        return;
      }

      // Validate form using user profile data
      if (!user) {
        toast.error('กรุณาเข้าสู่ระบบ');
        setIsLoading(false);
        isSubmittingRef.current = false; // ✅ Reset ref เมื่อ validation fail
        return;
      }

      // Clear previous validation errors
      setValidationErrors({});

      // Specific validation for request date
      if (!formData.requestDate || formData.requestDate.trim() === '') {
        setValidationErrors({ requestDate: 'กรุณาเลือกวันที่ต้องการเบิก' });
        toast.error('กรุณาเลือกวันที่ต้องการเบิก');
        setIsLoading(false);
        isSubmittingRef.current = false; // ✅ Reset ref เมื่อ validation fail
        return;
      }

      // Validate delivery location
      if (!formData.deliveryLocation || formData.deliveryLocation.trim() === '') {
        toast.error('กรุณากรอกสถานที่รับอุปกรณ์');
        setIsLoading(false);
        isSubmittingRef.current = false; // ✅ Reset ref เมื่อ validation fail
        return;
      }

      // Additional validation for branch users
      if (user.userType === 'branch') {
        if (!formData.firstName || !formData.lastName || !formData.nickname || !formData.department || !formData.phone) {
          toast.error('กรุณากรอกข้อมูลส่วนตัวให้ครบถ้วน');
          setIsLoading(false);
          isSubmittingRef.current = false; // ✅ Reset ref เมื่อ validation fail
          return;
        }
        
        // Validate phone number format (10 digits)
        // ✅ EXCEPTION: Allow 000-000-0000 for admin users
        const phoneRegex = /^[0-9]{10}$/;
        if (formData.phone !== '000-000-0000' && !phoneRegex.test(formData.phone)) {
          toast.error('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก)');
          setIsLoading(false);
          isSubmittingRef.current = false; // ✅ Reset ref เมื่อ validation fail
          return;
        }
      }

      // Validate item: only allow items from the list (not from current form)
      if (requestItems.length === 0) {
        toast.error('กรุณาเพิ่มรายการอุปกรณ์ที่ต้องการเบิกในรายการด้านล่างก่อนกดบันทึก');
        setIsLoading(false);
        isSubmittingRef.current = false; // ✅ Reset ref เมื่อ validation fail
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
        office: formData.office || user.officeName || user.office || '',
        officeId: user.userType === 'branch' ? (user.officeId || formData.officeId || '') : (formData.officeId || ''), // 🆕 สำหรับ branch users ใช้ officeId จาก user
        phone: user.userType === 'individual' ? (user.phone || '') : formData.phone,
        userType: user.userType, // 🆕 ส่งประเภทผู้ใช้
        // Form data
        requestDate: formData.requestDate,
        urgency: formData.urgency,
        deliveryLocation: formData.deliveryLocation,
        userId: user?.id || undefined,
        items: selectedItems.map(it => {
          // API expects masterId; current UI itemId equals InventoryMaster._id from /api/inventory
          const selectedItem = inventoryItems.find(i => String(i._id) === it.itemId);
          const isSIMCard = selectedItem?.categoryId === 'cat_sim_card';
          
          return {
            masterId: it.itemId,
            quantity: it.quantity,
            // ✅ แยกชัดเจน: ถ้าเป็นซิมการ์ดเก็บใน requestedPhoneNumbers, ถ้าไม่ใช่เก็บใน serialNumbers
            serialNumbers: !isSIMCard && it.serialNumber ? [it.serialNumber] : undefined,
            requestedPhoneNumbers: isSIMCard && it.serialNumber ? [it.serialNumber] : undefined,
            itemNotes: it.itemNotes || ''
          };
        })
      };

      // Debug: Log the data being sent

      const response = await fetch('/api/equipment-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      // ✅ จัดการ 401/403 error - เด้งออกจากระบบทันที
      if (handleAuthError(response)) {
        return;
      }

      const data = await response.json();

      if (response.ok) {
        toast.success('ส่งข้อมูลเรียบร้อยแล้ว');
        // Reset form
        setIsSubmitted(false);
        setFormData({
          requestDate: new Date().toISOString().split('T')[0], // Today's date as default
          urgency: 'normal',
          deliveryLocation: '',
          firstName: '',
          lastName: '',
          nickname: '',
          department: '',
          phone: '',
          email: '',
          office: '',
          officeId: '', // 🆕 Reset officeId
        });
        setRequestItem({ itemId: '', quantity: 1, serialNumber: '', itemNotes: '' });
        setRequestItems([]);
        setSelectedCategoryId('');
        setShowCategorySelector(false);
        
        // ✅ Refresh ข้อมูลอุปกรณ์ทันทีหลัง submit สำเร็จ (เพื่อแสดงสถานะ pending)
        // Reset dataLoadedRef เพื่อให้สามารถ fetch ข้อมูลใหม่ได้
        dataLoadedRef.current = false;
        // เรียก fetchInventoryItems() พร้อม cache-busting เพื่อให้ดึงข้อมูลใหม่
        setTimeout(() => {
          fetchInventoryItems();
        }, 500); // รอสักครู่เพื่อให้ API clear cache เสร็จก่อน
      } else {
        // ไม่แสดง console.error เพื่อลดความยุ่งเหยิง
        toast.error(data.error || 'เกิดข้อผิดพลาดในการส่งข้อมูล');
      }
    } catch (error) {
      console.error('Network error:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      // ✅ Reset ทั้ง state และ ref เพื่อให้สามารถ submit ใหม่ได้
      setIsLoading(false);
      isSubmittingRef.current = false;
      console.log('✅ [handleSubmit] Form submission completed, reset flags');
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
    <AuthGuard>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl px-5 py-8 sm:p-8 border border-white/50">
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">เบิกอุปกรณ์</h1>

          {/* User Profile Display */}
          <RequesterInfoForm 
            formData={{
              ...formData,
              email: formData.email || user?.email || '',
              office: formData.office || user?.officeName || user?.office || '',
              officeId: formData.officeId || user?.officeId || '' // 🆕 ส่ง officeId ด้วย
            }}
            onInputChange={handleInputChange}
            title="ข้อมูลผู้ขอเบิก"
            showEmail={true}
            lockOffice={user?.userType === 'branch'} // 🆕 ล็อค office สำหรับผู้ใช้ประเภทสาขา
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
              <label className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                รายการอุปกรณ์ที่ต้องการเบิก *
                {isLoadingEquipment && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
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
                      onClick={() => {
                        setShowCategorySelector(!showCategorySelector);
                        if (!showCategorySelector) setShowItemSelector(false);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between cursor-pointer"
                    >
                      <span className={selectedCategoryId ? 'text-gray-900' : 'text-gray-500'}>
                        {selectedCategoryId ? categoryConfigs.find(c => c.id === selectedCategoryId)?.name || 'กรุณาเลือกหมวดหมู่' : 'กรุณาเลือกหมวดหมู่'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </button>
                    
                    {/* Category Dropdown */}
                    {showCategorySelector && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {/* Search in categories */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="ค้นหาหมวดหมู่..."
                              value={categorySearchTerm}
                              onChange={(e) => setCategorySearchTerm(e.target.value)}
                              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                          </div>
                        </div>
                        {categoryConfigs
                          .filter(config => !config.isSystemCategory || config.id !== 'cat_unassigned') // ไม่แสดง "ไม่ระบุ"
                          .filter(config => (config.name || '').toLowerCase().includes(categorySearchTerm.toLowerCase()))
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
                                onClick={() => {
                                  handleCategorySelect(config.id);
                                  setShowCategorySelector(false);
                                  setShowItemSelector(false);
                                  setCategorySearchTerm('');
                                }}
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
                      const availableItems = itemsByCategory[selectedCategoryId];
                      if (availableItems && availableItems.length > 0) {
                        const filtered = availableItems
                          .filter((itemName) => {
                            const firstMatch = inventoryItems.find(i => i.itemName === itemName);
                            if (!firstMatch) return true;
                            return !requestItems.some(it => it.itemId === String(firstMatch._id));
                          })
                          .filter(name => name.toLowerCase().includes(itemSearchTerm.toLowerCase()));

                        return (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                const next = !showItemSelector;
                                setShowItemSelector(next);
                                if (next) setShowCategorySelector(false);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between cursor-pointer"
                            >
                              <span className={requestItem.itemId ? 'text-gray-900' : 'text-gray-500'}>
                                {getItemDisplayName(requestItem.itemId) || 'กรุณาเลือกอุปกรณ์'}
                              </span>
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            </button>

                            {showItemSelector && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                {/* Search */}
                                <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                      type="text"
                                      placeholder="ค้นหาอุปกรณ์..."
                                      value={itemSearchTerm}
                                      onChange={(e) => setItemSearchTerm(e.target.value)}
                                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                  </div>
                                </div>

                                <div className="max-h-48 overflow-auto">
                                  {filtered.length > 0 ? (
                                    filtered.map((itemName) => {
                                      // ✅ หาอุปกรณ์ที่ตรงกับชื่อ
                                      const selectedItem = inventoryItems.find(i => i.itemName === itemName);
                                      
                                      // ✅ ใช้ availableAfterPending (จำนวนที่พร้อมเบิกจริงๆ หลังหัก pending ของทุกคน) แทน isAvailable
                                      const availableQty = selectedItem?.quantity || 0;
                                      const availableAfterPending = selectedItem?.availableAfterPending || 0;
                                      const isAvailable = availableAfterPending > 0; // ✅ พร้อมเบิกเมื่อ availableAfterPending > 0
                                      
                                      const itemId = selectedItem ? String(selectedItem._id) : '';
                                      const isLoadingThisItem = loadingItemId === itemId;
                                      
                                      // ✅ ใช้ข้อมูล pending จาก API (hasPendingRequest, pendingQuantity)
                                      const hasPendingRequest = selectedItem?.hasPendingRequest === true;
                                      const pendingQty = selectedItem?.pendingQuantity || 0;
                                      
                                      // ✅ สามารถคลิกได้:
                                      // - ผู้ใช้ประเภทบุคคล: ต้องไม่มี pending request และพร้อมเบิก (availableAfterPending > 0)
                                      // - ผู้ใช้ประเภทสาขา: แค่พร้อมเบิก (availableAfterPending > 0) (ยังคลิกได้แม้มี pending request)
                                      const isIndividualUser = user?.userType === 'individual';
                                      const canClick = isAvailable && (!hasPendingRequest || !isIndividualUser) && !isLoadingThisItem;
                                      
                                      return (
                                        <div
                                          key={itemName}
                                          onClick={async () => {
                                            // ✅ เช็คก่อนว่าสามารถคลิกได้หรือไม่
                                            if (!canClick) {
                                              if (isLoadingThisItem) {
                                                return; // กำลังโหลดอยู่
                                              }
                                               // ✅ แสดง error เฉพาะผู้ใช้ประเภทบุคคลที่มี pending request
                                               if (hasPendingRequest && pendingQty > 0 && isIndividualUser) {
                                                 toast.error(`อุปกรณ์นี้มี ${pendingQty} ชิ้นรออนุมัติอยู่แล้ว`);
                                               } else if (!isAvailable || availableAfterPending === 0) {
                                                toast.error('อุปกรณ์นี้ยังไม่พร้อมเบิก กรุณารอสั่งซื้อ');
                                              }
                                              return;
                                            }
                                            
                                            // ✅ คลิกได้ - เลือกอุปกรณ์
                                            setItemSearchTerm('');
                                            await handleItemSelect(itemId);
                                          }}
                                          className={`px-3 py-2 border-b border-gray-100 ${
                                            isLoadingThisItem
                                              ? 'bg-blue-50 cursor-wait'
                                              : canClick
                                              ? 'hover:bg-blue-50 cursor-pointer text-gray-900'
                                              : 'cursor-not-allowed text-gray-500 bg-gray-50'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className={canClick ? 'text-gray-900' : 'text-gray-500'}>
                                              {itemName} (คงเหลือ: {availableQty} ชิ้น
                                              {/* แสดงจำนวนที่พร้อมเบิกจริงๆ (หัก pending ของทุกคนออก) */}
                                              {(() => {
                                                const availableAfterPending = selectedItem?.availableAfterPending || 0;
                                                const totalPendingQty = selectedItem?.totalPendingQuantity || 0;
                                                // แสดงเฉพาะเมื่อมี pending requests และจำนวนที่พร้อมเบิกต่างจากจำนวนคงเหลือ
                                                if (totalPendingQty > 0 && availableAfterPending < availableQty) {
                                                  return `, พร้อมเบิก: ${availableAfterPending} ชิ้น`;
                                                }
                                                return '';
                                              })()})
                                            </span>
                                            <div className="flex items-center gap-2">
                                              {isLoadingThisItem && (
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                              )}
                                               {!isLoadingThisItem && hasPendingRequest && pendingQty > 0 && (
                                                 // ✅ แสดงจำนวนที่รออนุมัติ (ใช้รูปแบบเดียวกันทั้งหมด) - แสดงเสมอถ้ามี pending
                                                <span className="ml-2 px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md whitespace-nowrap">
                                                   {pendingQty} ชิ้นรออนุมัติ
                                                </span>
                                              )}
                                               {!isLoadingThisItem && availableAfterPending === 0 && (
                                                 // ✅ ไม่พร้อมเบิก (availableAfterPending = 0) - แสดงเสมอถ้าจำนวนพร้อมเบิกเป็น 0
                                                <span className="ml-2 px-2 py-0.5 text-xs font-medium text-orange-600 bg-yellow-100 rounded-md whitespace-nowrap">
                                                  รอสั่งซื้อ
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="px-3 py-4 text-center text-gray-500">
                                      {itemSearchTerm ? 'ไม่พบอุปกรณ์ที่ค้นหา' : 'ไม่มีอุปกรณ์ให้เลือก'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 text-sm">
                          ตอนนี้ยังไม่มีอุปกรณ์ในหมวดหมู่นี้ โปรดติดต่อทีม IT Support
                        </div>
                      );
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
                        max="1"
                        value="1"
                        readOnly
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed ${
                          (!itemsByCategory[selectedCategoryId] || itemsByCategory[selectedCategoryId].length === 0) 
                            ? 'bg-gray-50 cursor-not-allowed' 
                            : ''
                        }`}
                        disabled={true}
                        required
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                        {(() => {
                          // ตรวจสอบว่าเป็นซิมการ์ดหรือไม่
                          const selectedItem = inventoryItems.find(i => String(i._id) === requestItem.itemId);
                          const isSIMCard = selectedItem?.categoryId === 'cat_sim_card';
                          return isSIMCard ? 'เบอร์โทรศัพท์ (ถ้ามี)' : 'Serial Number (ถ้ามี)';
                        })()}
                        {isLoadingSerialNumbers && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        )}
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
                            {(() => {
                              // ✅ กรอง SN ที่รออนุมัติออก
                              const selectedItem = inventoryItems.find(i => String(i._id) === requestItem.itemId);
                              const availableAfterPending = selectedItem?.availableAfterPending || 0;
                              const hasPendingRequest = selectedItem?.hasPendingRequest === true;
                              const isIndividualUser = user?.userType === 'individual';
                              
                              const filteredSNs = availableSerialNumbers.filter(sn => {
                                if (sn.includes('ไม่มี')) {
                                  // ✅ สำหรับ option "ไม่มี SN": เช็คว่ายังมีจำนวนพอเบิกหรือไม่ (availableAfterPending > 0)
                                  // และสำหรับผู้ใช้ประเภทบุคคล: เช็คว่าผู้ใช้คนนี้มี pending request หรือไม่
                                  const canShow = availableAfterPending > 0 && (!hasPendingRequest || !isIndividualUser);
                                  console.log(`🔍 Filtering "ไม่มี SN" option:`, { 
                                    sn, 
                                    availableAfterPending, 
                                    hasPendingRequest, 
                                    isIndividualUser,
                                    canShow,
                                    itemId: requestItem.itemId 
                                  });
                                  return canShow;
                                }
                                // ✅ สำหรับ SN/เบอร์: เช็คว่า SN/เบอร์ นี้รออนุมัติหรือไม่ (ของทุกคน - สำหรับกรอง dropdown)
                                const isPending = isSerialNumberPendingByAnyone(requestItem.itemId, sn);
                                console.log(`🔍 Filtering SN/Phone:`, { sn, isPending, itemId: requestItem.itemId });
                                return !isPending;
                              });
                              
                              console.log('🔍 Equipment Request - Serial Numbers filtering:', {
                                total: availableSerialNumbers.length,
                                filtered: filteredSNs.length,
                                availableAfterPending,
                                hasPendingRequest,
                                isIndividualUser,
                                availableSerialNumbers,
                                filteredSNs
                              });
                              
                              return filteredSNs.map((sn, index) => (
                                <option key={`${index}-${sn}`} value={sn}>
                                  {sn}
                                </option>
                              ));
                            })()}
                          </select>
                          {(() => {
                            // ✅ แสดงจำนวน SN ที่พร้อมใช้งาน (หลังกรองแล้ว)
                            const filteredCount = availableSerialNumbers.filter(sn => {
                              if (sn.includes('ไม่มี')) {
                                return !isItemPendingApproval(requestItem.itemId, '');
                              }
                              return !isItemPendingApproval(requestItem.itemId, sn);
                            }).length;
                            
                            const pendingCount = availableSerialNumbers.length - filteredCount;
                            
                            if (filteredCount > 0) {
                              return (
                                <p className="text-xs text-green-600 mt-1">
                                  ✅ พบตัวเลือกที่พร้อมใช้งาน {filteredCount} รายการ
                                  {pendingCount > 0 && ` (${pendingCount} รายการรออนุมัติเบิก)`}
                                  {(() => {
                                    const hasNoSNOption = availableSerialNumbers.some(sn => sn.includes('ไม่มี') && !isItemPendingApproval(requestItem.itemId, ''));
                                    if (hasNoSNOption) {
                                      return ' (รวมอุปกรณ์ที่ไม่มี SN)';
                                    }
                                    return '';
                                  })()}
                                </p>
                              );
                            } else {
                              return (
                                <p className="text-xs text-orange-600 mt-1">
                                  ⚠️ ตัวเลือกทั้งหมดกำลังรออนุมัติการเบิก
                                </p>
                              );
                            }
                          })()}
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
                      <li key={item.itemId} className="flex items-center justify-between p-3 pb-5">
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
                  <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded border-l-4 border-yellow-200">
                    <div className="font-medium text-orange-500 mb-1">💡 หมายเหตุ:</div>
                    <div>เฉพาะอุปกรณ์ที่อยู่ในรายการนี้เท่านั้นที่จะถูกส่งเบิก กรุณาเพิ่มรายการอุปกรณ์ที่ต้องการเบิกให้ครบถ้วนก่อนกดบันทึก</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Submit Button */}
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={isLoading || isSubmittingRef.current}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={(e) => {
                  // ✅ ป้องกัน double-click โดยตรวจสอบ state ก่อน
                  if (isLoading || isSubmittingRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('⚠️ Button click prevented - already submitting');
                    return false;
                  }
                }}
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
    </AuthGuard>
  );
}
