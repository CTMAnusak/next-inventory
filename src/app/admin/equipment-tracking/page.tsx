'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { enableDragScroll } from '@/lib/drag-scroll';
import Layout from '@/components/Layout';
import { 
  Search, 
  RefreshCw, 
  Filter,
  MapPin,
  User,
  Package,
  Calendar,
  Phone,
  Building,
  Hash,
  Upload
} from 'lucide-react';
import DatePicker from '@/components/DatePicker';
import SearchableSelect from '@/components/SearchableSelect';
import { toast } from 'react-hot-toast';
import { formatEquipmentTrackingDate } from '@/lib/thai-date-utils';
import * as XLSX from 'xlsx';

interface EquipmentTracking {
  _id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  nickname: string;
  department: string;
  office: string;
  phone: string;
  pendingDeletion?: boolean;
  userType?: 'individual' | 'branch'; // เพิ่มประเภทผู้ใช้
  itemId: string;
  itemName: string;
  currentItemName: string;
  quantity: number;
  serialNumber?: string;
  numberPhone?: string; // ✅ เพิ่มเบอร์โทรศัพท์สำหรับซิมการ์ด
  category: string;
  categoryId?: string; // ✅ เพิ่ม categoryId สำหรับเช็คประเภทอุปกรณ์
  categoryName?: string;
  status: string;
  statusName?: string;
  condition: string;
  conditionName?: string;
  source: 'request' | 'user-owned';
  dateAdded: string;
  requestDate: string;
  deliveryLocation: string;
  urgency: string;
  reason: string;
}

