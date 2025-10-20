'use client';

import { useState, useEffect, useRef } from 'react';
import { enableDragScroll } from '@/lib/drag-scroll';
import Layout from '@/components/Layout';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Edit, 
  Trash2, 
  Filter,
  X,
  Save,
  User as UserIcon,
  Building,
  Phone,
  Mail,
  Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { customToast } from '@/lib/custom-toast';
import * as XLSX from 'xlsx';

interface User {
  _id?: string; // MongoDB _id (for compatibility)
  user_id?: string; // User ID ที่แสดงให้ user เห็น
  firstName: string;
  lastName: string;
  nickname?: string;
  department?: string;
  office: string;
  phone?: string;
  email: string;
  userType: 'individual' | 'branch';
  isMainAdmin?: boolean;
  userRole: 'user' | 'admin' | 'it_admin';
  registrationMethod?: 'manual' | 'google';
  googleId?: string;
  profilePicture?: string;
  isApproved?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  profileCompleted?: boolean;
  
  // Fields สำหรับการลบ user
  pendingDeletion?: boolean;
  pendingDeletionReason?: string;
  pendingDeletionRequestedBy?: string;
  pendingDeletionRequestedAt?: string;
  
  createdAt: string;
}

interface UserFormData {
  firstName: string;
  lastName: string;
  nickname: string;
  department: string;
  office: string;
  phone: string;
  email: string;
  password: string;
  userType: 'individual' | 'branch';
  userRole: 'user' | 'admin' | 'it_admin';
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [filteredPendingUsers, setFilteredPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'approved' | 'pending'>('approved');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvingUser, setApprovingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<'user' | 'admin' | 'it_admin'>('user');
  const [isApproving, setIsApproving] = useState(false);
  
  // States สำหรับ pending deletion popup
  const [showPendingDeletionModal, setShowPendingDeletionModal] = useState(false);
  const [pendingDeletionUser, setPendingDeletionUser] = useState<User | null>(null);
  const [userEquipment, setUserEquipment] = useState<any[]>([]);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');

  // Form data
  const [formData, setFormData] = useState<UserFormData>({
    firstName: '',
    lastName: '',
    nickname: '',
    department: '',
    office: '',
    phone: '',
    email: '',
    password: '',
    userType: 'individual',
    userRole: 'user'
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Drag scroll ref
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUsers();
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
  }, [users, pendingUsers, searchTerm, userTypeFilter, officeFilter, activeTab]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        // แยก users ตามสถานะ isApproved
        const approvedUsers = data.filter((user: User) => user.isApproved !== false);
        const pendingUsersData = data.filter((user: User) => user.isApproved === false);
        
        setUsers(approvedUsers);
        setPendingUsers(pendingUsersData);
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
    const sourceData = activeTab === 'approved' ? users : pendingUsers;
    
    let filtered = sourceData.filter(user => {
      const matchesSearch = !searchTerm || 
        user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.nickname && user.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.office.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.department && user.department.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesUserType = !userTypeFilter || user.userType === userTypeFilter;
      const matchesOffice = !officeFilter || user.office.includes(officeFilter);

      return matchesSearch && matchesUserType && matchesOffice;
    });

    // Sort by creation date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (activeTab === 'approved') {
      setFilteredUsers(filtered);
    } else {
      setFilteredPendingUsers(filtered);
    }
    setCurrentPage(1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Validation for phone number
    if (name === 'phone') {
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

  const validateForm = () => {
    // Check required fields based on user type
    if (formData.userType === 'individual') {
      if (!formData.firstName || !formData.lastName || !formData.nickname || 
          !formData.department || !formData.office || !formData.phone || 
          !formData.email || (!editingUser && !formData.password)) {
        toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
        return false;
      }
    } else {
      if (!formData.office || !formData.phone || !formData.email || 
          (!editingUser && !formData.password)) {
        toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
        return false;
      }
    }

    // Validate phone number
    if (formData.phone && formData.phone.length !== 10) {
      toast.error('เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น');
      return false;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('รูปแบบอีเมลล์ไม่ถูกต้อง');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      const url = editingUser ? `/api/admin/users/${editingUser._id}` : '/api/admin/users';
      const method = editingUser ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(editingUser ? 'อัพเดตข้อมูลเรียบร้อยแล้ว' : 'เพิ่มผู้ใช้เรียบร้อยแล้ว');
        await fetchUsers();
        resetForm();
        setShowAddModal(false);
        setShowEditModal(false);
      } else {
        const data = await response.json();
        // Check if it's a duplicate error with multiple fields
        if (data.duplicateFields && data.duplicateFields.length > 1) {
          // Show detailed error for multiple duplicates
          const errorList = data.duplicateFields.map((field: string) => `• ${field}`).join('\n');
          customToast.error(`${editingUser ? 'ไม่สามารถอัพเดตผู้ใช้ได้' : 'ไม่สามารถสร้างผู้ใช้ได้'} เนื่องจาก:\n${errorList}`, { 
            duration: 15000, // เพิ่มเวลาเพราะมีข้อมูลเยอะ
            style: {
              whiteSpace: 'pre-line',
              textAlign: 'left',
              maxWidth: '600px',
              lineHeight: '1.6',
              padding: '20px',
              paddingRight: '40px', // เผื่อที่สำหรับปุ่มปิด
            },
            dismissible: true, // ให้สามารถปิดได้
          });
        } else {
          // Show simple error for single duplicate or other errors
          customToast.error(data.error || 'เกิดข้อผิดพลาด', { 
            duration: 10000,
            style: {
              maxWidth: '500px',
              padding: '18px',
              paddingRight: '40px', // เผื่อที่สำหรับปุ่มปิด
            },
            dismissible: true, // ให้สามารถปิดได้
          });
        }
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      nickname: user.nickname || '',
      department: user.department || '',
      office: user.office,
      phone: user.phone || '',
      email: user.email,
      password: '',
      userType: user.userType,
      userRole: user.userRole
    });
    setShowEditModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณต้องการลบผู้ใช้นี้หรือไม่?')) return;

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        if (data.pendingDeletion) {
          toast.success('ผู้ใช้ถูกทำเครื่องหมายรอลบ กรุณาตรวจสอบการคืนอุปกรณ์');
        } else {
          toast.success('ลบผู้ใช้เรียบร้อยแล้ว');
        }
        await fetchUsers();
      } else {
        // ตรวจสอบว่ามีอุปกรณ์ครอบครองหรือไม่
        if (data.hasEquipment && data.equipmentList) {
          const equipmentCount = data.equipmentCount || 0;
          const equipmentItems = data.equipmentList.slice(0, 5); // แสดงแค่ 5 รายการแรก
          const remainingCount = equipmentCount - equipmentItems.length;
          
          // สร้างข้อความแสดงรายการอุปกรณ์
          let equipmentMessage = `❌ ไม่สามารถลบผู้ใช้ได้\n\n`;
          equipmentMessage += `🔴 ผู้ใช้นี้ยังมีอุปกรณ์ครอบครองอยู่ ${equipmentCount} รายการ\n`;
          equipmentMessage += `กรุณาให้ผู้ใช้คืนอุปกรณ์ทั้งหมดก่อนลบบัญชี\n\n`;
          equipmentMessage += `📦 อุปกรณ์ที่ต้องคืน:\n`;
          equipmentItems.forEach((item: string, index: number) => {
            equipmentMessage += `  ${index + 1}. ${item}\n`;
          });
          
          if (remainingCount > 0) {
            equipmentMessage += `  ... และอีก ${remainingCount} รายการ\n`;
          }
          
          // แสดง contact info ถ้ามี
          if (data.userContact) {
            equipmentMessage += `\n📞 ข้อมูลติดต่อผู้ใช้:\n`;
            equipmentMessage += `  • ชื่อ: ${data.userContact.name}\n`;
            equipmentMessage += `  • สำนักงาน: ${data.userContact.office}\n`;
            equipmentMessage += `  • โทร: ${data.userContact.phone}\n`;
            equipmentMessage += `  • อีเมล: ${data.userContact.email}`;
          }
          
          // แสดง custom toast แบบยาว ตรงกลางจอทั้งแนวตั้งและแนวนอน
          customToast.error(equipmentMessage, {
            duration: 15000, // แสดง 15 วินาที
            style: {
              maxWidth: '600px',
              whiteSpace: 'pre-line',
              textAlign: 'left',
              fontSize: '14px',
              lineHeight: '1.6',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
              position: 'fixed',
              top: '0%',
              right: '0%',
              zIndex: '9999'
            }
          });
        } else {
          // กรณีอื่นๆ ที่ไม่ใช่เรื่องอุปกรณ์
          const errorMessage = data.error || data.message || 'เกิดข้อผิดพลาดในการลบ';
          customToast.error(errorMessage);
        }
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  // Function สำหรับแสดงรายละเอียด pending deletion
  const handleViewPendingDeletionDetails = async (user: User) => {
    setPendingDeletionUser(user);
    setShowPendingDeletionModal(true);
    
    // ดึงข้อมูลอุปกรณ์ของ user
    try {
      const response = await fetch(`/api/user/owned-equipment?userId=${user.user_id}`);
      if (response.ok) {
        const data = await response.json();
        setUserEquipment(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching user equipment:', error);
      setUserEquipment([]);
    }
  };

  // Function สำหรับยกเลิกการลบ
  const handleCancelDeletion = async (user: User) => {
    if (!confirm('คุณต้องการยกเลิกการลบผู้ใช้นี้หรือไม่?')) return;

    try {
      const response = await fetch(`/api/admin/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pendingDeletion: false,
          pendingDeletionReason: null,
          pendingDeletionRequestedBy: null,
          pendingDeletionRequestedAt: null,
        }),
      });

      if (response.ok) {
        toast.success('ยกเลิกการลบผู้ใช้เรียบร้อยแล้ว');
        setShowPendingDeletionModal(false);
        await fetchUsers();
      } else {
        toast.error('เกิดข้อผิดพลาดในการยกเลิกการลบ');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleApprove = (user: User) => {
    setApprovingUser(user);
    setSelectedRole('user'); // Default role
    setShowApprovalModal(true);
  };

  const handleReject = async (user: User) => {
    if (!confirm('คุณต้องการปฏิเสธการสมัครสมาชิกของ ' + user.firstName + ' ' + user.lastName + ' หรือไม่?')) return;

    try {
      const response = await fetch(`/api/admin/users/${user._id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast.success('ปฏิเสธการสมัครสมาชิกเรียบร้อยแล้ว');
        await fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || 'เกิดข้อผิดพลาดในการปฏิเสธ');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const confirmApproval = async () => {
    if (!approvingUser) return;

    setIsApproving(true);
    try {
      const response = await fetch(`/api/admin/users/${approvingUser._id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userRole: selectedRole }),
      });

      if (response.ok) {
        toast.success('อนุมัติสมาชิกใหม่เรียบร้อยแล้ว');
        setShowApprovalModal(false);
        setApprovingUser(null);
        await fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || 'เกิดข้อผิดพลาดในการอนุมัติ');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsApproving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      nickname: '',
      department: '',
      office: '',
      phone: '',
      email: '',
      password: '',
      userType: 'individual',
      userRole: 'user'
    });
    setEditingUser(null);
  };

  const handleExportExcel = () => {
    try {
      // ใช้ข้อมูลที่กรองแล้วตาม tab ปัจจุบัน
      const dataToExport = activeTab === 'approved' ? filteredUsers : filteredPendingUsers;
      
      if (dataToExport.length === 0) {
        toast.error('ไม่มีข้อมูลให้ Export');
        return;
      }

      // เตรียมข้อมูลสำหรับ Excel
      const exportData = dataToExport.map((user, index) => {
        const baseData: any = {
          'ลำดับ': index + 1,
          'ประเภท': user.userType === 'individual' ? 'บุคคล' : 'สาขา',
          'User ID': user.user_id || 'รอสร้าง',
          'ชื่อ': user.firstName || '-',
          'นามสกุล': user.lastName || '-',
          'ชื่อเล่น': user.nickname || '-',
          'แผนก': user.department || '-',
          'สาขา': user.office,
          'เบอร์โทร': user.phone || '-',
          'อีเมล': user.email,
          'วิธีสมัคร': user.registrationMethod === 'google' ? 'Google OAuth' : 'Manual',
        };

        // เพิ่มคอลัมน์ตามสถานะ
        if (activeTab === 'approved') {
          if (user.pendingDeletion) {
            baseData['สถานะ'] = 'รอลบ';
            baseData['เหตุผลรอลบ'] = user.pendingDeletionReason || '-';
          } else if (user.isMainAdmin) {
            baseData['สถานะ'] = 'Admin หลัก';
          } else {
            baseData['สถานะ'] = 
              user.userRole === 'user' ? 'ทั่วไป' : 
              user.userRole === 'admin' ? 'Admin' : 
              user.userRole === 'it_admin' ? 'Admin ทีม IT' : 'ไม่ระบุ';
          }
        } else {
          baseData['สถานะ'] = 'รอการอนุมัติ';
        }

        baseData['วันที่สร้าง'] = new Date(user.createdAt).toLocaleString('th-TH', { 
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        return baseData;
      });

      // สร้าง worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // กำหนดความกว้างคอลัมน์
      ws['!cols'] = [
        { wch: 8 },  // ลำดับ
        { wch: 12 }, // ประเภท
        { wch: 15 }, // User ID
        { wch: 20 }, // ชื่อ
        { wch: 20 }, // นามสกุล
        { wch: 12 }, // ชื่อเล่น
        { wch: 25 }, // แผนก
        { wch: 25 }, // สาขา
        { wch: 15 }, // เบอร์โทร
        { wch: 30 }, // อีเมล
        { wch: 15 }, // วิธีสมัคร
        { wch: 20 }, // สถานะ
        { wch: 30 }, // เหตุผลรอลบ (ถ้ามี)
        { wch: 25 }, // วันที่สร้าง
      ];

      // สร้าง workbook
      const wb = XLSX.utils.book_new();
      const sheetName = activeTab === 'approved' ? 'ผู้ใช้งาน' : 'รอการอนุมัติ';
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // สร้างชื่อไฟล์พร้อมวันที่และเวลา
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
      
      const filename = `รายชื่อผู้ใช้_${activeTab === 'approved' ? 'อนุมัติแล้ว' : 'รอการอนุมัติ'}_${dateStr}_${timeStr}.xlsx`;

      // Export ไฟล์
      XLSX.writeFile(wb, filename);
      
      toast.success(`ส่งออกข้อมูล ${dataToExport.length} รายการสำเร็จ`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    }
  };

  // Get unique values for filters
  const allUsers = [...users, ...pendingUsers];
  const offices = [...new Set(allUsers.map(user => user.office))];

  // Pagination
  const currentData = activeTab === 'approved' ? filteredUsers : filteredPendingUsers;
  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = currentData.slice(startIndex, endIndex);

  return (
    <Layout>
      <div className="max-w-full mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 flex-col md:flex-row ">
            <h1 className="text-2xl font-bold text-gray-900  mb-5 md:mb-0">จัดการผู้ใช้งาน</h1>
            
            {/* Action Buttons */}
            <div className="flex max-[470px]:flex-col max-[470px]:gap-3 max-[470px]:w-4/5 space-x-4 max-[470px]:space-x-0">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex justify-center items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>ฟิลเตอร์</span>
              </button>
              <button
                onClick={fetchUsers}
                disabled={loading}
                className="flex justify-center items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>รีเฟรช</span>
              </button>
              <button
                onClick={handleExportExcel}
                disabled={loading || currentData.length === 0}
                className="flex justify-center items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={currentData.length === 0 ? 'ไม่มีข้อมูลให้ Export' : 'Export ข้อมูลเป็น Excel'}
              >
                <Download className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="flex justify-center items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มผู้ใช้</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      placeholder="ชื่อ, อีเมล, สาขา"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ประเภทผู้ใช้
                  </label>
                  <select
                    value={userTypeFilter}
                    onChange={(e) => setUserTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="individual">บุคคล</option>
                    <option value="branch">สาขา</option>
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
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('approved')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'approved'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  รายชื่อผู้ใช้งาน
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                    activeTab === 'approved' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {users.length}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'pending'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  อนุมัติรายชื่อ
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                    activeTab === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {pendingUsers.length}
                  </span>
                </button>
              </nav>
            </div>
          </div>

          {/* Table */}
          <div ref={tableContainerRef} className="table-container">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    ประเภท
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    User ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    ชื่อ-นามสกุล
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    ชื่อเล่น
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    แผนก
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    สาขา
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    เบอร์โทร
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    อีเมล
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    สถานะ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    วันที่สร้าง
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading && (
                  <tr>
                    <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                      <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                      กำลังโหลดข้อมูล
                    </td>
                  </tr>
                )}
                {!loading && currentItems.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                      {activeTab === 'pending' ? 'ไม่มีผู้ใช้รอการอนุมัติ' : 'ไม่พบข้อมูล'}
                    </td>
                  </tr>
                )}
                {currentItems.map((user, index) => (
                  <tr key={user._id || user.user_id} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
                          user.userType === 'individual' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {user.userType === 'individual' ? (
                            <>
                              <UserIcon className="w-3 h-3 mr-1" />
                              บุคคล
                            </>
                          ) : (
                            <>
                              <Building className="w-3 h-3 mr-1" />
                              สาขา
                            </>
                          )}
                        </span>
                        {user.registrationMethod === 'google' && (
                          <span className="inline-flex items-center px-1 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                            Google
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-selectable">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {user.user_id || 'รอสร้าง'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-selectable">
                      {user.userType === 'individual' ? `${user.firstName} ${user.lastName}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-selectable">
                      {user.nickname || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-selectable">
                      {user.department || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-selectable">
                      {user.office}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-selectable">
                      {user.phone || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-selectable">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {user.pendingDeletion ? (
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              🔴 รอลบ
                            </span>
                            <button
                              onClick={() => handleViewPendingDeletionDetails(user)}
                              className="inline-flex items-center justify-center w-6 h-6 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors"
                              title="ดูรายละเอียด"
                            >
                              ℹ️
                            </button>
                          </div>
                        ) : user.isMainAdmin ? (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">
                            🛡️ Admin หลัก
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
                            user.userRole === 'user' 
                              ? 'bg-gray-100 text-gray-800' 
                              : user.userRole === 'admin'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {user.userRole === 'user' ? 'ทั่วไป' : 
                             user.userRole === 'admin' ? 'Admin' : 
                             user.userRole === 'it_admin' ? 'Admin ทีม IT' : 'ไม่ระบุ'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {activeTab === 'pending' ? (
                          <>
                            <button
                              onClick={() => handleApprove(user)}
                              className="text-green-600 hover:text-green-900 p-1"
                              title="อนุมัติ"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleReject(user)}
                              className="text-red-600 hover:text-red-900 p-1"
                              title="ปฏิเสธ"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(user)}
                              className="text-blue-600 hover:text-blue-900 p-1"
                              title={user.isMainAdmin ? "แก้ไขข้อมูล (Admin หลัก - ไม่สามารถลบได้)" : "แก้ไขข้อมูล"}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {/* Hide delete button for Main Admin */}
                            {!user.isMainAdmin && (
                              <button
                                onClick={() => handleDelete(user._id!)}
                                className="text-red-600 hover:text-red-900 p-1"
                                title="ลบผู้ใช้"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center text-sm text-gray-700">
                <span>
                  แสดง {startIndex + 1} ถึง {Math.min(endIndex, currentData.length)} จาก {currentData.length} รายการ
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

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border border-white/20 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">เพิ่มผู้ใช้ใหม่</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ประเภทผู้ใช้ *
                    </label>
                    <select
                      name="userType"
                      value={formData.userType}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      required
                    >
                      <option value="individual">บุคคล</option>
                      <option value="branch">สาขา</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      สถานะ *
                    </label>
                    <select
                      name="userRole"
                      value={formData.userRole}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      required
                    >
                      <option value="user">ทั่วไป</option>
                      <option value="admin">Admin</option>
                      <option value="it_admin">Admin ทีม IT</option>
                    </select>
                  </div>
                </div>

                {formData.userType === 'individual' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ชื่อ *
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          นามสกุล *
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ชื่อเล่น *
                        </label>
                        <input
                          type="text"
                          name="nickname"
                          value={formData.nickname}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          แผนก *
                        </label>
                        <input
                          type="text"
                          name="department"
                          value={formData.department}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ออฟฟิศ/สาขา *
                  </label>
                  <input
                    type="text"
                    name="office"
                    value={formData.office}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      เบอร์โทร *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="0812345678"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      title="กรุณากรอกเบอร์โทรศัพท์ 10 หลัก"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      อีเมล *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="example@email.com"
                      title="กรุณากรอกอีเมลล์ให้ถูกต้อง"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    รหัสผ่าน *
                  </label>
                  <input
                    type="text"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    minLength={6}
                    required
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{loading ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border border-white/20 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">แก้ไขผู้ใช้</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ประเภทผู้ใช้
                    </label>
                    <select
                      name="userType"
                      value={formData.userType}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-gray-100"
                      disabled
                    >
                      <option value="individual">บุคคล</option>
                      <option value="branch">สาขา</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      สถานะ *
                    </label>
                    <select
                      name="userRole"
                      value={formData.userRole}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      required
                    >
                      <option value="user">ทั่วไป</option>
                      <option value="admin">Admin</option>
                      <option value="it_admin">Admin ทีม IT</option>
                    </select>
                  </div>
                </div>

                {formData.userType === 'individual' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ชื่อ *
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          นามสกุล *
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ชื่อเล่น *
                        </label>
                        <input
                          type="text"
                          name="nickname"
                          value={formData.nickname}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          แผนก *
                        </label>
                        <input
                          type="text"
                          name="department"
                          value={formData.department}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ออฟฟิศ/สาขา *
                  </label>
                  <input
                    type="text"
                    name="office"
                    value={formData.office}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      เบอร์โทร *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="0812345678"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      title="กรุณากรอกเบอร์โทรศัพท์ 10 หลัก"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      อีเมล *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="example@email.com"
                      title="กรุณากรอกอีเมลล์ให้ถูกต้อง"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    รหัสผ่านใหม่ (เว้นว่างหากไม่ต้องการเปลี่ยน)
                  </label>
                  <input
                    type="text"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    minLength={6}
                    placeholder="กรอกรหัสผ่านใหม่"
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{loading ? 'กำลังอัพเดต...' : 'อัพเดต'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Approval Modal */}
        {showApprovalModal && approvingUser && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">อนุมัติสมาชิกใหม่</h3>
                <button
                  onClick={() => setShowApprovalModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* User Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-4 mb-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {approvingUser.firstName} {approvingUser.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{approvingUser.email}</p>
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>สาขา:</strong> {approvingUser.office}</p>
                  <p><strong>แผนก:</strong> {approvingUser.department || '-'}</p>
                  <p><strong>เบอร์โทร:</strong> {approvingUser.phone}</p>
                  <p><strong>วิธีสมัคร:</strong> {approvingUser.registrationMethod === 'google' ? 'Google OAuth' : 'Manual'}</p>
                </div>
              </div>

              {/* Role Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เลือกบทบาท *
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'user' | 'admin' | 'it_admin')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  <option value="user">ผู้ใช้ทั่วไป</option>
                  <option value="admin">Admin</option>
                  <option value="it_admin">Admin ทีม IT</option>
                </select>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowApprovalModal(false)}
                  disabled={isApproving}
                  className="flex-1 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmApproval}
                  disabled={isApproving}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isApproving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังอนุมัติ...</span>
                    </>
                  ) : (
                    <span>อนุมัติ</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending Deletion Details Modal */}
        {showPendingDeletionModal && pendingDeletionUser && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border border-white/20 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">รายละเอียดการลบผู้ใช้</h3>
                <button
                  onClick={() => setShowPendingDeletionModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* User Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล</label>
                    <p className="text-gray-900">{pendingDeletionUser.firstName} {pendingDeletionUser.lastName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                    <p className="text-gray-900">{pendingDeletionUser.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">แผนก</label>
                    <p className="text-gray-900">{pendingDeletionUser.department || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">สาขา</label>
                    <p className="text-gray-900">{pendingDeletionUser.office}</p>
                  </div>
                </div>
              </div>

              {/* Equipment List */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">📦 อุปกรณ์ที่รอคืน ({userEquipment.length} รายการ)</h4>
                {userEquipment.length > 0 ? (
                  <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                    {userEquipment.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                        <div>
                          <p className="font-medium text-gray-900">{item.itemName}</p>
                          <p className="text-sm text-gray-600">
                            {item.category} {item.serialNumber ? `• SN: ${item.serialNumber}` : ''}
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          จำนวน: {item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600">ไม่พบข้อมูลอุปกรณ์</p>
                )}
              </div>

              {/* Status Info */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-center mb-2">
                  <span className="text-yellow-600 font-medium">⚠️ สถานะ: รอ Admin อนุมัติการคืนอุปกรณ์</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">
                  <strong>เหตุผล:</strong> {pendingDeletionUser.pendingDeletionReason}
                </p>
                {pendingDeletionUser.pendingDeletionRequestedAt && (
                  <p className="text-sm text-gray-700">
                    <strong>วันที่ร้องขอ:</strong> {new Date(pendingDeletionUser.pendingDeletionRequestedAt).toLocaleString('th-TH')}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowPendingDeletionModal(false);
                    window.open('/admin/equipment-reports', '_blank');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  ดูประวัติคืนอุปกรณ์
                </button>
                <button
                  onClick={() => handleCancelDeletion(pendingDeletionUser)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  ยกเลิกการลบ
                </button>
                <button
                  onClick={() => setShowPendingDeletionModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
