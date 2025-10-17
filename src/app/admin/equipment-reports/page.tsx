'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { enableDragScroll } from '@/lib/drag-scroll';
import Layout from '@/components/Layout';
import { 
  Search, 
  RefreshCw, 
  Download, 
  Filter,
  Eye,
  X,
  Calendar,
  User,
  Package,
  FileText,
  CheckCircle,
  Settings
} from 'lucide-react';
import DatePicker from '@/components/DatePicker';
import SerialNumberSelector from '@/components/SerialNumberSelector';
import ExcelJS from 'exceljs';

// Memoized wrapper to prevent unnecessary re-renders
const MemoizedSerialNumberSelector = React.memo(({ 
  itemKey, 
  onSelectionChange, 
  ...props 
}: any) => (
  <SerialNumberSelector
    {...props}
    onSelectionChange={(selectedItems: any[]) => onSelectionChange(itemKey, selectedItems)}
  />
));
MemoizedSerialNumberSelector.displayName = 'MemoizedSerialNumberSelector';
import { toast } from 'react-hot-toast';

interface RequestLog {
  _id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  department: string;
  office: string;
  requestDate: string;
  urgency: string;
  deliveryLocation: string;
  phone: string;
  reason: string;
  items: Array<{
    itemId: string;        // Primary reference to inventory
    itemName: string;      // Current name from inventory
    quantity: number;
    category?: string;     // Item category (name)
    categoryId?: string;   // ✅ เพิ่ม categoryId
    masterId?: string;     // ✅ เพิ่ม masterId
    serialNumbers?: string[];
    assignedSerialNumbers?: string[]; // Serial numbers assigned by admin
    statusOnRequest?: string; // เพิ่ม statusOnRequest property
    conditionOnRequest?: string; // เพิ่ม conditionOnRequest property
    assignedPhoneNumbers?: string[]; // เพิ่ม assignedPhoneNumbers property
    assignedQuantity?: number; // จำนวนที่ Admin assign ให้แล้ว
    itemApproved?: boolean; // สถานะว่ารายการนี้ได้รับการอนุมัติแล้วหรือยัง
    approvedAt?: string; // วันที่อนุมัติรายการนี้
  }>;
  submittedAt: string;
  status?: 'pending' | 'completed'; // เพิ่ม status
}

interface ReturnLog {
  _id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  department: string;
  office: string;
  phone?: string; // ✅ แก้ไขจาก phoneNumber เป็น phone ให้ตรงกับ API
  returnDate: string;
  items: Array<{
    itemId: string;        // Primary reference to inventory
    itemName: string;      // Current name from inventory
    quantity: number;
    category?: string;     // เพิ่ม category property
    serialNumber?: string; // Single serial number (แก้ไขจาก serialNumbers)
    assetNumber?: string;
    image?: string;
    statusOnReturn?: string; // สถานะอุปกรณ์เมื่อคืน (มี/หาย)
    conditionOnReturn?: string; // สภาพอุปกรณ์เมื่อคืน (ใช้งานได้/ชำรุด)
    numberPhone?: string; // เพิ่ม numberPhone property
    approvalStatus?: 'pending' | 'approved'; // สถานะการอนุมัติ
  }>;
  submittedAt: string;
}

type TabType = 'request' | 'return';

