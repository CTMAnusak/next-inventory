'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
    serialNumbers?: string[];
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
  returnDate: string;
  items: Array<{
    itemId: string;        // Primary reference to inventory
    itemName: string;      // Current name from inventory
    quantity: number;
    serialNumber?: string; // Single serial number (แก้ไขจาก serialNumbers)
    assetNumber?: string;
    image?: string;
  }>;
  submittedAt: string;
  status?: 'pending' | 'completed'; // เพิ่ม status สำหรับการแสดงสถานะ
}

type TabType = 'request' | 'return';

export default function AdminEquipmentReportsPage() {
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [returnLogs, setReturnLogs] = useState<ReturnLog[]>([]);
  const [filteredData, setFilteredData] = useState<(RequestLog | ReturnLog)[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('request');
  const [showFilters, setShowFilters] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  
  // Serial Number Selection Modal
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestLog | null>(null);
  const [itemSelections, setItemSelections] = useState<{[key: string]: any[]}>({});
  
  // Delete Confirmation Modal
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  
  // State for current inventory data
  const [inventoryItems, setInventoryItems] = useState<{[key: string]: string}>({});

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchData();
    fetchInventoryData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [requestLogs, returnLogs, activeTab, searchTerm, departmentFilter, officeFilter, dateFromFilter, dateToFilter]);



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
      }

      if (returnResponse.ok) {
        const returnData = await returnResponse.json();
        setReturnLogs(returnData);
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
  const handleOpenSelectionModal = (request: RequestLog) => {
    setSelectedRequest(request);
    setItemSelections({});
    setShowSelectionModal(true);
  };

  // ฟังก์ชันสำหรับจัดการการเลือก Serial Number
  const handleSelectionChange = useCallback((itemKey: string, selectedItems: any[]) => {
    setItemSelections(prev => ({
      ...prev,
      [itemKey]: selectedItems
    }));
  }, []);

  // ฟังก์ชันสำหรับยืนยันการคืนอุปกรณ์
  const handleApproveReturn = async (returnId: string) => {
    try {
      const response = await fetch(`/api/admin/equipment-reports/returns/${returnId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
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
          toast.success('คำขอคืนนี้ได้รับการอนุมัติแล้ว');
        } else {
          const message = data.message || 'ยืนยันการคืนอุปกรณ์เรียบร้อยแล้ว';
          toast.success(message);
        }
        fetchData(); // Refresh data
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error approving return:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  // ฟังก์ชันสำหรับอนุมัติด้วยการเลือก Serial Number
  const handleApproveWithSelection = async () => {
    console.log('🎯 handleApproveWithSelection called');
    console.log('📋 selectedRequest:', selectedRequest);
    console.log('🔍 itemSelections:', itemSelections);
    
    if (!selectedRequest) {
      console.log('❌ No selectedRequest');
      return;
    }

    try {
      // Validate selections
      const selections = selectedRequest.items.map(item => {
        const itemKey = `${item.itemName || 'unknown'}-${item.category || 'ไม่ระบุ'}`;
        const selectedItems = itemSelections[itemKey] || [];
        
        // ✅ Enhanced validation: Handle insufficient stock cases
        if (selectedItems.length !== item.quantity) {
          if (selectedItems.length === 0) {
            // Case: No items available (SerialNumberSelector shows insufficient stock)
            throw new Error(`ไม่สามารถอนุมัติได้: ไม่มี ${item.itemName} เพียงพอในคลัง (ขอ ${item.quantity} ชิ้น)`);
          } else {
            // Case: Admin needs to select more items
            throw new Error(`กรุณาเลือก ${item.itemName} ให้ครบ ${item.quantity} ชิ้น (เลือกแล้ว ${selectedItems.length} ชิ้น)`);
          }
        }

        return {
          itemName: item.itemName,
          category: item.category || 'ไม่ระบุ',
          requestedQuantity: item.quantity,
          selectedItems: selectedItems
        };
      });

      const response = await fetch(`/api/admin/equipment-reports/requests/${selectedRequest._id}/approve-with-selection`, {
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
    }
  };

  // ฟังก์ชันสำหรับเปิด Modal ยืนยันการลบคำขอ
  const handleDeleteRequest = async (requestId: string) => {
    setShowDeleteConfirmModal(true);
  };

  // ฟังก์ชันสำหรับยืนยันการลบคำขอ
  const confirmDeleteRequest = async () => {
    if (!selectedRequest) return;

    try {
      const response = await fetch(`/api/admin/equipment-reports/requests/${selectedRequest._id}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('ลบคำขอเรียบร้อยแล้ว');
        setShowDeleteConfirmModal(false);
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

    // Sort by submitted date (newest first)
    filtered.sort((a, b) => {
      // Use submittedAt if available, fallback to createdAt or updatedAt
      const getDate = (item: any) => {
        if (item.submittedAt) return new Date(item.submittedAt);
        if (item.createdAt) return new Date(item.createdAt);
        if (item.updatedAt) return new Date(item.updatedAt);
        return new Date(0); // fallback to epoch
      };
      
      const dateA = getDate(a);
      const dateB = getDate(b);
      return dateB.getTime() - dateA.getTime(); // Latest first
    });

    setFilteredData(filtered);
    setCurrentPage(1);
  };

  // Get current item name from inventory or fallback to stored name
  const getCurrentItemName = (item: any) => {
    if (item.itemId && inventoryItems[item.itemId]) {
      return inventoryItems[item.itemId];
    }
    return item.itemName || 'Unknown Item';
  };

  const exportToExcel = () => {
    toast('ฟีเจอร์ Export Excel จะพัฒนาในอนาคต');
  };

  const handleViewImage = (imageName: string) => {
    setSelectedImage(`/assets/ReturnLog/${imageName}`);
    setShowImageModal(true);
  };



  // Get unique values for filters
  const departments = [...new Set([...requestLogs, ...returnLogs].map(item => item.department))];
  const offices = [...new Set([...requestLogs, ...returnLogs].map(item => item.office))];

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredData.slice(startIndex, endIndex);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
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
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6 overflow-x-auto overflow-y-hidden">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'request', label: 'ประวัติเบิก', icon: Package, count: requestLogs.length },
                { key: 'return', label: 'ประวัติคืน', icon: FileText, count: returnLogs.length },
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

          {/* Filters */}
          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
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

          {/* Table */}
          <div className="overflow-x-auto">
            {activeTab === 'request' ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      วันที่
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ชื่ออุปกรณ์
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      จำนวน
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Serial Numbers
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ชื่อ
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      แผนก
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      สาขา
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      เหตุผล
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ความเร่งด่วน
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      สถานที่จัดส่ง
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      เบอร์โทร
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ดำเนินการ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading && (
                    <tr>
                      <td colSpan={12} className="px-6 py-8 text-center text-gray-500">
                        <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                        กำลังโหลดข้อมูล
                      </td>
                    </tr>
                  )}
                  {!loading && currentItems.length === 0 && (
                    <tr>
                      <td colSpan={12} className="px-6 py-8 text-center text-gray-500">ไม่พบข้อมูล</td>
                    </tr>
                  )}
                  {currentItems.map((log) => {
                    const requestLog = log as RequestLog;
                    return requestLog.items.map((item, itemIndex) => (
                      <tr key={`${requestLog._id}-${itemIndex}`}>
                        {itemIndex === 0 && (
                          <>
                            <td rowSpan={requestLog.items.length} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                              {new Date(requestLog.requestDate).toLocaleDateString('th-TH')}
                            </td>
                          </>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                          {getCurrentItemName(item)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          <div className="flex flex-col gap-2">
                            {/* Serial Numbers ที่ user ขอมา */}
                            {Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0 && (
                              <div>
                                <div className="text-xs text-gray-600 font-medium mb-1">ที่ user ขอ:</div>
                                <div className="flex flex-col gap-1">
                                  {item.serialNumbers.slice(0, 2).map((sn, idx) => (
                                    <span key={idx} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                      {sn}
                                    </span>
                                  ))}
                                  {item.serialNumbers.length > 2 && (
                                    <span className="text-xs text-gray-500">
                                      +{item.serialNumbers.length - 2} อื่นๆ
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Serial Numbers ที่ admin assign ให้ */}
                            {Array.isArray(item.assignedSerialNumbers) && item.assignedSerialNumbers.length > 0 && (
                              <div>
                                <div className="text-xs text-gray-600 font-medium mb-1">ที่ admin ให้:</div>
                                <div className="flex flex-col gap-1">
                                  {item.assignedSerialNumbers.slice(0, 2).map((sn, idx) => (
                                    <span key={idx} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                      {sn}
                                    </span>
                                  ))}
                                  {item.assignedSerialNumbers.length > 2 && (
                                    <span className="text-xs text-gray-500">
                                      +{item.assignedSerialNumbers.length - 2} อื่นๆ
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* ถ้าไม่มี SN ทั้งคู่ */}
                            {!((Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) ||
                                (Array.isArray(item.assignedSerialNumbers) && item.assignedSerialNumbers.length > 0)) && (
                              <span>-</span>
                            )}
                          </div>
                        </td>
                        {itemIndex === 0 && (
                          <>
                            <td rowSpan={requestLog.items.length} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {requestLog.firstName} {requestLog.lastName} ({requestLog.nickname})
                            </td>
                            <td rowSpan={requestLog.items.length} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                              {requestLog.department}
                            </td>
                            <td rowSpan={requestLog.items.length} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                              {requestLog.office}
                            </td>
                            <td rowSpan={requestLog.items.length} className="px-6 py-4 text-sm text-gray-500 text-center">
                              <div className="max-w-xs truncate" title={requestLog.reason}>
                                {requestLog.reason}
                              </div>
                            </td>
                            <td rowSpan={requestLog.items.length} className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                requestLog.urgency === 'very_urgent' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {requestLog.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ'}
                              </span>
                            </td>
                            <td rowSpan={requestLog.items.length} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                              {requestLog.deliveryLocation}
                            </td>
                            <td rowSpan={requestLog.items.length} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                              {requestLog.phone}
                            </td>
                            <td rowSpan={requestLog.items.length} className="px-6 py-4 whitespace-nowrap text-center">
                              {requestLog.status === 'completed' ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  เสร็จสิ้น
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleOpenSelectionModal(requestLog)}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  <Settings className="w-3 h-3 mr-1" />
                                  เลือกอุปกรณ์และอนุมัติ
                                </button>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            ) : activeTab === 'return' ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      วันที่คืน
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ชื่อ
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      แผนก
                    </th>
                                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ออฟฟิศ/สาขา
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ชื่ออุปกรณ์
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Serial Numbers
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        เลขทรัพย์สิน
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        จำนวน
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        รูปภาพ
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        การดำเนินการ
                      </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading && (
                    <tr>
                      <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                        <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                        กำลังโหลดข้อมูล
                      </td>
                    </tr>
                  )}
                  {!loading && currentItems.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-6 py-8 text-center text-gray-500">ไม่พบข้อมูล</td>
                    </tr>
                  )}
                  {currentItems.map((log) => {
                    const returnLog = log as ReturnLog;
                    return returnLog.items.map((item, itemIndex) => (
                      <tr key={`${returnLog._id}-${itemIndex}`}>
                        {itemIndex === 0 && (
                          <>
                            <td rowSpan={returnLog.items.length} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                              {new Date(returnLog.returnDate).toLocaleDateString('th-TH')}
                            </td>
                            <td rowSpan={returnLog.items.length} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                              {returnLog.firstName} {returnLog.lastName} {returnLog.nickname ? `(${returnLog.nickname})` : ''}
                            </td>
                            <td rowSpan={returnLog.items.length} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                              {returnLog.department || '-'}
                            </td>
                            <td rowSpan={returnLog.items.length} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                              {returnLog.office}
                            </td>
                          </>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                          {getCurrentItemName(item)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {item.serialNumber ? (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {item.serialNumber}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {item.assetNumber || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {item.image ? (
                            <button
                              onClick={() => handleViewImage(item.image!)}
                              className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors justify-center"
                            >
                              <Eye className="w-4 h-4" />
                              <span>คลิกเพื่อดูรูป</span>
                            </button>
                          ) : (
                            <span className="text-gray-400">ไม่มีรูปภาพ</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                          {itemIndex === 0 && (
                            returnLog.status === 'pending' ? (
                              <button
                                onClick={() => handleApproveReturn(returnLog._id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                              >
                                <CheckCircle className="w-4 h-4 inline mr-2" />
                                ยืนยันการคืน
                              </button>
                            ) : (
                              <span className="text-green-600 font-medium">
                                ✅ ยืนยันแล้ว
                              </span>
                            )
                          )}
                        </td>
                      </tr>
                    ));
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
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60">
            <div className="relative max-w-4xl max-h-[90vh] p-4">
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
              >
                <X className="w-8 h-8" />
              </button>
              <img
                src={selectedImage}
                alt="Return item"
                className="max-w-full max-h-full object-contain rounded-lg"
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
                      <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center mb-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                          <span className="text-sm font-medium text-orange-800">Serial Numbers ที่ user เจาะจงมา:</span>
                        </div>
                        <div className="space-y-1">
                          {selectedRequest.items.map((item, idx) => 
                            item.serialNumbers && item.serialNumbers.length > 0 && (
                              <div key={idx} className="text-sm text-orange-700">
                                <span className="font-medium">{item.itemName}:</span>{' '}
                                {item.serialNumbers.map((sn, snIdx) => (
                                  <span key={snIdx} className="inline-block bg-orange-100 px-2 py-1 rounded text-xs mr-1">
                                    {sn}
                                  </span>
                                ))}
                              </div>
                            )
                          )}
                        </div>
                        <p className="text-xs text-orange-600 mt-2">
                          💡 ระบบจะล็อค Serial Numbers เหล่านี้ให้อัตโนมัติ (หากมีในคลัง)
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowSelectionModal(false);
                      setSelectedRequest(null);
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
                    {Object.keys(itemSelections).length > 0 && (
                      <span>
                        เลือกแล้ว: {Object.values(itemSelections).reduce((total, items) => total + items.length, 0)} ชิ้น
                      </span>
                    )}
                  </div>
                  <div className="flex justify-center items-center space-x-6">
                    {/* ปุ่มลบคำขอ */}
                    <button
                      onClick={() => selectedRequest && handleDeleteRequest(selectedRequest._id)}
                      className="px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 hover:bg-red-50 hover:border-red-400 shadow-sm"
                    >
                      🗑️ ลบคำขอ
                    </button>
                    
                    {/* ปุ่มยกเลิก */}
                    <button
                      onClick={() => {
                        setShowSelectionModal(false);
                        setSelectedRequest(null);
                        setItemSelections({});
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      ยกเลิก
                    </button>
                    
                    {/* ปุ่มอนุมัติและมอบหมาย */}
                    <button
                      onClick={handleApproveWithSelection}
                      disabled={!selectedRequest || Object.keys(itemSelections).length !== selectedRequest.items.length}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      อนุมัติและมอบหมาย
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirmModal && selectedRequest && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 transform transition-all">
              {/* Header */}
              <div className="bg-red-500 rounded-t-xl p-6 text-white">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">ลบคำขอเบิกอุปกรณ์</h3>
                    <p className="text-red-100 text-sm">การดำเนินการนี้ไม่สามารถยกเลิกได้</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="mb-4">
                  <p className="text-gray-700 mb-3">คุณแน่ใจหรือไม่ที่ต้องการลบคำขอนี้?</p>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm">
                      <div className="grid grid-cols-2 gap-2 text-gray-600">
                        <span className="font-medium">ผู้ขอ:</span>
                        <span>{selectedRequest.firstName} {selectedRequest.lastName}</span>
                        <span className="font-medium">วันที่ขอ:</span>
                        <span>{new Date(selectedRequest.requestDate).toLocaleDateString('th-TH')}</span>
                        <span className="font-medium">อุปกรณ์:</span>
                        <div className="space-y-1">
                          {selectedRequest.items.map((item, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium">{item.itemName}</span>
                              <span className="text-gray-500"> จำนวน: {item.quantity} ชิ้น</span>
                              {Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0 && (
                                <div className="ml-2 text-xs text-blue-600">
                                  SN ที่ขอ: {item.serialNumbers.join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700 font-medium">
                        ⚠️ คำเตือน: คำขอนี้จะถูกลบออกจากระบบถาวร
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 rounded-b-xl px-6 py-4 flex justify-between">
                {/* ปุ่มยกเลิกฝั่งซ้าย */}
                <button
                  onClick={() => setShowDeleteConfirmModal(false)}
                  className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors font-medium"
                >
                  ยกเลิก
                </button>
                
                {/* ปุ่มลบฝั่งขวา (ห่างจากปุ่มยกเลิก) */}
                <button
                  onClick={confirmDeleteRequest}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium shadow-lg"
                >
                  🗑️ ลบคำขอ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
