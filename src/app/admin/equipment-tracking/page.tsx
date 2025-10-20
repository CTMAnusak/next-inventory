'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  FileDown
} from 'lucide-react';
import DatePicker from '@/components/DatePicker';
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
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');
  const [dateAddedFilter, setDateAddedFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [deliveryLocationFilter, setDeliveryLocationFilter] = useState('');
  const [quantityFilter, setQuantityFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Drag scroll ref
  const tableContainerRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    fetchTrackingData();
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
  }, [trackingData, searchTerm, itemFilter, categoryFilter, detailFilter, statusFilter, conditionFilter, departmentFilter, officeFilter, dateAddedFilter, sourceFilter, deliveryLocationFilter, quantityFilter]);

  const fetchTrackingData = async () => {
    setLoading(true);
    try {
      // Build query parameters from filters
      const params = new URLSearchParams();
      if (departmentFilter) params.append('department', departmentFilter);
      if (officeFilter) params.append('office', officeFilter);
      
      const response = await fetch(`/api/admin/equipment-tracking?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTrackingData(data);
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
      // Search filter (general search across multiple fields)
      const matchesSearch = !searchTerm || 
        (record.firstName && record.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.lastName && record.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.nickname && record.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.department && record.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.office && record.office.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.phone && record.phone.includes(searchTerm)) ||
        record.currentItemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (record.serialNumber && record.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.numberPhone && record.numberPhone.includes(searchTerm)); // ✅ เพิ่มการค้นหาเบอร์โทรศัพท์

      // Item filter
      const matchesItem = !itemFilter || 
        record.currentItemName.toLowerCase().includes(itemFilter.toLowerCase());

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

      // Department filter
      const matchesDepartment = !departmentFilter || (record.department && record.department.includes(departmentFilter));

      // Office filter
      const matchesOffice = !officeFilter || (record.office && record.office.includes(officeFilter));

      // Date filter (based on dateAdded)
      const recordDate = new Date(record.dateAdded || record.requestDate);
      const matchesDateAdded = !dateAddedFilter || 
        recordDate.toDateString() === new Date(dateAddedFilter).toDateString();

      // Source filter (request or user-owned)
      const matchesSource = !sourceFilter || record.source === sourceFilter;

      // Delivery Location filter
      const matchesDeliveryLocation = !deliveryLocationFilter || 
        (record.deliveryLocation && record.deliveryLocation.toLowerCase().includes(deliveryLocationFilter.toLowerCase()));

      // Quantity filter
      const matchesQuantity = !quantityFilter || 
        record.quantity === parseInt(quantityFilter);

      return matchesSearch && matchesItem && matchesCategory && matchesDetail && matchesStatus && 
             matchesCondition && matchesDepartment && matchesOffice && 
             matchesDateAdded && matchesSource && matchesDeliveryLocation && matchesQuantity;
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
    setDepartmentFilter('');
    setOfficeFilter('');
    setDateAddedFilter('');
    setSourceFilter('');
    setDeliveryLocationFilter('');
    setQuantityFilter('');
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

  // Get unique values for filters
  const items = useMemo(() => {
    if (!Array.isArray(trackingData)) return [];
    return [...new Set(trackingData.map(record => record.currentItemName).filter(Boolean))];
  }, [trackingData]);

  const categories = useMemo(() => {
    if (!Array.isArray(trackingData)) return [];
    const categoryMap = new Map();
    trackingData.forEach(record => {
      const id = record.category;
      const name = record.categoryName || record.category;
      if (id && !categoryMap.has(id)) {
        categoryMap.set(id, { id, name });
      }
    });
    return Array.from(categoryMap.values());
  }, [trackingData]);

  const statuses = useMemo(() => {
    if (!Array.isArray(trackingData)) return [];
    const statusMap = new Map();
    trackingData.forEach(record => {
      const id = record.status;
      const name = record.statusName || record.status;
      if (id && !statusMap.has(id)) {
        statusMap.set(id, { id, name });
      }
    });
    return Array.from(statusMap.values());
  }, [trackingData]);

  const conditions = useMemo(() => {
    if (!Array.isArray(trackingData)) return [];
    const conditionMap = new Map();
    trackingData.forEach(record => {
      const id = record.condition;
      const name = record.conditionName || record.condition;
      if (id && !conditionMap.has(id)) {
        conditionMap.set(id, { id, name });
      }
    });
    return Array.from(conditionMap.values());
  }, [trackingData]);

  const departments = useMemo(() => {
    if (!Array.isArray(trackingData)) return [];
    return [...new Set(trackingData.map(record => record.department).filter(Boolean))];
  }, [trackingData]);

  const offices = useMemo(() => {
    if (!Array.isArray(trackingData)) return [];
    return [...new Set(trackingData.map(record => record.office).filter(Boolean))];
  }, [trackingData]);

  const deliveryLocations = useMemo(() => {
    if (!Array.isArray(trackingData)) return [];
    return [...new Set(trackingData.map(record => record.deliveryLocation).filter(Boolean))];
  }, [trackingData]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredData.slice(startIndex, endIndex);

  return (
    <Layout>
      <div className="max-w-full mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
          {/* Header */}
          <div className="flex justify-between items-center mb-6  flex-col lg:flex-row ">
            <div className="text-center lg:text-left mb-5 lg:mb-0">
              <h1 className="text-2xl font-bold text-gray-900">ติดตามอุปกรณ์</h1>
              <p className="text-gray-600 mt-1">
                ค้นหาและติดตามว่าใครเบิกอุปกรณ์อะไรไป
              </p>
            </div>
            <div className="flex justify-center space-x-0 sm:space-x-4 flex-wrap gap-4 sm:gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>ฟิลเตอร์</span>
              </button>
              <button
                onClick={fetchTrackingData}
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
                <FileDown className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Quick Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 h-5 w-5 text-gray-400 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-lg"
                placeholder="ค้นหาผู้เบิก, อุปกรณ์, Serial Number, เบอร์โทร, แผนก, สาขา..."
              />
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">ฟิลเตอร์ขั้นสูง</h3>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  ล้างฟิลเตอร์
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    อุปกรณ์
                  </label>
                  <select
                    value={itemFilter}
                    onChange={(e) => setItemFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">ทั้งหมด</option>
                    {items.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หมวดหมู่
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">ทั้งหมด</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
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
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">ทั้งหมด</option>
                    {statuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.name}
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
                      <option key={condition.id} value={condition.id}>
                        {condition.name}
                      </option>
                    ))}
                  </select>
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
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    แหล่งที่มา
                  </label>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="request">เบิกอุปกรณ์</option>
                    <option value="user-owned">เพิ่มอุปกรณ์ที่มี</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    สถานที่จัดส่ง
                  </label>
                  <select
                    value={deliveryLocationFilter}
                    onChange={(e) => setDeliveryLocationFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">ทั้งหมด</option>
                    {deliveryLocations.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
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
              <table className="min-w-full divide-y divide-gray-200">
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
                        
                        {/* 7. ชื่อ-นามสกุล (ชื่อเล่น) */}
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
                    แสดง {startIndex + 1} ถึง {Math.min(endIndex, filteredData.length)} จาก {filteredData.length} รายการอุปกรณ์
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
      </div>
    </Layout>
  );
}