export default function AdminEquipmentReportsPage() {
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [returnLogs, setReturnLogs] = useState<ReturnLog[]>([]);
  const [filteredData, setFilteredData] = useState<(RequestLog | ReturnLog)[]>([]);
  // Flattened, sorted rows for display and pagination
  const [displayRows, setDisplayRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('request');
  const [isTabSwitching, setIsTabSwitching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  
  // Serial Number Selection Modal
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestLog | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [itemSelections, setItemSelections] = useState<{[key: string]: any[]}>({});
  
  // Loading states for buttons
  const [isApproving, setIsApproving] = useState(false);
  const [isDeletingRequest, setIsDeletingRequest] = useState(false);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [approvingReturnIds, setApprovingReturnIds] = useState<Set<string>>(new Set()); // Track multiple return approvals
  
  
  // State for current inventory data
  const [inventoryItems, setInventoryItems] = useState<{[key: string]: string}>({});
  
  // Config data for status and condition
  const [statusConfigs, setStatusConfigs] = useState<any[]>([]);
  const [conditionConfigs, setConditionConfigs] = useState<any[]>([]);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [itemNameFilter, setItemNameFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');
  const [serialNumberFilter, setSerialNumberFilter] = useState('');
  const [phoneNumberFilter, setPhoneNumberFilter] = useState('');
  const [deliveryLocationFilter, setDeliveryLocationFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Drag scroll ref
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
    fetchInventoryData();
    fetchConfigs();
  }, []);

  // Initialize drag scrolling
  useEffect(() => {
    const element = tableContainerRef.current;
    if (!element) return;

    const cleanup = enableDragScroll(element);
    return cleanup;
  }, []);

  // Handle tab switching with loading state
  const handleTabChange = useCallback((newTab: TabType) => {
    if (newTab !== activeTab) {
      setIsTabSwitching(true);
      setActiveTab(newTab);
      // Reset tab switching state after a brief delay
      setTimeout(() => {
        setIsTabSwitching(false);
      }, 100);
    }
  }, [activeTab]);

  useEffect(() => {
    applyFilters();
  }, [requestLogs, returnLogs, activeTab, searchTerm, itemNameFilter, categoryFilter, statusFilter, conditionFilter, departmentFilter, officeFilter, serialNumberFilter, phoneNumberFilter, deliveryLocationFilter, urgencyFilter, dateFromFilter, dateToFilter]);



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

  // Helper functions to convert ID to name
  // Note: Status and condition names are now resolved in the API, so these functions are no longer needed
  // const getStatusName = (statusId: string) => {
  //   const status = statusConfigs.find(s => s.id === statusId);
  //   return status?.name || statusId;
  // };

  // const getConditionName = (conditionId: string) => {
  //   const condition = conditionConfigs.find(c => c.id === conditionId);
  //   return condition?.name || conditionId;
  // };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [requestResponse, returnResponse] = await Promise.all([
        fetch('/api/admin/equipment-reports/requests'),
        fetch('/api/admin/equipment-reports/returns')
      ]);

      if (requestResponse.ok) {
        const requestData = await requestResponse.json();
        setRequestLogs(requestData);
      } else {
        console.error('❌ Request API failed:', requestResponse.status, requestResponse.statusText);
      }

      if (returnResponse.ok) {
        const returnData = await returnResponse.json();
        setReturnLogs(returnData);
      } else {
        console.error('❌ Return API failed:', returnResponse.status, returnResponse.statusText);
      }

      if (!requestResponse.ok && !returnResponse.ok) {
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  // Fetch current inventory data to get updated item names
  const fetchInventoryData = async () => {
    try {
      const response = await fetch('/api/inventory');
      if (response.ok) {
        const data = await response.json();
        const items = data.items || [];
        
        // Create a map of itemId to current itemName
        const inventoryMap: {[key: string]: string} = {};
        items.forEach((item: any) => {
          inventoryMap[item._id] = item.itemName;
        });
        
        setInventoryItems(inventoryMap);
      }
    } catch (error) {
      console.error('Error fetching inventory data:', error);
    }
  };

  // ฟังก์ชันสำหรับเปิด Serial Number Selection Modal
  const handleOpenSelectionModal = (request: RequestLog, itemIndex: number) => {
    // สร้าง request ใหม่ที่มีแค่รายการที่เลือก
    const singleItemRequest = {
      ...request,
      items: [request.items[itemIndex]]
    };
    setSelectedRequest(singleItemRequest);
    setItemSelections({});
    setSelectedItemIndex(itemIndex);
    setShowSelectionModal(true);
  };

  // ฟังก์ชันสำหรับจัดการการเลือก Serial Number
  const handleSelectionChange = useCallback((itemKey: string, selectedItems: any[]) => {
    setItemSelections(prev => ({
      ...prev,
      [itemKey]: selectedItems
    }));
  }, []);

  // ฟังก์ชันสำหรับยืนยันการคืนอุปกรณ์รายการเดียว
  const handleApproveReturnItem = async (returnId: string, itemIndex: number) => {
    const trackingId = `${returnId}-${itemIndex}`;
    
    try {
      // ✅ เริ่ม loading
      setApprovingReturnIds(prev => new Set(prev).add(trackingId));
      
      const response = await fetch(`/api/admin/equipment-reports/returns/${returnId}/approve-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemIndex })
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        toast.error('เกิดข้อผิดพลาดในการประมวลผลข้อมูล');
        return;
      }

      if (response.ok) {
        if (data.alreadyApproved) {
          toast.success('รายการนี้ได้รับการอนุมัติแล้ว');
        } else {
          const message = data.message || 'ยืนยันการคืนอุปกรณ์เรียบร้อยแล้ว';
          toast.success(message);
        }
        fetchData(); // Refresh data
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error approving return item:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      // ✅ จบ loading
      setApprovingReturnIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(trackingId);
        return newSet;
      });
    }
  };

  // ฟังก์ชันสำหรับอนุมัติด้วยการเลือก Serial Number
  const handleApproveWithSelection = async () => {
    
    if (!selectedRequest) {
      return;
    }

    try {
      setIsApproving(true); // ✅ เริ่ม loading
      
      // Validate selections
      const selections = selectedRequest.items.map(item => {
        // ✅ Use consistent itemKey generation (same as in modal rendering)
        const itemKey = `${item.itemName || 'unknown'}-${item.category || 'ไม่ระบุ'}`;
        const selectedItems = itemSelections[itemKey] || [];
        
        // ✅ Enhanced validation: Check if admin selected items
        if (selectedItems.length !== item.quantity) {
          if (selectedItems.length === 0) {
            // Case: Admin didn't select any items
            // ✅ Check if this might be a timing issue (modal just opened)
            if (Object.keys(itemSelections).length === 0) {
              throw new Error(`กรุณารอให้ระบบโหลดรายการอุปกรณ์เสร็จสิ้น แล้วเลือกอุปกรณ์ก่อนอนุมัติ`);
            } else {
              throw new Error(`กรุณาเลือกรายการอุปกรณ์สำหรับ ${item.itemName} (ต้องเลือก ${item.quantity} ชิ้น)`);
            }
          } else {
            // Case: Admin needs to select more items
            throw new Error(`กรุณาเลือก ${item.itemName} ให้ครบ ${item.quantity} ชิ้น (เลือกแล้ว ${selectedItems.length} ชิ้น)`);
          }
        }

        return {
          masterId: (item as any).masterId, // match request item reliably
          itemName: item.itemName,
          category: (item as any).categoryId || (item as any).category || 'ไม่ระบุ',
          requestedQuantity: item.quantity,
          selectedItems: selectedItems
        };
      });

      // ใช้ requestId เดิม (ไม่ใช่ของ singleItemRequest)
      const originalRequestId = requestLogs.find(req => 
        req._id === selectedRequest._id || 
        (req.firstName === selectedRequest.firstName && 
         req.lastName === selectedRequest.lastName && 
         req.requestDate === selectedRequest.requestDate)
      )?._id || selectedRequest._id;

      const response = await fetch(`/api/admin/equipment-reports/requests/${originalRequestId}/approve-with-selection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selections })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('อนุมัติและมอบหมายอุปกรณ์เรียบร้อยแล้ว');
        setShowSelectionModal(false);
        setSelectedRequest(null);
        setItemSelections({});
        fetchData(); // Refresh data
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error approving with selection:', error);
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsApproving(false); // ✅ จบ loading
    }
  };

  // ฟังก์ชันสำหรับลบคำขอ
  const handleDeleteRequest = async (requestId: string) => {
    try {
      setIsDeletingRequest(true); // ✅ เริ่ม loading
      
      // หา requestId เดิมจาก requestLogs
      const originalRequestId = requestLogs.find(req => 
        req._id === requestId || 
        (req.firstName === selectedRequest?.firstName && 
         req.lastName === selectedRequest?.lastName && 
         req.requestDate === selectedRequest?.requestDate)
      )?._id || requestId;

      const response = await fetch(`/api/admin/equipment-reports/requests/${originalRequestId}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('ลบคำขอเรียบร้อยแล้ว');
        setShowSelectionModal(false);
        setSelectedRequest(null);
        setItemSelections({});
        fetchData(); // Refresh data
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาดในการลบคำขอ');
      }
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsDeletingRequest(false); // ✅ จบ loading
    }
  };

  // ฟังก์ชันสำหรับลบ 'รายการเดียว' ในคำขอจาก popup
  const handleDeleteRequestItem = async () => {
    if (!selectedRequest || selectedItemIndex == null) return;

    try {
      setIsDeletingItem(true); // ✅ เริ่ม loading
      
      // หา requestId เดิมจาก requestLogs
      const originalRequestId = requestLogs.find(req => 
        req._id === selectedRequest._id || 
        (req.firstName === selectedRequest.firstName && 
         req.lastName === selectedRequest.lastName && 
         req.requestDate === selectedRequest.requestDate)
      )?._id || selectedRequest._id;

      const response = await fetch(`/api/admin/equipment-reports/requests/${originalRequestId}/items/${selectedItemIndex}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('ลบรายการออกจากคำขอเรียบร้อยแล้ว');
        setShowSelectionModal(false);
        setSelectedRequest(null);
        setSelectedItemIndex(null);
        setItemSelections({});
        fetchData();
      } else {
        toast.error(data.error || 'ไม่สามารถลบรายการได้');
      }
    } catch (error) {
      console.error('Error deleting request item:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsDeletingItem(false); // ✅ จบ loading
    }
  };

  // ฟังก์ชันสำหรับดำเนินการเสร็จสิ้น (แบบเดิม - สำหรับ fallback)
  const handleCompleteRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/admin/equipment-reports/requests/${requestId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('ดำเนินการเสร็จสิ้นแล้ว');
        // รีเฟรชข้อมูลทันที
        await fetchData();
      } else {
        console.error('Complete request failed:', data);
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error completing request:', error);
      toast.error('เกิดข้อผิดพลาดในการดำเนินการ');
    }
  };

  // ฟังก์ชันรีเซทค่าฟิลเตอร์ทั้งหมดกลับเป็นค่าเริ่มต้น
  const resetFilters = () => {
    setSearchTerm('');
    setItemNameFilter('');
    setCategoryFilter('');
    setStatusFilter('');
    setConditionFilter('');
    setDepartmentFilter('');
    setOfficeFilter('');
    setSerialNumberFilter('');
    setPhoneNumberFilter('');
    setDeliveryLocationFilter('');
    setUrgencyFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setCurrentPage(1);
  };

  const applyFilters = () => {
    const data = activeTab === 'request' ? requestLogs : returnLogs;
    
    let filtered = data.filter(item => {
      // Search filter - ค้นหาเฉพาะ: ชื่อ, นามสกุล, ชื่อเล่น
      const matchesSearch = !searchTerm || 
        item.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nickname.toLowerCase().includes(searchTerm.toLowerCase());

      // Item Name filter
      const matchesItemName = !itemNameFilter || 
        item.items.some(equip => {
          const currentItemName = getCurrentItemName(equip);
          return currentItemName.includes(itemNameFilter);
        });

      // Category filter
      const matchesCategory = !categoryFilter || 
        item.items.some(equip => {
          const category = (equip as any).category || '';
          return category.includes(categoryFilter);
        });

      // Status filter
      const matchesStatus = !statusFilter || 
        item.items.some(equip => {
          const status = activeTab === 'request' 
            ? (equip as any).statusOnRequest 
            : (equip as any).statusOnReturn;
          return status && status.includes(statusFilter);
        });

      // Condition filter
      const matchesCondition = !conditionFilter || 
        item.items.some(equip => {
          const condition = activeTab === 'request' 
            ? (equip as any).conditionOnRequest 
            : (equip as any).conditionOnReturn;
          return condition && condition.includes(conditionFilter);
        });

      // Department filter
      const matchesDepartment = !departmentFilter || item.department.includes(departmentFilter);

      // Office filter
      const matchesOffice = !officeFilter || item.office.includes(officeFilter);

      // Serial Number filter - กรองตามค่า Serial Number ที่แสดงในตาราง (ใช้ logic เดียวกับตาราง)
      const matchesSerialNumber = !serialNumberFilter || 
        item.items.some(equip => {
          const searchValue = serialNumberFilter.trim();
          
          // ถ้าไม่มีค่าค้นหา ให้แสดงทั้งหมด
          if (!searchValue) {
            return true;
          }
          
          if (activeTab === 'request') {
            const requestItem = equip as any;
            
            // ✅ ใช้ logic เดียวกับตาราง: ตรวจสอบว่าเป็นซิมการ์ดหรือไม่
            const isSimCard = requestItem.categoryId === 'cat_sim_card';
            if (isSimCard) {
              // ซิมการ์ดแสดง "-" ในคอลัมน์ Serial Number
              return searchValue === '-';
            }
            
            // ✅ ใช้ logic เดียวกับตาราง: ตรวจสอบว่ารายการนี้อนุมัติแล้วหรือยัง
            const isApproved = (requestItem as any).itemApproved || ((requestItem as any).assignedQuantity && (requestItem as any).assignedQuantity > 0);
            
            if (isApproved) {
              // ถ้าอนุมัติแล้ว แสดง assignedSerialNumbers (เหมือนตาราง)
              if (Array.isArray(requestItem.assignedSerialNumbers) && requestItem.assignedSerialNumbers.length > 0) {
                // ถ้าค้นหา "-" และมี SN = ไม่แสดง
                if (searchValue === '-') {
                  return false;
                }
                // ค้นหาตามค่า SN ที่มี
                return requestItem.assignedSerialNumbers.some((sn: string) => 
                  sn && sn.toLowerCase().includes(searchValue.toLowerCase())
                );
              } else {
                // ถ้าไม่มี assignedSerialNumbers = แสดง "-" ในตาราง
                return searchValue === '-';
              }
            } else {
              // ยังไม่อนุมัติ แสดง serialNumbers (เหมือนตาราง)
              if (Array.isArray(requestItem.serialNumbers) && requestItem.serialNumbers.length > 0) {
                // ถ้าค้นหา "-" และมี SN = ไม่แสดง
                if (searchValue === '-') {
                  return false;
                }
                // ค้นหาตามค่า SN ที่มี
                return requestItem.serialNumbers.some((sn: string) => 
                  sn && sn.toLowerCase().includes(searchValue.toLowerCase())
                );
              } else {
                // ถ้าไม่มี serialNumbers = แสดง "-" ในตาราง
                return searchValue === '-';
              }
            }
          }
          
          if (activeTab === 'return') {
            const returnItem = equip as any;
            // ค้นหาใน serialNumber ที่แสดงในตาราง
            if (returnItem.serialNumber && returnItem.serialNumber.trim() !== '') {
              // ถ้าค้นหา "-" และมี SN = ไม่แสดง
              if (searchValue === '-') {
                return false;
              }
              // ค้นหาตามค่า SN ที่มี
              return returnItem.serialNumber.toLowerCase().includes(searchValue.toLowerCase());
            } else {
              // ถ้าไม่มี serialNumber = แสดง "-" ในตาราง
              return searchValue === '-';
            }
          }
          
          return false;
        });

      // Phone Number filter - กรองตามค่า Phone Number ที่แสดงในตาราง (ใช้ logic เดียวกับตาราง)
      const matchesPhoneNumber = !phoneNumberFilter || 
        item.items.some(equip => {
          const searchValue = phoneNumberFilter.trim();
          
          // ถ้าไม่มีค่าค้นหา ให้แสดงทั้งหมด
          if (!searchValue) {
            return true;
          }
          
          if (activeTab === 'request') {
            const requestItem = equip as any;
            
            // ใช้ logic เดียวกับตาราง: ตรวจสอบว่าเป็นซิมการ์ดหรือไม่
            const isSimCard = requestItem.categoryId === 'cat_sim_card';
            
            if (!isSimCard) {
              // ถ้าไม่ใช่ซิมการ์ด = แสดง "-" ในคอลัมน์ Phone Number
              return searchValue === '-';
            }
            
            // ✅ ใช้ logic เดียวกับตาราง: ตรวจสอบว่ารายการนี้อนุมัติแล้วหรือยัง
            const isApproved = (requestItem as any).itemApproved || ((requestItem as any).assignedQuantity && (requestItem as any).assignedQuantity > 0);
            
            if (isApproved) {
              // ถ้าอนุมัติแล้ว แสดง assignedPhoneNumbers (เหมือนตาราง)
              if (Array.isArray(requestItem.assignedPhoneNumbers) && requestItem.assignedPhoneNumbers.length > 0) {
                // ถ้าค้นหา "-" และมีเบอร์ = ไม่แสดง
                if (searchValue === '-') {
                  return false;
                }
                // ค้นหาตามค่าเบอร์ที่มี
                return requestItem.assignedPhoneNumbers.some((phone: string) => 
                  phone && phone.toLowerCase().includes(searchValue.toLowerCase())
                );
              } else {
                // ถ้าไม่มี assignedPhoneNumbers = แสดง "-" ในตาราง
                return searchValue === '-';
              }
            } else {
              // ยังไม่อนุมัติ แสดง serialNumbers (สำหรับซิมการ์ดเก็บเป็นเบอร์โทร - เหมือนตาราง)
              if (Array.isArray(requestItem.serialNumbers) && requestItem.serialNumbers.length > 0) {
                // ถ้าค้นหา "-" และมีเบอร์ = ไม่แสดง
                if (searchValue === '-') {
                  return false;
                }
                // ค้นหาตามค่าเบอร์ที่มี
                return requestItem.serialNumbers.some((phone: string) => 
                  phone && phone.toLowerCase().includes(searchValue.toLowerCase())
                );
              } else {
                // ถ้าไม่มี serialNumbers = แสดง "-" ในตาราง
                return searchValue === '-';
              }
            }
          }
          
          if (activeTab === 'return') {
            const returnItem = equip as any;
            // ค้นหาใน numberPhone ที่แสดงในตาราง
            if (returnItem.numberPhone && returnItem.numberPhone.trim() !== '') {
              // ถ้าค้นหา "-" และมีเบอร์ = ไม่แสดง
              if (searchValue === '-') {
                return false;
              }
              // ค้นหาตามค่าเบอร์ที่มี
              return returnItem.numberPhone.toLowerCase().includes(searchValue.toLowerCase());
            } else {
              // ถ้าไม่มี numberPhone = แสดง "-" ในตาราง
              return searchValue === '-';
            }
          }
          
          return false;
        });

      // Delivery Location filter (only for request tab)
      const matchesDeliveryLocation = !deliveryLocationFilter || 
        (activeTab === 'request' && (item as RequestLog).deliveryLocation?.includes(deliveryLocationFilter));

      // Urgency filter (only for request tab)
      const matchesUrgency = !urgencyFilter || 
        (activeTab === 'request' && (item as RequestLog).urgency === urgencyFilter);

      // Date filter (single-day per tab)
      const itemDateValue = activeTab === 'request' ? 
        (item as RequestLog).requestDate : 
        (item as ReturnLog).returnDate;
      const itemDate = new Date(itemDateValue);
      const itemY = itemDate.getFullYear();
      const itemM = String(itemDate.getMonth() + 1).padStart(2, '0');
      const itemD = String(itemDate.getDate()).padStart(2, '0');
      const itemLocalYMD = `${itemY}-${itemM}-${itemD}`;

      // For request tab, use dateFromFilter only (label: วันที่เบิก)
      const matchesRequestDate = activeTab !== 'request' || !dateFromFilter || itemLocalYMD === dateFromFilter;
      // For return tab, use dateToFilter only (label: วันที่คืน)
      const matchesReturnDate = activeTab !== 'return' || !dateToFilter || itemLocalYMD === dateToFilter;

      return matchesSearch && matchesItemName && matchesCategory && matchesStatus && 
             matchesCondition && matchesDepartment && matchesOffice && 
             matchesSerialNumber && matchesPhoneNumber &&
             matchesDeliveryLocation && matchesUrgency && matchesRequestDate && matchesReturnDate;
    });

    // ✅ แก้ไข: กรองที่ระดับรายการย่อย (item level) แทนระดับคำขอ (request level)
    // เพื่อให้ฟิลเตอร์ Serial Number และ Phone Number ทำงานถูกต้อง
    const rows: any[] = [];

    if (activeTab === 'request') {
      (filtered as RequestLog[]).forEach((log) => {
        log.items.forEach((item, index) => {
          // ✅ กรองรายการย่อยตาม Serial Number และ Phone Number
          const shouldIncludeItem = (() => {
            // Serial Number filter
            if (serialNumberFilter) {
              const searchValue = serialNumberFilter.trim();
              if (searchValue) {
                const requestItem = item as any;
                
                // ตรวจสอบว่าเป็นซิมการ์ดหรือไม่
                const isSimCard = requestItem.categoryId === 'cat_sim_card';
                if (isSimCard) {
                  // ซิมการ์ดแสดง "-" ในคอลัมน์ Serial Number
                  if (searchValue !== '-') return false;
                } else {
                  // ตรวจสอบว่ารายการนี้อนุมัติแล้วหรือยัง
                  const isApproved = (requestItem as any).itemApproved || ((requestItem as any).assignedQuantity && (requestItem as any).assignedQuantity > 0);
                  
                  if (isApproved) {
                    // ถ้าอนุมัติแล้ว แสดง assignedSerialNumbers
                    if (Array.isArray(requestItem.assignedSerialNumbers) && requestItem.assignedSerialNumbers.length > 0) {
                      if (searchValue === '-') return false;
                      if (!requestItem.assignedSerialNumbers.some((sn: string) => 
                        sn && sn.toLowerCase().includes(searchValue.toLowerCase())
                      )) return false;
                    } else {
                      if (searchValue !== '-') return false;
                    }
                  } else {
                    // ยังไม่อนุมัติ แสดง serialNumbers
                    if (Array.isArray(requestItem.serialNumbers) && requestItem.serialNumbers.length > 0) {
                      if (searchValue === '-') return false;
                      if (!requestItem.serialNumbers.some((sn: string) => 
                        sn && sn.toLowerCase().includes(searchValue.toLowerCase())
                      )) return false;
                    } else {
                      if (searchValue !== '-') return false;
                    }
                  }
                }
              }
            }

            // Phone Number filter
            if (phoneNumberFilter) {
              const searchValue = phoneNumberFilter.trim();
              if (searchValue) {
                const requestItem = item as any;
                
                // ตรวจสอบว่าเป็นซิมการ์ดหรือไม่
                const isSimCard = requestItem.categoryId === 'cat_sim_card';
                
                if (!isSimCard) {
                  // ถ้าไม่ใช่ซิมการ์ด = แสดง "-" ในคอลัมน์ Phone Number
                  if (searchValue !== '-') return false;
                } else {
                  // ตรวจสอบว่ารายการนี้อนุมัติแล้วหรือยัง
                  const isApproved = (requestItem as any).itemApproved || ((requestItem as any).assignedQuantity && (requestItem as any).assignedQuantity > 0);
                  
                  if (isApproved) {
                    // ถ้าอนุมัติแล้ว แสดง assignedPhoneNumbers
                    if (Array.isArray(requestItem.assignedPhoneNumbers) && requestItem.assignedPhoneNumbers.length > 0) {
                      if (searchValue === '-') return false;
                      if (!requestItem.assignedPhoneNumbers.some((phone: string) => 
                        phone && phone.toLowerCase().includes(searchValue.toLowerCase())
                      )) return false;
                    } else {
                      if (searchValue !== '-') return false;
                    }
                  } else {
                    // ยังไม่อนุมัติ แสดง serialNumbers (สำหรับซิมการ์ดเก็บเป็นเบอร์โทร)
                    if (Array.isArray(requestItem.serialNumbers) && requestItem.serialNumbers.length > 0) {
                      if (searchValue === '-') return false;
                      if (!requestItem.serialNumbers.some((phone: string) => 
                        phone && phone.toLowerCase().includes(searchValue.toLowerCase())
                      )) return false;
                    } else {
                      if (searchValue !== '-') return false;
                    }
                  }
                }
              }
            }

            return true;
          })();

          // ✅ ถ้ารายการนี้ผ่านการกรอง Serial Number และ Phone Number ให้เพิ่มเข้าไปใน rows
          if (shouldIncludeItem) {
            // ✅ แก้ไข: ตรวจสอบว่ารายการเบิกยืนยันแล้วหรือยัง (pending ต้องอยู่บนสุด)
            const assignedQty = (item as any).assignedQuantity || 0;
            const requestedQty = item.quantity || 0;
            const isItemApproved = assignedQty >= requestedQty;
            const group = isItemApproved ? 'approved' : 'pending';
            const date = (log as any).submittedAt || (log as any).updatedAt || (log as any).createdAt || (log as any).requestDate || (log as any).returnDate || Date.now();
            rows.push({ type: 'request', log, item, itemIndex: index, group, date: new Date(date) });
          }
        });
      });
    } else {
      (filtered as ReturnLog[]).forEach((log) => {
        log.items.forEach((item: any, index: number) => {
          // ✅ กรองรายการย่อยตาม Serial Number และ Phone Number
          const shouldIncludeItem = (() => {
            // Serial Number filter
            if (serialNumberFilter) {
              const searchValue = serialNumberFilter.trim();
              if (searchValue) {
                if (item.serialNumber && item.serialNumber.trim() !== '') {
                  if (searchValue === '-') return false;
                  if (!item.serialNumber.toLowerCase().includes(searchValue.toLowerCase())) return false;
                } else {
                  if (searchValue !== '-') return false;
                }
              }
            }

            // Phone Number filter
            if (phoneNumberFilter) {
              const searchValue = phoneNumberFilter.trim();
              if (searchValue) {
                if (item.numberPhone && item.numberPhone.trim() !== '') {
                  if (searchValue === '-') return false;
                  if (!item.numberPhone.toLowerCase().includes(searchValue.toLowerCase())) return false;
                } else {
                  if (searchValue !== '-') return false;
                }
              }
            }

            return true;
          })();

          // ✅ ถ้ารายการนี้ผ่านการกรอง Serial Number และ Phone Number ให้เพิ่มเข้าไปใน rows
          if (shouldIncludeItem) {
            // ✅ แก้ไข: ตรวจสอบว่ารายการยืนยันแล้วหรือยัง (pending ต้องอยู่บนสุด)
            const isPending = item.approvalStatus !== 'approved';
            const group = isPending ? 'pending' : 'approved';
            const dateValue = group === 'approved' ? (item.approvedAt || (log as any).updatedAt || log.returnDate) : (log.returnDate || (log as any).createdAt || (log as any).updatedAt);
            rows.push({ type: 'return', log, item, itemIndex: index, group, date: new Date(dateValue as any) });
          }
        });
      });
    }

    // ✅ เรียงลำดับ: 
    // - pending (รอดำเนินการ) อยู่บนสุด → แสดงปุ่ม "เลือกอุปกรณ์และอนุมัติ" หรือ "ยืนยันการคืน"
    // - approved (เสร็จสิ้นแล้ว) อยู่ด้านล่าง → แสดง "เสร็จสิ้น" หรือ "ยืนยันแล้ว"
    // - ภายในแต่ละกลุ่ม เรียงตามวันที่ล่าสุดไปเก่าสุด
    const groupOrder = { pending: 0, approved: 1 } as const;
    rows.sort((a, b) => {
      const g = groupOrder[a.group as 'pending' | 'approved'] - groupOrder[b.group as 'pending' | 'approved'];
      if (g !== 0) return g;
      // เรียงตามวันที่ล่าสุดไปเก่าสุด
      return (b.date as Date).getTime() - (a.date as Date).getTime();
    });

    setFilteredData(filtered);
    setDisplayRows(rows);
    setCurrentPage(1);
  };

  // Get item name prioritizing stored name (historical accuracy)
  const getCurrentItemName = (item: any) => {
    // Use stored itemName if available (historical record)
    if (item.itemName) {
      return item.itemName;
    }
    // Fallback to current inventory name if no stored name
    if (item.itemId && inventoryItems[item.itemId]) {
      return inventoryItems[item.itemId];
    }
    return 'Unknown Item';
  };

  const exportToExcel = async () => {
    try {
      if (displayRows.length === 0) {
        toast.error('ไม่มีข้อมูลให้ Export');
        return;
      }

      toast.loading('กำลังสร้างไฟล์ Excel...', { id: 'export-loading' });

      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const sheetName = activeTab === 'request' ? 'ประวัติเบิก' : 'ประวัติคืน';
      const worksheet = workbook.addWorksheet(sheetName);

      if (activeTab === 'request') {
        // ตั้งค่าคอลัมน์สำหรับประวัติเบิก
        worksheet.columns = [
          { header: 'ลำดับ', key: 'no', width: 8 },
          { header: 'วันที่เบิก', key: 'requestDate', width: 15 },
          { header: 'ชื่อผู้เบิก', key: 'requester', width: 20 },
          { header: 'ชื่อเล่น', key: 'nickname', width: 12 },
          { header: 'แผนก', key: 'department', width: 20 },
          { header: 'ออฟฟิศ/สาขา', key: 'office', width: 20 },
          { header: 'เบอร์โทร', key: 'phone', width: 15 },
          { header: 'ชื่ออุปกรณ์', key: 'itemName', width: 25 },
          { header: 'หมวดหมู่', key: 'category', width: 20 },
          { header: 'สถานะ', key: 'status', width: 12 },
          { header: 'สภาพ', key: 'condition', width: 12 },
          { header: 'Serial Number', key: 'serialNumber', width: 20 },
          { header: 'Phone Number', key: 'phoneNumber', width: 15 },
          { header: 'จำนวน', key: 'quantity', width: 10 },
          { header: 'ความเร่งด่วน', key: 'urgency', width: 12 },
          { header: 'สถานที่จัดส่ง', key: 'deliveryLocation', width: 20 },
          { header: 'เหตุผลการเบิก', key: 'reason', width: 30 },
          { header: 'สถานะการดำเนินการ', key: 'actionStatus', width: 18 },
        ];

        // เพิ่มข้อมูล
        displayRows.forEach((row, index) => {
          const log = row.log as RequestLog;
          const item = row.item as any;
          
          const isSimCard = item.categoryId === 'cat_sim_card';
          const isApproved = ((item as any).assignedQuantity || 0) >= item.quantity;
          
          let serialNumbers = '-';
          if (!isSimCard) {
            if (isApproved && Array.isArray(item.assignedSerialNumbers) && item.assignedSerialNumbers.length > 0) {
              serialNumbers = item.assignedSerialNumbers.join(', ');
            } else if (!isApproved && Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
              serialNumbers = item.serialNumbers.join(', ');
            }
          }
          
          let phoneNumbers = '-';
          if (isSimCard) {
            if (isApproved && Array.isArray(item.assignedPhoneNumbers) && item.assignedPhoneNumbers.length > 0) {
              phoneNumbers = item.assignedPhoneNumbers.join(', ');
            } else if (!isApproved && Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
              phoneNumbers = item.serialNumbers.join(', ');
            }
          }

          worksheet.addRow({
            no: index + 1,
            requestDate: log.requestDate ? new Date(log.requestDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-',
            requester: log.firstName && log.lastName ? `${log.firstName} ${log.lastName}` : 'Unknown User',
            nickname: log.nickname || '-',
            department: log.department || '-',
            office: log.office || '-',
            phone: log.phone || '-',
            itemName: getCurrentItemName(item),
            category: item.category || 'Unknown Category',
            status: item.statusOnRequest || 'ไม่ระบุ',
            condition: item.conditionOnRequest || 'ไม่ระบุ',
            serialNumber: serialNumbers,
            phoneNumber: phoneNumbers,
            quantity: item.quantity,
            urgency: log.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ',
            deliveryLocation: log.deliveryLocation || '-',
            reason: log.reason || '-',
            actionStatus: isApproved ? 'เสร็จสิ้น' : 'รอดำเนินการ',
          });
        });
      } else {
        // ตั้งค่าคอลัมน์สำหรับประวัติคืน (มีคอลัมน์รูปภาพ)
        worksheet.columns = [
          { header: 'ลำดับ', key: 'no', width: 8 },
          { header: 'วันที่คืน', key: 'returnDate', width: 15 },
          { header: 'ชื่อผู้คืน', key: 'returner', width: 20 },
          { header: 'ชื่อเล่น', key: 'nickname', width: 12 },
          { header: 'แผนก', key: 'department', width: 20 },
          { header: 'ออฟฟิศ/สาขา', key: 'office', width: 20 },
          { header: 'เบอร์โทร', key: 'phone', width: 15 },
          { header: 'ชื่ออุปกรณ์', key: 'itemName', width: 25 },
          { header: 'หมวดหมู่', key: 'category', width: 20 },
          { header: 'สถานะ', key: 'status', width: 12 },
          { header: 'สภาพ', key: 'condition', width: 12 },
          { header: 'Serial Number', key: 'serialNumber', width: 20 },
          { header: 'Phone Number', key: 'phoneNumber', width: 15 },
          { header: 'เลขทรัพย์สิน', key: 'assetNumber', width: 15 },
          { header: 'จำนวน', key: 'quantity', width: 10 },
          { header: 'รูปภาพ', key: 'image', width: 25 },
          { header: 'สถานะการดำเนินการ', key: 'actionStatus', width: 18 },
        ];

        // เพิ่มข้อมูลและรูปภาพ
        for (let index = 0; index < displayRows.length; index++) {
          const row = displayRows[index];
          const log = row.log as ReturnLog;
          const item = row.item as any;
          
          const excelRow = worksheet.addRow({
            no: index + 1,
            returnDate: log.returnDate ? new Date(log.returnDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-',
            returner: log.firstName && log.lastName ? `${log.firstName} ${log.lastName}` : 'Unknown User',
            nickname: log.nickname || '-',
            department: log.department || '-',
            office: log.office || '-',
            phone: log.phoneNumber || '-',
            itemName: getCurrentItemName(item),
            category: item.category || 'Unknown Category',
            status: item.statusOnReturn || 'ไม่ระบุ',
            condition: item.conditionOnReturn || 'ไม่ระบุ',
            serialNumber: item.serialNumber || '-',
            phoneNumber: item.numberPhone || '-',
            assetNumber: item.assetNumber || '-',
            quantity: item.quantity,
            image: '',
            actionStatus: item.approvalStatus === 'approved' ? 'ยืนยันแล้ว' : 'รอยืนยัน',
          });

          // ถ้ามีรูปภาพ ให้ใส่รูปลงใน Excel
          if (item.image) {
            try {
              const imagePath = `/assets/ReturnLog/${item.image}`;
              const response = await fetch(imagePath);
              
              if (response.ok) {
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                
                // กำหนดนามสกุลไฟล์
                const ext = item.image.toLowerCase().split('.').pop() || 'png';
                const imageId = workbook.addImage({
                  buffer: arrayBuffer,
                  extension: ext === 'jpg' ? 'jpeg' : ext as any,
                });

                // ปรับความสูงของแถวให้พอดีกับรูป
                excelRow.height = 80;

                // ใส่รูปลงใน cell โดยจัดให้อยู่กึ่งกลาง
                // คำนวณ offset เพื่อให้รูปอยู่กลาง cell
                const imageWidth = 90;  // ขนาดรูป
                const imageHeight = 90;
                const cellWidth = 25 * 7; // ความกว้าง column (25) * 7 pixels per character width unit
                const cellHeight = 80 * 0.75; // ความสูงแถว (80) * 0.75 (conversion factor)
                
                // คำนวณ offset เพื่อจัดกลาง (หน่วยเป็น pixels)
                const colOffset = Math.max(0, (cellWidth - imageWidth) / 2);
                const rowOffset = Math.max(0, (cellHeight - imageHeight) / 2);

                worksheet.addImage(imageId, {
                  tl: { col: 15, row: index + 1, colOff: colOffset, rowOff: rowOffset },
                  ext: { width: imageWidth, height: imageHeight },
                  editAs: 'oneCell' // รูปจะย้ายตามแถว/คอลัมน์
                });
              }
            } catch (error) {
              console.error('Error loading image:', item.image, error);
              // ถ้าโหลดรูปไม่ได้ ให้แสดงข้อความแทน
              excelRow.getCell('image').value = 'ไม่สามารถโหลดรูปได้';
            }
          } else {
            excelRow.getCell('image').value = 'ไม่มีรูปภาพ';
          }
        }
      }

      // จัดรูปแบบ header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }, // สีน้ำเงิน
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 25; // ความสูง header

      // จัดตำแหน่งข้อมูลทุก cell ให้อยู่กึ่งกลาง
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.eachCell({ includeEmpty: true }, (cell) => {
            cell.alignment = { 
              vertical: 'middle', 
              horizontal: 'center', 
              wrapText: true 
            };
            // เพิ่มขอบให้สวยงาม
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };
          });
        } else {
          // เพิ่มขอบให้ header
          row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF2563EB' } },
              left: { style: 'thin', color: { argb: 'FF2563EB' } },
              bottom: { style: 'thin', color: { argb: 'FF2563EB' } },
              right: { style: 'thin', color: { argb: 'FF2563EB' } }
            };
          });
        }
      });

      // Generate filename
      const now = new Date();
      const dateStr = now.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).replace(/:/g, '-');
      
      const filename = `${sheetName}_${dateStr}_${timeStr}.xlsx`;

      // Export file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast.dismiss('export-loading');
      toast.success(`ส่งออกข้อมูล ${displayRows.length} รายการสำเร็จ`);
    } catch (error) {
      console.error('Export error:', error);
      toast.dismiss('export-loading');
      toast.error('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    }
  };

  const handleViewImage = (imageName: string) => {
    setSelectedImage(`/assets/ReturnLog/${imageName}`);
    setShowImageModal(true);
  };

  // Handle escape key to close image modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showImageModal) {
        setShowImageModal(false);
      }
    };

    if (showImageModal) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [showImageModal]);



  // Get unique values for filters
  const allLogs = [...requestLogs, ...returnLogs];
  
  // Get unique item names from all items (sorted alphabetically)
  const itemNames = [...new Set(
    allLogs.flatMap(log => 
      log.items.map(item => getCurrentItemName(item))
    )
  )].sort((a, b) => a.localeCompare(b, 'th'));

  // Get unique categories from all items (sorted alphabetically)
  const categories = [...new Set(
    allLogs.flatMap(log => 
      log.items.map(item => (item as any).category || '')
    ).filter(cat => cat !== '')
  )].sort((a, b) => a.localeCompare(b, 'th'));

  // Get unique statuses from all items (sorted alphabetically)
  const statuses = [...new Set(
    [
      ...requestLogs.flatMap(log => 
        log.items.map(item => (item as any).statusOnRequest).filter(Boolean)
      ),
      ...returnLogs.flatMap(log => 
        log.items.map(item => (item as any).statusOnReturn).filter(Boolean)
      )
    ]
  )].sort((a, b) => a.localeCompare(b, 'th'));

  // Get unique conditions from all items (sorted alphabetically)
  const conditions = [...new Set(
    [
      ...requestLogs.flatMap(log => 
        log.items.map(item => (item as any).conditionOnRequest).filter(Boolean)
      ),
      ...returnLogs.flatMap(log => 
        log.items.map(item => (item as any).conditionOnReturn).filter(Boolean)
      )
    ]
  )].sort((a, b) => a.localeCompare(b, 'th'));

  // Get unique departments (sorted alphabetically)
  const departments = [...new Set(allLogs.map(item => item.department))].sort((a, b) => a.localeCompare(b, 'th'));
  
  // Get unique offices (sorted alphabetically)
  const offices = [...new Set(allLogs.map(item => item.office))].sort((a, b) => a.localeCompare(b, 'th'));

  // Get unique delivery locations from request logs (sorted alphabetically)
  const deliveryLocations = [...new Set(
    requestLogs.map(log => log.deliveryLocation).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'th'));

  // Pagination
  const totalPages = Math.ceil(displayRows.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = displayRows.slice(startIndex, endIndex);

  return (
    <Layout>
      <div className="w-full max-w-full mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
          {/* Header */}
          <div className="flex flex-col justify-between items-center mb-7 xl:flex-row">
            <h1 className="text-2xl font-bold text-gray-900 pb-5 xl:pb-0">รายงานการเบิก/คืนอุปกรณ์</h1>
            <div className="flex flex-wrap justify-center gap-4 w-full xl:w-auto">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="w-full min-[400px]:w-3/5 min-[481px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>ฟิลเตอร์</span>
              </button>
              <button
                onClick={() => {
                  fetchData();
                  fetchInventoryData();
                }}
                disabled={loading}
                className="w-full min-[400px]:w-3/5 min-[481px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>รีเฟรช</span>
              </button>

              <button
                onClick={exportToExcel}
                disabled={loading || displayRows.length === 0}
                className="w-full min-[400px]:w-3/5 min-[481px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={displayRows.length === 0 ? 'ไม่มีข้อมูลให้ Export' : 'Export ข้อมูลเป็น Excel'}
              >
                <Download className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">ฟิลเตอร์ข้อมูล</h3>
                <button
                  onClick={resetFilters}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  ล้างฟิลเตอร์
                </button>
              </div>
              
              {/* แถวที่ 1: ค้นหา, Serial Number, Phone Number, อุปกรณ์, หมวดหมู่, สถานะ, สภาพ */}
              <div className="grid max-[768px]:grid-cols-1 max-[1120px]:grid-cols-2 max-[1440px]:grid-cols-4 grid-cols-7 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ค้นหา
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="ชื่อ, นามสกุล, ชื่อเล่น"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serial Number
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={serialNumberFilter}
                      onChange={(e) => setSerialNumberFilter(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="ค้นหา Serial Number"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={phoneNumberFilter}
                      onChange={(e) => setPhoneNumberFilter(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="ค้นหา Phone Number"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    อุปกรณ์
                  </label>
                  <input
                    list="itemNames-list"
                    value={itemNameFilter}
                    onChange={(e) => setItemNameFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="พิมพ์หรือเลือก"
                  />
                  <datalist id="itemNames-list">
                    <option value="">ทั้งหมด</option>
                    {itemNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หมวดหมู่
                  </label>
                  <input
                    list="categories-list"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="พิมพ์หรือเลือก"
                  />
                  <datalist id="categories-list">
                    <option value="">ทั้งหมด</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    สถานะ
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">ทั้งหมด</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    สภาพ
                  </label>
                  <select
                    value={conditionFilter}
                    onChange={(e) => setConditionFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">ทั้งหมด</option>
                    {conditions.map((condition) => (
                      <option key={condition} value={condition}>
                        {condition}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* แถวที่ 2: แผนก, สาขา, สถานที่จัดส่ง, ความเร่งด่วน, วันที่ */}
              <div className="grid max-[768px]:grid-cols-1 max-[1120px]:grid-cols-2 max-[1440px]:grid-cols-4 grid-cols-7 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    แผนก
                  </label>
                  <input
                    list="departments-list"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="พิมพ์หรือเลือก"
                  />
                  <datalist id="departments-list">
                    <option value="">ทั้งหมด</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept} />
                    ))}
                  </datalist>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    สาขา
                  </label>
                  <input
                    list="offices-list"
                    value={officeFilter}
                    onChange={(e) => setOfficeFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="พิมพ์หรือเลือก"
                  />
                  <datalist id="offices-list">
                    <option value="">ทั้งหมด</option>
                    {offices.map((office) => (
                      <option key={office} value={office} />
                    ))}
                  </datalist>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    สถานที่จัดส่ง
                  </label>
                  <input
                    list="deliveryLocations-list"
                    value={deliveryLocationFilter}
                    onChange={(e) => setDeliveryLocationFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="พิมพ์หรือเลือก"
                  />
                  <datalist id="deliveryLocations-list">
                    <option value="">ทั้งหมด</option>
                    {deliveryLocations.map((location) => (
                      <option key={location} value={location} />
                    ))}
                  </datalist>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ความเร่งด่วน
                  </label>
                  <select
                    value={urgencyFilter}
                    onChange={(e) => setUrgencyFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="normal">ปกติ</option>
                    <option value="very_urgent">ด่วนมาก</option>
                  </select>
                </div>
                
                {activeTab === 'request' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      วันที่เบิก
                    </label>
                    <DatePicker
                      value={dateFromFilter}
                      onChange={(date) => setDateFromFilter(date)}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      วันที่คืน
                    </label>
                    <DatePicker
                      value={dateToFilter}
                      onChange={(date) => setDateToFilter(date)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6 overflow-x-auto overflow-y-hidden">
            <nav className="-mb-px flex space-x-8">
              {[
                { 
                  key: 'request', 
                  label: 'ประวัติเบิก', 
                  icon: Package, 
                  count: requestLogs.reduce((total, req) => total + req.items.length, 0),
                  pendingCount: requestLogs.reduce((total, req) => 
                    total + req.items.filter((item: any) => ((item.assignedQuantity || 0) < item.quantity)).length, 0
                  )
                },
                { 
                  key: 'return', 
                  label: 'ประวัติคืน', 
                  icon: FileText, 
                  count: returnLogs.reduce((total, req) => total + req.items.length, 0),
                  pendingCount: returnLogs.reduce((total, ret) => 
                    total + ret.items.filter((item: any) => item.approvalStatus !== 'approved').length, 0
                  )
                },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleTabChange(tab.key as TabType)}
                    className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="w-max">{tab.label}</span>
                    <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none rounded-full ${
                      activeTab === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Table */}
          <div ref={tableContainerRef} className="table-container">
            {activeTab === 'request' ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-600">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      วันที่เบิก
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      ชื่อผู้เบิก
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      ชื่อเล่น
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      แผนก
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      ออฟฟิศ/สาขา
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      เบอร์โทร
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      ชื่ออุปกรณ์
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      หมวดหมู่
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      สถานะ
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      สภาพ
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      Serial Number
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      Phone Number
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      จำนวน
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      ความเร่งด่วน
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      สถานที่จัดส่ง
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      เหตุผลการเบิก
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      การดำเนินการ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(loading || isTabSwitching) && (
                    <tr>
                      <td colSpan={17} className="px-6 py-8 text-center text-gray-500">
                        <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                        กำลังโหลดข้อมูล
                      </td>
                    </tr>
                  )}
                  {!loading && !isTabSwitching && currentItems.length === 0 && (
                    <tr>
                      <td colSpan={17} className="px-6 py-8 text-center text-gray-500">ไม่พบข้อมูล</td>
                    </tr>
                  )}
                  {!isTabSwitching && currentItems.map((row, rowIndex) => {
                    const requestLog = (row as any).log as RequestLog;
                    const item = (row as any).item as any;
                    const itemIndex = (row as any).itemIndex as number;
                      // ✅ Determine row background color based on ITEM confirmation status (not request status)
                      const isItemApproved = ((item as any).assignedQuantity || 0) >= item.quantity;
                      const baseBgClass = rowIndex % 2 === 0 ? 'bg-white' : 'bg-blue-50';
                      const rowBgClass = isItemApproved ? baseBgClass : 'bg-orange-50';
                      
                      return (
                        <tr key={`${requestLog._id}-${itemIndex}`} className={rowBgClass}>
                        {/* วันที่เบิก */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {requestLog.requestDate ? new Date(requestLog.requestDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-'}
                        </td>
                        {/* ชื่อผู้เบิก */}
                        <td className="px-6 py-4 text-sm text-center text-selectable">
                          <div className={
                            (requestLog as any).userId?.pendingDeletion 
                              ? 'text-orange-600' 
                              : !requestLog.firstName 
                              ? 'text-gray-500 italic' 
                              : 'text-gray-900'
                          }>
                            {requestLog.firstName && requestLog.lastName ? (
                              <>
                                {requestLog.firstName} {requestLog.lastName}
                                {(requestLog as any).userId?.pendingDeletion && ' (รอลบ)'}
                              </>
                            ) : (
                              'Unknown User'
                            )}
                          </div>
                        </td>
                        {/* ชื่อเล่น */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {requestLog.nickname || '-'}
                        </td>
                        {/* แผนก */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {requestLog.department || '-'}
                        </td>
                        {/* ออฟฟิศ/สาขา */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {requestLog.office || '-'}
                        </td>
                        {/* เบอร์โทร */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {requestLog.phone || '-'}
                        </td>
                        {/* ชื่ออุปกรณ์ */}
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 text-center text-selectable">
                          {getCurrentItemName(item)}
                        </td>
                        {/* หมวดหมู่ */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {item.category || 'Unknown Category'}
                        </td>
                        {/* สถานะ */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {(item as any).statusOnRequestName || item.statusOnRequest || 'ไม่ระบุ'}
                        </td>
                        {/* สภาพ */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {(item as any).conditionOnRequestName || item.conditionOnRequest || 'ไม่ระบุ'}
                        </td>
                        {/* Serial Number */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          <div className="flex flex-col gap-1">
                            {(() => {
                              // ✅ ถ้าเป็นซิมการ์ด (categoryId === 'cat_sim_card') ให้แสดง "-"
                              const isSimCard = item.categoryId === 'cat_sim_card';
                              
                              if (isSimCard) {
                                return <span>-</span>;
                              }
                              
                              // ✅ CRITICAL FIX: ถ้ารายการอนุมัติแล้ว ให้แสดงเฉพาะ assignedSerialNumbers
                              // (ไม่ว่าจะมี SN หรือไม่มี - ถ้าไม่มีแสดง "-")
                              const isApproved = (item as any).itemApproved || ((item as any).assignedQuantity && (item as any).assignedQuantity > 0);
                              
                              if (isApproved) {
                                // แสดง assignedSerialNumbers (ที่แอดมินเลือกจริง)
                                if (Array.isArray(item.assignedSerialNumbers) && item.assignedSerialNumbers.length > 0) {
                                  return item.assignedSerialNumbers.map((sn: string, idx: number) => (
                                    <span key={idx} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                      {sn}
                                    </span>
                                  ));
                                } else {
                                  // แอดมินเลือกอุปกรณ์ที่ไม่มี SN
                                  return <span>-</span>;
                                }
                              } else {
                                // ยังไม่อนุมัติ - แสดง serialNumbers (ที่ผู้ใช้เลือกมา)
                                if (Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
                                  return item.serialNumbers.map((sn: string, idx: number) => (
                                    <span key={idx} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                      {sn}
                                    </span>
                                  ));
                                } else {
                                  return <span>-</span>;
                                }
                              }
                            })()}
                          </div>
                        </td>
                        {/* Phone Number */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          <div className="flex flex-col gap-1">
                            {(() => {
                              // ✅ ถ้าไม่ใช่ซิมการ์ด แสดง "-"
                              const isSimCard = item.categoryId === 'cat_sim_card';
                              
                              if (!isSimCard) {
                                return <span>-</span>;
                              }
                              
                              // ✅ CRITICAL FIX: ถ้ารายการอนุมัติแล้ว ให้แสดงเฉพาะ assignedPhoneNumbers
                              // (ไม่ว่าจะมีเบอร์หรือไม่มี - ถ้าไม่มีแสดง "-")
                              const isApproved = (item as any).itemApproved || ((item as any).assignedQuantity && (item as any).assignedQuantity > 0);
                              
                              if (isApproved) {
                                // แสดง assignedPhoneNumbers (ที่แอดมินเลือกจริง)
                                if (Array.isArray(item.assignedPhoneNumbers) && item.assignedPhoneNumbers.length > 0) {
                                  return item.assignedPhoneNumbers.map((phone: string, idx: number) => (
                                    <span key={idx} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                      {phone}
                                    </span>
                                  ));
                                } else {
                                  // แอดมินเลือกซิมการ์ดที่ไม่มีเบอร์
                                  return <span>-</span>;
                                }
                              } else {
                                // ยังไม่อนุมัติ - แสดง serialNumbers (ที่ผู้ใช้เลือกมา - สำหรับซิมการ์ดจะเป็นเบอร์โทรศัพท์)
                                if (Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
                                  return item.serialNumbers.map((phone: string, idx: number) => (
                                    <span key={idx} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                      {phone}
                                    </span>
                                  ));
                                } else {
                                  return <span>-</span>;
                                }
                              }
                            })()}
                          </div>
                        </td>
                        {/* จำนวน */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {item.quantity}
                        </td>
                        {/* ความเร่งด่วน */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            requestLog.urgency === 'very_urgent' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {requestLog.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ'}
                          </span>
                        </td>
                        {/* สถานที่จัดส่ง */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {requestLog.deliveryLocation || '-'}
                        </td>
                        {/* เหตุผลการเบิก */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center">
                          <div className="max-w-xs truncate" title={requestLog.reason}>
                            {requestLog.reason || '-'}
                          </div>
                        </td>
                         {/* การดำเนินการ */}
                         <td className="px-6 py-4 whitespace-nowrap text-center">
                           {/* ✅ เช็คว่า item นี้อนุมัติแล้วหรือยัง (ไม่ใช่เช็ค request status) */}
                           {(() => {
                             const assignedQty = (item as any).assignedQuantity || 0;
                             const requestedQty = item.quantity || 0;
                             const isCompleted = assignedQty >= requestedQty;
                             
                             
                             return isCompleted ? (
                               <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                 <CheckCircle className="w-3 h-3 mr-1" />
                                 เสร็จสิ้น
                               </span>
                             ) : (
                               <button
                                 onClick={() => handleOpenSelectionModal(requestLog, itemIndex)}
                                 className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                               >
                                 <Settings className="w-3 h-3 mr-1" />
                                 เลือกอุปกรณ์และอนุมัติ
                               </button>
                             );
                           })()}
                         </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : activeTab === 'return' ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-600">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      วันที่คืน
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      ชื่อผู้คืน
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      ชื่อเล่น
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      แผนก
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      ออฟฟิศ/สาขา
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      เบอร์โทร
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      ชื่ออุปกรณ์
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      หมวดหมู่
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      สถานะ
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      สภาพ
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      Serial Number
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      Phone Number
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      เลขทรัพย์สิน
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      จำนวน
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      รูปภาพ
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      การดำเนินการ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(loading || isTabSwitching) && (
                    <tr>
                      <td colSpan={16} className="px-6 py-8 text-center text-gray-500">
                        <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                        กำลังโหลดข้อมูล
                      </td>
                    </tr>
                  )}
                  {!loading && !isTabSwitching && currentItems.length === 0 && (
                    <tr>
                      <td colSpan={16} className="px-6 py-8 text-center text-gray-500">ไม่พบข้อมูล</td>
                    </tr>
                  )}
                  {!isTabSwitching && currentItems.map((row, rowIndex) => {
                    const returnLog = (row as any).log as ReturnLog;
                    const item = (row as any).item as any;
                    const itemIndex = (row as any).itemIndex as number;
                      // Determine row background color based on approval status
                      const isPending = item.approvalStatus === 'pending' || !item.approvalStatus;
                      const baseBgClass = rowIndex % 2 === 0 ? 'bg-white' : 'bg-blue-50';
                      const rowBgClass = isPending ? 'bg-orange-50' : baseBgClass;
                      
                      return (
                        <tr key={`${returnLog._id}-${itemIndex}`} className={rowBgClass}>
                        {/* วันที่คืน */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {returnLog.returnDate ? new Date(returnLog.returnDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-'}
                        </td>
                        {/* ชื่อผู้คืน */}
                        <td className="px-6 py-4 text-sm text-center text-selectable">
                          <div className={
                            (returnLog as any).userId?.pendingDeletion 
                              ? 'text-orange-600' 
                              : !returnLog.firstName 
                              ? 'text-gray-500 italic' 
                              : 'text-gray-900'
                          }>
                            {returnLog.firstName && returnLog.lastName ? (
                              <>
                                {returnLog.firstName} {returnLog.lastName}
                                {(returnLog as any).userId?.pendingDeletion && ' (รอลบ)'}
                              </>
                            ) : (
                              'Unknown User'
                            )}
                          </div>
                        </td>
                        {/* ชื่อเล่น */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {returnLog.nickname || '-'}
                        </td>
                        {/* แผนก */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {returnLog.department || '-'}
                        </td>
                        {/* ออฟฟิศ/สาขา */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {returnLog.office || '-'}
                        </td>
                        {/* เบอร์โทร */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {returnLog.phone || '-'}
                        </td>
                        {/* ชื่ออุปกรณ์ */}
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 text-center text-selectable">
                          {getCurrentItemName(item)}
                        </td>
                        {/* หมวดหมู่ */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {item.category || 'Unknown Category'}
                        </td>
                        {/* สถานะ */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {(item as any).statusOnReturnName || item.statusOnReturn || 'ไม่ระบุ'}
                        </td>
                        {/* สภาพ */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {(item as any).conditionOnReturnName || item.conditionOnReturn || 'ไม่ระบุ'}
                        </td>
                        {/* Serial Number */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {item.serialNumber ? (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {item.serialNumber}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        {/* Phone Number */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {item.numberPhone ? (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              {item.numberPhone}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        {/* เลขทรัพย์สิน */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {item.assetNumber || '-'}
                        </td>
                        {/* จำนวน */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {item.quantity}
                        </td>
                        {/* รูปภาพ */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {item.image ? (
                            <button
                              onClick={() => handleViewImage(item.image!)}
                              className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors justify-center cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                              <span>คลิกเพื่อดูรูป</span>
                            </button>
                          ) : (
                            <span className="text-gray-400">ไม่มีรูปภาพ</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                          {item.approvalStatus === 'pending' || !item.approvalStatus ? (
                            <button
                              onClick={() => handleApproveReturnItem(returnLog._id, itemIndex)}
                              disabled={approvingReturnIds.has(`${returnLog._id}-${itemIndex}`)}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2"
                            >
                              {approvingReturnIds.has(`${returnLog._id}-${itemIndex}`) ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                              <span>{approvingReturnIds.has(`${returnLog._id}-${itemIndex}`) ? 'กำลังยืนยัน...' : 'ยืนยันการคืน'}</span>
                            </button>
                          ) : (
                            <span className="text-green-600 font-medium">
                              ✅ ยืนยันแล้ว
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : null}
          </div>

          {/* Total Count */}
          {!loading && displayRows.length > 0 && (
            <div className="mt-4 text-left">
              <p className="text-sm text-gray-600">
                แสดงทั้งหมด {displayRows.length} รายการ
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center text-sm text-gray-700">
                <span>
                  แสดง {startIndex + 1} ถึง {Math.min(endIndex, displayRows.length)} จาก {displayRows.length} รายการ
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ←
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 border rounded-md text-sm ${
                      currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Image Modal */}
        {showImageModal && selectedImage && (
          <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-60"
            onClick={() => setShowImageModal(false)}
          >
            <div 
              className="relative max-w-4xl max-h-[90vh] p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 z-10 transition-all duration-200"
                title="ปิดรูปภาพ"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={selectedImage}
                alt="Return item"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onError={(e) => {
                  console.error('Failed to load image:', selectedImage);
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const errorDiv = document.createElement('div');
                  errorDiv.className = 'text-white text-center p-8';
                  errorDiv.innerHTML = `
                    <div class="text-red-400 mb-2">ไม่สามารถโหลดรูปภาพได้</div>
                    <div class="text-sm text-gray-300">${selectedImage}</div>
                  `;
                  target.parentNode?.appendChild(errorDiv);
                }}
                onLoad={() => {
                }}
              />
            </div>
          </div>
        )}

        {/* Serial Number Selection Modal */}
        {showSelectionModal && selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4 overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">เลือกอุปกรณ์ที่จะมอบหมาย</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      คำขอของ {selectedRequest.firstName} {selectedRequest.lastName}
                    </p>
                    
                    {/* แสดงรายการ SN ที่ user เจาะจงมา */}
                    {selectedRequest.items.some(item => item.serialNumbers && item.serialNumbers.length > 0) && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center mb-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                          <span className="text-sm font-medium text-blue-800">Serial Numbers ที่ user เลือกมา:</span>
                        </div>
                        <div className="space-y-1">
                          {selectedRequest.items.map((item, idx) => 
                            item.serialNumbers && item.serialNumbers.length > 0 && (
                              <div key={idx} className="text-sm text-blue-700">
                                <span className="font-medium">{item.itemName}:</span>{' '}
                                {item.serialNumbers.map((sn, snIdx) => (
                                  <span key={snIdx} className="inline-block bg-blue-100 px-2 py-1 rounded text-xs mr-1">
                                    {sn}
                                  </span>
                                ))}
                              </div>
                            )
                          )}
                        </div>
                        <p className="text-xs text-blue-600 mt-2">
                          💡 ระบบจะติ๊กให้อัตโนมัติ (หากมีในคลัง) แต่คุณสามารถเปลี่ยนการเลือกได้
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowSelectionModal(false);
                      setSelectedRequest(null);
                      setSelectedItemIndex(null);
                      setItemSelections({});
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-6">
                  {selectedRequest.items.map((item, index) => {
                    const itemKey = `${item.itemName || 'unknown'}-${item.category || 'ไม่ระบุ'}`;
                    return (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900">
                            {item.itemName}
                          </h4>
                          <span className="text-sm text-gray-500">
                            จำนวน: {item.quantity} ชิ้น
                          </span>
                        </div>
                        
                        <MemoizedSerialNumberSelector
                          key={itemKey} 
                          itemKey={itemKey}
                          itemName={item.itemName || inventoryItems[item.itemId] || 'ไม่ระบุ'}
                          category={item.category || 'ไม่ระบุ'}
                          categoryId={item.categoryId} // ✅ ส่ง categoryId ไปด้วย
                          requestedQuantity={item.quantity}
                          requestedSerialNumbers={item.serialNumbers}
                          onSelectionChange={handleSelectionChange}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {selectedRequest && (
                      <div className="space-y-1">
                        <div>
                          เลือกแล้ว: {Object.values(itemSelections).reduce((total, items) => total + items.length, 0)} ชิ้น
                          จากที่ต้องการ: {selectedRequest.items.reduce((total, item) => total + item.quantity, 0)} ชิ้น
                        </div>
                        {/* ✅ Show selection status for each item */}
                        <div className="flex flex-wrap gap-2">
                          {selectedRequest.items.map((item, idx) => {
                            const itemKey = `${item.itemName || 'unknown'}-${item.category || 'ไม่ระบุ'}`;
                            const selectedItems = itemSelections[itemKey] || [];
                            const isComplete = selectedItems.length === item.quantity;
                            return (
                              <span
                                key={idx}
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  isComplete 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-orange-100 text-orange-800'
                                }`}
                              >
                                {item.itemName}: {selectedItems.length}/{item.quantity}
                                {isComplete ? ' ✓' : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                   <div className="flex justify-center items-center space-x-4">
                     {/* ปุ่มลบคำขอ/ลบรายการเดียว */}
                     <button
                       onClick={() => {
                         if (selectedItemIndex != null) {
                           if (confirm('ลบรายการนี้ออกจากคำขอใช่หรือไม่?')) {
                             handleDeleteRequestItem();
                           }
                         } else {
                           if (confirm('คุณแน่ใจหรือไม่ที่ต้องการลบคำขอนี้?')) {
                             handleDeleteRequest(selectedRequest!._id);
                           }
                         }
                       }}
                       disabled={isDeletingRequest || isDeletingItem}
                       className="px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 hover:bg-red-50 hover:border-red-400 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                     >
                       {(isDeletingRequest || isDeletingItem) && (
                         <RefreshCw className="w-4 h-4 animate-spin" />
                       )}
                       <span>{selectedItemIndex != null ? '🗑️ ลบรายการนี้' : '🗑️ ลบคำขอ'}</span>
                     </button>
                     
                     {/* ปุ่มยกเลิก */}
                     <button
                       onClick={() => {
                         setShowSelectionModal(false);
                         setSelectedRequest(null);
                         setSelectedItemIndex(null);
                         setItemSelections({});
                       }}
                       className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                     >
                       ยกเลิก
                     </button>
                     
                     {/* ปุ่มอนุมัติและมอบหมาย */}
                     <button
                       onClick={handleApproveWithSelection}
                       disabled={isApproving || !selectedRequest || (() => {
                         // ✅ Check if all items have the correct number of selections
                         if (!selectedRequest) return true;
                         return selectedRequest.items.some(item => {
                           const itemKey = `${item.itemName || 'unknown'}-${item.category || 'ไม่ระบุ'}`;
                           const selectedItems = itemSelections[itemKey] || [];
                           return selectedItems.length !== item.quantity;
                         });
                       })()}
                       className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                     >
                       {isApproving && (
                         <RefreshCw className="w-4 h-4 animate-spin" />
                       )}
                       <span>{isApproving ? 'กำลังอนุมัติ...' : 'อนุมัติและมอบหมาย'}</span>
                     </button>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
