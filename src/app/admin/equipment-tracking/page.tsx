'use client';

import { useState, useEffect } from 'react';
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
  Hash
} from 'lucide-react';
import DatePicker from '@/components/DatePicker';
import { toast } from 'react-hot-toast';

interface EquipmentTracking {
  _id: string;
  requestId: string;
  firstName: string;
  lastName: string;
  nickname: string;
  department: string;
  office: string;
  phone: string;
  requestDate: string;
  deliveryLocation: string;
  urgency: string;
  reason: string;
  userId?: string;
  itemId: string;
  itemName: string;
  currentItemName: string;
  quantity: number;
  serialNumber?: string;
  category: string;
  submittedAt: string;
  source: 'request' | 'user-owned';
}

export default function AdminEquipmentTrackingPage() {
  const [trackingData, setTrackingData] = useState<EquipmentTracking[]>([]);
  const [filteredData, setFilteredData] = useState<EquipmentTracking[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [itemIdFilter, setItemIdFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15; // แสดงไม่เกิน 15 รายการต่อหน้า

  useEffect(() => {
    fetchTrackingData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [trackingData, searchTerm, userFilter, itemFilter, departmentFilter, officeFilter, dateFromFilter, dateToFilter, urgencyFilter, userIdFilter, itemIdFilter]);

  const fetchTrackingData = async () => {
    setLoading(true);
    try {
      // Build query parameters from filters
      const params = new URLSearchParams();
      if (userIdFilter) params.append('userId', userIdFilter);
      if (itemIdFilter) params.append('itemId', itemIdFilter);
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
    let filtered = trackingData.filter(record => {
      // Search filter (general search across multiple fields)
      const matchesSearch = !searchTerm || 
        record.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.office.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.phone.includes(searchTerm) ||
        record.currentItemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (record.serialNumber && record.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      // User filter
      const matchesUser = !userFilter || 
        `${record.firstName} ${record.lastName}`.toLowerCase().includes(userFilter.toLowerCase()) ||
        record.nickname.toLowerCase().includes(userFilter.toLowerCase());

      // Item filter
      const matchesItem = !itemFilter || 
        record.currentItemName.toLowerCase().includes(itemFilter.toLowerCase());

      // Department filter
      const matchesDepartment = !departmentFilter || record.department.includes(departmentFilter);

      // Office filter
      const matchesOffice = !officeFilter || record.office.includes(officeFilter);

      // Date filter
      const recordDate = new Date(record.requestDate);
      const matchesDateFrom = !dateFromFilter || recordDate >= new Date(dateFromFilter);
      const matchesDateTo = !dateToFilter || recordDate <= new Date(dateToFilter);

      // Urgency filter
      const matchesUrgency = !urgencyFilter || record.urgency === urgencyFilter;
      
      // User ID filter
      const matchesUserId = !userIdFilter || record.userId === userIdFilter;
      
      // Item ID filter
      const matchesItemId = !itemIdFilter || record.itemId === itemIdFilter;

      return matchesSearch && matchesUser && matchesItem && matchesDepartment && 
             matchesOffice && matchesDateFrom && matchesDateTo && matchesUrgency &&
             matchesUserId && matchesItemId;
    });

    setFilteredData(filtered);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setUserFilter('');
    setItemFilter('');
    setDepartmentFilter('');
    setOfficeFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setUrgencyFilter('');
    setUserIdFilter('');
    setItemIdFilter('');
  };

  // Get unique values for filters
  const users = [...new Set(trackingData.map(record => `${record.firstName} ${record.lastName} (${record.nickname})`))];
  const items = [...new Set(trackingData.map(record => record.currentItemName))];
  const departments = [...new Set(trackingData.map(record => record.department))];
  const offices = [...new Set(trackingData.map(record => record.office))];

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
          <div className="flex justify-between items-center mb-6  flex-col md:flex-row ">
            <div className="text-center md:text-left mb-5 md:mb-0">
              <h1 className="text-2xl font-bold text-gray-900">ติดตามอุปกรณ์</h1>
              <p className="text-gray-600 mt-1">
                {userIdFilter && itemIdFilter 
                  ? `ติดตามอุปกรณ์ Item ID: ${itemIdFilter} ที่ User ID: ${userIdFilter} ครอบครอง`
                  : userIdFilter 
                    ? `ติดตามอุปกรณ์ที่ User ID: ${userIdFilter} ครอบครอง`
                    : itemIdFilter 
                      ? `ติดตามอุปกรณ์ Item ID: ${itemIdFilter} ที่ผู้ใช้ครอบครอง`
                      : 'ค้นหาและติดตามว่าใครเบิกอุปกรณ์อะไรไป'
                }
              </p>
            </div>
            <div className="flex space-x-4">
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
                placeholder="ค้นหาผู้เบิก, อุปกรณ์, Serial Number, แผนก, สาขา..."
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
                    ผู้เบิก
                  </label>
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">ทั้งหมด</option>
                    {users.map((user) => (
                      <option key={user} value={user}>
                        {user}
                      </option>
                    ))}
                  </select>
                </div>
                
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
                    User ID
                  </label>
                  <input
                    type="text"
                    value={userIdFilter}
                    onChange={(e) => setUserIdFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="ระบุ User ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item ID
                  </label>
                  <input
                    type="text"
                    value={itemIdFilter}
                    onChange={(e) => setItemIdFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="ระบุ Item ID"
                  />
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
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่เริ่มต้น
                  </label>
                  <DatePicker
                    value={dateFromFilter}
                    onChange={(date) => setDateFromFilter(date)}
                    placeholder="dd/mm/yyyy"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่สิ้นสุด
                  </label>
                  <DatePicker
                    value={dateToFilter}
                    onChange={(date) => setDateToFilter(date)}
                    placeholder="dd/mm/yyyy"
                  />
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
                    <option value="very_urgent">ด่วนมาก</option>
                    <option value="normal">ปกติ</option>
                  </select>
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
          <div className="overflow-x-auto">
            {loading && (
              <div className="text-center py-12 text-gray-500">
                <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                กำลังโหลดข้อมูล
              </div>
            )}
            
            {!loading && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ชื่อ-นามสกุล (ชื่อเล่น)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      เบอร์โทร
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      แผนก
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ออฟฟิศ/สาขา
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      หมวดหมู่
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      อุปกรณ์ที่มี
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      จำนวน
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Serial Number
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        ไม่พบข้อมูล
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((record, index) => (
                      <tr key={`${record._id}-${index}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {record.firstName} {record.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                ({record.nickname})
                              </div>
                              {record.userId && (
                                <div className="text-xs text-gray-400">
                                  ID: {record.userId}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.phone || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.department || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.office || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.category === 'ไม่ระบุ' 
                              ? 'bg-gray-100 text-gray-800' 
                              : record.category === 'คอมพิวเตอร์และแล็ปท็อป'
                              ? 'bg-red-100 text-red-800'
                              : record.category === 'อุปกรณ์เสริม'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {record.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {record.currentItemName}
                              </div>
                              <div className="text-xs text-gray-500">
                                ID: {record.itemId}
                              </div>
                              <div className={`text-xs font-medium ${
                                record.source === 'user-owned' 
                                  ? 'text-orange-600 bg-orange-100 px-1 rounded' 
                                  : 'text-blue-600 bg-blue-100 px-1 rounded'
                              }`}>
                                {record.source === 'user-owned' ? 'อุปกรณ์ที่มีอยู่เดิม' : 'อุปกรณ์ที่เบิก'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.quantity > 1 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {record.quantity} ชิ้น
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.serialNumber ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                              {record.serialNumber}
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                              ไม่มี SN
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
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
                  {searchTerm || userFilter || itemFilter || departmentFilter || officeFilter || dateFromFilter || dateToFilter || urgencyFilter || userIdFilter || itemIdFilter
                    ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา'
                    : 'ยังไม่มีการเบิกอุปกรณ์หรืออุปกรณ์ที่มีอยู่เดิม'
                  }
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
