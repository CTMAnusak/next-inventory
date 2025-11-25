'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { enableDragScroll } from '@/lib/drag-scroll';
import { useAuth } from '@/contexts/AuthContext';
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
  Upload,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { customToast } from '@/lib/custom-toast';
import SearchableSelect from '@/components/SearchableSelect';
import OfficeManagementModal from '@/components/OfficeManagementModal';
import * as XLSX from 'xlsx';

interface User {
  _id?: string; // MongoDB _id (for compatibility)
  user_id?: string; // User ID ที่แสดงให้ user เห็น
  firstName: string;
  lastName: string;
  nickname?: string;
  department?: string;
  office: string;
  officeId?: string; // 🆕 Office ID
  officeName?: string; // 🆕 Office Name (populated)
  phone?: string;
  email: string;
  userType: 'individual' | 'branch';
  isMainAdmin?: boolean;
  userRole: 'user' | 'admin' | 'it_admin' | 'super_admin';
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
  officeId?: string; // 🆕 Office ID
  phone: string;
  email: string;
  password: string;
  userType: 'individual' | 'branch';
  userRole: 'user' | 'admin' | 'it_admin' | 'super_admin';
}

const ISSUE_STATUS_LABELS: Record<string, string> = {
  pending: 'รอดำเนินการ',
  in_progress: 'กำลังดำเนินการ',
  completed: 'รอผู้ใช้งานตรวจสอบ',
  closed: 'ปิดงาน'
};

const getIssueStatusLabel = (status?: string) =>
  status ? ISSUE_STATUS_LABELS[status] || status : 'ไม่ทราบสถานะ';

