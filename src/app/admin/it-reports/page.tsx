'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { enableDragScroll } from '@/lib/drag-scroll';
import Layout from '@/components/Layout';
import { 
  Search, 
  RefreshCw, 
  Upload, 
  Eye, 
  Send,
  Filter,
  X,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  Phone,
  Mail,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Building
} from 'lucide-react';
import DatePicker from '@/components/DatePicker';
import SearchableSelect from '@/components/SearchableSelect';
import { toast } from 'react-hot-toast';
import ExcelJS from 'exceljs';

interface ITIssue {
  _id: string;
  issueId: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  email: string;
  department: string;
  office: string;
  issueCategory: string;
  customCategory?: string;
  urgency: 'normal' | 'very_urgent';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'closed';
  images?: string[];
  notes?: string; // เก็บไว้เพื่อ backward compatibility
  reportDate: string;
  acceptedDate?: string;
  completedDate?: string;
  closedDate?: string;
  updatedAt?: string;
  userType?: 'individual' | 'branch'; // เพิ่มประเภทผู้ใช้
  assignedAdmin?: {
    name: string;
    email: string;
  };
  userFeedback?: {
    action: 'approved' | 'rejected';
    reason: string;
    submittedAt: string;
  };
  // ประวัติใหม่
  notesHistory?: Array<{
    note: string;
    adminId: string;
    adminName: string;
    createdAt: string;
  }>;
  userFeedbackHistory?: Array<{
    action: 'approved' | 'rejected';
    reason: string;
    submittedAt: string;
  }>;
}

interface ITAdmin {
  id: string;
  userId: string;
  name: string;
  email: string;
}

type TabType = 'pending' | 'in_progress' | 'completed' | 'closed';

