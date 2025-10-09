'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  phoneNumber?: string; // เพิ่ม phoneNumber property
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
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');
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

  useEffect(() => {
    applyFilters();
  }, [requestLogs, returnLogs, activeTab, searchTerm, departmentFilter, officeFilter, dateFromFilter, dateToFilter]);



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
        console.log('📋 Request data received:', requestData);
        setRequestLogs(requestData);
      } else {
        console.error('❌ Request API failed:', requestResponse.status, requestResponse.statusText);
      }

      if (returnResponse.ok) {
        const returnData = await returnResponse.json();
        console.log('📋 Return data received:', returnData);
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
      console.log('❌ No selectedRequest');
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
    setDepartmentFilter('');
    setOfficeFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setCurrentPage(1);
  };

  const applyFilters = () => {
    const data = activeTab === 'request' ? requestLogs : returnLogs;
    
    let filtered = data.filter(item => {
      // Search filter
      const matchesSearch = !searchTerm || 
        item.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.items.some(equip => {
          const currentItemName = getCurrentItemName(equip);
          return currentItemName.toLowerCase().includes(searchTerm.toLowerCase());
        });

      // Department filter
      const matchesDepartment = !departmentFilter || item.department.includes(departmentFilter);

      // Office filter
      const matchesOffice = !officeFilter || item.office.includes(officeFilter);

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

      return matchesSearch && matchesDepartment && matchesOffice && matchesRequestDate && matchesReturnDate;
    });

    // Build flattened rows and sort by: pending first, then date desc
    const rows: any[] = [];

    if (activeTab === 'request') {
      (filtered as RequestLog[]).forEach((log) => {
        log.items.forEach((item, index) => {
          // ✅ Check if THIS ITEM is approved (not the whole request)
          const isItemApproved = ((item as any).assignedQuantity || 0) >= item.quantity;
          const group = isItemApproved ? 'approved' : 'pending';
          const date = (log as any).submittedAt || (log as any).updatedAt || (log as any).createdAt || (log as any).requestDate || (log as any).returnDate || Date.now();
          rows.push({ type: 'request', log, item, itemIndex: index, group, date: new Date(date) });
        });
      });
    } else {
      (filtered as ReturnLog[]).forEach((log) => {
        log.items.forEach((item: any, index: number) => {
          const group = item.approvalStatus === 'approved' ? 'approved' : 'pending';
          const dateValue = group === 'approved' ? (item.approvedAt || (log as any).updatedAt || log.returnDate) : (log.returnDate || (log as any).createdAt || (log as any).updatedAt);
          rows.push({ type: 'return', log, item, itemIndex: index, group, date: new Date(dateValue as any) });
        });
      });
    }

    const groupOrder = { pending: 0, approved: 1 } as const;
    rows.sort((a, b) => {
      const g = groupOrder[a.group as 'pending' | 'approved'] - groupOrder[b.group as 'pending' | 'approved'];
      if (g !== 0) return g;
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

  const exportToExcel = () => {
    toast('ฟีเจอร์ Export Excel จะพัฒนาในอนาคต');
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
  const departments = [...new Set([...requestLogs, ...returnLogs].map(item => item.department))];
  const offices = [...new Set([...requestLogs, ...returnLogs].map(item => item.office))];

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
                className="w-full min-[400px]:w-3/5 min-[481px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={resetFilters}
                className="w-full min-[400px]:w-3/5 min-[481px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>รีเซทค่า</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">ฟิลเตอร์ข้อมูล</h3>
                <button
                  onClick={resetFilters}
                  className="flex items-center space-x-2 px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>รีเซทค่า</span>
                </button>
              </div>
              <div className="grid max-[768px]:grid-cols-1 max-[1120px]:grid-cols-2 grid-cols-4 gap-4">
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
                      placeholder="ชื่อ, อุปกรณ์"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    แผนก
                  </label>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">ทั้งหมด</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    สาขา
                  </label>
                  <select
                    value={officeFilter}
                    onChange={(e) => setOfficeFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">ทั้งหมด</option>
                    {offices.map((office) => (
                      <option key={office} value={office}>
                        {office}
                      </option>
                    ))}
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
                      placeholder="dd/mm/yyyy"
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
                      placeholder="dd/mm/yyyy"
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
                    onClick={() => setActiveTab(tab.key as TabType)}
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
                  {loading && (
                    <tr>
                      <td colSpan={17} className="px-6 py-8 text-center text-gray-500">
                        <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                        กำลังโหลดข้อมูล
                      </td>
                    </tr>
                  )}
                  {!loading && currentItems.length === 0 && (
                    <tr>
                      <td colSpan={17} className="px-6 py-8 text-center text-gray-500">ไม่พบข้อมูล</td>
                    </tr>
                  )}
                  {currentItems.map((row, rowIndex) => {
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
                          {requestLog.requestDate ? new Date(requestLog.requestDate).toLocaleDateString('th-TH') : '-'}
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
                          {item.statusOnRequest || 'ไม่ระบุ'}
                        </td>
                        {/* สภาพ */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {item.conditionOnRequest || 'ไม่ระบุ'}
                        </td>
                        {/* Serial Number */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          <div className="flex flex-col gap-1">
                            {/* Serial Numbers ที่ admin assign ให้ (รวมกับที่ user ขอ) */}
                            {Array.isArray(item.assignedSerialNumbers) && item.assignedSerialNumbers.length > 0 ? (
                              item.assignedSerialNumbers.map((sn: string, idx: number) => (
                                <span key={idx} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                  {sn}
                                </span>
                              ))
                            ) : Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0 ? (
                              item.serialNumbers.map((sn: string, idx: number) => (
                                <span key={idx} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                  {sn}
                                </span>
                              ))
                            ) : (
                              <span>-</span>
                            )}
                          </div>
                        </td>
                        {/* Phone Number */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          <div className="flex flex-col gap-1">
                            {Array.isArray(item.assignedPhoneNumbers) && item.assignedPhoneNumbers.length > 0 ? (
                              item.assignedPhoneNumbers.map((phone: string, idx: number) => (
                                <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {phone}
                                </span>
                              ))
                            ) : (
                              <span>-</span>
                            )}
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
                             
                            // Debug logging
                            console.log(`🔍 Item ${item.itemName}: assignedQty=${assignedQty}, requestedQty=${requestedQty}, isCompleted=${isCompleted}`);
                            console.log(`🔍 Full item data:`, item);
                             
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
                  {loading && (
                    <tr>
                      <td colSpan={16} className="px-6 py-8 text-center text-gray-500">
                        <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                        กำลังโหลดข้อมูล
                      </td>
                    </tr>
                  )}
                  {!loading && currentItems.length === 0 && (
                    <tr>
                      <td colSpan={16} className="px-6 py-8 text-center text-gray-500">ไม่พบข้อมูล</td>
                    </tr>
                  )}
                  {currentItems.map((row, rowIndex) => {
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
                          {returnLog.returnDate ? new Date(returnLog.returnDate).toLocaleDateString('th-TH') : '-'}
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
                          {returnLog.phoneNumber || '-'}
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
                          {item.statusOnReturn || 'ไม่ระบุ'}
                        </td>
                        {/* สภาพ */}
                        <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                          {item.conditionOnReturn || 'ไม่ระบุ'}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center text-sm text-gray-700">
                <span>
                  แสดง {startIndex + 1} ถึง {Math.min(endIndex, filteredData.length)} จาก {filteredData.length} รายการ
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
                  console.log('Image loaded successfully:', selectedImage);
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