export default function AdminUsersPage() {
  const pathname = usePathname();
  const dataLoadedRef = useRef(false);
  const { user: currentUser, loading: authLoading } = useAuth(); // Get current logged-in user
  const isSuperAdmin = currentUser?.userRole === 'super_admin' || currentUser?.isMainAdmin; // Check if current user is Super Admin
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
  const [selectedRole, setSelectedRole] = useState<'user' | 'admin' | 'it_admin' | 'super_admin'>('user');
  const [isApproving, setIsApproving] = useState(false);
  
  // States สำหรับ pending deletion popup
  const [showPendingDeletionModal, setShowPendingDeletionModal] = useState(false);
  const [pendingDeletionUser, setPendingDeletionUser] = useState<User | null>(null);
  const [userEquipment, setUserEquipment] = useState<any[]>([]);
  
  // 🆕 States สำหรับ Office Management
  const [showOfficeModal, setShowOfficeModal] = useState(false);
  const [officeOptions, setOfficeOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loadingOffices, setLoadingOffices] = useState(false);
  
  // States สำหรับ loading ของแต่ละ action
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteUserConfirmText, setDeleteUserConfirmText] = useState('');

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');

  // Form data
  const [formData, setFormData] = useState<UserFormData>({
    firstName: '',
    lastName: '',
    nickname: '',
    department: '',
    office: '',
    officeId: '', // 🆕 Office ID
    phone: '',
    email: '',
    password: '',
    userType: 'individual',
    userRole: 'user'
  });

  // Field errors state for duplicate validation
  const [fieldErrors, setFieldErrors] = useState<{
    email?: boolean;
    phone?: boolean;
    firstName?: boolean;
    lastName?: boolean;
  }>({});

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
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
      fetchUsers();
      fetchOfficeOptions(); // 🆕 ดึงรายการ Office
    }
  }, [pathname]);

  // 🆕 ดึงรายการ Office สำหรับ dropdown
  const fetchOfficeOptions = async () => {
    setLoadingOffices(true);
    try {
      const response = await fetch('/api/admin/offices');
      if (response.ok) {
        const offices = await response.json();
        setOfficeOptions(offices.map((office: any) => ({
          value: office.office_id,
          label: office.name
        })));
      }
    } catch (error) {
      console.error('Error fetching offices:', error);
    } finally {
      setLoadingOffices(false);
    }
  };

  // Initialize drag scrolling
  useEffect(() => {
    const element = tableContainerRef.current;
    if (!element) return;

    const cleanup = enableDragScroll(element);
    return cleanup;
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, pendingUsers, searchTerm, emailFilter, userTypeFilter, officeFilter, activeTab]);

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
        (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.nickname && user.nickname.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesEmail = !emailFilter || (user.email && user.email.toLowerCase().includes(emailFilter.toLowerCase()));
      const matchesUserType = !userTypeFilter || user.userType === userTypeFilter;
      // 🆕 อัพเดต filter ให้รองรับทั้ง officeId และ office (backward compatibility)
      const matchesOffice = !officeFilter || 
        (user.officeId && user.officeId === officeFilter) ||
        (user.office && user.office.toLowerCase() === officeFilter.toLowerCase()) ||
        (user.officeName && user.officeName.toLowerCase() === officeFilter.toLowerCase());

      return matchesSearch && matchesEmail && matchesUserType && matchesOffice;
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
    
    // Clear field error when user starts typing
    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof typeof fieldErrors];
        return newErrors;
      });
    }
    
    // Validation for phone number
    if (name === 'phone') {
      // Allow 000-000-0000 for Super Admin
      const isSuperAdmin = formData.email === 'vexclusive.it@gmail.com';
      if (value === '000-000-0000' && isSuperAdmin) {
        setFormData(prev => ({
          ...prev,
          [name]: value
        }));
        return;
      }
      
      // For other users, only allow numbers
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

    // Validate phone number (allow 000-000-0000 for Super Admin)
    const isSuperAdmin = formData.email === 'vexclusive.it@gmail.com';
    if (formData.phone && formData.phone.length !== 10) {
      toast.error('เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น');
      return false;
    }
    
    // Allow 000-000-0000 for Super Admin, otherwise validate numeric format
    if (formData.phone && formData.phone !== '000-000-0000' && !isSuperAdmin) {
      if (!/^[0-9]{10}$/.test(formData.phone)) {
        toast.error('เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น');
        return false;
      }
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
    
    // ✅ ป้องกันการ submit ซ้ำ
    if (loading) {
      console.log('⚠️ Form is already submitting, ignoring duplicate submission');
      return;
    }
    
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
        resetForm();
        setFieldErrors({}); // Clear field errors on success
        setShowAddModal(false);
        setShowEditModal(false);
        // รีเฟรชข้อมูลหลังจากปิด modal
        await fetchUsers();
      } else {
        const data = await response.json();
        
        // Parse duplicate errors and set field errors
        const newFieldErrors: typeof fieldErrors = {};
        if (data.duplicateFields && Array.isArray(data.duplicateFields)) {
          data.duplicateFields.forEach((errorMsg: string) => {
            if (errorMsg.includes('อีเมลล์')) {
              newFieldErrors.email = true;
            } else if (errorMsg.includes('เบอร์โทรศัพท์')) {
              newFieldErrors.phone = true;
            } else if (errorMsg.includes('ชื่อ-นามสกุล')) {
              newFieldErrors.firstName = true;
              newFieldErrors.lastName = true;
            }
          });
        }
        setFieldErrors(newFieldErrors);
        
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

  const handleEdit = async (user: User) => {
    setEditingUserId(user._id || null);
    try {
      // จำลองการโหลดเล็กน้อยเพื่อให้เห็นแอนิเมชัน (ถ้ามีการ fetch ข้อมูลเพิ่มเติมในอนาคต)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 🆕 ตรวจสอบว่า officeId ของ user ยังมีอยู่หรือไม่ ถ้าไม่มีให้ใช้ default
      let officeId = user.officeId || '';
      if (officeId && officeId !== 'UNSPECIFIED_OFFICE') {
        const officeExists = officeOptions.find(opt => opt.value === officeId);
        if (!officeExists) {
          // Office ถูกลบแล้ว ให้ใช้ default
          officeId = 'UNSPECIFIED_OFFICE';
        }
      } else if (!officeId) {
        // ไม่มี officeId ให้ใช้ default
        officeId = 'UNSPECIFIED_OFFICE';
      }
      
      setEditingUser(user);
      
      // 🔒 Security: If editing a super_admin but current user is not super_admin, reset role
      let userRole = user.userRole || 'user';
      if (userRole === 'super_admin' && !isSuperAdmin) {
        userRole = 'user'; // Reset to default role if not authorized
      }
      
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        nickname: user.nickname || '',
        department: user.department || '',
        office: user.officeName || user.office || 'ไม่ระบุสาขา',
        officeId: officeId, // 🆕 ใช้ officeId ที่ตรวจสอบแล้ว
        phone: user.phone || '',
        email: user.email,
        password: '',
        userType: user.userType,
        userRole: userRole // Use checked role instead of user.userRole
      });
      setFieldErrors({}); // Clear field errors when opening edit modal
      setShowEditModal(true);
    } finally {
      setEditingUserId(null);
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteUserConfirmText('');
    setShowDeleteUserConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    // ✅ ป้องกันการ submit ซ้ำ
    if (deletingUserId) {
      console.log('⚠️ Already deleting a user, ignoring duplicate click');
      return;
    }
    
    if (!userToDelete || deleteUserConfirmText !== 'delete') {
      return;
    }

    setDeletingUserId(userToDelete._id!);
    setShowDeleteUserConfirm(false);
    try {
      const response = await fetch(`/api/admin/users/${userToDelete._id}`, {
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
        const sections: string[] = [];

        if (data.hasOpenIssues && data.openIssues) {
          const {
            total,
            asRequester,
            asAssignee,
            requesterIssues = [],
            assigneeIssues = []
          } = data.openIssues as {
            total: number;
            asRequester: number;
            asAssignee: number;
            requesterIssues?: Array<{ issueId: string; status: string; issueCategory?: string }>;
            assigneeIssues?: Array<{ issueId: string; status: string; issueCategory?: string }>;
          };

          const sampleIssues = [...requesterIssues, ...assigneeIssues]
            .slice(0, 5)
            .map((issue, index) => {
              const label = getIssueStatusLabel(issue.status);
              const category = issue.issueCategory ? ` (${issue.issueCategory})` : '';
              return `${index + 1}. ${issue.issueId} - ${label}${category}`;
            });

          let issueMessage = `🔴 ผู้ใช้นี้ยังมีงานแจ้ง IT ที่ยังไม่ปิดจำนวน ${total} รายการ ดังนี้:\n`;
          issueMessage += `(กรุณาปิดงานทั้งหมดให้เรียบร้อยก่อนลบผู้ใช้อีกครั้ง)\n\n`;
          issueMessage += `รายการที่อยู่ในระหว่างการแจ้งงาน IT ดังนี้:\n`;
          if (sampleIssues.length > 0) {
            issueMessage += `${sampleIssues.join('\n')}`;
          }
          issueMessage += `\n`;

          sections.push(issueMessage);
        }

        if (data.hasPendingEquipmentRequests && data.pendingEquipmentRequests) {
          const { total, summaries = [] } = data.pendingEquipmentRequests as {
            total: number;
            summaries?: Array<{
              requestId: string;
              requestDate?: string;
              itemCount: number;
              equipmentName?: string;
              categoryName?: string;
              deliveryLocation?: string;
              requesterDisplayName?: string;
              office?: string;
              officeId?: string;
              requesterFirstName?: string;
              requesterLastName?: string;
              requesterDepartment?: string;
              requesterPhone?: string;
              requesterEmail?: string;
            }>;
          };

          const requestLines = summaries.slice(0, 5).map((request, index) => {
            const equipmentLabel = request.equipmentName
              ? `อุปกรณ์: ${request.equipmentName}${request.itemCount && request.itemCount > 1 ? ` (รวม ${request.itemCount} รายการ)` : ''}`
              : undefined;

            const nameSegment =
              request.requesterFirstName || request.requesterLastName
                ? `ชื่อ: ${request.requesterFirstName || '-'} นามสกุล: ${request.requesterLastName || '-'}`
                : undefined;

            const departmentSegment = request.requesterDepartment
              ? `แผนก: ${request.requesterDepartment}`
              : undefined;

            const officeSegment = request.office ? `ออฟฟิศ/สาขา: ${request.office}` : undefined;
            const deliverySegment = request.deliveryLocation
              ? `สถานที่จัดส่ง: ${request.deliveryLocation}`
              : undefined;
            const phoneSegment = request.requesterPhone ? `โทร: ${request.requesterPhone}` : undefined;
            const emailSegment = request.requesterEmail ? `อีเมล: ${request.requesterEmail}` : undefined;

            const segments = [
              equipmentLabel,
              nameSegment,
              departmentSegment,
              officeSegment,
              deliverySegment,
              phoneSegment,
              emailSegment
            ].filter(Boolean);

            if (segments.length === 0) {
              return `${index + 1}. รายละเอียดคำขอ\nรายละเอียดไม่ครบถ้วน`;
            }

            const [firstSegment, ...restSegments] = segments;
            const firstLine = firstSegment
              ? `${index + 1}. รายละเอียดคำขอ : ${firstSegment}`
              : `${index + 1}. รายละเอียดคำขอ`;
            const secondLine =
              restSegments.length > 0
                ? `${restSegments.map(segment => segment?.replace(/^•?\s*/, '')).join(' , ')}`
                : undefined;

            return [firstLine, secondLine].filter(Boolean).join('\n');
          });

          let requestMessage = `🔴 ผู้ใช้นี้ยังมีคำขอเบิกอุปกรณ์ที่รออนุมัติ ${total} รายการ ดังนี้:\n`;
          requestMessage += `(กรุณาอนุมัติหรือยกเลิกคำขอทั้งหมดก่อนจึงจะลบผู้ใช้ได้)\n\n`;
          requestMessage += `อุปกรณ์ที่อยู่ในระหว่างการเบิก ดังนี้:\n`;
          if (requestLines.length > 0) {
            requestMessage += `${requestLines.join('\n')}`;
          }
          requestMessage += `\n`;

          sections.push(requestMessage);
        }

        if (data.hasEquipment && data.equipmentList) {
          const equipmentCount = data.equipmentCount || 0;
          const equipmentListWithContact = (data as any).equipmentListWithContact || [];
          const equipmentItems = data.equipmentList.slice(0, 5); // แสดงแค่ 5 รายการแรก
          const remainingCount = equipmentCount - equipmentItems.length;
          
          let equipmentMessage = `🔴 ผู้ใช้นี้ยังมีอุปกรณ์ครอบครองอยู่ ${equipmentCount} รายการ\n`;
          equipmentMessage += `(กรุณาให้ผู้ใช้คืนอุปกรณ์ทั้งหมดก่อนลบบัญชี)\n\n`;
          equipmentMessage += `📦 อุปกรณ์ที่ต้องคืน ดังนี้:\n`;
          
          // แสดงข้อมูลติดต่อแยกตามแต่ละรายการ (ถ้ามี equipmentListWithContact)
          if (equipmentListWithContact.length > 0) {
            equipmentListWithContact.slice(0, 5).forEach((item: any, index: number) => {
              equipmentMessage += `${index + 1}. ${item.equipment}\n`;
              
              // แสดงข้อมูลติดต่อสำหรับรายการนี้
              if (item.contact) {
                const contact = item.contact;
                const contactFirstName = contact.firstName || contact.name || '-';
                const contactLastName = contact.lastName || '-';
                const contactDepartment =
                  contact.department !== undefined && contact.department !== null
                    ? contact.department
                    : '-';
                const contactOffice = contact.office || '-';
                const contactPhone = contact.phone || '-';
                const contactEmail = contact.email || '-';

                const contactSegments = [
                  `ชื่อ: ${contactFirstName} นามสกุล: ${contactLastName}`,
                  `แผนก: ${contactDepartment}`,
                  `ออฟฟิศ/สาขา: ${contactOffice}`,
                  `โทร: ${contactPhone}`,
                  `อีเมล: ${contactEmail}`
                ];

                equipmentMessage += `📞 ข้อมูลติดต่อ: ${contactSegments.join(' , ')}\n`;
              }
            });
          } else {
            // Fallback: แสดงแค่รายการอุปกรณ์ (ไม่มีข้อมูลติดต่อแยก)
            equipmentItems.forEach((item: string, index: number) => {
              equipmentMessage += `${index + 1}. ${item}\n`;
            });
            
            // แสดงข้อมูลติดต่อรวม (ถ้ามี)
            if (data.userContact) {
              const contactFirstName = data.userContact.firstName || data.userContact.name || '-';
              const contactLastName = data.userContact.lastName || '-';
              const contactDepartment =
                data.userContact.department !== undefined && data.userContact.department !== null
                  ? data.userContact.department
                  : '-';
              const contactOffice = data.userContact.office || '-';
              const contactPhone = data.userContact.phone || '-';
              const contactEmail = data.userContact.email || '-';

              const contactSegments = [
                `ชื่อ: ${contactFirstName} นามสกุล: ${contactLastName}`,
                `แผนก: ${contactDepartment}`,
                `ออฟฟิศ/สาขา: ${contactOffice}`,
                `โทร: ${contactPhone}`,
                `อีเมล: ${contactEmail}`
              ];

              equipmentMessage += `\n📞 ข้อมูลติดต่อผู้ใช้:\n`;
              equipmentMessage += `     ${contactSegments.join(' , ')}`;
            }
          }
          
          if (remainingCount > 0) {
            equipmentMessage += `... และอีก ${remainingCount} รายการ\n`;
          }
          
          // เพิ่มช่องว่างหลังข้อมูลสุดท้าย
          equipmentMessage += `\n`;

          sections.push(equipmentMessage);
        }

        if (sections.length > 0) {
          // เพิ่มเส้นขีดระหว่าง sections (แต่ section สุดท้ายไม่ต้องมี)
          const separator = '────────────────────────────────────────';
          const sectionsWithSeparator = sections.map((section, index) => {
            // section สุดท้ายไม่ต้องมีเส้นขีด
            if (index === sections.length - 1) {
              return section;
            }
            return `${section}\n${separator}`;
          });
          
          const combinedMessage = ['❌ ไม่สามารถลบผู้ใช้ได้', ...sectionsWithSeparator].join('\n\n');

          // ใช้ CSS media query สำหรับ responsive max-width (ไม่ต้องคำนวณด้วย JavaScript)
          customToast.error(combinedMessage, {
            duration: Number.POSITIVE_INFINITY,
            style: {
              whiteSpace: 'pre-line',
              textAlign: 'left',
              fontSize: '14px',
              lineHeight: '1.6',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.25)',
              position: 'fixed',
              top: '10%',
              right: '2%',
              transform: 'translateY(0)',
              zIndex: '9999',
              overflow: 'auto',
              maxHeight: '80vh'
              // ไม่ต้องใส่ width, maxWidth, minWidth เพราะใช้ CSS class toast-responsive-width แทน
            }
          });
        } else {
          const errorMessage = data.error || data.message || 'เกิดข้อผิดพลาดในการลบ';
          customToast.error(errorMessage);
        }
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setDeletingUserId(null);
      setUserToDelete(null);
      setDeleteUserConfirmText('');
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteUserConfirm(false);
    setUserToDelete(null);
    setDeleteUserConfirmText('');
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
      officeId: '', // 🆕
      phone: '',
      email: '',
      password: '',
      userType: 'individual',
      userRole: 'user'
    });
    setEditingUser(null);
    setFieldErrors({}); // Clear field errors when resetting form
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
          'สาขา': user.officeName || user.office || '-', // 🆕 แสดงชื่อ office
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
              user.userRole === 'it_admin' ? 'Admin ทีม IT' :
              user.userRole === 'super_admin' ? 'Super Admin' : 'ไม่ระบุ';
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
  
  // Get unique emails
  const emails = [...new Set(allUsers.map(user => user.email).filter(Boolean))];
  const emailOptions = emails.map(email => ({ value: email, label: email }));
  
  // 🆕 Get unique offices from officeOptions state (ใช้ ID จาก Office collection)
  const officeFilterOptions = officeOptions;

  // Pagination
  const currentData = activeTab === 'approved' ? filteredUsers : filteredPendingUsers;
  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = currentData.slice(startIndex, endIndex);

  return (
    <Layout>
      <div className="max-w-full mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-8 border border-white/50">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 flex-col xl:flex-row ">
            <h1 className="text-2xl font-semibold text-gray-900 mb-5 xl:mb-0">จัดการผู้ใช้งาน</h1>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap justify-center max-[470px]:flex-col gap-2 max-[724px]:gap-3 max-[724px]:w-4/5">
              <button
                onClick={() => setShowOfficeModal(true)}
                className="flex justify-center items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Building className="w-4 h-4" />
                <span>แก้ไขสาขา</span>
              </button>
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
                <Upload className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setFieldErrors({}); // Clear field errors when opening add modal
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    อีเมล
                  </label>
                  <SearchableSelect
                    options={emailOptions}
                    value={emailFilter}
                    onChange={setEmailFilter}
                    placeholder="ทั้งหมด"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ประเภทผู้ใช้
                  </label>
                  <SearchableSelect
                    options={[
                      { value: 'individual', label: 'บุคคล' },
                      { value: 'branch', label: 'สาขา' }
                    ]}
                    value={userTypeFilter}
                    onChange={setUserTypeFilter}
                    placeholder="ทั้งหมด"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    สาขา
                  </label>
                  <SearchableSelect
                    options={officeFilterOptions}
                    value={officeFilter}
                    onChange={setOfficeFilter}
                    placeholder="ทั้งหมด"
                  />
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
            <table className="min-w-[140%] divide-y divide-gray-200">
              <thead className="bg-blue-600">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    ประเภท
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    User ID
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    ชื่อ-นามสกุล
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    ชื่อเล่น
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    แผนก
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    สาขา
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    เบอร์โทร
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    อีเมล
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    สถานะ
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    วันที่สร้าง
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
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
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
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
                    <td className="px-6 py-4 text-sm text-gray-500 text-selectable text-center">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {user.user_id || 'รอสร้าง'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-selectable text-center">
                      {user.userType === 'individual' ? `${user.firstName} ${user.lastName}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-selectable text-center">
                      {user.nickname || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-selectable text-center">
                      {user.department || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-selectable text-center">
                      {user.officeName || user.office || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-selectable text-center">
                      {user.phone || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-selectable text-center">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
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
                             user.userRole === 'it_admin' ? 'Admin ทีม IT' :
                             user.userRole === 'super_admin' ? 'Super Admin' : 'ไม่ระบุ'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {new Date(user.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center space-x-2">
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
                              disabled={editingUserId === user._id || deletingUserId === user._id}
                              className="text-blue-600 hover:text-blue-900 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={user.isMainAdmin ? "แก้ไขข้อมูล (Admin หลัก - ไม่สามารถลบได้)" : "แก้ไขข้อมูล"}
                            >
                              {editingUserId === user._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Edit className="w-4 h-4" />
                              )}
                            </button>
                            {/* Hide delete button for Main Admin */}
                            {!user.isMainAdmin && (
                              <button
                                onClick={() => handleDeleteClick(user)}
                                disabled={editingUserId === user._id || deletingUserId === user._id}
                                className="text-red-600 hover:text-red-900 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="ลบผู้ใช้"
                              >
                                {deletingUserId === user._id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
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
                  onClick={() => {
                    setShowAddModal(false);
                    setFieldErrors({}); // Clear field errors when closing modal
                  }}
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
                      {isSuperAdmin && <option value="super_admin">Super Admin</option>}
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
                          data-error={fieldErrors.firstName ? "true" : "false"}
                          style={fieldErrors.firstName ? { backgroundColor: '#fef2f2' } : { backgroundColor: '#ffffff' }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
                            fieldErrors.firstName 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:ring-blue-500'
                          }`}
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
                          data-error={fieldErrors.lastName ? "true" : "false"}
                          style={fieldErrors.lastName ? { backgroundColor: '#fef2f2' } : { backgroundColor: '#ffffff' }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
                            fieldErrors.lastName 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:ring-blue-500'
                          }`}
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
                  {loadingOffices ? (
                    <input
                      type="text"
                      value="กำลังโหลด..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                      disabled
                    />
                  ) : (
                    <SearchableSelect
                      options={officeOptions}
                      value={formData.officeId || ''}
                      onChange={(officeId) => {
                        const selectedOffice = officeOptions.find(opt => opt.value === officeId);
                        setFormData({
                          ...formData,
                          officeId: officeId,
                          office: selectedOffice?.label || ''
                        });
                      }}
                      placeholder="เลือกสาขา"
                      className="w-full"
                    />
                  )}
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
                       data-error={fieldErrors.phone ? "true" : "false"}
                       style={fieldErrors.phone ? { backgroundColor: '#fef2f2' } : { backgroundColor: '#ffffff' }}
                       className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
                         fieldErrors.phone 
                           ? 'border-red-500 focus:ring-red-500' 
                           : 'border-gray-300 focus:ring-blue-500'
                       }`}
                       placeholder={formData.email === 'vexclusive.it@gmail.com' ? '000-000-0000' : '0812345678'}
                       pattern={formData.email === 'vexclusive.it@gmail.com' ? undefined : '[0-9]{10}'}
                       maxLength={formData.email === 'vexclusive.it@gmail.com' ? 13 : 10}
                       title={formData.email === 'vexclusive.it@gmail.com' ? 'Super Admin สามารถใช้ 000-000-0000 ได้' : 'กรุณากรอกเบอร์โทรศัพท์ 10 หลัก'}
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
                      data-error={fieldErrors.email ? "true" : "false"}
                      style={fieldErrors.email ? { backgroundColor: '#fef2f2' } : { backgroundColor: '#ffffff' }}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
                        fieldErrors.email 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
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
                    placeholder="กรอกรหัสผ่าน (อย่างน้อย 6 ตัวอักษร)"
                    required
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setFieldErrors({}); // Clear field errors when canceling
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>เพิ่มผู้ใช้</span>
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
                <h3 className="text-xl font-semibold text-gray-900">แก้ไขผู้ใช้</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setFieldErrors({}); // Clear field errors when closing modal
                  }}
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
                      {/* Show "Super Admin" ONLY if editing user is isMainAdmin = true */}
                      {editingUser?.isMainAdmin ? (
                        <option value="super_admin">Super Admin</option>
                      ) : (
                        <>
                          <option value="user">ทั่วไป</option>
                          <option value="admin">Admin</option>
                          <option value="it_admin">Admin ทีม IT</option>
                        </>
                      )}
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
                          data-error={fieldErrors.firstName ? "true" : "false"}
                          style={fieldErrors.firstName ? { backgroundColor: '#fef2f2' } : { backgroundColor: '#ffffff' }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
                            fieldErrors.firstName 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:ring-blue-500'
                          }`}
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
                          data-error={fieldErrors.lastName ? "true" : "false"}
                          style={fieldErrors.lastName ? { backgroundColor: '#fef2f2' } : { backgroundColor: '#ffffff' }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
                            fieldErrors.lastName 
                              ? 'border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:ring-blue-500'
                          }`}
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
                  {loadingOffices ? (
                    <input
                      type="text"
                      value="กำลังโหลด..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                      disabled
                    />
                  ) : (
                    <SearchableSelect
                      options={officeOptions}
                      value={formData.officeId || ''}
                      onChange={(officeId) => {
                        const selectedOffice = officeOptions.find(opt => opt.value === officeId);
                        setFormData({
                          ...formData,
                          officeId: officeId,
                          office: selectedOffice?.label || ''
                        });
                      }}
                      placeholder="เลือกสาขา"
                      className="w-full"
                    />
                  )}
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
                       data-error={fieldErrors.phone ? "true" : "false"}
                       style={fieldErrors.phone ? { backgroundColor: '#fef2f2' } : { backgroundColor: '#ffffff' }}
                       className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
                         fieldErrors.phone 
                           ? 'border-red-500 focus:ring-red-500' 
                           : 'border-gray-300 focus:ring-blue-500'
                       }`}
                       placeholder={formData.email === 'vexclusive.it@gmail.com' ? '000-000-0000' : '0812345678'}
                       pattern={formData.email === 'vexclusive.it@gmail.com' ? undefined : '[0-9]{10}'}
                       maxLength={formData.email === 'vexclusive.it@gmail.com' ? 13 : 10}
                       title={formData.email === 'vexclusive.it@gmail.com' ? 'Super Admin สามารถใช้ 000-000-0000 ได้' : 'กรุณากรอกเบอร์โทรศัพท์ 10 หลัก'}
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
                      data-error={fieldErrors.email ? "true" : "false"}
                      style={fieldErrors.email ? { backgroundColor: '#fef2f2' } : { backgroundColor: '#ffffff' }}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
                        fieldErrors.email 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
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
                    onClick={() => {
                      setShowEditModal(false);
                      setFieldErrors({}); // Clear field errors when canceling
                    }}
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
                <h3 className="text-xl font-semibold text-gray-900">อนุมัติสมาชิกใหม่</h3>
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
                  <p><strong>สาขา:</strong> {approvingUser.officeName || approvingUser.office || '-'}</p>
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
                  onChange={(e) => setSelectedRole(e.target.value as 'user' | 'admin' | 'it_admin' | 'super_admin')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  <option value="user">ผู้ใช้ทั่วไป</option>
                  <option value="admin">Admin</option>
                  <option value="it_admin">Admin ทีม IT</option>
                  {isSuperAdmin && <option value="super_admin">Super Admin</option>}
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
                <h3 className="text-xl font-semibold text-gray-900">รายละเอียดการลบผู้ใช้</h3>
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
                    <p className="text-gray-900">{pendingDeletionUser.officeName || pendingDeletionUser.office || '-'}</p>
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
        
        {/* 🆕 Office Management Modal */}
        <OfficeManagementModal
          isOpen={showOfficeModal}
          onClose={() => setShowOfficeModal(false)}
          onRefresh={() => {
            fetchUsers();
            fetchOfficeOptions();
          }}
        />

        {/* Delete User Confirmation Modal */}
        {showDeleteUserConfirm && userToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-900">
                    ยืนยันการลบผู้ใช้
                  </span>
                </div>
                <button
                  onClick={handleDeleteCancel}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={deletingUserId === userToDelete._id}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      คุณแน่ใจหรือไม่ที่จะลบผู้ใช้ "{userToDelete.firstName} {userToDelete.lastName}"?
                    </h3>
                    <div className="text-sm text-gray-600 space-y-2 mb-4">
                      <p>การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
                      <p>ผู้ใช้นี้จะถูกลบออกจากระบบอย่างถาวร</p>
                      {userToDelete.email && (
                        <p className="mt-2">
                          <strong>อีเมล:</strong> {userToDelete.email}
                        </p>
                      )}
                    </div>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        พิมพ์ <span className="font-mono font-bold text-red-600">delete</span> เพื่อยืนยัน:
                      </label>
                      <input
                        type="text"
                        value={deleteUserConfirmText}
                        onChange={(e) => setDeleteUserConfirmText(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="delete"
                        disabled={deletingUserId === userToDelete._id}
                        autoFocus
                      />
                      {deleteUserConfirmText && deleteUserConfirmText !== 'delete' && (
                        <p className="text-red-500 text-sm mt-1">กรุณาพิมพ์ "delete" ให้ถูกต้อง</p>
                      )}
                      {deleteUserConfirmText === 'delete' && (
                        <p className="text-green-600 text-sm mt-1">✓ ยืนยันแล้ว</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={handleDeleteCancel}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={deletingUserId === userToDelete._id}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteUserConfirmText !== 'delete' || deletingUserId === userToDelete._id}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {deletingUserId === userToDelete._id && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  ลบผู้ใช้
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