export default function AdminITReportsPage() {
  const pathname = usePathname();
  const dataLoadedRef = useRef(false);
  const [issues, setIssues] = useState<ITIssue[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<ITIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [showFilters, setShowFilters] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<ITIssue | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  
  // IT Admin Selection
  const [itAdmins, setItAdmins] = useState<ITAdmin[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedIssueForAssign, setSelectedIssueForAssign] = useState<ITIssue | null>(null);
  const [assigningAdminId, setAssigningAdminId] = useState<string | null>(null);
  
  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; status: string; text: string } | null>(null);
  const [workNotes, setWorkNotes] = useState('');
  const [sendingWork, setSendingWork] = useState(false);
  const [tabCounts, setTabCounts] = useState<Record<TabType, number>>({
    pending: 0,
    in_progress: 0,
    completed: 0,
    closed: 0
  });

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState(''); // Issue ID only
  const [nameFilter, setNameFilter] = useState(''); // ชื่อ, นามสกุล, ชื่อเล่น
  const [emailFilter, setEmailFilter] = useState(''); // อีเมล
  const [phoneFilter, setPhoneFilter] = useState(''); // เบอร์โทรศัพท์
  const [userTypeFilter, setUserTypeFilter] = useState(''); // ประเภทผู้ใช้
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [adminFilter, setAdminFilter] = useState(''); // IT Admin ผู้รับงาน
  const [dateFilter, setDateFilter] = useState(''); // วันที่แจ้งงาน
  const [monthFilter, setMonthFilter] = useState(''); // เดือน (1-12)
  const [yearFilter, setYearFilter] = useState(''); // ปี พ.ศ.

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Drag scroll ref
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const categories = [
    'ปัญหา Internet',
    'ปัญหา Notebook/Computer',
    'ปัญหา ปริ้นเตอร์ และ อุปกรณ์',
    'ปัญหา TV/VDO Conference',
    'ปัญหา ตู้ฝากเงิน',
    'ปัญหา อุปกรณ์ มือถือและแท็บเลต',
    'ปัญหา เบอร์โทรศัพท์',
    'ปัญหา Nas เข้าไม่ได้ ใช้งานไม่ได้',
    'ขอ User Account Email ระบบงาน',
    'อื่น ๆ (โปรดระบุ)'
  ];

  // Note: This component uses IT issue categories, not inventory categories
  // So we keep the hardcoded categories array for IT issues

  // ✅ Reset data loaded flag when pathname changes (navigation to this page)
  useEffect(() => {
    dataLoadedRef.current = false;
  }, [pathname]);

  useEffect(() => {
    if (!dataLoadedRef.current) {
      dataLoadedRef.current = true;
      fetchIssues(1); // Initial fetch when navigating to this page
    } else {
      // Refetch when tab or search changes (but not on initial load)
      fetchIssues(1); // Reset to page 1 when tab or search changes
    }
  }, [activeTab, searchTerm, pathname]);

  // Fetch when page changes (but not on initial load)
  useEffect(() => {
    if (currentPage > 1) {
      fetchIssues(currentPage);
    }
  }, [currentPage]);

  // Fetch IT admins once on mount
  useEffect(() => {
    fetchItAdmins();
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
  }, [issues, nameFilter, emailFilter, phoneFilter, userTypeFilter, urgencyFilter, categoryFilter, adminFilter, dateFilter, monthFilter, yearFilter]);

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

  // 🚀 Server-side pagination with filters
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    refreshAllTabCounts();
  }, []);

  const fetchIssues = async (page = 1, statusOverride?: TabType, searchOverride?: string) => {
    setLoading(true);
    try {
      // Build query params
      const targetStatus = statusOverride ?? activeTab;
      const searchValue = searchOverride !== undefined ? searchOverride : searchTerm;
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        status: targetStatus,
      });

      // Add search filters if present
      if (searchValue) params.append('search', searchValue);

      const response = await fetch(`/api/admin/it-reports?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setIssues(data.issues || []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalItems(data.pagination?.total || 0);
        setCurrentPage(page);
        setTabCounts(prev => ({
          ...prev,
          [targetStatus]: data.pagination?.total || 0
        }));
      } else {
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setNameFilter('');
    setEmailFilter('');
    setPhoneFilter('');
    setUserTypeFilter('');
    setUrgencyFilter('');
    setCategoryFilter('');
    setAdminFilter('');
    setDateFilter('');
    setMonthFilter('');
    setYearFilter('');
  };

  const fetchTabCount = async (status: TabType, searchOverride?: string) => {
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '1',
        status,
      });

      const searchValue = searchOverride !== undefined ? searchOverride : searchTerm;
      if (searchValue) {
        params.append('search', searchValue);
      }

      const response = await fetch(`/api/admin/it-reports?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const total = data.pagination?.total || 0;
        setTabCounts(prev => ({
          ...prev,
          [status]: total
        }));
      }
    } catch (error) {
      console.error('Failed to fetch tab count:', error);
    }
  };

  const refreshAllTabCounts = async (searchOverride?: string) => {
    const statuses: TabType[] = ['pending', 'in_progress', 'completed', 'closed'];
    await Promise.all(statuses.map((status) => fetchTabCount(status, searchOverride)));
  };

  const handleAutoRefresh = async () => {
    await Promise.all([
      refreshAllTabCounts(searchTerm),
      fetchIssues(1)
    ]);
  };

  const resetViewState = () => {
    clearAllFilters();
    setActiveTab('pending');
    setCurrentPage(1);
    setShowFilters(false);
    setIssues([]);
    setFilteredIssues([]);
    setTotalPages(1);
    setTotalItems(0);
    setSelectedIssue(null);
    setShowDetailModal(false);
    setShowImageModal(false);
    setSelectedImage('');
    setShowAssignModal(false);
    setSelectedIssueForAssign(null);
    setAssigningAdminId(null);
    setShowConfirmModal(false);
    setConfirmAction(null);
    setWorkNotes('');
    setSendingWork(false);
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = 0;
    }
  };

  const handleRefresh = async () => {
    resetViewState();
    await Promise.all([
      refreshAllTabCounts(''),
      fetchIssues(1, 'pending', ''),
      fetchItAdmins()
    ]);
  };

  const applyFilters = () => {
    let filtered = issues.filter(issue => {

      // Filter by name (ชื่อ, นามสกุล, ชื่อเล่น)
      const matchesName = !nameFilter || 
        (issue.firstName && issue.firstName.toLowerCase().includes(nameFilter.toLowerCase())) ||
        (issue.lastName && issue.lastName.toLowerCase().includes(nameFilter.toLowerCase())) ||
        (issue.nickname && issue.nickname.toLowerCase().includes(nameFilter.toLowerCase()));

      // Filter by email
      const matchesEmail = !emailFilter || 
        issue.email.toLowerCase().includes(emailFilter.toLowerCase());

      // Filter by phone
      const matchesPhone = !phoneFilter || 
        issue.phone.includes(phoneFilter);

      // Filter by user type
      const matchesUserType = !userTypeFilter || 
        issue.userType === userTypeFilter;

      // Urgency filter
      const matchesUrgency = !urgencyFilter || issue.urgency === urgencyFilter;

      // Category filter
      const matchesCategory = !categoryFilter || issue.issueCategory === categoryFilter;

      // Admin filter (IT Admin ผู้รับงาน)
      const matchesAdmin = !adminFilter || 
        (adminFilter === 'unassigned' ? !issue.assignedAdmin?.name : issue.assignedAdmin?.name === adminFilter);

      // Date filter (วันที่แจ้งงาน)
      const matchesDate = !dateFilter || 
        new Date(issue.reportDate).toISOString().split('T')[0] === dateFilter;

      // Month and Year filter (ช่วงเวลา)
      let matchesMonthYear = true;
      if (monthFilter || yearFilter) {
        const issueDate = new Date(issue.reportDate);
        const issueMonth = issueDate.getMonth() + 1; // 1-12
        const issueYearBE = issueDate.getFullYear() + 543; // พ.ศ.
        
        if (monthFilter && parseInt(monthFilter) !== issueMonth) {
          matchesMonthYear = false;
        }
        if (yearFilter && parseInt(yearFilter) !== issueYearBE) {
          matchesMonthYear = false;
        }
      }

      return matchesName && matchesEmail && matchesPhone && matchesUserType && matchesUrgency && matchesCategory && matchesAdmin && matchesDate && matchesMonthYear;
    });

    // Server already sorts by urgency and date
    setFilteredIssues(filtered);
  };

  const fetchItAdmins = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const users = await response.json();
        // กรองเฉพาะ users ที่มี userRole = 'it_admin' เท่านั้น
        const itAdminUsers = users
          .filter((user: any) => user.userRole === 'it_admin')
          .map((user: any) => ({
            id: user._id,
            userId: user.user_id,
            name: user.userType === 'individual' 
              ? `${user.firstName} ${user.lastName}`.trim()
              : user.office,
            email: user.email
          }));
        setItAdmins(itAdminUsers);
      }
    } catch (error) {
      console.error('Failed to fetch IT admins:', error);
    }
  };



  const handleAcceptJob = (issue: ITIssue) => {
    setSelectedIssueForAssign(issue);
    setShowAssignModal(true);
    setAssigningAdminId(null); // Reset loading state when opening modal
  };

  const handleAssignAdmin = async (admin: ITAdmin) => {
    if (!selectedIssueForAssign) return;

    // Set loading state for the clicked admin
    setAssigningAdminId(admin.id);

    try {
      const response = await fetch(`/api/admin/it-reports/${selectedIssueForAssign._id}/send-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedAdminId: admin.userId,  // ส่ง userId แทน name/email
          assignedAdmin: {                 // เก็บไว้เพื่อ backward compatibility
            name: admin.name,
            email: admin.email
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setShowAssignModal(false);
        setSelectedIssueForAssign(null);
        await handleAutoRefresh();
      } else {
        const data = await response.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      // Clear loading state
      setAssigningAdminId(null);
    }
  };

  const handleStatusChange = async (issueId: string, currentStatus: string) => {
    if (currentStatus === 'pending') {
      // For pending, show assign modal
      const issue = issues.find(i => i._id === issueId);
      if (issue) {
        handleAcceptJob(issue);
      }
      return;
    }

    // For in_progress, show confirmation modal
    const actionText = 'ส่งงาน';
    setWorkNotes(''); // Reset notes when opening modal
    setConfirmAction({ id: issueId, status: currentStatus, text: actionText });
    setShowConfirmModal(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    setSendingWork(true);
    try {
      const response = await fetch(`/api/admin/it-reports/${confirmAction.id}/send-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          notes: workNotes.trim() || undefined 
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        await handleAutoRefresh();
      } else {
        const data = await response.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSendingWork(false);
      setShowConfirmModal(false);
      setConfirmAction(null);
      setWorkNotes(''); // Clear notes after sending
    }
  };

  const handleViewDetails = (issue: ITIssue) => {
    setSelectedIssue(issue);
    setShowDetailModal(true);
  };

  const exportToExcel = async () => {
    try {
      // ✅ ใช้ filteredIssues ที่ filter แล้วใน client-side แทนการเรียก API ใหม่
      // เพื่อให้ export ตามฟิลเตอร์ที่เลือก
      const allIssues = filteredIssues;

      if (allIssues.length === 0) {
        toast.error('ไม่มีข้อมูลให้ Export', { id: 'export-loading' });
        return;
      }

      toast.loading('กำลังสร้างไฟล์ Excel...', { id: 'export-loading' });

      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const sheetName = getTabDisplayName(activeTab);
      const worksheet = workbook.addWorksheet(sheetName);

      // ตั้งค่าคอลัมน์
      worksheet.columns = [
        { header: 'ลำดับ', key: 'no', width: 8 },
        { header: 'วันที่แจ้ง', key: 'reportDate', width: 15 },
        { header: 'ความเร่งด่วน', key: 'urgency', width: 12 },
        { header: 'Issue ID', key: 'issueId', width: 15 },
        { header: 'ประเภทผู้ใช้', key: 'userType', width: 12 },
        { header: 'ชื่อ-นามสกุล', key: 'name', width: 25 },
        { header: 'เบอร์โทร', key: 'phone', width: 15 },
        { header: 'อีเมล', key: 'email', width: 25 },
        { header: 'แผนก', key: 'department', width: 20 },
        { header: 'สาขา', key: 'office', width: 20 },
        { header: 'หัวข้อปัญหา', key: 'issueCategory', width: 25 },
        { header: 'รายละเอียดปัญหา', key: 'description', width: 40 },
        { header: 'สถานะงาน', key: 'status', width: 15 },
        { header: 'วันที่แอดมินรับงาน', key: 'acceptedDate', width: 20 },
        { header: 'วันที่แอดมินดำเนินการเสร็จ', key: 'completedDate', width: 25 },
        { header: 'วันที่ปิดงาน', key: 'closedDate', width: 20 },
        { header: 'IT Admin ผู้รับงาน', key: 'assignedAdmin', width: 25 },
        { header: 'รูปภาพ', key: 'images', width: 25 },
        { header: 'หมายเหตุล่าสุด (Admin)', key: 'latestAdminNote', width: 30 },
        { header: 'หมายเหตุล่าสุด (ผู้แจ้ง)', key: 'latestUserNote', width: 30 },
      ];

      // เพิ่มข้อมูลและรูปภาพ
      for (let index = 0; index < allIssues.length; index++) {
        const issue = allIssues[index];
        
        // สร้างชื่อ-นามสกุลพร้อมชื่อเล่น
        const fullName = issue.firstName && issue.lastName 
          ? `${issue.firstName} ${issue.lastName}${issue.nickname ? ` (${issue.nickname})` : ''}`
          : '(ผู้ใช้ถูกลบแล้ว)';

        // หาหมายเหตุล่าสุดจาก admin (ต้องเป็น admin เท่านั้น ไม่ใช่ user)
        const latestAdminNote = issue.notesHistory && issue.notesHistory.length > 0
          ? issue.notesHistory
              .filter((note: any) => note.adminId && note.adminName) // กรองเฉพาะหมายเหตุจาก admin
              .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // เรียงตามวันที่ล่าสุด
              .map((note: any) => note.note)[0] || '-'
          : (issue.notes || '-');

        // หาหมายเหตุล่าสุดจากผู้แจ้ง
        let latestUserNote = '-';
        if (issue.userFeedbackHistory && issue.userFeedbackHistory.length > 0) {
          // เรียงตามวันที่ล่าสุดและเอาหมายเหตุล่าสุด
          const latestFeedback = issue.userFeedbackHistory
            .sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
          latestUserNote = latestFeedback.reason;
        } else if (issue.userFeedback) {
          // Fallback สำหรับข้อมูลเก่า
          latestUserNote = issue.userFeedback.reason;
        } else if (issue.status === 'closed') {
          // ถ้าปิดงานแล้วแต่ไม่มี feedback ให้แสดง "แก้ไขสำเร็จ"
          latestUserNote = 'แก้ไขสำเร็จ';
        }

        const excelRow = worksheet.addRow({
          no: index + 1,
          reportDate: new Date(issue.reportDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }),
          urgency: issue.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ',
          issueId: issue.issueId,
          userType: issue.userType === 'branch' ? 'สาขา' : 'บุคคล',
          name: fullName,
          phone: issue.phone,
          email: issue.email,
          department: issue.department,
          office: issue.office,
          issueCategory: issue.issueCategory + (issue.customCategory ? ` (${issue.customCategory})` : ''),
          description: issue.description,
          status: getStatusDisplayName(issue.status),
          acceptedDate: issue.acceptedDate ? new Date(issue.acceptedDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-',
          completedDate: issue.completedDate ? new Date(issue.completedDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-',
          closedDate: issue.closedDate ? new Date(issue.closedDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-',
          assignedAdmin: issue.assignedAdmin?.name || '-',
          images: '',
          latestAdminNote: latestAdminNote,
          latestUserNote: latestUserNote,
        });

        // ถ้ามีรูปภาพ ให้ใส่รูปลงใน Excel
        if (issue.images && issue.images.length > 0) {
          try {
            // ใส่รูปภาพแรกเท่านั้น (เพื่อไม่ให้ไฟล์ใหญ่เกินไป)
            const firstImage = issue.images[0];
            const imagePath = `/assets/IssueLog/${firstImage}`;
            const response = await fetch(imagePath);
            
            if (response.ok) {
              const blob = await response.blob();
              const arrayBuffer = await blob.arrayBuffer();
              
              // กำหนดนามสกุลไฟล์
              const ext = firstImage.toLowerCase().split('.').pop() || 'png';
              const imageId = workbook.addImage({
                buffer: arrayBuffer,
                extension: ext === 'jpg' ? 'jpeg' : ext as any,
              });

              // ปรับความสูงของแถวให้พอดีกับรูป
              excelRow.height = 80;

              // ใส่รูปลงใน cell (คอลัมน์รูปภาพอยู่ที่ตำแหน่ง 17)
              worksheet.addImage(imageId, {
                tl: { col: 16, row: index + 1 },
                ext: { width: 90, height: 90 },
                editAs: 'oneCell'
              });

              // ไม่แสดงข้อความใดๆ เมื่อมีรูป (แสดงแค่รูป)
              excelRow.getCell('images').value = '';
            }
          } catch (error) {
            console.error('Error loading image:', error);
            excelRow.getCell('images').value = 'ไม่สามารถโหลดรูปได้';
          }
        } else {
          excelRow.getCell('images').value = 'ไม่มีรูป';
        }
      }

      // จัดรูปแบบ header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 25;

      // จัดตำแหน่งข้อมูลทุก cell ให้อยู่กึ่งกลาง
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.eachCell({ includeEmpty: true }, (cell) => {
            cell.alignment = { 
              vertical: 'middle', 
              horizontal: 'center', 
              wrapText: true 
            };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };
          });
        } else {
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
      
      const filename = `รายงานแจ้งงานIT_${sheetName}_${dateStr}_${timeStr}.xlsx`;

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
      toast.success(`ส่งออกข้อมูล ${allIssues.length} รายการสำเร็จ`);
    } catch (error) {
      console.error('Export error:', error);
      toast.dismiss('export-loading');
      toast.error('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    }
  };

  const getTabDisplayName = (tab: TabType) => {
    switch (tab) {
      case 'pending': return 'รอดำเนินการ';
      case 'in_progress': return 'กำลังดำเนินการ';
      case 'completed': return 'รอผู้ใช้ตรวจสอบ';
      case 'closed': return 'ปิดงาน';
      default: return 'รายงานแจ้งงานIT';
    }
  };

  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case 'pending': return 'รอดำเนินการ';
      case 'in_progress': return 'กำลังดำเนินการ';
      case 'completed': return 'รอผู้ใช้ตรวจสอบ';
      case 'closed': return 'ปิดงานแล้ว';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3.5 h-3.5" />;
      case 'in_progress':
        return <AlertTriangle className="w-3.5 h-3.5" />;
      case 'completed':
        return <AlertTriangle className="w-3.5 h-3.5" />;
      case 'closed':
        return <CheckCircle className="w-3.5 h-3.5" />;
      default:
        return <XCircle className="w-3.5 h-3.5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'closed':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">รอดำเนินการ</span>;
      case 'in_progress':
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">กำลังดำเนินการ</span>;
      case 'completed':
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">รอผู้ใช้ตรวจสอบ</span>;
      case 'closed':
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">ปิดงานแล้ว</span>;
      default:
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    return urgency === 'very_urgent' ? 
      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">ด่วนมาก</span> :
      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">ปกติ</span>;
  };

  // Get unique admins from issues
  const getUniqueAdmins = () => {
    const admins = new Set<string>();
    issues.forEach(issue => {
      if (issue.assignedAdmin?.name) {
        admins.add(issue.assignedAdmin.name);
      }
    });
    return Array.from(admins).sort();
  };

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

  // Client-side display (server already handles pagination)
  const currentItems = filteredIssues;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  const getNoDataColSpan = () => {
    return activeTab === 'completed' ? 12 : 11; // เพิ่ม 1 เพื่อรองรับคอลัมน์ประเภทผู้ใช้
  };

  return (
    <Layout>
      <div className="max-w-full mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
          {/* Header */}
          <div className="flex flex-col justify-between items-center mb-7 xl:flex-row">
            <h1 className="text-2xl text-center xl:text-left font-semibold text-gray-900 pb-5 xl:pb-0">รายงานแจ้งงาน IT</h1> 
            <div className="flex flex-wrap justify-center gap-4 w-full xl:w-auto">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="w-full min-[400px]:w-3/5 min-[481px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>ฟิลเตอร์</span>
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="w-full min-[400px]:w-3/5 min-[481px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>รีเฟรช</span>
              </button>

              <button
                onClick={exportToExcel}
                disabled={loading || totalItems === 0}
                className="w-full min-[400px]:w-3/5 min-[481px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={totalItems === 0 ? 'ไม่มีข้อมูลให้ Export' : 'Export ข้อมูลเป็น Excel'}
              >
                <Upload className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
              <div className="grid max-[768px]:grid-cols-1 max-[1120px]:grid-cols-2 grid-cols-4 gap-4">
                {/* Search Issue ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ค้นหา Issue ID
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="พิมพ์เพื่อค้นหา..."
                    />
                  </div>
                </div>

                {/* Name Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ค้นหา ชื่อ-นามสกุล (ชื่อเล่น)
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="พิมพ์เพื่อค้นหา..."
                    />
                  </div>
                </div>

                {/* Email Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ค้นหาอีเมล
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={emailFilter}
                      onChange={(e) => setEmailFilter(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="พิมพ์เพื่อค้นหา..."
                    />
                  </div>
                </div>

                {/* Phone Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ค้นหาเบอร์
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={phoneFilter}
                      onChange={(e) => setPhoneFilter(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="พิมพ์เพื่อค้นหา..."
                    />
                  </div>
                </div>

                {/* User Type Filter */}
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

                {/* Urgency Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ความเร่งด่วน
                  </label>
                  <SearchableSelect
                    options={[
                      { value: 'very_urgent', label: 'ด่วนมาก' },
                      { value: 'normal', label: 'ปกติ' }
                    ]}
                    value={urgencyFilter}
                    onChange={setUrgencyFilter}
                    placeholder="ทั้งหมด"
                  />
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หัวข้อปัญหา
                  </label>
                  <SearchableSelect
                    options={categories.map(category => ({ value: category, label: category }))}
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    placeholder="ทั้งหมด"
                  />
                </div>

                {/* Admin Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ผู้รับผิดชอบ
                  </label>
                  <SearchableSelect
                    options={[
                      { value: 'unassigned', label: 'รอรับงาน' },
                      ...getUniqueAdmins().map(admin => ({ value: admin, label: admin }))
                    ]}
                    value={adminFilter}
                    onChange={setAdminFilter}
                    placeholder="ทั้งหมด"
                  />
                </div>

                {/* Date Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่แจ้งงาน
                  </label>
                  <DatePicker
                    value={dateFilter}
                    onChange={(date) => setDateFilter(date)}
                    placeholder="dd/mm/yyyy"
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

              {/* Clear Filters Button */}
              {(searchTerm || nameFilter || emailFilter || phoneFilter || userTypeFilter || urgencyFilter || categoryFilter || adminFilter || dateFilter || monthFilter || yearFilter) && (
                <div className="flex justify-end">
                  <button
                    onClick={clearAllFilters}
                    className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <X className="w-4 h-4 mr-1" />
                    ล้างฟิลเตอร์ทั้งหมด
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6 overflow-x-auto overflow-y-hidden">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'pending', label: 'รอดำเนินการ', icon: Clock, count: tabCounts.pending },
                { key: 'in_progress', label: 'กำลังดำเนินการ', icon: CheckCircle, count: tabCounts.in_progress },
                { key: 'completed', label: 'รอผู้ใช้ตรวจสอบ', icon: AlertTriangle, count: tabCounts.completed },
                { key: 'closed', label: 'ปิดงาน', icon: XCircle, count: tabCounts.closed },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as TabType)}
                    className={`flex max-[580px]:flex-col max-[580px]:gap-2 max-[580px]:mr-3 items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className='flex max-[560px]:flex-row items-center max-[560px]:mr-0 gap-2'>
                      <Icon className="w-4 h-4" />
                      <span className="w-max">{tab.label}</span>
                    </div>
                      
                    <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-semibold leading-none rounded-full ${
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
            <table className="min-w-[140%] divide-y divide-gray-200">
              <thead className="bg-blue-600">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    วันที่แจ้ง
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    ความเร่งด่วน
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    Issue ID
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    ประเภทผู้ใช้
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    ชื่อ-นามสกุล
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    เบอร์โทร
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    อีเมล
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    หัวข้อปัญหา
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    รายละเอียด
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    สถานะงาน
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    IT Admin ผู้รับงาน
                  </th>
                  {(activeTab === 'pending' || activeTab === 'in_progress') && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      การดำเนินการ
                    </th>
                  )}
                  {activeTab !== 'pending' && activeTab !== 'in_progress' && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                      วันที่ดำเนินการเสร็จ
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading && (
                  <tr>
                    <td colSpan={getNoDataColSpan()} className="px-6 py-8 text-center text-gray-500">
                      <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                      กำลังโหลดข้อมูล
                    </td>
                  </tr>
                )}
                {!loading && currentItems.length === 0 && (
                  <tr>
                    <td colSpan={getNoDataColSpan()} className="px-6 py-8 text-center text-gray-500">ไม่พบข้อมูล</td>
                  </tr>
                )}
                {currentItems.map((issue, index) => (
                  <tr 
                    key={issue._id} 
                    className={issue.urgency === 'very_urgent' ? 'bg-yellow-50' : (index % 2 === 0 ? 'bg-white' : 'bg-blue-50')}
                  >
                    <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                      {new Date(issue.reportDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getUrgencyBadge(issue.urgency)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-blue-600 text-center text-selectable">
                      {issue.issueId}
                    </td>
                    {/* ประเภทผู้ใช้ */}
                    <td className="px-6 py-4 text-sm text-center text-selectable">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        issue.userType === 'branch' 
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-green-100 text-green-800 border border-green-300'
                      }`}>
                        {issue.userType === 'branch' ? 'สาขา' : 'บุคคล'}
                      </span>
                    </td>
                    
                    {/* ชื่อ-นามสกุล */}
                    <td className="px-6 py-4 text-sm text-center text-selectable">
                      <div className={
                        (issue as any).userId?.pendingDeletion 
                          ? 'text-orange-600' 
                          : !issue.firstName 
                          ? 'text-gray-500 italic' 
                          : 'text-gray-900'
                      }>
                        {issue.firstName && issue.lastName ? (
                          <>
                            {issue.firstName} {issue.lastName}{issue.nickname ? ` (${issue.nickname})` : ''}
                            {(issue as any).userId?.pendingDeletion && ' (รอลบ)'}
                          </>
                        ) : (
                          '(ผู้ใช้ถูกลบแล้ว)'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                      {issue.phone}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                      {issue.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                      {issue.issueCategory}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleViewDetails(issue)}
                        className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-sm cursor-pointer mx-auto"
                      >
                        <Eye className="w-4 h-4" />
                        <span>ดูรายละเอียด</span>
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(issue.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-selectable">
                      {issue.assignedAdmin?.name ? (
                        <span className="text-green-700 font-medium">{issue.assignedAdmin.name}</span>
                      ) : (
                        <span className="text-yellow-700 font-medium">รอรับงาน</span>
                      )}
                    </td>
                    {activeTab === 'pending' && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleStatusChange(issue._id, 'pending')}
                          className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm cursor-pointer mx-auto"
                        >
                          <Clock className="w-4 h-4" />
                          <span>รับงาน</span>
                        </button>
                      </td>
                    )}
                    {activeTab === 'in_progress' && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleStatusChange(issue._id, 'in_progress')}
                          className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm cursor-pointer mx-auto"
                        >
                          <Send className="w-4 h-4" />
                          <span>ส่งงาน</span>
                        </button>
                      </td>
                    )}
                    {activeTab !== 'pending' && activeTab !== 'in_progress' && (
                      <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                        {issue.completedDate ? new Date(issue.completedDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-'}
                      </td>
                    )}

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total Count Display */}
          {!loading && totalItems > 0 && (
            <div className="mt-4">
              <span className="text-sm text-gray-700">
                แสดงทั้งหมด {totalItems} รายการ (หน้า {currentPage}/{totalPages})
              </span>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center text-sm text-gray-700">
                <span>
                  แสดง {startIndex + 1} ถึง {endIndex} จาก {totalItems} รายการ
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

        {/* Detail Modal */}
        {showDetailModal && selectedIssue && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetailModal(false)}
          >
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-4xl w-full mx-4 border border-white/20 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                      รายละเอียดงาน <br/><span className='text-blue-500 text-lg'>Issue ID: {selectedIssue.issueId}</span>
                    </h3>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border-2 ${getStatusColor(selectedIssue.status)}`}>
                        {getStatusIcon(selectedIssue.status)}
                        <span className="ml-2">{getStatusDisplayName(selectedIssue.status)}</span>
                      </span>
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full border-2 ${
                        selectedIssue.urgency === 'very_urgent' 
                          ? 'bg-red-50 text-red-700 border-red-300'
                          : 'bg-gray-50 text-gray-700 border-gray-300'
                      }`}>
                        ความเร่งด่วน: {selectedIssue.urgency === 'very_urgent' ? 'ด่วนมาก' : 'ปกติ'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors items-start"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* ข้อมูลผู้แจ้ง */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <div className="w-1 h-6 bg-blue-500 rounded-full mr-3"></div>
                      ข้อมูลผู้แจ้ง
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white p-3 rounded-lg">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">ชื่อ-นามสกุล</label>
                        <div className={
                          (selectedIssue as any).userId?.pendingDeletion 
                            ? 'text-orange-600' 
                            : !selectedIssue.firstName 
                            ? 'text-gray-500 italic' 
                            : 'text-gray-900'
                        }>
                          {selectedIssue.firstName && selectedIssue.lastName ? (
                            <>
                              <p className="font-medium">
                                {selectedIssue.firstName} {selectedIssue.lastName} <span className="text-gray-600"> ({selectedIssue.nickname})</span>
                                {(selectedIssue as any).userId?.pendingDeletion && ' (รอลบ)'}
                              </p>
                            </>
                          ) : (
                            <p className="font-medium">(ผู้ใช้ถูกลบแล้ว)</p>
                          )}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-lg">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">เบอร์โทร</label>
                        <p className="text-gray-900 font-medium">{selectedIssue.phone}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">อีเมลผู้แจ้ง</label>
                        <p className="text-gray-900 font-medium break-all">{selectedIssue.email}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">แผนก</label>
                        <p className="text-gray-900 font-medium">{selectedIssue.department}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">ออฟฟิศ/สาขา</label>
                        <p className="text-gray-900 font-medium">{selectedIssue.office}</p>
                      </div>
                    </div>
                  </div>

                  {/* IT Admin ผู้รับผิดชอบ */}
                  <div className={`p-5 rounded-xl border-2 ${
                    selectedIssue.assignedAdmin?.name
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' 
                      : 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200'
                  }`}>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <div className={`w-1 h-6 rounded-full mr-3 ${selectedIssue.assignedAdmin?.name ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      ชื่อ IT Admin ผู้รับผิดชอบ
                    </h4>
                    {selectedIssue.assignedAdmin?.name ? (
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-green-900 font-bold text-lg">{selectedIssue.assignedAdmin.name}</p>
                        <p className="text-green-600 text-sm mt-1">{selectedIssue.assignedAdmin.email}</p>
                      </div>
                    ) : (
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-yellow-900 font-semibold">รอ Admin รับงาน</p>
                      </div>
                    )}
                  </div>

                  {/* รายละเอียดปัญหา */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <div className="w-1 h-6 bg-purple-500 rounded-full mr-3"></div>
                      รายละเอียดปัญหา
                    </h4>
                    
                    <div className="space-y-4">
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                        <label className="block text-sm font-semibold text-purple-700 mb-2">ประเภทปัญหา / หัวข้อ</label>
                        <p className="text-gray-900 font-medium text-lg">
                          {selectedIssue.issueCategory}
                          {selectedIssue.customCategory && (
                            <span className="text-purple-600"> ({selectedIssue.customCategory})</span>
                          )}
                        </p>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">รายละเอียด</label>
                        <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{selectedIssue.description}</p>
                      </div>

                      {/* รูปภาพ */}
                      {selectedIssue.images && selectedIssue.images.length > 0 && (
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                          <label className="block text-sm font-semibold text-indigo-700 mb-3">รูปภาพประกอบ ({selectedIssue.images.length} รูป)</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {selectedIssue.images.map((image, index) => (
                              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-indigo-200 hover:border-indigo-400 transition-colors bg-gray-100">
                                <img 
                                  src={`/assets/IssueLog/${image}`} 
                                  alt={`รูปภาพปัญหา ${index + 1}`}
                                  className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                                  onClick={() => {
                                    setSelectedImage(`/assets/IssueLog/${image}`);
                                    setShowImageModal(true);
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline Section */}
                  <div className="bg-gradient-to-r from-green-50 to-teal-50 p-5 rounded-xl border border-green-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <div className="w-1 h-6 bg-green-500 rounded-full mr-3"></div>
                      ไทม์ไลน์
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* วันที่แจ้งงาน */}
                      <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
                        <label className="block text-sm font-semibold text-green-700 mb-1">วันที่แจ้งงาน</label>
                        <p className="text-gray-900 font-medium">
                          {new Date(selectedIssue.reportDate).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            timeZone: 'Asia/Bangkok'
                          })}
                        </p>
                        <p className="text-gray-600 text-sm">
                          {new Date(selectedIssue.reportDate).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}
                        </p>
                      </div>
                      
                      {/* วันที่แอดมินรับงาน */}
                      <div className={`bg-white p-4 rounded-lg border-l-4 ${selectedIssue.acceptedDate ? 'border-blue-500' : 'border-gray-300'}`}>
                        <label className="block text-sm font-semibold text-blue-700 mb-1">วันที่แอดมินรับงาน</label>
                        {selectedIssue.acceptedDate ? (
                          <>
                            <p className="text-gray-900 font-medium">
                              {new Date(selectedIssue.acceptedDate).toLocaleDateString('th-TH', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                timeZone: 'Asia/Bangkok'
                              })}
                            </p>
                            <p className="text-gray-600 text-sm">
                              {new Date(selectedIssue.acceptedDate).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}
                            </p>
                          </>
                        ) : (
                          <p className="text-gray-400 font-medium">-</p>
                        )}
                      </div>

                      {/* วันที่แอดมินดำเนินการเสร็จ */}
                      <div className={`bg-white p-4 rounded-lg border-l-4 ${selectedIssue.completedDate ? 'border-purple-500' : 'border-gray-300'}`}>
                        <label className="block text-sm font-semibold text-purple-700 mb-1">วันที่แอดมินดำเนินการเสร็จ</label>
                        {selectedIssue.completedDate ? (
                          <>
                            <p className="text-gray-900 font-medium">
                              {new Date(selectedIssue.completedDate).toLocaleDateString('th-TH', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                timeZone: 'Asia/Bangkok'
                              })}
                            </p>
                            <p className="text-gray-600 text-sm">
                              {new Date(selectedIssue.completedDate).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}
                            </p>
                          </>
                        ) : (
                          <p className="text-gray-400 font-medium">-</p>
                        )}
                      </div>
                      
                      {/* วันที่ปิดงาน */}
                      <div className={`bg-white p-4 rounded-lg border-l-4 ${selectedIssue.closedDate ? 'border-emerald-500' : 'border-gray-300'}`}>
                        <label className="block text-sm font-semibold text-emerald-700 mb-1">วันที่ปิดงาน</label>
                        {selectedIssue.closedDate ? (
                          <>
                            <p className="text-gray-900 font-medium">
                              {new Date(selectedIssue.closedDate).toLocaleDateString('th-TH', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                timeZone: 'Asia/Bangkok'
                              })}
                            </p>
                            <p className="text-gray-600 text-sm">
                              {new Date(selectedIssue.closedDate).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}
                            </p>
                          </>
                        ) : (
                          <p className="text-gray-400 font-medium">-</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* หมายเหตุจาก Admin */}
                  <div className="bg-yellow-50 p-5 rounded-xl border border-yellow-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <div className="w-1 h-6 bg-yellow-500 rounded-full mr-3"></div>
                      หมายเหตุจาก Admin
                    </h4>
                    
                    {/* แสดงประวัติหมายเหตุทั้งหมด */}
                    {selectedIssue.notesHistory && selectedIssue.notesHistory.length > 0 ? (
                      <div className="space-y-3">
                        {selectedIssue.notesHistory.map((noteEntry, index) => (
                          <div key={index} className="bg-white p-4 rounded-lg border-l-4 border-yellow-400">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-sm font-semibold text-yellow-700">
                                {noteEntry.adminName}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(noteEntry.createdAt).toLocaleDateString('th-TH', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  timeZone: 'Asia/Bangkok'
                                })}
                              </span>
                            </div>
                            <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                              {noteEntry.note}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : selectedIssue.notes ? (
                      // Fallback สำหรับข้อมูลเก่าที่ยังไม่มี history
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                          {selectedIssue.notes}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-gray-900 leading-relaxed">-</p>
                      </div>
                    )}
                  </div>

                  {/* หมายเหตุจากผู้แจ้ง */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <div className="w-1 h-6 bg-gray-500 rounded-full mr-3"></div>
                      หมายเหตุจากผู้แจ้ง
                    </h4>
                    
                    {/* แสดงประวัติ feedback ทั้งหมด */}
                    {selectedIssue.userFeedbackHistory && selectedIssue.userFeedbackHistory.length > 0 ? (
                      <div className="space-y-3">
                        {selectedIssue.userFeedbackHistory.map((feedback, index) => (
                          <div key={index} className={`p-4 rounded-lg border-l-4 ${
                            feedback.action === 'rejected' 
                              ? 'bg-red-50 border-red-400' 
                              : 'bg-green-50 border-green-400'
                          }`}>
                            <div className="flex justify-between items-start mb-2">
                              <span className={`text-sm font-semibold ${
                                feedback.action === 'rejected' ? 'text-red-700' : 'text-green-700'
                              }`}>
                                {feedback.action === 'rejected' ? '🔄 ไม่ปิดงาน' : '✅ ปิดงาน'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(feedback.submittedAt).toLocaleDateString('th-TH', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  timeZone: 'Asia/Bangkok'
                                })}
                              </span>
                            </div>
                            <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                              {feedback.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : selectedIssue.userFeedback ? (
                      // Fallback สำหรับข้อมูลเก่าที่ยังไม่มี history
                      <div className={`bg-white p-4 rounded-lg border-l-4 ${
                        selectedIssue.userFeedback.action === 'rejected' 
                          ? 'border-red-400' 
                          : 'border-green-400'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-sm font-semibold ${
                            selectedIssue.userFeedback.action === 'rejected' ? 'text-red-700' : 'text-green-700'
                          }`}>
                            {selectedIssue.userFeedback.action === 'rejected' ? '🔄 ไม่ปิดงาน' : '✅ ปิดงาน'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(selectedIssue.userFeedback.submittedAt).toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Asia/Bangkok'
                            })}
                          </span>
                        </div>
                        <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                          {selectedIssue.userFeedback.reason}
                        </p>
                      </div>
                    ) : selectedIssue.status === 'closed' ? (
                      <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                        <span className="text-sm font-semibold text-green-700">✅ ปิดงาน</span>
                        <p className="text-gray-900 leading-relaxed mt-2">แก้ไขสำเร็จ</p>
                      </div>
                    ) : (
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-gray-900 leading-relaxed">-</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                  >
                    ปิด
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
                alt="Full size"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        )}



        {/* Assign Admin Modal */}
        {showAssignModal && selectedIssueForAssign && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full border border-white/20">
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">เลือก IT Admin</h3>
                <button 
                  onClick={() => {
                    setShowAssignModal(false);
                    setAssigningAdminId(null); // Reset loading state when closing modal
                  }} 
                  className="text-gray-400 hover:text-gray-600"
                  disabled={assigningAdminId !== null}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100 mb-6">
                  <p className="text-sm text-gray-900 mb-2">
                    เลือก IT Admin ที่จะรับผิดชอบงาน
                  </p>
                  <p className="text-lg font-semibold text-blue-700">#{selectedIssueForAssign.issueId}</p>
                </div>
                
                {itAdmins.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"></path>
                      </svg>
                    </div>
                    <p className="text-gray-800 text-lg mb-2">ไม่มี IT Admin ในระบบ</p>
                    <p className="text-gray-500 text-sm mb-6">กรุณาเพิ่ม User ที่มี role "Admin ทีม IT" ก่อนใช้งาน</p>
                    <button
                      onClick={() => {
                        setShowAssignModal(false);
                        window.open('/admin/users', '_blank');
                      }}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        จัดการ Users
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">เลือก IT Admin ที่เหมาะสม</h4>
                    {itAdmins.map((admin) => {
                      const isLoading = assigningAdminId === admin.id;
                      return (
                        <button
                          key={admin.id}
                          onClick={() => handleAssignAdmin(admin)}
                          disabled={assigningAdminId !== null}
                          className={`w-full p-4 text-left border rounded-xl transition-colors group ${
                            isLoading
                              ? 'bg-blue-100 border-blue-400 cursor-wait'
                              : assigningAdminId !== null
                              ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed'
                              : 'bg-gray-50 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                              isLoading
                                ? 'bg-blue-200'
                                : 'bg-blue-100 group-hover:bg-blue-200'
                            }`}>
                              <span className="text-blue-600 font-semibold text-sm">
                                {admin.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900">{admin.name}</p>
                                {isLoading && (
                                  <div className="flex items-center gap-1 text-blue-600">
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span className="text-xs font-medium">กำลังโหลด...</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{admin.email}</p>
                            </div>
                            <div className="ml-auto">
                              {!isLoading && assigningAdminId === null && (
                                <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                </svg>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && confirmAction && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-lg w-full border border-white/20">
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">ยืนยันการส่งงาน</h3>
                <button 
                  onClick={() => setShowConfirmModal(false)} 
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-4">
                  <p className="text-gray-900 text-center">
                    คุณต้องการ<span className="font-semibold text-orange-700">{confirmAction.text}</span>นี้หรือไม่?
                  </p>
                  <p className="text-sm text-gray-600 text-center mt-2">
                    การดำเนินการนี้จะเปลี่ยนสถานะงานเป็น "รอผู้ใช้ตรวจสอบ"
                  </p>
                </div>

                {/* Notes Input */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📝 หมายเหตุ (ไม่บังคับ)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    บันทึกรายละเอียดการแก้ไข เช่น เปลี่ยนอุปกรณ์, ติดตั้งโปรแกรม, แก้ไขการตั้งค่า ฯลฯ
                  </p>
                  <textarea
                    value={workNotes}
                    onChange={(e) => setWorkNotes(e.target.value)}
                    placeholder="ระบุรายละเอียดการแก้ไข..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {workNotes.length} ตัวอักษร
                  </p>
                </div>
                
                <div className="flex space-x-3 justify-end">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    disabled={sendingWork}
                    className="px-5 py-2.5 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleConfirmAction}
                    disabled={sendingWork}
                    className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingWork ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        กำลังส่งงาน...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        ส่งงาน
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