export default function AdminEquipmentTrackingPage() {
  const pathname = usePathname();
  const dataLoadedRef = useRef(false);
  const [trackingData, setTrackingData] = useState<EquipmentTracking[]>([]);
  const [filteredData, setFilteredData] = useState<EquipmentTracking[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [detailFilter, setDetailFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState(''); // ประเภทผู้ใช้
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');
  const [dateAddedFilter, setDateAddedFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [deliveryLocationFilter, setDeliveryLocationFilter] = useState('');
  const [quantityFilter, setQuantityFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState(''); // เดือน (1-12)
  const [yearFilter, setYearFilter] = useState(''); // ปี พ.ศ.

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;
  
  // Drag scroll ref
  const tableContainerRef = useRef<HTMLDivElement>(null);


  // ✅ Reset data loaded flag when pathname changes (navigation to this page)
  useEffect(() => {
    dataLoadedRef.current = false;
  }, [pathname]);

  useEffect(() => {
    if (!dataLoadedRef.current) {
      dataLoadedRef.current = true;
      fetchTrackingData(1);
    }
  }, [pathname]);

  // Initialize drag scrolling
  useEffect(() => {
    const element = tableContainerRef.current;
    if (!element) return;

    const cleanup = enableDragScroll(element);
    return cleanup;
  }, []);

  useEffect(() => {
    applyFilters();
  }, [trackingData, searchTerm, itemFilter, categoryFilter, detailFilter, statusFilter, conditionFilter, userTypeFilter, departmentFilter, officeFilter, dateAddedFilter, sourceFilter, deliveryLocationFilter, quantityFilter, monthFilter, yearFilter]);

  const fetchTrackingData = async (page: number = 1) => {
    setLoading(true);
    try {
      // Build query parameters from filters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      });
      
      if (departmentFilter) params.append('department', departmentFilter);
      if (officeFilter) params.append('office', officeFilter);
      
      const response = await fetch(`/api/admin/equipment-tracking?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTrackingData(data.data || data); // Support both old and new format
        setCurrentPage(page);
        
        // Handle pagination data if available
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages);
          setTotalItems(data.pagination.totalItems);
        } else {
          // Fallback for old format
          setTotalPages(Math.ceil((data.data || data).length / itemsPerPage));
          setTotalItems((data.data || data).length);
        }
      } else {
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };



    const applyFilters = () => {
    if (!Array.isArray(trackingData)) return; // Ensure trackingData is an array
    let filtered = trackingData.filter(record => {
      // Search filter - ค้นหาเฉพาะ: ชื่อ, นามสกุล, ชื่อเล่น
      const matchesSearch = !searchTerm || 
        (record.firstName && record.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.lastName && record.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.nickname && record.nickname.toLowerCase().includes(searchTerm.toLowerCase()));

      // Item filter - ✅ แก้ไข: ใช้ exact match แทน substring
      const matchesItem = !itemFilter || 
        record.currentItemName.toLowerCase() === itemFilter.toLowerCase();

      // Category filter
      const matchesCategory = !categoryFilter || record.category === categoryFilter;

      // Detail filter (Serial Number or Phone Number)
      const matchesDetail = !detailFilter || 
        (record.serialNumber && record.serialNumber.toLowerCase().includes(detailFilter.toLowerCase())) ||
        (record.numberPhone && record.numberPhone.includes(detailFilter));

      // Status filter
      const matchesStatus = !statusFilter || record.status === statusFilter;

      // Condition filter
      const matchesCondition = !conditionFilter || record.condition === conditionFilter;

      // User Type filter
      const matchesUserType = !userTypeFilter || record.userType === userTypeFilter;

      // Department filter - ✅ แก้ไข: ใช้ exact match แทน substring
      const matchesDepartment = !departmentFilter || (record.department && record.department.toLowerCase() === departmentFilter.toLowerCase());

      // Office filter - ✅ แก้ไข: ใช้ exact match แทน substring
      const matchesOffice = !officeFilter || (record.office && record.office.toLowerCase() === officeFilter.toLowerCase());

      // Date filter (based on dateAdded)
      const recordDate = new Date(record.dateAdded || record.requestDate);
      const matchesDateAdded = !dateAddedFilter || 
        recordDate.toDateString() === new Date(dateAddedFilter).toDateString();

      // Source filter (request or user-owned)
      const matchesSource = !sourceFilter || record.source === sourceFilter;

      // Delivery Location filter - ✅ แก้ไข: ใช้ exact match แทน substring
      const matchesDeliveryLocation = !deliveryLocationFilter || 
        (record.deliveryLocation && record.deliveryLocation.toLowerCase() === deliveryLocationFilter.toLowerCase());

      // Quantity filter
      const matchesQuantity = !quantityFilter || 
        record.quantity === parseInt(quantityFilter);

      // Month and Year filter (ช่วงเวลา)
      let matchesMonthYear = true;
      if (monthFilter || yearFilter) {
        const recordDate = new Date(record.dateAdded || record.requestDate);
        const recordMonth = recordDate.getMonth() + 1; // 1-12
        const recordYearBE = recordDate.getFullYear() + 543; // พ.ศ.
        
        if (monthFilter && parseInt(monthFilter) !== recordMonth) {
          matchesMonthYear = false;
        }
        if (yearFilter && parseInt(yearFilter) !== recordYearBE) {
          matchesMonthYear = false;
        }
      }

      return matchesSearch && matchesItem && matchesCategory && matchesDetail && matchesStatus && 
             matchesCondition && matchesUserType && matchesDepartment && matchesOffice && 
             matchesDateAdded && matchesSource && matchesDeliveryLocation && matchesQuantity && matchesMonthYear;
    });

    setFilteredData(filtered);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setItemFilter('');
    setCategoryFilter('');
    setDetailFilter('');
    setStatusFilter('');
    setConditionFilter('');
    setUserTypeFilter('');
    setDepartmentFilter('');
    setOfficeFilter('');
    setDateAddedFilter('');
    setSourceFilter('');
    setDeliveryLocationFilter('');
    setQuantityFilter('');
    setMonthFilter('');
    setYearFilter('');
    setCurrentPage(1);
    fetchTrackingData(1);
  };

  const handleExportExcel = () => {
    try {
      // Prepare data for Excel export
      const exportData = filteredData.map((record, index) => {
        const dateObj = new Date(record.dateAdded || record.requestDate);
        const { dateString, timeString } = formatEquipmentTrackingDate(dateObj);
        
        const isSimCard = record.categoryId === 'cat_sim_card';
        let details = '';
        if (isSimCard && record.numberPhone) {
          details = record.numberPhone;
        } else if (record.serialNumber) {
          details = record.serialNumber;
        } else {
          details = 'ไม่มี SN/เบอร์';
        }

        return {
          'ลำดับ': index + 1,
          'หมวดหมู่': record.categoryName || record.category || 'ไม่ระบุ',
          'อุปกรณ์': record.currentItemName,
          'รายละเอียด (SN/เบอร์)': details,
          'สถานะ': record.statusName || record.status || 'ไม่ระบุ',
          'สภาพ': record.conditionName || record.condition || 'ไม่ระบุ',
          'วันที่เพิ่มอุปกรณ์': `${dateString} ${timeString}`,
          'ประเภทผู้ใช้': record.userType === 'branch' ? 'สาขา' : 'บุคคล',
          'ชื่อ': record.firstName || '-',
          'นามสกุล': record.lastName || '-',
          'ชื่อเล่น': record.nickname || '-',
          'แผนก': record.department || '-',
          'ออฟฟิศ/สาขา': record.office || '-',
          'เบอร์โทร': record.phone || '-',
          'สถานที่จัดส่ง': record.deliveryLocation || '-',
          'จำนวน': record.quantity,
          'แหล่งที่มา': record.source === 'request' ? 'เบิกอุปกรณ์' : 'ผู้ใช้ (dashboard)',
        };
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 8 },  // ลำดับ
        { wch: 25 }, // หมวดหมู่
        { wch: 20 }, // อุปกรณ์
        { wch: 20 }, // รายละเอียด
        { wch: 12 }, // สถานะ
        { wch: 12 }, // สภาพ
        { wch: 22 }, // วันที่เพิ่มอุปกรณ์
        { wch: 12 }, // ประเภทผู้ใช้
        { wch: 15 }, // ชื่อ
        { wch: 15 }, // นามสกุล
        { wch: 12 }, // ชื่อเล่น
        { wch: 20 }, // แผนก
        { wch: 20 }, // ออฟฟิศ/สาขา
        { wch: 15 }, // เบอร์โทร
        { wch: 20 }, // สถานที่จัดส่ง
        { wch: 10 }, // จำนวน
        { wch: 18 }, // แหล่งที่มา
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ติดตามอุปกรณ์');

      // Generate filename with current date
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
      
      const filename = `ติดตามอุปกรณ์_${dateStr}_${timeStr}.xlsx`;

      // Export to file
      XLSX.writeFile(wb, filename);
      
      toast.success(`ส่งออกข้อมูล ${filteredData.length} รายการสำเร็จ`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    }
  };

  // Get unique values for filters (formatted for SearchableSelect)
  const itemOptions = useMemo(() => {
    if (!Array.isArray(trackingData)) return [];
    // ✅ แก้ไข: normalize case เพื่อป้องกันรายการซ้ำ
    const itemMap = new Map<string, string>();
    trackingData.map(record => record.currentItemName).filter(Boolean).forEach(item => {
      const normalized = item.toLowerCase();
      if (!itemMap.has(normalized)) {
        itemMap.set(normalized, item); // เก็บค่าแรกที่พบ (original case)
      }
    });
    const uniqueItems = Array.from(itemMap.values()).sort((a, b) => a.localeCompare(b, 'th'));
    return uniqueItems.map(item => ({ value: item, label: item }));
  }, [trackingData]);

  const categoryOptions = useMemo(() => {
    if (!Array.isArray(trackingData)) return [];
    const categoryMap = new Map();
    trackingData.forEach(record => {
      const id = record.category;
      const name = record.categoryName || record.category;
      if (id && !categoryMap.has(id)) {
        categoryMap.set(id, { value: id, label: name });
      }
    });
    return Array.from(categoryMap.values());
  }, [trackingData]);

  const statusOptions = useMemo(() => {
    if (!Array.isArray(trackingData)) return [];
    const statusMap = new Map();
    trackingData.forEach(record => {
      const id = record.status;
      const name = record.statusName || record.status;
      if (id && !statusMap.has(id)) {
        statusMap.set(id, { value: id, label: name });
      }
    });
    return Array.from(statusMap.values());
  }, [trackingData]);

  const conditionOptions = useMemo(() => {
    if (!Array.isArray(trackingData)) return [];
    const conditionMap = new Map();
    trackingData.forEach(record => {
      const id = record.condition;
      const name = record.conditionName || record.condition;
      if (id && !conditionMap.has(id)) {
        conditionMap.set(id, { value: id, label: name });
      }
    });
    return Array.from(conditionMap.values());
  }, [trackingData]);

  const departmentOptions = useMemo(() => {
    if (!Array.isArray(trackingData)) return [];
    // ✅ แก้ไข: normalize case เพื่อป้องกันรายการซ้ำ
    const deptMap = new Map<string, string>();
    trackingData.map(record => record.department).filter(Boolean).forEach(dept => {
      const normalized = dept.toLowerCase();
      if (!deptMap.has(normalized)) {
        deptMap.set(normalized, dept); // เก็บค่าแรกที่พบ (original case)
      }
    });
    const uniqueDepts = Array.from(deptMap.values()).sort((a, b) => a.localeCompare(b, 'th'));
    return uniqueDepts.map(dept => ({ value: dept, label: dept }));
  }, [trackingData]);

  const officeOptions = useMemo(() => {
    if (!Array.isArray(trackingData)) return [];
    // ✅ แก้ไข: normalize case เพื่อป้องกันรายการซ้ำ
    const officeMap = new Map<string, string>();
    trackingData.map(record => record.office).filter(Boolean).forEach(office => {
      const normalized = office.toLowerCase();
      if (!officeMap.has(normalized)) {
        officeMap.set(normalized, office); // เก็บค่าแรกที่พบ (original case)
      }
    });
    const uniqueOffices = Array.from(officeMap.values()).sort((a, b) => a.localeCompare(b, 'th'));
    return uniqueOffices.map(office => ({ value: office, label: office }));
  }, [trackingData]);

  const deliveryLocationOptions = useMemo(() => {
    if (!Array.isArray(trackingData)) return [];
    // ✅ แก้ไข: normalize case เพื่อป้องกันรายการซ้ำ
    const locationMap = new Map<string, string>();
    trackingData.map(record => record.deliveryLocation).filter(Boolean).forEach(location => {
      const normalized = location.toLowerCase();
      if (!locationMap.has(normalized)) {
        locationMap.set(normalized, location); // เก็บค่าแรกที่พบ (original case)
      } else {
        // ✅ ถ้าค่าใหม่ขึ้นต้นด้วยตัวพิมพ์ใหญ่ ให้เปลี่ยนเป็นค่าใหม่
        const existingValue = locationMap.get(normalized)!;
        if (location.charAt(0) === location.charAt(0).toUpperCase() && 
            existingValue.charAt(0) === existingValue.charAt(0).toLowerCase()) {
          locationMap.set(normalized, location);
        }
      }
    });
    const uniqueLocations = Array.from(locationMap.values()).sort((a, b) => a.localeCompare(b, 'th'));
    return uniqueLocations.map(location => ({ value: location, label: location }));
  }, [trackingData]);

  // Month and Year options
  const monthOptions = useMemo(() => {
    const months = [
      { value: '1', label: 'ม.ค.' }, { value: '2', label: 'ก.พ.' }, { value: '3', label: 'มี.ค.' },
      { value: '4', label: 'เม.ย.' }, { value: '5', label: 'พ.ค.' }, { value: '6', label: 'มิ.ย.' },
      { value: '7', label: 'ก.ค.' }, { value: '8', label: 'ส.ค.' }, { value: '9', label: 'ก.ย.' },
      { value: '10', label: 'ต.ค.' }, { value: '11', label: 'พ.ย.' }, { value: '12', label: 'ธ.ค.' }
    ];
    return months;
  }, []);

  const yearOptions = useMemo(() => {
    const currentYearBE = new Date().getFullYear() + 543; // ปีปัจจุบัน พ.ศ.
    const startYear = 2550;
    const years = [];
    for (let year = currentYearBE; year >= startYear; year--) {
      years.push({ value: year.toString(), label: year.toString() });
    }
    return years;
  }, []);

  // Pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredData.slice(startIndex, endIndex);

  return (
    <Layout>
      <div className="max-w-full mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl px-4 py-6 md:p-8 border border-white/50">
          {/* Header */}
          <div className="flex justify-between items-center mb-6  flex-col xl:flex-row ">
            <div className="text-center xl:text-left mb-5 xl:mb-0">
              <h1 className="text-2xl font-semibold text-gray-900">ติดตามอุปกรณ์</h1>
              <p className="text-gray-600 mt-1">
                ค้นหาและติดตามว่าใครเบิกอุปกรณ์อะไรไป
              </p>
            </div>
            <div className="flex flex-col sm:flex-row justify-center space-x-0 sm:space-x-2 flex-wrap gap-2 w-4/5 min-[401px]:w-3/5 min-[640px]:w-auto">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>ฟิลเตอร์</span>
              </button>
              <button
                onClick={() => fetchTrackingData(1)}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>รีเฟรช</span>
              </button>
              <button
                onClick={handleExportExcel}
                disabled={loading || filteredData.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={filteredData.length === 0 ? 'ไม่มีข้อมูลให้ Export' : 'Export ข้อมูลเป็น Excel'}
              >
                <Upload className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Quick Search */}
          <div className="mb-6 w-full sm:w-lg xl:w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ค้นหาชื่อผู้เบิก
              </label>
              <div className="relative">
                <Search className="absolute left-3 h-5 w-5 text-gray-400 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="ชื่อ, นามสกุล, ชื่อเล่น"
                />
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="bg-gray-100 rounded-lg p-6 mb-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">ฟิลเตอร์ขั้นสูง</h3>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  ล้างฟิลเตอร์
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    อุปกรณ์
                  </label>
                  <SearchableSelect
                    options={itemOptions}
                    value={itemFilter}
                    onChange={setItemFilter}
                    placeholder="ทั้งหมด"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หมวดหมู่
                  </label>
                  <SearchableSelect
                    options={categoryOptions}
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    placeholder="ทั้งหมด"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    รายละเอียด
                  </label>
                  <input
                    type="text"
                    value={detailFilter}
                    onChange={(e) => setDetailFilter(e.target.value)}
                    placeholder="Serial Number / เบอร์โทร"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    สถานะ
                  </label>
                  <SearchableSelect
                    options={statusOptions}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    placeholder="ทั้งหมด"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    สภาพ
                  </label>
                  <SearchableSelect
                    options={conditionOptions}
                    value={conditionFilter}
                    onChange={setConditionFilter}
                    placeholder="ทั้งหมด"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    จำนวน
                  </label>
                  <input
                    type="number"
                    value={quantityFilter}
                    onChange={(e) => setQuantityFilter(e.target.value)}
                    placeholder="ทั้งหมด"
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ประเภทผู้ใช้
                  </label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'ทั้งหมด' },
                      { value: 'branch', label: 'สาขา' },
                      { value: 'individual', label: 'บุคคล' }
                    ]}
                    value={userTypeFilter}
                    onChange={setUserTypeFilter}
                    placeholder="ทั้งหมด"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    แผนก
                  </label>
                  <SearchableSelect
                    options={departmentOptions}
                    value={departmentFilter}
                    onChange={setDepartmentFilter}
                    placeholder="ทั้งหมด"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    สาขา
                  </label>
                  <SearchableSelect
                    options={officeOptions}
                    value={officeFilter}
                    onChange={setOfficeFilter}
                    placeholder="ทั้งหมด"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    แหล่งที่มา
                  </label>
                  <SearchableSelect
                    options={[
                      { value: 'request', label: 'เบิกอุปกรณ์' },
                      { value: 'user-owned', label: 'เพิ่มอุปกรณ์ที่มี' }
                    ]}
                    value={sourceFilter}
                    onChange={setSourceFilter}
                    placeholder="ทั้งหมด"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    สถานที่จัดส่ง
                  </label>
                  <SearchableSelect
                    options={deliveryLocationOptions}
                    value={deliveryLocationFilter}
                    onChange={setDeliveryLocationFilter}
                    placeholder="ทั้งหมด"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่เพิ่มอุปกรณ์
                  </label>
                  <DatePicker
                    value={dateAddedFilter}
                    onChange={(date) => setDateAddedFilter(date)}
                  />
                </div>

                {/* Period Filter (ช่วงเวลา) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ช่วงเวลา
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <SearchableSelect
                        options={monthOptions}
                        value={monthFilter}
                        onChange={setMonthFilter}
                        placeholder="เดือน"
                      />
                    </div>
                    <div>
                      <SearchableSelect
                        options={yearOptions}
                        value={yearFilter}
                        onChange={setYearFilter}
                        placeholder="ปี พ.ศ."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Summary */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 gap-4">
            <div className="text-sm text-gray-600">
              พบ {filteredData.length} รายการอุปกรณ์ จากทั้งหมด {trackingData.length} รายการ (รวมอุปกรณ์ที่เบิกและอุปกรณ์ที่มีอยู่เดิม)
            </div>
          </div>

          {/* Equipment Tracking Table */}
          <div ref={tableContainerRef} className="table-container">
            {loading && (
              <div className="text-center py-8 text-gray-500">
                <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                กำลังโหลดข้อมูล
              </div>
            )}
            
            {!loading && (
              <table className="min-w-[140%] divide-y divide-gray-200">
                <thead className="bg-blue-600">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      หมวดหมู่
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      อุปกรณ์
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      รายละเอียด
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      สถานะ
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      สภาพ
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      วันที่เพิ่มอุปกรณ์
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      ประเภทผู้ใช้
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      ชื่อ-นามสกุล (ชื่อเล่น)
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
                      สถานที่จัดส่ง
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      จำนวน
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      แหล่งที่มา
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentItems.map((record, index) => (
                      <tr key={`${record._id}-${index}`} className={`hover:bg-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}`}>
                        {/* 1. หมวดหมู่ */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            (record.categoryName || record.category) === 'ไม่ระบุ' 
                              ? 'bg-gray-100 text-gray-800' 
                              : (record.categoryName || record.category) === 'คอมพิวเตอร์และแล็ปท็อป'
                              ? 'bg-red-100 text-red-800'
                              : (record.categoryName || record.category) === 'อุปกรณ์เสริม'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {record.categoryName || record.category}
                          </span>
                        </td>
                        
                        {/* 2. อุปกรณ์ */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-gray-900 flex justify-center">
                            {record.currentItemName}
                          </div>
                        </td>
                        
                        {/* 3. รายละเอียด (Serial Number / เบอร์โทรศัพท์) */}
                        <td className="px-6 py-4 text-sm text-gray-900 text-selectable text-center">
                          {(() => {
                            const isSimCard = record.categoryId === 'cat_sim_card';
                            
                            // ✅ ถ้าเป็นซิมการ์ดและมีเบอร์โทร แสดงเบอร์โทร
                            if (isSimCard && record.numberPhone) {
                              return (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                  {record.numberPhone}
                                </span>
                              );
                            }
                            // ✅ ถ้ามี Serial Number แสดง SN
                            else if (record.serialNumber) {
                              return (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                  {record.serialNumber}
                                </span>
                              );
                            }
                            // ✅ ถ้าไม่มีทั้ง SN และเบอร์โทร
                            else {
                              return (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                                  ไม่มี SN/เบอร์
                                </span>
                              );
                            }
                          })()}
                        </td>
                        
                        {/* 4. สถานะ */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.statusName === 'มี' 
                              ? 'bg-green-100 text-green-800' 
                              : record.statusName === 'หาย'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {record.statusName || record.status || 'ไม่ระบุ'}
                          </span>
                        </td>
                        
                        {/* 5. สภาพ */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.conditionName === 'ใช้งานได้' 
                              ? 'bg-blue-100 text-blue-800' 
                              : record.conditionName === 'ชำรุด'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {record.conditionName || record.condition || 'ไม่ระบุ'}
                          </span>
                        </td>
                        
                        {/* 6. วันที่เพิ่มอุปกรณ์ */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                          <div className="flex flex-col items-center">
                            {(() => {
                              const dateObj = new Date(record.dateAdded || record.requestDate);
                              const { dateString, timeString } = formatEquipmentTrackingDate(dateObj);
                              return (
                                <>
                                  <span className="font-medium">
                                    {dateString}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {timeString}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </td>
                        
                        {/* 7. ประเภทผู้ใช้ */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            record.userType === 'branch' 
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-green-100 text-green-800 border border-green-300'
                          }`}>
                            {record.userType === 'branch' ? 'สาขา' : 'บุคคล'}
                          </span>
                        </td>
                        
                        {/* 8. ชื่อ-นามสกุล (ชื่อเล่น) */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center">
                            <div className="text-center">
                              <div className={`text-sm font-medium ${
                                record.pendingDeletion 
                                  ? 'text-orange-600' 
                                  : !record.firstName 
                                  ? 'text-gray-500' 
                                  : 'text-gray-900'
                              }`}>
                                {record.firstName && record.lastName ? (
                                  <>
                                    {record.firstName} {record.lastName}
                                    {record.pendingDeletion && ' (รอลบ)'}
                                  </>
                                ) : (
                                  '-'
                                )}
                              </div>
                              {record.nickname && (
                                <div className="text-sm text-gray-500">
                                  ({record.nickname})
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        
                        {/* 8. แผนก */}
                        <td 
                          className="px-6 py-4 text-sm text-gray-900 text-selectable text-center"
                          style={{ userSelect: 'text', cursor: 'text' }}
                        >
                          {record.department || '-'}
                        </td>
                        
                        {/* 9. ออฟฟิศ/สาขา */}
                        <td 
                          className="px-6 py-4 text-sm text-gray-900 text-selectable text-center"
                          style={{ userSelect: 'text', cursor: 'text' }}
                        >
                          {record.office || '-'}
                        </td>
                        
                        {/* 10. เบอร์โทร */}
                        <td 
                          className="px-6 py-4 text-sm text-gray-900 text-selectable text-center"
                          style={{ userSelect: 'text', cursor: 'text' }}
                        >
                          {record.phone || '-'}
                        </td>
                        
                        {/* 11. สถานที่จัดส่ง */}
                        <td 
                          className="px-6 py-4 text-sm text-gray-900 text-selectable text-center"
                          style={{ userSelect: 'text', cursor: 'text' }}
                        >
                          <div className="flex items-center justify-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              record.source === 'request' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {record.deliveryLocation || '-'}
                            </span>
                          </div>
                        </td>
                        
                        {/* 12. จำนวน */}
                        <td className="px-6 py-4 text-sm text-gray-900 text-selectable text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.quantity > 1 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {record.quantity} ชิ้น
                          </span>
                        </td>
                        
                        {/* 13. แหล่งที่มา */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.source === 'request' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {record.source === 'request' ? '🔵 เบิกอุปกรณ์' : '🟠 ผู้ใช้ (dashboard)'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Empty State */}
          {currentItems.length === 0 && !loading && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">ไม่พบข้อมูล</h3>
                              <p className="text-gray-600">
                  {searchTerm || itemFilter || categoryFilter || statusFilter || conditionFilter || departmentFilter || officeFilter || dateAddedFilter || sourceFilter
                    ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา'
                    : 'ยังไม่มีการเบิกอุปกรณ์หรืออุปกรณ์ที่มีอยู่เดิม'
                  }
                </p>
            </div>
          )}

          {/* Total Count */}
          {!loading && filteredData.length > 0 && (
            <div className="mt-4 text-left">
              <p className="text-sm text-gray-600">
                แสดงทั้งหมด {filteredData.length} รายการ
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
                              <div className="flex items-center text-sm text-gray-700">
                  <span>
                    แสดง {startIndex + 1} ถึง {Math.min(endIndex, totalItems)} จาก {totalItems} รายการอุปกรณ์
                  </span>
                </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const newPage = Math.max(currentPage - 1, 1);
                    setCurrentPage(newPage);
                    fetchTrackingData(newPage);
                  }}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ←
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => {
                      setCurrentPage(page);
                      fetchTrackingData(page);
                    }}
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
                  onClick={() => {
                    const newPage = Math.min(currentPage + 1, totalPages);
                    setCurrentPage(newPage);
                    fetchTrackingData(newPage);
                  }}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
