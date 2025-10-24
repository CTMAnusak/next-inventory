'use client';

import React, { useState, useEffect, useRef } from 'react';
import { enableDragScroll } from '@/lib/drag-scroll';
import { isSIMCardSync } from '@/lib/sim-card-helpers';
import { IConditionConfig } from '@/models/InventoryConfig';
import ExcelJS from 'exceljs';

// Extend window object for TypeScript
declare global {
  interface Window {
    fetchingAvailableItems: string | null;
  }
}
import Layout from '@/components/Layout';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Download, 
  Edit, 
  Trash2, 
  Filter,
  X,
  Save,
  Settings,
  MoreVertical,
  Edit3,
  AlertTriangle,
  Info,
  Shield
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import DraggableList from '@/components/DraggableList';
import CategoryConfigList from '@/components/CategoryConfigList';
import StatusConfigList from '@/components/StatusConfigList';
import ConditionConfigList from '@/components/ConditionConfigList';
import CategoryDeleteConfirmModal from '@/components/CategoryDeleteConfirmModal';
import StatusDeleteConfirmModal from '@/components/StatusDeleteConfirmModal';
import ConditionDeleteConfirmModal from '@/components/ConditionDeleteConfirmModal';
import DatePicker from '@/components/DatePicker';
import { 
  getStatusNameById, 
  getStatusClass as getStatusClassHelper,
  getDisplayStatusText,
  getStatusOptions,
  matchesStatusFilter,
  createStatusConfigsFromStatuses
} from '@/lib/status-helpers';
import { useTokenWarning } from '@/hooks/useTokenWarning';
import TokenExpiryModal from '@/components/TokenExpiryModal';
import ErrorModal from '@/components/ErrorModal';
import SimpleErrorModal from '@/components/SimpleErrorModal';
import { handleTokenExpiry } from '@/lib/auth-utils';
import GroupedRecycleBinModal from '@/components/GroupedRecycleBinModal';
import RecycleBinWarningModal from '@/components/RecycleBinWarningModal';
import StatusCell from '@/components/StatusCell';


interface InventoryItem {
  _id: string;
  itemName: string;
  categoryId: string; // Use categoryId as primary field
  quantity: number;
  totalQuantity?: number;
  serialNumbers?: string[]; // แก้ไขจาก serialNumber เป็น serialNumbers
  status: string; // Deprecated - will be removed
  statusId?: string; // New field for status reference
  condition?: string; // New field for condition reference
  dateAdded: string;
}

interface ICategoryConfig {
  id: string;
  name: string;
  isSystemCategory: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

interface IStatusConfig {
  id: string;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}


interface InventoryFormData {
  itemName: string;
  categoryId: string;
  quantity: number;
  totalQuantity: number;
  serialNumber: string;
  status: string;
  condition: string;
}

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [breakdownData, setBreakdownData] = useState<Record<string, any>>({});
  const [breakdownRefreshCounter, setBreakdownRefreshCounter] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);

  // RecycleBin Warning Modal State
  const [showRecycleBinWarning, setShowRecycleBinWarning] = useState(false);
  const [recycleBinWarningData, setRecycleBinWarningData] = useState({
    itemName: '',
    serialNumber: ''
  });

  // Simple Error Modal State
  const [showSimpleError, setShowSimpleError] = useState(false);
  const [simpleErrorMessage, setSimpleErrorMessage] = useState('');

  // Token expiry warning
  const { 
    timeToExpiry, 
    hasWarned, 
    showModal, 
    showLogoutModal, 
    handleCloseModal, 
    handleLogoutConfirm 
  } = useTokenWarning();

  // Helper function to handle API responses with token expiry
  const handleApiResponse = async (response: Response, errorMessage?: string) => {
    if (handleTokenExpiry(response, errorMessage)) {
      return null; // Token expired, stop processing
    }
    return response;
  };
  
  // Stock Rename states
  const [showStockRename, setShowStockRename] = useState(false);
  const [stockRenameOldName, setStockRenameOldName] = useState('');
  const [stockRenameNewName, setStockRenameNewName] = useState('');
  const [showRenameConfirm, setShowRenameConfirm] = useState(false);
  const [renameLoading, setRenameLoading] = useState(false);
  
  // Stock button loading states
  const [stockButtonLoading, setStockButtonLoading] = useState<string | null>(null);
  
  // 🆕 Modal for stock reduction error
  const [showStockReductionError, setShowStockReductionError] = useState(false);
  const [stockReductionErrorData, setStockReductionErrorData] = useState<{
    error: string;
    suggestion: string;
    details?: {
      itemsToRemove: number;
      itemsWithoutSN: number;
      itemsWithSN: number;
    };
  } | null>(null);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [detailsFilter, setDetailsFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(''); // yyyy-mm-dd format for DatePicker
  const [lowStockFilter, setLowStockFilter] = useState<number | null>(null);
  const [stockDisplayMode, setStockDisplayMode] = useState<'all' | 'low_stock'>('all');
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(2);
  
  // Drag scroll ref
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Form data
  const [formData, setFormData] = useState<InventoryFormData>({
    itemName: '',
    categoryId: '',
    quantity: 0,
    totalQuantity: 0,
    serialNumber: '',
    status: '', // ใช้ empty string แล้วจะ set ใน useEffect
    condition: ''
  });
  
  // Add missing addFromSN state
  const [addFromSN, setAddFromSN] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Note: statuses state removed - using statusConfigs only
  
  // New category configuration support
  const [categoryConfigs, setCategoryConfigs] = useState<ICategoryConfig[]>([]);
  const [originalCategoryConfigs, setOriginalCategoryConfigs] = useState<ICategoryConfig[]>([]);
  
  // New status configuration support
  const [statusConfigs, setStatusConfigs] = useState<IStatusConfig[]>([]);
  const [originalStatusConfigs, setOriginalStatusConfigs] = useState<IStatusConfig[]>([]);
  
  // New condition configuration support
  const [conditionConfigs, setConditionConfigs] = useState<IConditionConfig[]>([]);
  const [originalConditionConfigs, setOriginalConditionConfigs] = useState<IConditionConfig[]>([]);
  
  // Category management states
  const [newCategory, setNewCategory] = useState('');
  const [newStatus, setNewStatus] = useState('');
  
  // Status management states
  const [newStatusConfig, setNewStatusConfig] = useState('');
  
  // Condition management states
  const [newConditionConfig, setNewConditionConfig] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');
  const [editingStatusIndex, setEditingStatusIndex] = useState<number | null>(null);
  const [editingStatusValue, setEditingStatusValue] = useState('');
  const [editingConditionIndex, setEditingConditionIndex] = useState<number | null>(null);
  const [editingConditionValue, setEditingConditionValue] = useState('');
  
  // Delete confirmation states for categories
  const [showCategoryDeleteConfirm, setShowCategoryDeleteConfirm] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<ICategoryConfig | null>(null);
  const [deletingCategoryIndex, setDeletingCategoryIndex] = useState<number | null>(null);
  const [categoryDeleteLoading, setCategoryDeleteLoading] = useState(false);
  
  // Delete confirmation states for statuses
  const [showStatusDeleteConfirm, setShowStatusDeleteConfirm] = useState(false);
  const [deletingStatus, setDeletingStatus] = useState<string | null>(null);
  const [deletingStatusIndex, setDeletingStatusIndex] = useState<number | null>(null);
  const [statusDeleteLoading, setStatusDeleteLoading] = useState(false);
  
  // Delete confirmation states for condition
  const [showConditionDeleteConfirm, setShowConditionDeleteConfirm] = useState(false);
  const [deletingCondition, setDeletingCondition] = useState<string | null>(null);
  const [deletingConditionIndex, setDeletingConditionIndex] = useState<number | null>(null);
  const [conditionDeleteLoading, setConditionDeleteLoading] = useState(false);
  
  // Draft state for settings modal
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // New state for improved add item flow
  const [selectedCategory, setSelectedCategory] = useState(''); // เพิ่ม selectedCategory
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [existingItemsInCategory, setExistingItemsInCategory] = useState<string[]>([]);
  const [selectedExistingItem, setSelectedExistingItem] = useState('');
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  
  
  // Stock Management state
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockItem, setStockItem] = useState<{itemId: string, itemName: string, categoryId: string} | null>(null);
  const [stockOperation, setStockOperation] = useState<'view_current_info' | 'adjust_stock' | 'change_status_condition' | 'delete_item' | 'edit_items'>('view_current_info');
  const [stockValue, setStockValue] = useState<number>(0);
  const [stockReason, setStockReason] = useState<string>('');
  const [stockLoading, setStockLoading] = useState(false);
  const [stockInfo, setStockInfo] = useState<any>(null);
  
  // Adjust Stock state
  const [newStatusId, setNewStatusId] = useState<string>('');
  const [newConditionId, setNewConditionId] = useState<string>('');
  const [changeQuantity, setChangeQuantity] = useState<number>(0); // จำนวนที่ต้องการเปลี่ยน
  
  // New UI state for status/condition changes
  const [currentStatusId, setCurrentStatusId] = useState<string>('');
  const [currentConditionId, setCurrentConditionId] = useState<string>('');
  const [statusChangeQuantity, setStatusChangeQuantity] = useState<number>(0);
  const [conditionChangeQuantity, setConditionChangeQuantity] = useState<number>(0);
  const [targetStatusId, setTargetStatusId] = useState<string>('');
  const [targetConditionId, setTargetConditionId] = useState<string>('');

  // Edit Items state
  const [availableItems, setAvailableItems] = useState<{
    withSerialNumber: any[];
    withPhoneNumber?: any[];
    withoutSerialNumber: { count: number; items: any[] };
  } | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingSerialNum, setEditingSerialNum] = useState<string>('');
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [itemOperation, setItemOperation] = useState<'edit' | 'delete'>('edit');
  const [editItemLoading, setEditItemLoading] = useState(false);
  const [availableItemsLoading, setAvailableItemsLoading] = useState(false);
  
  // New state variables for editing status and condition
  const [editingNewStatusId, setEditingNewStatusId] = useState<string>('');
  const [editingNewConditionId, setEditingNewConditionId] = useState<string>('');
  const [editingCurrentStatusId, setEditingCurrentStatusId] = useState<string>('');
  const [editingCurrentConditionId, setEditingCurrentConditionId] = useState<string>('');
  
  // Search and filter for edit items
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemFilterBy, setItemFilterBy] = useState<'all' | 'admin' | 'user'>('all');

  // Derived state สำหรับ backward compatibility
  // Remove categories variable - use categoryConfigs directly
  
  // Helper function to get category name by ID
  const getCategoryName = (categoryId: string): string => {
    const category = categoryConfigs.find(cat => cat.id === categoryId);
    return category ? category.name : categoryId;
  };

  const getConditionText = (conditionId: string): string => {
    const condition = conditionConfigs.find(cond => cond.id === conditionId);
    return condition ? condition.name : conditionId;
  };

  // Helper function to get status name by ID
  const getStatusName = (statusId: string): string => {
    const status = statusConfigs.find(s => s.id === statusId);
    return status ? status.name : statusId;
  };

  // Helper function to generate reason text based on operation type
  const generateReasonText = (operation: string, currentValues?: any, newValues?: any): string => {
    if (operation === 'change_status_condition') {
      const changes = [];
      
      // Check for status change
      if (currentStatusId && targetStatusId && statusChangeQuantity > 0) {
        const currentStatusName = getStatusName(currentStatusId);
        const targetStatusName = getStatusName(targetStatusId);
        changes.push(`เปลี่ยนสถานะ จาก ${currentStatusName} เป็น ${targetStatusName} จำนวน ${statusChangeQuantity} ชิ้น`);
      }
      
      // Check for condition change
      if (currentConditionId && targetConditionId && conditionChangeQuantity > 0) {
        const currentConditionName = getConditionText(currentConditionId);
        const targetConditionName = getConditionText(targetConditionId);
        changes.push(`เปลี่ยนสภาพ จาก ${currentConditionName} เป็น ${targetConditionName} จำนวน ${conditionChangeQuantity} ชิ้น`);
      }
      
      if (changes.length > 0) {
        return `${changes.join(', ')} (Admin Stock)`;
      }
      return 'เปลี่ยนสถานะ/สภาพ ของ Admin Stock';
    } else if (operation === 'adjust_stock') {
      const currentStock = currentValues?.currentStock || 0;
      const newStock = newValues?.newStock || 0;
      return `ปรับจำนวนอุปกรณ์ (มี + ใช้งานได้) จาก ${currentStock} ชิ้น เป็น ${newStock} ชิ้น`;
    }
    return 'ปรับจำนวน Admin Stock';
  };
  const statuses = statusConfigs.map(s => s.id); // ใช้ statusId แทน statusName

  // State for delete confirmation
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Error Modal State
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorData, setErrorData] = useState<{
    title: string;
    message: string;
    reason: string;
    nextSteps: string[];
    itemName: string;
    adminStock: number;
    userOwned: number;
  } | null>(null);


  useEffect(() => {
    fetchInventory();
    fetchConfig();
  }, []);
  
  // Set default status and condition values when configs are loaded
  useEffect(() => {
    if (statusConfigs.length > 0 && !formData.status) {
      const defaultStatus = statusConfigs.find(s => s.name === 'มี') || statusConfigs[0];
      setFormData(prev => ({ ...prev, status: defaultStatus.id }));
    }
    if (conditionConfigs.length > 0 && !formData.condition) {
      const defaultCondition = conditionConfigs.find(c => c.name === 'ใช้งานได้') || conditionConfigs[0];
      setFormData(prev => ({ ...prev, condition: defaultCondition.id }));
    }
  }, [statusConfigs, conditionConfigs, formData.status, formData.condition]);

  // Update reason text when status/condition/category changes for change_status_condition operation
  useEffect(() => {
    if (stockOperation === 'change_status_condition') {
      const newReason = generateReasonText('change_status_condition', null, null);
      setStockReason(newReason);
    }
  }, [stockOperation, currentStatusId, targetStatusId, statusChangeQuantity, currentConditionId, targetConditionId, conditionChangeQuantity, statusConfigs, conditionConfigs]);

  // Update reason text when stock value changes for adjust_stock operation
  useEffect(() => {
    if (stockOperation === 'adjust_stock' && stockInfo) {
      // คำนวณจำนวนที่ปรับได้จริง (มี + ใช้งานได้)
      let adjustableCount = 0;
      if (stockInfo.adjustableCount !== undefined) {
        adjustableCount = stockInfo.adjustableCount;
      } else {
        // Fallback: คำนวณจากข้อมูลที่มี
        const statusAvailable = stockInfo.nonSNStatusBreakdown?.['status_available'] || 0;
        const conditionWorking = stockInfo.nonSNConditionBreakdown?.['cond_working'] || 0;
        adjustableCount = Math.min(statusAvailable, conditionWorking);
      }
      const newReason = `ปรับจำนวนอุปกรณ์ (มี + ใช้งานได้) จาก ${adjustableCount} ชิ้น เป็น ${stockValue} ชิ้น`;
      setStockReason(newReason);
    }
  }, [stockOperation, stockValue, stockInfo]);

  // Initialize drag scrolling
  useEffect(() => {
    const element = tableContainerRef.current;
    if (!element) return;

    const cleanup = enableDragScroll(element);
    return cleanup;
  }, []);

  // Fetch available items when switching to edit_items operation or adjust_stock
  useEffect(() => {
    if ((stockOperation === 'edit_items' || stockOperation === 'adjust_stock') && stockItem) {
      fetchAvailableItems(stockItem);
    }
  }, [stockOperation, stockItem]);

  // Refresh available items when stock modal is opened
  useEffect(() => {
    if (showStockModal && stockItem) {
      fetchAvailableItems(stockItem);
    }
  }, [showStockModal, stockItem]);

  useEffect(() => {
    applyFilters();
  }, [items, searchTerm, categoryFilter, detailsFilter, dateFilter, lowStockFilter, stockDisplayMode, lowStockThreshold]);

  // Update stockValue when stockInfo changes for adjust_stock operation
  useEffect(() => {
    if (stockOperation === 'adjust_stock' && stockInfo) {
      // คำนวณจำนวนที่ปรับได้จริง (มี + ใช้งานได้)
      let adjustableCount = 0;
      if (stockInfo.adjustableCount !== undefined) {
        adjustableCount = stockInfo.adjustableCount;
      } else {
        // Fallback: คำนวณจากข้อมูลที่มี
        const statusAvailable = stockInfo.nonSNStatusBreakdown?.['status_available'] || 0;
        const conditionWorking = stockInfo.nonSNConditionBreakdown?.['cond_working'] || 0;
        adjustableCount = Math.min(statusAvailable, conditionWorking);
      }
      setStockValue(adjustableCount);
    }
  }, [stockInfo, stockOperation]);

  const fetchInventory = async (page: number = 1, search: string = '', category: string = '') => {
    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(search && { search }),
        ...(category && { category })
      });
      
      const response = await fetch(`/api/admin/inventory?${params.toString()}`);
      const handledResponse = await handleApiResponse(response, 'ไม่สามารถโหลดข้อมูลคลังสินค้าได้ - เซสชันหมดอายุ');
      
      if (handledResponse && handledResponse.ok) {
        const data = await handledResponse.json();
        setItems(data.items || data); // Support both old and new format
        // TODO: Handle pagination data if needed
      } else if (handledResponse) {
        toast.error('เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  // Fetch breakdown data for a specific item
  const fetchBreakdown = async (itemName: string, categoryId: string) => {
    const cacheKey = `${itemName}_${categoryId}`;
    
    try {
      // Always fetch fresh data to ensure accuracy
      const response = await fetch(`/api/admin/inventory/breakdown?itemName=${encodeURIComponent(itemName)}&categoryId=${encodeURIComponent(categoryId)}&t=${Date.now()}`);
      
      if (response.ok) {
        const data = await response.json();
        setBreakdownData(prev => ({
          ...prev,
          [cacheKey]: data
        }));
        return data;
      } else {
        console.error('Failed to fetch breakdown data:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error fetching breakdown data:', error);
      return null;
    }
  };

  // Function to refresh data and clear all caches
  const refreshAndClearCache = async () => {
    try {
      setLoading(true);
      toast.loading('รีเฟรชและ Sync ข้อมูล...', { id: 'refresh-sync' });

      // 1. Clear local breakdownData cache first
      setBreakdownData({});
      console.log('🧹 Cleared breakdownData cache');

      // 2. Sync master data
      const syncResponse = await fetch('/api/admin/refresh-master-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshAll: true }),
      });

      // 3. Clear all caches in the system
      const cacheResponse = await fetch('/api/admin/clear-all-caches', { method: 'POST' });
      const handledCacheResponse = await handleApiResponse(cacheResponse, 'ไม่สามารถล้าง cache ได้ - เซสชันหมดอายุ');
      
      const syncResult = await syncResponse.json();
      
      if (syncResponse.ok && syncResult.success && handledCacheResponse && handledCacheResponse.ok) {
        toast.success(`รีเฟรชข้อมูลเรียบร้อยแล้ว (Sync ${syncResult.refreshedItems} รายการ)`, { id: 'refresh-sync' });
      } else if (handledCacheResponse) {
        toast.error('เกิดข้อผิดพลาดในการรีเฟรชข้อมูล', { id: 'refresh-sync' });
      }
    } catch (error) {
      console.error('Refresh and sync error:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ', { id: 'refresh-sync' });
    } finally {
      setLoading(false);
    }
    
    // Always refresh inventory data at the end
    await fetchInventory();
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/configs');
      const handledResponse = await handleApiResponse(response, 'ไม่สามารถโหลดการตั้งค่าได้ - เซสชันหมดอายุ');
      
      if (handledResponse && handledResponse.ok) {
        const data = await handledResponse.json();
        
        // Handle categoryConfigs format only
        if (Array.isArray(data.categoryConfigs) && data.categoryConfigs.length > 0) {
          setCategoryConfigs(data.categoryConfigs);
          setOriginalCategoryConfigs(JSON.parse(JSON.stringify(data.categoryConfigs))); // Deep copy
        }
        
        // Handle statusConfigs ONLY - ไม่ fallback ไป statuses เก่า
        if (Array.isArray(data.statusConfigs) && data.statusConfigs.length > 0) {
          setStatusConfigs(data.statusConfigs);
          setOriginalStatusConfigs(JSON.parse(JSON.stringify(data.statusConfigs))); // Deep copy
        } else {
          // ไม่มี statusConfigs ให้เป็น array ว่าง
          setStatusConfigs([]);
          setOriginalStatusConfigs([]);
        }
        
        // Handle conditionConfigs
        if (Array.isArray(data.conditionConfigs) && data.conditionConfigs.length > 0) {
          setConditionConfigs(data.conditionConfigs);
          setOriginalConditionConfigs(JSON.parse(JSON.stringify(data.conditionConfigs))); // Deep copy
        } else {
          // ไม่มี conditionConfigs ให้เป็น array ว่าง
          setConditionConfigs([]);
          setOriginalConditionConfigs([]);
        }
        
        // Note: statuses field is deprecated and will be removed
      }
    } catch (error) {
      // ใช้ค่าเริ่มต้นหากโหลดไม่ได้
    }
  };

  const applyFilters = () => {
    const term = (searchTerm || '').toLowerCase();
    let filtered = items.filter(item => {
      const itemNameSafe = String((item as any)?.itemName || '').toLowerCase();
      const categoryNameSafe = String(getCategoryName((item as any)?.categoryId) || '').toLowerCase();
      const matchesSearch =
        !term ||
        itemNameSafe.includes(term) ||
        categoryNameSafe.includes(term);
      
      const matchesCategory = !categoryFilter || item.categoryId === categoryFilter;
      
      // ฟิลเตอร์รายละเอียด (ค้นหาจากสถานะและสภาพ)
      const detailsTerm = (detailsFilter || '').toLowerCase();
      const statusText = String(getStatusText((item as any)?.statusId || (item as any)?.status) || '').toLowerCase();
      const conditionText = String(getConditionText((item as any)?.conditionId || (item as any)?.condition) || '').toLowerCase();
      const matchesDetails = 
        !detailsTerm || 
        statusText.includes(detailsTerm) || 
        conditionText.includes(detailsTerm);
      
      // ฟิลเตอร์วันที่
      let matchesDate = true;
      if (dateFilter && dateFilter.trim() !== '') {
        // DatePicker returns yyyy-mm-dd format
        const filterDate = new Date(dateFilter);
        filterDate.setHours(0, 0, 0, 0);
        
        const itemDate = new Date(item.dateAdded);
        itemDate.setHours(0, 0, 0, 0);
        
        // เช็คว่าวันที่ตรงกันหรือไม่
        matchesDate = itemDate.getTime() === filterDate.getTime();
      }
      
      return matchesSearch && matchesCategory && matchesDetails && matchesDate;
    });

    // Group by itemName + category
    const groupedMap = new Map<string, any>();
    for (const it of filtered) {
      const key = `${it.itemName}||${it.categoryId}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          _id: `grouped-${key}`, // Use key as stable unique ID
          key,
          itemName: it.itemName,
          categoryId: it.categoryId,
          quantity: 0,
          totalQuantity: 0,
          serialNumbers: [] as string[],
          status: it.status,
          dateAdded: it.dateAdded,
          // เพิ่มข้อมูลสำหรับการแสดงรายละเอียด
          items: [] as any[], // เก็บรายการย่อยทั้งหมด
          hasMixedStatus: false
        });
      }
      const acc = groupedMap.get(key);
      
      // เพิ่มรายการย่อย
      acc.items.push({
        _id: it._id,
        quantity: it.quantity,
        totalQuantity: it.totalQuantity,
        serialNumbers: it.serialNumbers || [],
        status: it.status,
        dateAdded: it.dateAdded
      });
      
      acc.quantity += it.quantity;
      // For serial-numbered records, total should be 1 per record regardless of remaining quantity
      if (it.serialNumbers && Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0) {
        const addTotal = typeof it.totalQuantity === 'number' && it.totalQuantity > 0 ? it.totalQuantity : 1;
        acc.totalQuantity += addTotal;
      } else {
        acc.totalQuantity += (typeof it.totalQuantity === 'number' ? it.totalQuantity : it.quantity);
      }
      if (it.serialNumbers && Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0) {
        acc.serialNumbers.push(...it.serialNumbers);
      }
      
      // ตรวจสอบสถานะที่หลากหลาย
      if (acc.status !== it.status) {
        acc.hasMixedStatus = true;
        acc.status = 'mixed';
      }
      
      if (new Date(it.dateAdded).getTime() > new Date(acc.dateAdded).getTime()) acc.dateAdded = it.dateAdded;
    }

    let grouped = Array.from(groupedMap.values());

    // Apply low stock filter AFTER grouping (exclude groups that have serial numbers)
    if (stockDisplayMode === 'low_stock') {
      grouped = grouped.filter(
        (g) => g.quantity <= lowStockThreshold && (!g.serialNumbers || g.serialNumbers.length === 0)
      );
    }
    // If stockDisplayMode is 'all', we don't filter by stock level

    // Sort by low stock items first (non-serial groups only), then by date added
    grouped.sort((a, b) => {
      const threshold = lowStockThreshold;
      const aIsLowStock = a.quantity <= threshold && (!a.serialNumbers || a.serialNumbers.length === 0);
      const bIsLowStock = b.quantity <= threshold && (!b.serialNumbers || b.serialNumbers.length === 0);
      if (aIsLowStock && !bIsLowStock) return -1;
      if (!aIsLowStock && bIsLowStock) return 1;
      return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
    });

    setFilteredItems(grouped);
    setCurrentPage(1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: name === 'quantity' || name === 'totalQuantity' ? Number(value) : value
      };
      
      // หากใส่ Serial Number ให้จำนวนเป็น 1 อัตโนมัติ
      if (name === 'serialNumber') {
        if (value.trim() !== '') {
          newData.quantity = 1;
          newData.totalQuantity = 1;
        } else if (addFromSN) {
          // เมื่อเคลียร์ Serial Number ในโหมดเพิ่มจาก S/N ให้จำนวนว่าง (0)
          newData.quantity = 0;
          newData.totalQuantity = 0;
        }
      }

      // หากแก้ไขจำนวน และไม่มี Serial Number ให้ sync ไปยังจำนวนทั้งหมดด้วย
      if (name === 'quantity' && (prev.serialNumber || '').trim() === '') {
        newData.totalQuantity = Number(value);
      }
      
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.itemName || !formData.categoryId || formData.quantity <= 0 || !formData.condition) {
        toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
        setLoading(false);
        return;
      }

      const url = editingItem ? `/api/admin/inventory/${editingItem._id}` : '/api/admin/inventory';
      const method = editingItem ? 'PUT' : 'POST';

      // Force quantity/totalQuantity to 1 when adding from SN flow or SIM card
      const payload = (addFromSN && !editingItem) || isSIMCardSync(formData.categoryId)
        ? { 
            ...formData, 
            quantity: 1, 
            totalQuantity: 1,
            // แปลง status และ condition เป็น statusId และ conditionId
            statusId: formData.status,
            conditionId: formData.condition,
            // สำหรับซิมการ์ด ส่ง numberPhone แทน serialNumber
            ...(isSIMCardSync(formData.categoryId) && formData.serialNumber && {
              numberPhone: formData.serialNumber,
              serialNumber: '' // ล้าง serialNumber สำหรับซิมการ์ด
            })
          }
        : {
            ...formData,
            // แปลง status และ condition เป็น statusId และ conditionId
            statusId: formData.status,
            conditionId: formData.condition
          };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingItem ? 'อัพเดตข้อมูลเรียบร้อยแล้ว' : 'เพิ่มรายการเรียบร้อยแล้ว');
        
        // Add delay to ensure backend sync is complete before refreshing
        if (!editingItem) {
          console.log('⏳ Waiting for backend sync to complete...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        await fetchInventory();
        resetForm();
        setShowAddModal(false);
        setShowEditModal(false);
        setAddFromSN(false);
      } else {
        const data = await response.json();
        
        // Enhanced error handling for recycle bin
        if (data.errorType === 'RECYCLE_BIN_EXISTS' && data.showRecycleBinLink) {
          // Show beautiful warning modal instead of toast
          setRecycleBinWarningData({
            itemName: formData.itemName,
            serialNumber: formData.serialNumber || ''
          });
          setShowRecycleBinWarning(true);
        } else {
          // Show error in popup modal instead of toast
          setSimpleErrorMessage(data.error || 'เกิดข้อผิดพลาด');
          setShowSimpleError(true);
        }
      }
    } catch (error) {
      // Show connection error in popup modal instead of toast
      setSimpleErrorMessage('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      setShowSimpleError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      itemName: item.itemName,
      categoryId: item.categoryId,
      quantity: item.quantity,
      totalQuantity: item.totalQuantity ?? item.quantity,
      serialNumber: item.serialNumbers && item.serialNumbers.length > 0 ? item.serialNumbers[0] : '',
      status: item.status,
      condition: item.condition || ''
    });
    setShowEditModal(true);
  };

  // Stock Modal functions
  const openStockModal = async (item: any) => {
    // เริ่มแสดง loading animation สำหรับปุ่มนี้
    setStockButtonLoading(item._id);
    
    setStockItem({ 
      itemId: item._id, // ใช้ ID แทนชื่อ
      itemName: item.itemName, // เก็บชื่อไว้สำหรับแสดงผล
      categoryId: item.categoryId 
    });
    setStockOperation('view_current_info');
    setStockValue(0);
    setStockReason('');
    setShowStockRename(false);
    setStockRenameOldName('');
    setStockRenameNewName('');
    setShowRenameConfirm(false);
    setStockLoading(true);
    
    // Reset new UI state
    setCurrentStatusId('');
    setCurrentConditionId('');
    setStatusChangeQuantity(0);
    setConditionChangeQuantity(0);
    setTargetStatusId('');
    setTargetConditionId('');
    
    try {
      
      // Fetch current stock info (includes auto-detection)
      const response = await fetch(`/api/admin/stock-management?itemName=${encodeURIComponent(item.itemName)}&category=${encodeURIComponent(item.categoryId)}&t=${Date.now()}`, { cache: 'no-store' });
      
      if (response.ok) {
        const data = await response.json();
        
        // Ensure data structure is complete
        if (!data.stockManagement) {
          data.stockManagement = {
            adminDefinedStock: 0,
            userContributedCount: 0,
            currentlyAllocated: 0,
            realAvailable: 0
          };
        }
        
        setStockInfo(data);
        
        // Set default value based on current admin stock
        const adminStock = data.stockManagement?.adminDefinedStock || 0;
        setStockValue(adminStock);
        
        
        // Set default values for new UI - keep as empty for user selection
        // Don't auto-select any status or condition, let user choose
        
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to fetch stock info:', response.status, errorData);
        
        // Handle 401 Unauthorized (token expired)
        if (handleTokenExpiry(response, 'ไม่สามารถโหลดข้อมูล Stock ได้ - เซสชันหมดอายุ')) {
          return;
        }
        
        toast.error(errorData.error || 'ไม่สามารถโหลดข้อมูล Stock ได้');
        setStockInfo(null);
      }
    } catch (error) {
      console.error('❌ Error fetching stock info:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      setStockInfo(null);
    } finally {
      setStockLoading(false);
      setStockButtonLoading(null); // หยุดแสดง loading animation ของปุ่ม
      setShowStockModal(true);
      
      // Fetch available items immediately when modal opens
      // This ensures the serial number counts are displayed correctly from the start
      setTimeout(() => {
        if (stockItem) {
          fetchAvailableItems(item); // ใช้ item parameter แทน stockItem state
        }
      }, 100);
    }
  };

  const closeStockModal = async () => {
    setShowStockModal(false);
    setStockItem(null);
    setStockOperation('view_current_info');
    setStockValue(0);
    setStockReason('');
    setShowStockRename(false);
    setStockRenameOldName('');
    setStockRenameNewName('');
    setShowRenameConfirm(false);
    setStockButtonLoading(null); // หยุด loading animation ของปุ่มเมื่อปิด modal
    
    // Reset adjust stock fields
    setNewStatusId('');
    setNewConditionId('');
    setChangeQuantity(0);
    
    // Reset additional states
    setStockInfo(null);
    setAvailableItems(null);
    setEditingItemId(null);
    setEditingSerialNum('');
    setShowEditItemModal(false);
    setItemOperation('edit');
    setItemSearchTerm('');
    setItemFilterBy('all');
    
    // Refresh table after modal closes
    await fetchInventory();
    
    // Clear breakdown cache to ensure fresh data
    setBreakdownData({});
    console.log('🧹 Cleared breakdownData cache after modal closes');
  };

  // Stock Rename functions
  const handleStockRenameClick = () => {
    if (stockItem) {
      setStockRenameOldName(stockItem.itemName);
      setStockRenameNewName(stockItem.itemName);
      setShowStockRename(true);
    }
  };

  const handleStockRenameSubmit = () => {
    if (!stockRenameOldName.trim() || !stockRenameNewName.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (stockRenameOldName.trim() === stockRenameNewName.trim()) {
      toast.error('ชื่อเดิมและชื่อใหม่ต้องไม่เหมือนกัน');
      return;
    }

    setShowRenameConfirm(true);
  };

  const handleStockRenameConfirm = async () => {
    setRenameLoading(true);
    
    try {
      const response = await fetch('/api/admin/rename-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          oldName: stockRenameOldName.trim(),
          newName: stockRenameNewName.trim(),
          options: {
            dryRun: false,
            createBackup: true,
            batchSize: 1000
          }
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`เปลี่ยนชื่อสำเร็จ: "${stockRenameOldName}" → "${stockRenameNewName}"`);
        
        // Refresh inventory and close modal
        await fetchInventory();
        
        // อัปเดต stockItem ให้ใช้ชื่อใหม่
        setStockItem(prev => prev ? ({
          ...prev,
          itemName: stockRenameNewName.trim()
        }) : null);
        
        // รีเฟรช stock data ด้วยชื่อใหม่
        const updatedItem = {
          itemName: stockRenameNewName.trim(),
          categoryId: stockItem?.categoryId || 'ไม่ระบุ'
        };
        
        // ปิด rename mode และเปิด stock modal ใหม่ด้วยข้อมูลใหม่
        setShowStockRename(false);
        setStockRenameOldName('');
        setStockRenameNewName('');
        
        // Delay เล็กน้อยเพื่อให้ inventory update เสร็จก่อน
        setTimeout(async () => {
          // เรียก fetchAvailableItems ด้วยชื่อใหม่ก่อน
          await fetchAvailableItems(updatedItem);
          await openStockModal(updatedItem);
        }, 500);
        
        return; // ไม่ต้อง close modal ทันที
      } else {
        console.error('❌ Rename failed:', {
          responseOk: response.ok,
          dataSuccess: data.success,
          error: data.error,
          fullData: data
        });
        toast.error(data.error || 'เกิดข้อผิดพลาดในการเปลี่ยนชื่อ');
      }
    } catch (error) {
      console.error('Rename error:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setRenameLoading(false);
      setShowRenameConfirm(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Find the item to delete
    const itemToDelete = items.find(item => item._id === id);
    if (!itemToDelete) {
      toast.error('ไม่พบรายการที่ต้องการลบ');
      return;
    }

    // Get total quantity for this item
    const totalQuantity = itemToDelete.totalQuantity || itemToDelete.quantity || 0;
    
    // Prompt for quantity to delete
    const deleteQuantity = prompt(`คุณต้องการลบจำนวนเท่าไหร่?\n\nจำนวนทั้งหมดที่มี: ${totalQuantity}\n\nกรุณากรอกจำนวนที่ต้องการลบ (ไม่เกิน ${totalQuantity}):`);
    
    if (!deleteQuantity) return; // User cancelled
    
    const quantity = parseInt(deleteQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error('กรุณากรอกจำนวนที่ถูกต้อง');
      return;
    }
    
    if (quantity > totalQuantity) {
      toast.error(`จำนวนที่ลบต้องไม่เกิน ${totalQuantity}`);
      return;
    }

    // Show warning and confirmation
    const warningMessage = `⚠️ คำเตือน: คุณจะลบจริงไหมเพราะลบแล้ว ทุกบัญชีที่มีอุปกรณ์รายการนี้ อุปกรณ์ในบัญชีนั้นจะถูกลบด้วย\n\n`;
    const confirmationMessage = `กรุณาพิมพ์ "Delete" (D ตัวใหญ่) เพื่อยืนยันการลบ:`;
    
    const userConfirmation = prompt(warningMessage + confirmationMessage);
    
    if (userConfirmation !== 'Delete') {
      toast.error('การลบถูกยกเลิก');
      return;
    }

    try {
      const response = await fetch(`/api/admin/inventory/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deleteQuantity: quantity }),
      });

      if (response.ok) {
        toast.success(`ลบรายการจำนวน ${quantity} เรียบร้อยแล้ว`);
        await fetchInventory();
      } else {
        const data = await response.json();
        toast.error(data.error || 'เกิดข้อผิดพลาดในการลบ');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };





  const fetchAvailableItems = async (targetItem?: { itemName: string; categoryId: string }) => {
    const itemToFetch = targetItem || stockItem;
    if (!itemToFetch) return;
    
    // Prevent multiple simultaneous calls for the same item
    const cacheKey = `${itemToFetch.itemName}-${itemToFetch.categoryId}`;
    if (window.fetchingAvailableItems === cacheKey) {
      return;
    }
    
    window.fetchingAvailableItems = cacheKey;
    setAvailableItemsLoading(true);
    
    try {
      
      const params = new URLSearchParams({
        itemName: itemToFetch.itemName,
        category: itemToFetch.categoryId
      });

      // Debug: Check if we have auth cookies
      // Use different API based on operation type
      const apiEndpoint = stockOperation === 'edit_items' 
        ? `/api/admin/equipment-reports/all-items?${params}`  // All items for editing (all status/condition)
        : `/api/admin/equipment-reports/available-items?${params}`; // Available items only for other operations
      

      const response = await fetch(apiEndpoint, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailableItems(data);
      } else {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        console.error('Failed to fetch available items:', response.status, errorData);
        
        // Show user-friendly error message
        if (response.status === 401) {
          toast.error('กรุณาล็อกอินใหม่');
        } else if (response.status === 404) {
          toast.error('ไม่พบข้อมูลอุปกรณ์นี้');
        } else {
          toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        }
        
        setAvailableItems(null);
      }
    } catch (error) {
      console.error('Error fetching available items:', error);
      setAvailableItems(null);
    } finally {
      // Clear the fetching flag
      if (window.fetchingAvailableItems === cacheKey) {
        window.fetchingAvailableItems = null;
      }
      setAvailableItemsLoading(false);
    }
  };



  const handleEditItem = (item: any, type: 'serial' | 'phone' = 'serial') => {
    setEditingItemId(item.itemId);
    if (type === 'phone') {
      setEditingSerialNum(item.numberPhone || '');
    } else {
      setEditingSerialNum(item.serialNumber || '');
    }
    
    // Set current status and condition for editing
    setEditingCurrentStatusId(item.statusId || '');
    setEditingCurrentConditionId(item.conditionId || '');
    setEditingNewStatusId(''); // Default to empty (will show "-- เลือกสถานะใหม่ --")
    setEditingNewConditionId(''); // Default to empty (will show "-- เลือกสภาพใหม่ --")
    
    setItemOperation('edit');
    setShowEditItemModal(true);
  };

  const handleDeleteItem = (item: any, type: 'serial' | 'phone' = 'serial') => {
    setEditingItemId(item.itemId);
    if (type === 'phone') {
      setEditingSerialNum(item.numberPhone || '');
    } else {
      setEditingSerialNum(item.serialNumber || '');
    }
    setItemOperation('delete');
    setStockReason(''); // Reset reason for new operation
    setShowEditItemModal(true);
  };

  // Filter and search functions for edit items
  const getFilteredSerialNumberItems = () => {
    
    if (!availableItems?.withSerialNumber) {
      console.log('❌ No withSerialNumber data available');
      return [];
    }
    
    let filtered = availableItems.withSerialNumber;
    
    // Filter by source (admin/user)
    if (itemFilterBy !== 'all') {
      filtered = filtered.filter(item => item.addedBy === itemFilterBy);
    }
    
    // Search by serial number
    if (itemSearchTerm.trim()) {
      filtered = filtered.filter(item => 
        item.serialNumber?.toLowerCase().includes(itemSearchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };

  // Filter and search functions for SIM phone number items
  const getFilteredPhoneNumberItems = () => {
    if (!availableItems?.withPhoneNumber) {
      return [];
    }

    let filtered = availableItems.withPhoneNumber;

    // Filter by source (admin/user)
    if (itemFilterBy !== 'all') {
      filtered = filtered.filter((item: any) => item.addedBy === itemFilterBy);
    }

    // Search by phone number
    if (itemSearchTerm.trim()) {
      const term = itemSearchTerm.toLowerCase();
      filtered = filtered.filter((item: any) => item.numberPhone?.toLowerCase().includes(term));
    }

    return filtered;
  };

  const handleSaveEditItem = async () => {
    if (!editingItemId || !stockItem) {
      console.error('❌ Missing required data:', { editingItemId, stockItem: !!stockItem });
      return;
    }

    setEditItemLoading(true);

    try {
      const isDelete = itemOperation === 'delete';
      
      if (isDelete && !stockReason.trim()) {
        toast.error('กรุณาระบุเหตุผลในการลบรายการ');
        setEditItemLoading(false);
        return;
      }
      
      const isSimCard = isSIMCardSync(stockItem.categoryId);
      
      // Find old value from availableItems first
      const oldSerialNumber = availableItems?.withSerialNumber?.find(item => item.itemId === editingItemId)?.serialNumber;
      const oldPhoneNumber = availableItems?.withPhoneNumber?.find(item => item.itemId === editingItemId)?.numberPhone;

      // เพิ่ม validation สำหรับเบอร์โทรศัพท์ (เฉพาะเมื่อมีการเปลี่ยนแปลง)
      if (!isDelete && isSimCard && editingSerialNum.trim() && editingSerialNum.trim() !== oldPhoneNumber) {
        const phoneNumber = editingSerialNum.trim();
        if (phoneNumber.length !== 10) {
          toast.error('เบอร์โทรศัพท์ต้องเป็น 10 หลักเท่านั้น');
          setEditItemLoading(false);
          return;
        }
        if (!/^[0-9]{10}$/.test(phoneNumber)) {
          toast.error('เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น');
          setEditItemLoading(false);
          return;
        }
      }

      const requestBody: any = {
        itemId: editingItemId,
        itemName: stockItem.itemName,
        category: stockItem.categoryId, // API expects 'category' not 'categoryId'
        operation: itemOperation,
        reason: stockReason
      };

      // Add appropriate fields based on item type (only if changed)
      if (isSimCard) {
        if (editingSerialNum.trim() && editingSerialNum.trim() !== oldPhoneNumber) {
          requestBody.newPhoneNumber = editingSerialNum;
          requestBody.oldPhoneNumber = oldPhoneNumber || editingSerialNum;
        }
      } else {
        if (editingSerialNum.trim() && editingSerialNum.trim() !== oldSerialNumber) {
          requestBody.newSerialNumber = editingSerialNum;
          requestBody.oldSerialNumber = oldSerialNumber || editingSerialNum;
        }
      }

      // Add status and condition changes for edit operations (only if changed)
      if (!isDelete) {
        // Only send if there are actual changes
        if (editingNewStatusId && editingNewStatusId !== editingCurrentStatusId) {
          requestBody.newStatusId = editingNewStatusId;
          requestBody.currentStatusId = editingCurrentStatusId;
        }
        
        if (editingNewConditionId && editingNewConditionId !== editingCurrentConditionId) {
          requestBody.newConditionId = editingNewConditionId;
          requestBody.currentConditionId = editingCurrentConditionId;
        }
      }

      console.log('🔍 Edit item debug:', {
        editingItemId,
        stockItem,
        editingSerialNum,
        editingNewStatusId,
        editingNewConditionId,
        editingCurrentStatusId,
        editingCurrentConditionId,
        oldSerialNumber,
        oldPhoneNumber
      });

      const hasSerialNumberChange = editingSerialNum.trim() && editingSerialNum.trim() !== (isSimCard ? oldPhoneNumber : oldSerialNumber);
      const hasStatusChange = editingNewStatusId && editingNewStatusId !== editingCurrentStatusId;
      const hasConditionChange = editingNewConditionId && editingNewConditionId !== editingCurrentConditionId;

      const response = await fetch('/api/admin/inventory/edit-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาด');
      }

      // Check if operation was successful
      if (result.success === false) {
        // Handle validation errors (like duplicate serial number)
        if (result.isDuplicate) {
          toast.error(result.message);
          return; // Don't close modal, let user try again
        } else {
          throw new Error(result.message || 'เกิดข้อผิดพลาด');
        }
      }

      toast.success(
        isDelete 
          ? 'ลบรายการสำเร็จ'
          : 'แก้ไขรายการสำเร็จ'
      );

      // Close edit item modal
      setShowEditItemModal(false);
      setEditingItemId(null);
      setEditingSerialNum('');
      setStockReason('');
      
      // Reset status and condition editing states
      setEditingNewStatusId('');
      setEditingNewConditionId('');
      setEditingCurrentStatusId('');
      setEditingCurrentConditionId('');

      // Close stock modal after edit item operation
      closeStockModal();
      
      // Clear cache and refresh table like clicking refresh button
      setTimeout(async () => {
        try {
          setBreakdownData({});
          setBreakdownRefreshCounter(prev => prev + 1);
          await fetchInventory();
        } catch (error) {
          console.warn('⚠️ Failed to refresh table after edit item:', error);
        }
      }, 100); // Quick refresh after modal closes

      // If this was a delete operation, close the entire stock modal and refresh main inventory
      if (isDelete) {
        
        // Close the stock modal completely
        closeStockModal();
        
        // Show loading toast while refreshing
        const loadingToast = toast.loading('🔄 กำลังอัพเดทข้อมูล...');
        
        try {
          // Refresh main inventory data
          await fetchInventory();
          
          // Dismiss loading toast and show success
          toast.dismiss(loadingToast);
        } catch (refreshError) {
          // Dismiss loading toast and show error
          toast.dismiss(loadingToast);
          console.warn('⚠️ Failed to refresh main inventory after delete:', refreshError);
          toast.error('ข้อมูลอาจไม่เป็นปัจจุบัน กรุณารีเฟรชหน้า');
        }
      } else {
        // For edit operations, just show success - modal will close and refresh automatically
      }

    } catch (error) {
      console.error('Error saving item:', error);
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setEditItemLoading(false);
    }
  };

  // Delete confirmation modal functions
  const openDeleteConfirmModal = () => {
    setShowDeleteConfirmModal(true);
    setDeleteConfirmText('');
  };

  const closeDeleteConfirmModal = () => {
    setShowDeleteConfirmModal(false);
    setDeleteConfirmText('');
    setDeleteLoading(false);
  };

  const handleConfirmDelete = async () => {
    if (!stockItem || deleteConfirmText !== 'DELETE') {
      toast.error('กรุณาพิมพ์ "DELETE" เพื่อยืนยันการลบ');
      return;
    }

    // หมายเหตุ: สามารถลบหมวดหมู่ "ซิมการ์ด" ได้แล้ว (ถ้าต้องการป้องกันให้ uncomment บล็อกนี้)
    // if (isSIMCardSync(stockItem.categoryId)) {
    //   toast.error('⚠️ ไม่สามารถลบหมวดหมู่ "ซิมการ์ด" ได้ เนื่องจากเป็นหมวดหมู่พิเศษของระบบ');
    //   setDeleteLoading(false);
    //   return;
    // }

    setDeleteLoading(true);

    try {
      
      const response = await fetch(`/api/admin/inventory`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemName: stockItem.itemName,
          category: stockItem.categoryId,  // ✅ เปลี่ยนจาก categoryId เป็น category
          deleteAll: true,
          reason: stockReason || 'Complete item deletion via admin management'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // แสดงข้อความตาม deletion type
        if (data.deletionType === 'complete') {
          toast.success(`🗑️ ${data.message}`);
        } else if (data.deletionType === 'partial') {
          toast.success(`🗑️ ${data.message}`);
          if (data.warning) {
            toast(data.warning, { icon: '⚠️', duration: 5000 });
          }
        }
        
        await fetchInventory();
        closeDeleteConfirmModal();
        closeStockModal();
      } else {
        // แสดง Error Modal แทน toast
        setErrorData({
          title: 'ไม่สามารถลบได้',
          message: data.error || 'เกิดข้อผิดพลาดในการลบ',
          reason: data.reason || 'อุปกรณ์นี้ถูก User ครอบครองอยู่',
          nextSteps: data.nextSteps || [
            'รอให้ User คืนอุปกรณ์ทั้งหมด',
            'ตรวจสอบสถานะการยืมในหน้า Equipment Tracking',
            'ติดต่อ User เพื่อคืนอุปกรณ์'
          ],
          itemName: stockItem?.itemName || '',
          adminStock: data.adminStock || 0,
          userOwned: data.userOwned || 0
        });
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleStockSubmit = async () => {
    if (!stockItem) {
      toast.error('ไม่พบข้อมูลรายการ');
      return;
    }

    // Validation for delete operation
    if (stockOperation === 'delete_item') {
      // Show delete confirmation modal (validation จะทำภายใน modal)
      setShowDeleteConfirmModal(true);
      setStockLoading(false);
      return;
    } else {
      // Validation for other operations
      if (!stockReason.trim()) {
        toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
        return;
      }

      // Validation for change_status_condition operation
      if (stockOperation === 'change_status_condition') {
        // Check if at least one change is being made
        const hasStatusChange = currentStatusId && targetStatusId && statusChangeQuantity > 0;
        const hasConditionChange = currentConditionId && targetConditionId && conditionChangeQuantity > 0;
        
        if (!hasStatusChange && !hasConditionChange) {
          toast.error('กรุณาเลือกอย่างน้อยหนึ่งรายการที่ต้องการเปลี่ยน');
          return;
        }
        
        // Validate status change
        if (hasStatusChange) {
          if (statusChangeQuantity < 0) {
            toast.error('จำนวนที่ต้องการเปลี่ยนสถานะต้องเป็นจำนวนบวก');
            return;
          }
          if (statusChangeQuantity > (stockInfo?.statusBreakdown?.[currentStatusId] || 0)) {
            toast.error(`จำนวนที่ต้องการเปลี่ยนสถานะ (${statusChangeQuantity}) ต้องไม่เกินจำนวนที่มี (${stockInfo?.statusBreakdown?.[currentStatusId] || 0})`);
            return;
          }
        }
        
        // Validate condition change
        if (hasConditionChange) {
          if (conditionChangeQuantity < 0) {
            toast.error('จำนวนที่ต้องการเปลี่ยนสภาพต้องเป็นจำนวนบวก');
            return;
          }
          if (conditionChangeQuantity > (stockInfo?.conditionBreakdown?.[currentConditionId] || 0)) {
            toast.error(`จำนวนที่ต้องการเปลี่ยนสภาพ (${conditionChangeQuantity}) ต้องไม่เกินจำนวนที่มี (${stockInfo?.conditionBreakdown?.[currentConditionId] || 0})`);
            return;
          }
        }
      }
      
      // Only validate stockValue for adjust_stock operation
      if (stockOperation === 'adjust_stock' && stockValue < 0) {
        toast.error('จำนวน stock ต้องเป็นจำนวนบวก');
        return;
      }
    }

    setStockLoading(true);

    try {
      // Handle stock management operations
      const currentStock = stockInfo?.stockManagement?.adminDefinedStock || 0;
      const operationType = stockOperation === 'change_status_condition' ? 'change_status_condition' : 'adjust_stock';
      
      // For change_status_condition, use changeQuantity
      // For adjust_stock, use stockValue
      const finalStockValue = stockOperation === 'change_status_condition' 
        ? changeQuantity 
        : stockValue;

      console.log('🔍 Stock operation debug:', {
        itemName: stockItem.itemName,
        category: stockItem.categoryId, // เปลี่ยนจาก categoryId เป็น category
        operationType,
        currentStock,
        newStockValue: finalStockValue,  // This is the absolute value we want
        reason: stockReason,
        newStatusId,
        newConditionId
      });
      

      const response = await fetch('/api/admin/stock-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: stockItem.itemId, // ใช้ ID แทนชื่อ
          itemName: stockItem.itemName, // เก็บชื่อไว้สำหรับ logging
          category: stockItem.categoryId,
          operationType: operationType,
          value: finalStockValue,  // ✅ Send absolute value (API will calculate adjustment)
          reason: stockReason,
          // ส่งข้อมูลใหม่ (หากไม่กรอก จะใช้ค่าเดิม)
          newStatusId: targetStatusId && targetStatusId.trim() !== '' ? targetStatusId : undefined,     // undefined = ใช้ค่าเดิม
          newConditionId: targetConditionId && targetConditionId.trim() !== '' ? targetConditionId : undefined, // undefined = ใช้ค่าเดิม
          // ส่งข้อมูลเพิ่มเติมสำหรับการเปลี่ยนสถานะ/สภาพ
          currentStatusId: currentStatusId,
          statusChangeQuantity: statusChangeQuantity,
          currentConditionId: currentConditionId,
          conditionChangeQuantity: conditionChangeQuantity
        }),
      });

      const data = await response.json();
      
      console.log('🔍 Stock management response:', {
        status: response.status,
        ok: response.ok,
        data: data
      });

      if (response.ok) {
        toast.success(data.message);
        
        // Clear any cached data to ensure fresh information
        setStockInfo(null);
        
        // Clear breakdown data cache to force fresh data fetch
        setBreakdownData({});
        console.log('🧹 Cleared breakdownData cache after stock operation');
        
        // Add small delay to ensure backend sync is complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Clear backend cache to ensure fresh data
        try {
          await fetch('/api/admin/clear-all-caches', { method: 'POST' });
        } catch (error) {
          console.log('Cache clear failed, continuing with refresh...');
        }
        
        // Note: Table refresh will be done after modal closes
        
        // Also refresh the stock info for all operations
        if (stockItem) {
          const stockResponse = await fetch(`/api/admin/stock-management?itemName=${encodeURIComponent(stockItem.itemName)}&category=${encodeURIComponent(stockItem.categoryId)}&t=${Date.now()}`);
          if (stockResponse.ok) {
            const freshStockData = await stockResponse.json();
            setStockInfo(freshStockData);
          }
        }
        
        // Additional refresh for change_status_condition to ensure UI updates
        if (stockOperation === 'change_status_condition') {
          
          // Clear breakdown cache again for status/condition changes
          setBreakdownData({});
          console.log('🧹 Cleared breakdownData cache for status/condition change');
          
          // Note: Table refresh will be done after modal closes
          
          // Force fetch breakdown data for the specific item to update StatusCell immediately
          if (stockItem) {
            try {
              const breakdownResponse = await fetch(`/api/admin/inventory/breakdown?itemName=${encodeURIComponent(stockItem.itemName)}&categoryId=${encodeURIComponent(stockItem.categoryId)}&t=${Date.now()}`);
              if (breakdownResponse.ok) {
                const freshBreakdownData = await breakdownResponse.json();
                const cacheKey = `${stockItem.itemName}_${stockItem.categoryId}`;
                setBreakdownData(prev => ({
                  ...prev,
                  [cacheKey]: freshBreakdownData
                }));
              }
            } catch (error) {
              console.error('Error fetching fresh breakdown data:', error);
            }
          }
          
          // Clear and refetch stock info
          setStockInfo(null);
          if (stockItem) {
            const stockResponse = await fetch(`/api/admin/stock-management?itemName=${encodeURIComponent(stockItem.itemName)}&category=${encodeURIComponent(stockItem.categoryId)}&t=${Date.now()}`);
            if (stockResponse.ok) {
              const freshStockData = await stockResponse.json();
              setStockInfo(freshStockData);
            }
          }
          
          // Note: Final table refresh will be done after modal closes
          
          // Final breakdown cache clear to ensure fresh data
          setBreakdownData({});
          console.log('🧹 Final breakdownData cache clear');
          
          // Final force fetch breakdown data for immediate UI update
          if (stockItem) {
            try {
              const breakdownResponse = await fetch(`/api/admin/inventory/breakdown?itemName=${encodeURIComponent(stockItem.itemName)}&categoryId=${encodeURIComponent(stockItem.categoryId)}&t=${Date.now()}`);
              if (breakdownResponse.ok) {
                const freshBreakdownData = await breakdownResponse.json();
                const cacheKey = `${stockItem.itemName}_${stockItem.categoryId}`;
                setBreakdownData(prev => ({
                  ...prev,
                  [cacheKey]: freshBreakdownData
                }));
              }
            } catch (error) {
              console.error('Error fetching final breakdown data:', error);
            }
          }
        }
        
        // Re-fetch available items to update stock modal data for adjust_stock and change_status_condition operations
        if (stockOperation === 'adjust_stock' || stockOperation === 'change_status_condition') {
          // Fetch fresh data and update state directly
          try {
            const params = new URLSearchParams({
              itemName: stockItem.itemName,
              category: stockItem.categoryId
            });
            
            // Use available-items API for these operations
            const refreshApiEndpoint = `/api/admin/equipment-reports/available-items?${params}`;
            const availableResponse = await fetch(refreshApiEndpoint, {
              credentials: 'include'
            });
            if (availableResponse.ok) {
              const freshData = await availableResponse.json();
              setAvailableItems(freshData);
              
              // Update stockValue with fresh data
              if (freshData?.withoutSerialNumber?.count !== undefined) {
                setStockValue(freshData.withoutSerialNumber.count);
              }
            }
          } catch (error) {
            console.log('Failed to fetch fresh available items, using existing data');
          }
        }
        
        // Final refresh before closing modal
        
        // Clear breakdown cache for final refresh
        setBreakdownData({});
        setBreakdownRefreshCounter(prev => prev + 1);
        console.log('🧹 Final breakdown cache clear before closing modal');
        
        await fetchInventory();
        
        // Additional delay and refresh for change_status_condition and edit_items
        if (stockOperation === 'change_status_condition' || stockOperation === 'edit_items') {
          
          // Clear cache again for these operations
          setBreakdownData({});
          setBreakdownRefreshCounter(prev => prev + 1);
          console.log(`🧹 Additional breakdown cache clear for ${stockOperation}`);
          
          await new Promise(resolve => setTimeout(resolve, 500)); // Longer delay
          await fetchInventory();
        }
        
        closeStockModal();
      } else {
        // 🆕 ENHANCED: Handle specific error types with better UX
        if (data.errorType === 'CANNOT_REDUCE_WITH_SERIAL_NUMBERS') {
          // Parse error message to extract details
          const errorMessage = data.error || '';
          const matches = errorMessage.match(/มีรายการที่ไม่มี Serial Number เพียง (\d+) รายการ แต่ต้องลบ (\d+) รายการ จะต้องลบรายการที่มี Serial Number (\d+) รายการ/);
          
          const details = matches ? {
            itemsToRemove: parseInt(matches[2]),
            itemsWithoutSN: parseInt(matches[1]),
            itemsWithSN: parseInt(matches[3])
          } : undefined;
          
          // Set modal data and show modal
          setStockReductionErrorData({
            error: data.error,
            suggestion: data.suggestion || 'กรุณาใช้ฟังก์ชั่น "แก้ไขรายการ" เพื่อลบรายการที่มี Serial Number แบบ Manual',
            details
          });
          setShowStockReductionError(true);
          
          // Also show toast for immediate feedback
          toast.error('ไม่สามารถลดจำนวนได้', {
            duration: 3000,
            style: {
              background: '#FEF2F2',
              borderLeft: '4px solid #F87171',
              color: '#B91C1C'
            }
          });
        } else {
          // Regular error
          toast.error(data.error || 'เกิดข้อผิดพลาด');
        }
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setStockLoading(false);
    }
  };




  const resetForm = () => {
    // Set default status and condition based on loaded configs
    const defaultStatus = statusConfigs.length > 0 
      ? (statusConfigs.find(s => s.name === 'มี') || statusConfigs[0]).id
      : '';
    const defaultCondition = conditionConfigs.length > 0 
      ? (conditionConfigs.find(c => c.name === 'ใช้งานได้') || conditionConfigs[0]).id
      : '';
    
    setFormData({
      itemName: '',
      categoryId: '',
      quantity: 0,
      totalQuantity: 0,
      serialNumber: '',
      status: defaultStatus,
      condition: defaultCondition
    });
    setEditingItem(null);
    setAddFromSN(false);
    
    // Reset new states
    setSelectedCategory(''); // Reset selectedCategory ด้วย
    setSelectedCategoryId('');
    setExistingItemsInCategory([]);
    setSelectedExistingItem('');
    setIsAddingNewItem(false);
  };

  // Function to handle category selection and fetch existing items
  const handleCategorySelection = async (categoryId: string) => {
    setSelectedCategory(categoryId);
    setFormData(prev => ({ 
      ...prev, 
      categoryId,
      // ตั้งจำนวนเป็น 1 สำหรับซิมการ์ด  
      quantity: isSIMCardSync(categoryId) ? 1 : prev.quantity
    }));
    setSelectedExistingItem('');
    setIsAddingNewItem(false);

    if (categoryId) {
      try {
        // Fetch existing item names in this category
        const response = await fetch('/api/admin/inventory');
        if (response.ok) {
          const allItems = await response.json();
          const itemsInCategory = allItems
            .filter((item: any) => item.categoryId === categoryId)
            .map((item: any) => item.itemName)
            .filter((name: string, index: number, array: string[]) => array.indexOf(name) === index); // Remove duplicates
          
          setExistingItemsInCategory(itemsInCategory);
        }
      } catch (error) {
        console.error('Error fetching items in category:', error);
        setExistingItemsInCategory([]);
      }
    } else {
      setExistingItemsInCategory([]);
    }
  };

  // Function to handle existing item selection
  const handleExistingItemSelection = (itemName: string) => {
    setSelectedExistingItem(itemName);
    setFormData(prev => ({ ...prev, itemName }));
    setIsAddingNewItem(false);
  };

  // Function to switch to adding new item
  const handleAddNewItem = () => {
    setIsAddingNewItem(true);
    setSelectedExistingItem('');
    setFormData(prev => ({ ...prev, itemName: '' }));
  };

  const exportToExcel = async () => {
    try {
      if (filteredItems.length === 0) {
        toast.error('ไม่มีข้อมูลให้ Export');
        return;
      }

      toast.loading('กำลังโหลดข้อมูลจาก Database...', { id: 'export-loading' });

      // สร้าง query parameters สำหรับการฟิลเตอร์
      const params = new URLSearchParams();
      if (searchTerm) params.append('searchTerm', searchTerm);
      if (categoryFilter) params.append('categoryFilter', categoryFilter);
      if (dateFilter) params.append('dateFilter', dateFilter);
      // Note: detailsFilter จะใช้ในการกรองข้อมูลฝั่งหน้าบ้านแทน เพราะต้องใช้ config ในการแปลง

      // ดึงข้อมูลรายละเอียดจาก inventoryitems collection
      const response = await fetch(`/api/admin/inventory/items?${params.toString()}`, {
        credentials: 'include', // ✅ ส่ง cookies สำหรับ authentication
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        // ลอง parse error message จาก response
        let errorMessage = 'ไม่สามารถดึงข้อมูลจาก Database ได้';
        try {
          const errorData = await response.json();
          console.error('API Error:', errorData);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          console.error('Response status:', response.status);
        }
        
        if (response.status === 401) {
          throw new Error('กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
        }
        throw new Error(errorMessage);
      }

      let allInventoryItems = await response.json();
      console.log('Fetched inventory items:', allInventoryItems.length);
      
      // ฟิลเตอร์ตาม detailsFilter (สถานะและสภาพ) ฝั่งหน้าบ้าน
      if (detailsFilter && detailsFilter.trim() !== '') {
        const detailsTerm = detailsFilter.toLowerCase();
        allInventoryItems = allInventoryItems.filter((item: any) => {
          const statusText = String(getStatusText(item.statusId || item.status) || '').toLowerCase();
          const conditionText = String(getConditionText(item.conditionId || item.condition) || '').toLowerCase();
          return statusText.includes(detailsTerm) || conditionText.includes(detailsTerm);
        });
      }

      // ฟิลเตอร์ตาม categoryName ฝั่งหน้าบ้าน (เพราะ searchTerm อาจรวมการค้นหา category)
      if (searchTerm && searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        allInventoryItems = allInventoryItems.filter((item: any) => {
          const categoryName = String(getCategoryName(item.categoryId) || '').toLowerCase();
          // itemName ถูกกรองแล้วใน API แต่เพิ่ม categoryName filter ที่นี่
          return categoryName.includes(term) || String(item.itemName || '').toLowerCase().includes(term);
        });
      }

      console.log('Filtered inventory items for export:', allInventoryItems.length);
      
      toast.loading('กำลังสร้างไฟล์ Excel...', { id: 'export-loading' });

      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('คลังสินค้า');

      // ตั้งค่าคอลัมน์
      worksheet.columns = [
        { header: 'หมวดหมู่', key: 'category', width: 20 },
        { header: 'ชื่ออุปกรณ์', key: 'itemName', width: 25 },
        { header: 'จำนวน', key: 'quantity', width: 10 },
        { header: 'สถานะ', key: 'status', width: 15 },
        { header: 'สภาพ', key: 'condition', width: 15 },
        { header: 'Serial Number', key: 'serialNumber', width: 20 },
        { header: 'Phone Number', key: 'phoneNumber', width: 15 },
        { header: 'วันที่เพิ่ม', key: 'dateAdded', width: 15 },
      ];

      // ✅ ใช้ filteredItems จากหน้าเว็บโดยตรง เพื่อให้ตรงกับที่แสดงในตาราง 100%
      for (const group of filteredItems) {
        const itemName = group.itemName;
        const categoryName = getCategoryName(group.categoryId);

        // ดึงข้อมูลรายการจริงจาก inventoryitems (เฉพาะที่คงเหลือ - admin_stock)
        const items = allInventoryItems.filter(
          (it: any) => 
            it.itemName === group.itemName && 
            it.categoryId === group.categoryId &&
            it.currentOwnership?.ownerType === 'admin_stock' // ✅ เฉพาะอุปกรณ์ที่คงเหลือในคลัง
        );

        // แยกรายการเป็น 3 ประเภท
        const itemsWithSN: any[] = [];
        const itemsWithPhone: any[] = [];
        const itemsWithoutSNOrPhone: any[] = [];

        for (const item of items) {
          // ใน InventoryItem แต่ละ document มี serialNumber เดี่ยว (ไม่ใช่ array)
          const hasSerialNumber = (Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) || 
                                  (item.serialNumber && item.serialNumber.trim() !== '');
          const hasPhoneNumber = item.numberPhone && item.numberPhone.trim() !== '';

          if (hasSerialNumber) {
            // มี Serial Number
            itemsWithSN.push(item);
          } else if (hasPhoneNumber) {
            // มีเบอร์โทร
            itemsWithPhone.push(item);
          } else {
            // ไม่มีทั้ง SN และเบอร์โทร
            itemsWithoutSNOrPhone.push(item);
          }
        }

        // 1. แจกแจงรายการที่มี Serial Number (แต่ละ item เป็นแถวเดียว เพราะ 1 item = 1 SN)
        for (const item of itemsWithSN) {
          // รองรับทั้ง serialNumber (string) และ serialNumbers (array)
          const serialNumber = Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0
            ? item.serialNumbers[0]
            : (item.serialNumber || '-');

          worksheet.addRow({
            itemName,
            category: categoryName,
            quantity: 1, // แต่ละ item ใน InventoryItem = 1 ชิ้น
            status: getStatusText(item.statusId || item.status) || '-',
            condition: getConditionText(item.conditionId || item.condition) || '-',
            serialNumber: serialNumber,
            phoneNumber: '-',
            dateAdded: new Date(item.dateAdded).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }),
          });
        }

        // 2. แจกแจงรายการที่มีเบอร์โทร (แต่ละ item เป็นแถวเดียว เพราะ 1 item = 1 เบอร์)
        for (const item of itemsWithPhone) {
          const phoneNumber = item.numberPhone;
          worksheet.addRow({
            itemName,
            category: categoryName,
            quantity: 1, // แต่ละ item ใน InventoryItem = 1 ชิ้น
            status: getStatusText(item.statusId || item.status) || '-',
            condition: getConditionText(item.conditionId || item.condition) || '-',
            serialNumber: '-',
            phoneNumber: phoneNumber,
            dateAdded: new Date(item.dateAdded).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }),
          });
        }

        // 3. รวมรายการที่ไม่มี SN และเบอร์โทร เป็นแถวเดียว
        if (itemsWithoutSNOrPhone.length > 0) {
          // group ตาม status และ condition
          const grouped = new Map<string, any>();
          for (const item of itemsWithoutSNOrPhone) {
            const statusText = getStatusText(item.statusId || item.status) || '-';
            const conditionText = getConditionText(item.conditionId || item.condition) || '-';
            const key = `${statusText}||${conditionText}`;

            if (!grouped.has(key)) {
              grouped.set(key, {
                quantity: 0,
                status: statusText,
                condition: conditionText,
                dateAdded: item.dateAdded,
              });
            }
            const acc = grouped.get(key);
            acc.quantity += 1; // แต่ละ item = 1 ชิ้น
            // ใช้วันที่ล่าสุด
            if (new Date(item.dateAdded).getTime() > new Date(acc.dateAdded).getTime()) {
              acc.dateAdded = item.dateAdded;
            }
          }

          // เพิ่มแถวในตารางตามกลุ่มที่รวมแล้ว
          for (const [key, data] of grouped.entries()) {
            worksheet.addRow({
              itemName,
              category: categoryName,
              quantity: data.quantity,
              status: data.status,
              condition: data.condition,
              serialNumber: '-',
              phoneNumber: '-',
              dateAdded: new Date(data.dateAdded).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }),
            });
          }
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
      
      const filename = `คลังสินค้า_${dateStr}_${timeStr}.xlsx`;

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
      toast.success(`ส่งออกข้อมูลสำเร็จ`);
    } catch (error) {
      console.error('Export error:', error);
      toast.dismiss('export-loading');
      toast.error('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    }
  };


  // ✅ อัปเดตให้รองรับ statusId และ backward compatibility
  const getStatusText = (statusIdOrName: string) => {
    // ถ้าไม่มี statusConfigs ให้ return null เพื่อแสดง "-"
    if (!statusConfigs || statusConfigs.length === 0) {
      return null;
    }
    return getDisplayStatusText(statusIdOrName, statusConfigs);
  };

  const getStatusClass = (statusIdOrName: string) => {
    // ถ้าไม่มี statusConfigs ให้ return default class
    if (!statusConfigs || statusConfigs.length === 0) {
      return 'bg-gray-100 text-gray-500';
    }
    return getStatusClassHelper(statusIdOrName, statusConfigs);
  };

  const saveConfig = async () => {
    setSaveLoading(true);
    try {
      // Always use categoryConfigs, statusConfigs, and conditionConfigs
      const requestBody = { 
        categoryConfigs, 
        statusConfigs, // New status format with IDs only
        conditionConfigs // New condition format with IDs only
      };
      
      const response = await fetch('/api/admin/inventory/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Update original configs to track changes
        if (data.categoryConfigs) {
          setOriginalCategoryConfigs(JSON.parse(JSON.stringify(data.categoryConfigs)));
        }
        if (data.statusConfigs) {
          setOriginalStatusConfigs(JSON.parse(JSON.stringify(data.statusConfigs)));
        }
        if (data.conditionConfigs) {
          setOriginalConditionConfigs(JSON.parse(JSON.stringify(data.conditionConfigs)));
        }
        
        setHasUnsavedChanges(false);
        toast.success('บันทึกการตั้งค่าเรียบร้อย');
        setShowSettingsModal(false);
      } else {
        const data = await response.json();
        toast.error(data.error || 'บันทึกไม่สำเร็จ');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSaveLoading(false);
    }
  };

  // Cancel changes and revert to original state
  const cancelConfigChanges = async () => {
    setCancelLoading(true);
    
    // Add a small delay to show loading animation (simulate processing time)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (hasUnsavedChanges) {
      // Revert to original state
      setCategoryConfigs(JSON.parse(JSON.stringify(originalCategoryConfigs)));
      setStatusConfigs(JSON.parse(JSON.stringify(originalStatusConfigs)));
      setConditionConfigs(JSON.parse(JSON.stringify(originalConditionConfigs)));
      setHasUnsavedChanges(false);
    }
    
    setCancelLoading(false);
    setShowSettingsModal(false);
  };

  // Handle close settings modal (X button)
  const handleCloseSettingsModal = () => {
    if (hasUnsavedChanges) {
      // Show confirmation modal
      const confirmed = window.confirm('มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการยกเลิกหรือไม่?');
      if (confirmed) {
        // Cancel changes and close modal
        cancelConfigChanges();
      }
      // If not confirmed, do nothing (stay in modal)
    } else {
      // No changes, close modal directly
      setShowSettingsModal(false);
    }
  };

  // Generate unique category ID
  const generateCategoryId = (): string => {
    return `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Add new category
  const addNewCategoryConfig = () => {
    const name = newCategory.trim();
    if (!name) return;
    
    // Check for duplicates
    if (categoryConfigs.some(cat => cat.name === name)) {
      toast.error('เพิ่มข้อมูลไม่ได้ เนื่องจากข้อมูลซ้ำ', { duration: 4000 });
      return;
    }
    
    // Compute order ignoring "ไม่ระบุ" so the new one goes right before it
    const maxOrderExcludingUnassigned = Math.max(
      0,
      ...categoryConfigs
        .filter(cat => cat.id !== 'cat_unassigned')
        .map(cat => cat.order || 0)
    );
    const newCategoryConfig: ICategoryConfig = {
      id: generateCategoryId(),
      name,
      isSystemCategory: false,
      // Ensure new categories are always before both locked categories
      order: Math.min(maxOrderExcludingUnassigned + 1, 997),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setCategoryConfigs([...categoryConfigs, newCategoryConfig]);
    setHasUnsavedChanges(true);
    setNewCategory('');
    toast.success(`เพิ่มหมวดหมู่ "${name}" เรียบร้อย`);
  };

  // Update category config
  const updateCategoryConfig = (index: number, updates: Partial<ICategoryConfig>) => {
    const updated = [...categoryConfigs];
    updated[index] = { ...updated[index], ...updates, updatedAt: new Date() };
    setCategoryConfigs(updated);
    setHasUnsavedChanges(true);
  };

  // Delete category with confirmation
  const deleteCategoryConfig = (index: number) => {
    const category = categoryConfigs[index];
    
    if (category.isSystemCategory) {
      toast.error('ไม่สามารถลบหมวดหมู่ระบบได้');
      return;
    }
    
    setDeletingCategory(category);
    setDeletingCategoryIndex(index);
    setShowCategoryDeleteConfirm(true);
  };

  // Perform the actual deletion
  const performCategoryDelete = async () => {
    if (!deletingCategory || deletingCategoryIndex === null) return;
    
    setCategoryDeleteLoading(true);
    
    try {
      // For now, just delete from local state
      // In the future, we can call API to check for items using this category
      const updated = categoryConfigs.filter((_, i) => i !== deletingCategoryIndex);
      setCategoryConfigs(updated);
      setHasUnsavedChanges(true);
      
      toast.success(`ลบหมวดหมู่ "${deletingCategory.name}" สำเร็จ`);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการลบหมวดหมู่');
    } finally {
      setCategoryDeleteLoading(false);
      setShowCategoryDeleteConfirm(false);
      setDeletingCategory(null);
      setDeletingCategoryIndex(null);
    }
  };

  // Cancel category deletion
  const cancelCategoryDelete = () => {
    setShowCategoryDeleteConfirm(false);
    setDeletingCategory(null);
    setDeletingCategoryIndex(null);
    setCategoryDeleteLoading(false);
  };

  // Reorder categories
  const reorderCategoryConfigs = (newConfigs: ICategoryConfig[]) => {
    setCategoryConfigs(newConfigs);
    setHasUnsavedChanges(true);
  };

  // Status management functions
  const generateStatusId = (): string => {
    return `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Add new status config
  const addStatusConfig = () => {
    if (!newStatusConfig.trim()) {
      toast.error('กรุณาใส่ชื่อสถานะ');
      return;
    }

    if (statusConfigs.some(sc => sc.name === newStatusConfig.trim())) {
      toast.error('มีสถานะนี้อยู่แล้ว');
      return;
    }

    const newConfig: IStatusConfig = {
      id: generateStatusId(),
      name: newStatusConfig.trim(),
      order: statusConfigs.length + 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setStatusConfigs([...statusConfigs, newConfig]);
    setNewStatusConfig('');
    setHasUnsavedChanges(true);
    toast.success(`เพิ่มสถานะ "${newConfig.name}" เรียบร้อย`);
  };

  // Edit status config
  const updateStatusConfig = (index: number, newConfig: IStatusConfig) => {
    const updated = [...statusConfigs];
    updated[index] = newConfig;
    setStatusConfigs(updated);
    setHasUnsavedChanges(true);
  };

  // Delete status config
  const deleteStatusConfig = (index: number) => {
    const statusConfig = statusConfigs[index];
    const updated = statusConfigs.filter((_, i) => i !== index);
    setStatusConfigs(updated);
    setHasUnsavedChanges(true);
    toast.success(`ลบสถานะ "${statusConfig.name}" สำเร็จ`);
  };

  // Reorder status configs
  const reorderStatusConfigs = (newConfigs: IStatusConfig[]) => {
    setStatusConfigs(newConfigs);
    setHasUnsavedChanges(true);
  };
  
  // Add new condition config
  const addConditionConfig = () => {
    if (!newConditionConfig.trim()) {
      toast.error('กรุณาใส่ชื่อสภาพอุปกรณ์');
      return;
    }

    if (conditionConfigs.some(cc => cc.name === newConditionConfig.trim())) {
      toast.error('มีสภาพอุปกรณ์นี้อยู่แล้ว');
      return;
    }

    const newConfig: IConditionConfig = {
      id: `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newConditionConfig.trim(),
      order: conditionConfigs.length + 1,
      isSystemConfig: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setConditionConfigs([...conditionConfigs, newConfig]);
    setNewConditionConfig('');
    setHasUnsavedChanges(true);
    toast.success(`เพิ่มสภาพอุปกรณ์ "${newConfig.name}" เรียบร้อย`);
  };

  // Edit condition config
  const updateConditionConfig = (index: number, newConfig: IConditionConfig) => {
    const updated = [...conditionConfigs];
    updated[index] = newConfig;
    setConditionConfigs(updated);
    setHasUnsavedChanges(true);
  };

  // Delete condition config
  const deleteConditionConfig = (index: number) => {
    const conditionConfig = conditionConfigs[index];
    const updated = conditionConfigs.filter((_, i) => i !== index);
    setConditionConfigs(updated);
    setHasUnsavedChanges(true);
    toast.success(`ลบสภาพอุปกรณ์ "${conditionConfig.name}" สำเร็จ`);
  };

  // Reorder condition configs
  const reorderConditionConfigs = (newConfigs: IConditionConfig[]) => {
    setConditionConfigs(newConfigs);
    setHasUnsavedChanges(true);
  };
  
  // Delete status with confirmation (updated for statusConfigs)
  const deleteStatus = (index: number) => {
    const statusConfig = statusConfigs[index];
    setDeletingStatus(statusConfig.name);
    setDeletingStatusIndex(index);
    setShowStatusDeleteConfirm(true);
  };
  
  const confirmDeleteStatus = () => {
    if (deletingStatusIndex !== null) {
      const updatedStatusConfigs = statusConfigs.filter((_, i: any) => i !== deletingStatusIndex);
      setStatusConfigs(updatedStatusConfigs);
      setHasUnsavedChanges(true);
      toast.success(`ลบสถานะ "${deletingStatus}" สำเร็จ`);
    }
    cancelDeleteStatus();
  };
  
  const cancelDeleteStatus = () => {
    setShowStatusDeleteConfirm(false);
    setDeletingStatus(null);
    setDeletingStatusIndex(null);
    setStatusDeleteLoading(false);
  };
  
  // Delete condition with confirmation
  const deleteCondition = (index: number) => {
    const conditionConfig = conditionConfigs[index];
    setDeletingCondition(conditionConfig.name);
    setDeletingConditionIndex(index);
    setShowConditionDeleteConfirm(true);
  };
  
  const confirmDeleteCondition = () => {
    if (deletingConditionIndex !== null) {
      const updatedConditionConfigs = conditionConfigs.filter((_, i: any) => i !== deletingConditionIndex);
      setConditionConfigs(updatedConditionConfigs);
      setHasUnsavedChanges(true);
      toast.success(`ลบสถานะอุปกรณ์ "${deletingCondition}" สำเร็จ`);
    }
    cancelDeleteCondition();
  };
  
  const cancelDeleteCondition = () => {
    setShowConditionDeleteConfirm(false);
    setDeletingCondition(null);
    setDeletingConditionIndex(null);
    setConditionDeleteLoading(false);
  };

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredItems.slice(startIndex, endIndex);


  const findNonSerialDocForGroup = (groupItem: any): InventoryItem | undefined => {
    return items.find(
      (it) => it.itemName === groupItem.itemName && it.categoryId === groupItem.categoryId && (!it.serialNumbers || it.serialNumbers.length === 0)
    );
  };


  return (
    <Layout>
      <div className="max-w-full mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
          {/* Header */}
          <div className="flex flex-col justify-between items-center mb-7 xl:flex-row">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 pb-2 xl:pb-0">จัดการคลังสินค้า</h1>
            </div>
            <div className="flex flex-wrap justify-center gap-4 w-full xl:w-auto">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="w-full min-[440px]:w-3/7 min-[650px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>ฟิลเตอร์</span>
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="w-full min-[440px]:w-3/7 min-[650px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>ตั้งค่า</span>
              </button>

              <button
                onClick={refreshAndClearCache}
                disabled={loading}
                className="w-full min-[440px]:w-3/7 min-[650px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                title="รีเฟรชข้อมูล, ล้าง Cache และ Sync ข้อมูล InventoryMaster"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>รีเฟรช</span>
              </button>
              <button
                onClick={exportToExcel}
                disabled={loading || filteredItems.length === 0}
                className="w-full min-[440px]:w-3/7 min-[650px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={filteredItems.length === 0 ? 'ไม่มีข้อมูลให้ Export' : 'Export ข้อมูลเป็น Excel'}
              >
                <Download className="w-4 h-4" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
                className="w-full min-[440px]:w-3/7 min-[650px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มรายการ</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
              <div className="grid grid-cols-4 max-[768px]:grid-cols-1 max-[1120px]:grid-cols-2 gap-4">
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
                      placeholder="ชื่ออุปกรณ์, หมวดหมู่"
                    />
                  </div>
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
                    {categoryConfigs
                      .filter(config => {
                        // ซ่อน "ไม่ระบุ"
                        if (config.isSystemCategory && config.id === 'cat_unassigned') return false;
                        
                        // แสดงหมวดหมู่ทั้งหมดรวมถึงซิมการ์ด (ลบเงื่อนไขที่ป้องกันการเพิ่มรายการใหม่)
                        
                        return true;
                      })
                      .sort((a, b) => {
                        // จัดเรียงตาม order โดยให้ซิมการ์ดอยู่รองจากสุดท้าย (ก่อนไม่ระบุที่ถูกซ่อน)
                        const aOrder = a.id === 'cat_sim_card' ? 998 : (a.order || 0);
                        const bOrder = b.id === 'cat_sim_card' ? 998 : (b.order || 0);
                        return aOrder - bOrder;
                      })
                      .map((config: any) => (
                        <option key={config.id} value={config.id}>
                          {config.name}
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
                    value={detailsFilter}
                    onChange={(e) => setDetailsFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="เช่น ใช้งานได้"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่เพิ่ม
                  </label>
                  <DatePicker
                    value={dateFilter}
                    onChange={(date) => setDateFilter(date)}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <select
                  value={stockDisplayMode}
                  onChange={(e) => {
                    const mode = e.target.value as 'all' | 'low_stock';
                    setStockDisplayMode(mode);
                    // Update lowStockFilter based on mode
                    if (mode === 'all') {
                      setLowStockFilter(null);
                    } else {
                      setLowStockFilter(lowStockThreshold);
                    }
                  }}
                  className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">แสดงจำนวนทั้งหมด</option>
                  <option value="low_stock">สินค้าใกล้หมด ≤</option>
                </select>
                {stockDisplayMode === 'low_stock' && (
                  <>
                    <input
                      type="number"
                      min="0"
                      value={lowStockThreshold}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        setLowStockThreshold(value);
                        setLowStockFilter(value);
                      }}
                      placeholder="0"
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-sm text-gray-700">ชิ้น</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Table */}
          <div ref={tableContainerRef} className="table-container">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-600">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    ชื่ออุปกรณ์
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    หมวดหมู่
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    จำนวนคงเหลือ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                    จำนวนทั้งหมด
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    รายละเอียด
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    วันที่เพิ่ม
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    เพิ่มเติม
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-50  divide-y divide-gray-200">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                      กำลังโหลดข้อมูล
                    </td>
                  </tr>
                )}
                {!loading && currentItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">ไม่พบข้อมูล</td>
                  </tr>
                )}
                {currentItems.map((item, index) => {
                  const hasSerials = Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0;
                  const threshold = lowStockThreshold;
                  const isLowStock = item.quantity <= threshold && !hasSerials;
                  return (
                    <tr 
                      key={item._id} 
                      className={isLowStock ? 'bg-red-100 hover:!bg-red-200 transition-colors duration-200' : (index % 2 === 0 ? 'bg-white' : 'bg-blue-50')}
                      onMouseEnter={(e) => {
                        if (isLowStock) {
                          e.currentTarget.style.setProperty('background-color', '#fecaca', 'important');
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isLowStock) {
                          e.currentTarget.style.setProperty('background-color', '#fee2e2', 'important');
                        }
                      }}
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 text-center text-selectable">
                        {item.itemName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 text-center text-selectable">
                        {getCategoryName(item.categoryId)}
                      </td>
                      <td className={`px-6 py-4 text-sm font-medium ${
                        isLowStock ? 'text-red-600' : 'text-gray-900'
                      } text-center text-selectable`}>
                        <div className="flex flex-col items-center">
                          <span>{item.quantity}</span>
                          {item.userOwnedQuantity > 0 && (
                            <span className="text-xs text-blue-600 mt-1">
                              👤 User: {item.userOwnedQuantity}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-center text-selectable">
                        <div className="flex flex-col items-center">
                          <span>{item.totalQuantity ?? item.quantity}</span>
                          {item.quantity === 0 && item.userOwnedQuantity > 0 && (
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full mt-1">
                              ⏳ รอคืนอุปกรณ์
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <StatusCell 
                          key={`${item.itemName}_${item.categoryId}_${breakdownRefreshCounter}`} // Force re-render when data changes
                          item={{
                            _id: item._id,
                            itemName: item.itemName,
                            categoryId: item.categoryId,
                            statusMain: (() => {
                          const statusIdOrName = item.statusId || item.status;
                          const statusName = getStatusText(statusIdOrName);
                          
                          if (statusConfigs.length === 0 || !statusName || statusName === statusIdOrName) {
                                return '-';
                              }
                              
                              return item.hasMixedStatus ? 'หลากหลาย' : statusName;
                            })()
                          }}
                          breakdown={breakdownData[`${item.itemName}_${item.categoryId}`]}
                          onFetchBreakdown={() => fetchBreakdown(item.itemName, item.categoryId)}
                          statusConfigs={statusConfigs}
                          conditionConfigs={conditionConfigs}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {new Date(item.dateAdded).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium relative">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => openStockModal(item)}
                            disabled={stockButtonLoading === item._id}
                            className={`px-3 py-1 rounded-md text-sm font-medium cursor-pointer flex items-center justify-center min-w-[120px] ${
                              stockButtonLoading === item._id
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                : item.quantity === 0 && item.userOwnedQuantity > 0
                                  ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
                                  : item.quantity > 0 && item.userOwnedQuantity > 0
                                    ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                                    : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                            }`}
                            aria-label="จัดการ Stock"
                            title={
                              stockButtonLoading === item._id
                                ? 'กำลังโหลด...'
                                : item.quantity === 0 && item.userOwnedQuantity > 0
                                  ? `ลบไม่ได้ - User ครอบครอง ${item.userOwnedQuantity} ชิ้น`
                                  : item.quantity > 0 && item.userOwnedQuantity > 0
                                    ? `ลบได้บางส่วน - Admin: ${item.quantity}, User: ${item.userOwnedQuantity}`
                                    : `ลบได้ทั้งหมด - ${item.quantity} ชิ้น`
                            }
                          >
                            {stockButtonLoading === item._id ? (
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600"></div>
                                <span>โหลด...</span>
                              </div>
                            ) : (
                              item.quantity === 0 && item.userOwnedQuantity > 0
                                ? '🚫 ลบไม่ได้'
                                : item.quantity > 0 && item.userOwnedQuantity > 0
                                  ? '⚠️ ลบบางส่วน'
                                  : '🗑️ จัดการ Stock'
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Total Count */}
          {!loading && filteredItems.length > 0 && (
            <div className="mt-4 text-left">
              <p className="text-sm text-gray-600">
                แสดงทั้งหมด {filteredItems.length} รายการ
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center text-sm text-gray-700">
                <span>
                  แสดง {startIndex + 1} ถึง {Math.min(endIndex, filteredItems.length)} จาก {filteredItems.length} รายการ
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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden border-0 flex flex-col">
              {/* Header - Fixed */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">เพิ่มรายการใหม่</h3>
                  <button
                    onClick={() => { setShowAddModal(false); setAddFromSN(false); }}
                    className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                <form onSubmit={handleSubmit} className="space-y-5">
                {/* Step 1: Select Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หมวดหมู่ *
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => handleCategorySelection(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  >
                    <option value="">-- เลือกหมวดหมู่ --</option>
                    {categoryConfigs
                      .filter(config => {
                        // ซ่อน "ไม่ระบุ"
                        if (config.isSystemCategory && config.id === 'cat_unassigned') return false;
                        
                        // แสดงหมวดหมู่ทั้งหมดรวมถึงซิมการ์ด (ลบเงื่อนไขที่ป้องกันการเพิ่มรายการใหม่)
                        
                        return true;
                      })
                      .sort((a, b) => {
                        // จัดเรียงตาม order โดยให้ซิมการ์ดอยู่รองจากสุดท้าย (ก่อนไม่ระบุที่ถูกซ่อน)
                        const aOrder = a.id === 'cat_sim_card' ? 998 : (a.order || 0);
                        const bOrder = b.id === 'cat_sim_card' ? 998 : (b.order || 0);
                        return aOrder - bOrder;
                      })
                      .map((config: any) => (
                        <option key={config.id} value={config.id}>
                          {config.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Step 2: Show existing items in category or option to add new */}
                {selectedCategory && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      เลือกอุปกรณ์
                    </label>
                    
                    {existingItemsInCategory.length > 0 && (
                      <div className="mb-3">
                        <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
                          {existingItemsInCategory.map((itemName) => (
                            <label key={itemName} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input
                                type="radio"
                                name="existingItem"
                                value={itemName}
                                checked={selectedExistingItem === itemName}
                                onChange={() => handleExistingItemSelection(itemName)}
                                className="text-blue-600"
                              />
                              <span className="text-sm text-gray-700">{itemName}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Option to add new item */}
                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded border border-dashed border-gray-300">
                      <input
                        type="radio"
                        name="existingItem"
                        value="new"
                        checked={isAddingNewItem}
                        onChange={handleAddNewItem}
                        className="text-blue-600"
                      />
                      <span className="text-sm text-blue-600 font-medium">+ เพิ่มรายการใหม่</span>
                    </label>
                  </div>
                )}

                {/* Step 3: Item name input (only for new items) */}
                {selectedCategory && isAddingNewItem && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ชื่ออุปกรณ์ใหม่ *
                    </label>
                    <input
                      type="text"
                      name="itemName"
                      value={formData.itemName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="ระบุชื่ออุปกรณ์ใหม่"
                      required
                    />
                  </div>
                )}

                {/* Step 4: Quantity and other fields (show only when category is selected and item is chosen/named) */}
                {selectedCategory && (selectedExistingItem || isAddingNewItem) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        จำนวนที่เพิ่ม *
                      </label>
                      <input
                        type="number"
                        name="quantity"
                        value={formData.quantity}
                        onChange={handleInputChange}
                        min={1}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        required
                        disabled={addFromSN || formData.serialNumber.trim() !== '' || isSIMCardSync(selectedCategory)}
                      />
      {(addFromSN || formData.serialNumber.trim() !== '' || isSIMCardSync(selectedCategory)) && (
        <p className="text-xs text-blue-600 mt-1">
          {isSIMCardSync(selectedCategory)
            ? '* ซิมการ์ด: จำนวนถูกตั้งเป็น 1 และแก้ไขไม่ได้'
            : addFromSN
                            ? '* เพิ่มจากรายการ Serial Number: จำนวนทั้งหมดถูกตั้งเป็น 1 และแก้ไขไม่ได้' 
                            : '* เมื่อระบุ Serial Number จำนวนทั้งหมดจะเป็น 1 อัตโนมัติ'
                          }
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {isSIMCardSync(selectedCategory) ? 'เบอร์โทรศัพท์' : 'Serial Number'}
                        {isSIMCardSync(selectedCategory) && ' *'}
                      </label>
                      <input
                        type="text"
                        name="serialNumber"
                        value={formData.serialNumber}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder={isSIMCardSync(selectedCategory) ? 'กรอกเบอร์โทรศัพท์ 10 หลัก' : 'ไม่จำเป็น'}
                        pattern={isSIMCardSync(selectedCategory) ? '[0-9]{10}' : undefined}
                        maxLength={isSIMCardSync(selectedCategory) ? 10 : undefined}
                        required={addFromSN || isSIMCardSync(selectedCategory)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {isSIMCardSync(selectedCategory) 
                          ? 'กรุณากรอกหมายเลขโทรศัพท์ให้ครบ 10 หลัก' 
                          : addFromSN 
                          ? 'กรุณากรอก Serial Number ของรายการใหม่' 
                          : 'เมื่อใส่ Serial Number จำนวนจะถูกตั้งเป็น 1 อัตโนมัติ'
                        }
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        สถานะ
                      </label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      >
                        {statusConfigs.length > 0 ? (
                          getStatusOptions(statusConfigs).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                          </option>
                          ))
                        ) : (
                          <option value="" disabled>ไม่มีสถานะในระบบ</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        สภาพอุปกรณ์
                      </label>
                      <select
                        name="condition"
                        value={formData.condition}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        required
                      >
                        <option value="">เลือกสภาพอุปกรณ์</option>
                        {conditionConfigs.map((config) => (
                          <option key={config.id} value={config.id}>
                            {config.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => { setShowAddModal(false); setAddFromSN(false); }}
                        className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium"
                      >
                        ยกเลิก
                      </button>
                      {/* Show submit button only when required fields are filled */}
                      {selectedCategory && (selectedExistingItem || isAddingNewItem) && (
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl font-medium flex items-center justify-center space-x-2"
                        >
                          {loading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>กำลังบันทึก...</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              <span>บันทึก</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </form>
              </div>
            </div>
          </div>
              )}

      {/* 🆕 Stock Reduction Error Modal */}
      {showStockReductionError && stockReductionErrorData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-lg w-full mx-4 border border-red-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-red-100 bg-red-50/50 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-800">ไม่สามารถลดจำนวนได้</h3>
                  <p className="text-sm text-red-600">มีข้อจำกัดเกี่ยวกับ Serial Number</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowStockReductionError(false);
                  setStockReductionErrorData(null);
                }}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Error Message */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="text-red-500 mt-0.5">❌</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-800 mb-1">ปัญหาที่พบ</h4>
                    <p className="text-red-700 text-sm leading-relaxed">
                      {stockReductionErrorData.error}
                    </p>
                  </div>
                </div>
              </div>

              {/* Details Breakdown */}
              {stockReductionErrorData.details && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="text-amber-500 mt-0.5">📊</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-800 mb-2">รายละเอียด</h4>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-amber-700">ต้องลบทั้งหมด:</span>
                          <span className="font-medium text-amber-800">{stockReductionErrorData.details.itemsToRemove} รายการ</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-amber-700">ไม่มี Serial Number:</span>
                          <span className="font-medium text-green-600">{stockReductionErrorData.details.itemsWithoutSN} รายการ</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-amber-700">มี Serial Number:</span>
                          <span className="font-medium text-red-600">{stockReductionErrorData.details.itemsWithSN} รายการ</span>
                        </div>
                        <hr className="border-amber-200 my-1" />
                        <div className="flex justify-between text-xs">
                          <span className="text-amber-600">ยังขาดอีก:</span>
                          <span className="font-semibold text-red-600">
                            {stockReductionErrorData.details.itemsToRemove - stockReductionErrorData.details.itemsWithoutSN} รายการที่มี SN
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Solution */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="text-blue-500 mt-0.5">💡</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-800 mb-1">วิธีแก้ไข</h4>
                    <p className="text-blue-700 text-sm leading-relaxed mb-3">
                      {stockReductionErrorData.suggestion}
                    </p>
                    <div className="bg-blue-100 rounded p-3 text-xs text-blue-800">
                      <strong>ขั้นตอน:</strong> เลือก "แก้ไขรายการ" → เลือกรายการที่มี Serial Number → กดลบแบบ Manual
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50/50 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowStockReductionError(false);
                  setStockReductionErrorData(null);
                  // Switch to edit_items mode
                  setStockOperation('edit_items');
                  setStockReason('แก้ไขรายการอุปกรณ์');
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <span>🔧</span>
                <span>ไปที่แก้ไขรายการ</span>
              </button>
              
              <button
                onClick={() => {
                  setShowStockReductionError(false);
                  setStockReductionErrorData(null);
                }}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">แก้ไขรายการ</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ชื่ออุปกรณ์ *
                  </label>
                  <input
                    type="text"
                    name="itemName"
                    value={formData.itemName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หมวดหมู่ *
                  </label>
                  <select
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  >
                    <option value="">-- เลือกหมวดหมู่ --</option>
                    {categoryConfigs
                      .filter(config => {
                        // ซ่อน "ไม่ระบุ"
                        if (config.isSystemCategory && config.id === 'cat_unassigned') return false;
                        
                        // แสดงหมวดหมู่ทั้งหมดรวมถึงซิมการ์ด (ลบเงื่อนไขที่ป้องกันการเพิ่มรายการใหม่)
                        
                        return true;
                      })
                      .sort((a, b) => {
                        // จัดเรียงตาม order โดยให้ซิมการ์ดอยู่รองจากสุดท้าย (ก่อนไม่ระบุที่ถูกซ่อน)
                        const aOrder = a.id === 'cat_sim_card' ? 998 : (a.order || 0);
                        const bOrder = b.id === 'cat_sim_card' ? 998 : (b.order || 0);
                        return aOrder - bOrder;
                      })
                      .map((config: any) => (
                        <option key={config.id} value={config.id}>
                          {config.name}
                        </option>
                      ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    จำนวนทั้งหมด *
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                    disabled={formData.serialNumber.trim() !== ''}
                  />
                  {formData.serialNumber.trim() !== '' && (
                    <p className="text-xs text-blue-600 mt-1">
                      * เมื่อระบุ Serial Number จำนวนทั้งหมดจะเป็น 1 อัตโนมัติ
                    </p>
                  )}
                </div>

                {/* เอาช่องจำนวนทั้งหมดที่ซ้ำออก ให้เหลือเพียงช่องเดียวด้านบน */}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    name="serialNumber"
                    value={formData.serialNumber}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="ไม่จำเป็น"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    เมื่อใส่ Serial Number จำนวนจะถูกตั้งเป็น 1 อัตโนมัติ
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    สถานะ
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    {statusConfigs.length > 0 ? (
                      getStatusOptions(statusConfigs).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>ไม่มีสถานะในระบบ</option>
                    )}
                  </select>
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

        {/* Settings Modal */}
        {showSettingsModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl max-w-4xl w-full mx-4 border border-white/20 max-h-[90vh] flex flex-col overflow-hidden">
              {/* Header - Frozen */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-200 p-6 pb-4 z-10">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">ตั้งค่าหมวดหมู่/สถานะ/สภาพอุปกรณ์</h3>
                      {hasUnsavedChanges && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                          <span className="text-sm text-orange-600 font-medium">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
                        </div>
                      )}
                    </div>
                    {hasUnsavedChanges && (
                      <div className="flex items-center gap-2 sm:hidden">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                        <span className="text-sm text-orange-600 font-medium">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
                      </div>
                    )}
                  </div>
                  <button onClick={handleCloseSettingsModal} className="text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  {/* 1. Status Container */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        สถานะ
                        <span className="text-xs font-normal text-gray-400">
                          (ลากเพื่อเรียงลำดับ)
                        </span>
                      </h3>
                      <span className="text-sm text-gray-500">{statusConfigs.length} รายการ</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {/* Add new status form */}
                      <div className="mb-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newStatusConfig}
                            onChange={(e) => setNewStatusConfig(e.target.value)}
                            placeholder="เพิ่มสถานะใหม่"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newStatusConfig.trim()) {
                                e.preventDefault();
                                addStatusConfig();
                              }
                            }}
                          />
                          <button
                            onClick={addStatusConfig}
                            disabled={!newStatusConfig.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                          >
                            เพิ่ม
                          </button>
                        </div>
                      </div>

                      <StatusConfigList
                        statusConfigs={statusConfigs}
                        onReorder={reorderStatusConfigs}
                        onEdit={updateStatusConfig}
                        onDelete={deleteStatusConfig}
                        title=""
                      />
                    </div>
                  </div>

                  {/* 2. Condition Configs Section */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <ConditionConfigList
                      conditionConfigs={conditionConfigs}
                      onReorder={reorderConditionConfigs}
                      onUpdate={updateConditionConfig}
                      onDelete={deleteCondition}
                      title="สภาพอุปกรณ์"
                      newItemValue={newConditionConfig}
                      onNewItemValueChange={setNewConditionConfig}
                      onAddNewItem={addConditionConfig}
                    />
                  </div>

                  {/* 3. Categories Container - Full Width */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        หมวดหมู่
                        <span className="text-xs font-normal text-gray-400">
                          (ลากเพื่อเรียงลำดับ)
                        </span>
                      </h3>
                      <span className="text-sm text-gray-500">{categoryConfigs.length} รายการ</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      <CategoryConfigList
                        categoryConfigs={categoryConfigs}
                        onReorder={reorderCategoryConfigs}
                        onEdit={(categoryId, updates) => {
                          const index = categoryConfigs.findIndex(cat => cat.id === categoryId);
                          updateCategoryConfig(index, updates);
                        }}
                        onDelete={(categoryId) => {
                          const index = categoryConfigs.findIndex(cat => cat.id === categoryId);
                          deleteCategoryConfig(index);
                        }}
                        title=""
                        newItemValue={newCategory}
                        onNewItemValueChange={setNewCategory}
                        onAddNewItem={addNewCategoryConfig}
                        editingCategoryId={editingCategoryId}
                        editingValue={editingCategoryValue}
                        onEditingValueChange={setEditingCategoryValue}
                        onStartEdit={(categoryId) => {
                          setEditingCategoryId(categoryId);
                          // หา index จาก categoryId
                          const index = categoryConfigs.findIndex(cat => cat.id === categoryId);
                          // ใช้ชื่อจาก categoryConfigs ที่เป็นข้อมูลปัจจุบัน
                          const categoryName = categoryConfigs[index]?.name || '';
                          setEditingCategoryValue(categoryName);
                        }}
                        onSaveEdit={(categoryId) => {
                          // หา index จาก categoryId
                          const index = categoryConfigs.findIndex(cat => cat.id === categoryId);
                          updateCategoryConfig(index, {
                            name: editingCategoryValue.trim() || categoryConfigs[index].name
                          });
                          setEditingCategoryId(null);
                          setEditingCategoryValue('');
                        }}
                        onCancelEdit={() => {
                          setEditingCategoryId(null);
                          setEditingCategoryValue('');
                        }}
                        showBackgroundColors={true}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer - Frozen */}
              <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-6 pt-4 z-10">
                <div className="flex justify-end gap-3">
                <button
                  onClick={cancelConfigChanges}
                  disabled={cancelLoading || saveLoading}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    cancelLoading || saveLoading 
                      ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {cancelLoading && (
                    <div className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                  )}
                  {hasUnsavedChanges ? 'ยกเลิกการเปลี่ยนแปลง' : 'ปิด'}
                </button>
                <button
                  onClick={saveConfig}
                  disabled={!hasUnsavedChanges || saveLoading || cancelLoading}
                  className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 ${
                    hasUnsavedChanges && !saveLoading && !cancelLoading
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {saveLoading && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  บันทึกการเปลี่ยนแปลง
                </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Delete Confirmation Modal */}
        <StatusDeleteConfirmModal
          isOpen={showStatusDeleteConfirm}
          status={deletingStatus}
          onConfirm={confirmDeleteStatus}
          onCancel={cancelDeleteStatus}
          isLoading={statusDeleteLoading}
        />

        {/* Condition Delete Confirmation Modal */}
        <ConditionDeleteConfirmModal
          isOpen={showConditionDeleteConfirm}
          conditionName={deletingCondition}
          onConfirm={confirmDeleteCondition}
          onCancel={cancelDeleteCondition}
          loading={conditionDeleteLoading}
        />

        {/* Category Delete Confirmation Modal */}
        <CategoryDeleteConfirmModal
          isOpen={showCategoryDeleteConfirm}
          category={deletingCategory}
          onConfirm={performCategoryDelete}
          onCancel={cancelCategoryDelete}
          isLoading={categoryDeleteLoading}
        />
      </div>




      {/* Stock Management Modal */}
      {showStockModal && stockItem && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] border border-white/20 flex flex-col">
            {/* Modal Header - Fixed */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 rounded-t-2xl bg-white/95">
              <div className="flex items-center space-x-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  📦 จัดการ Stock - {stockItem.itemName}
                </h3>
                <button
                  onClick={handleStockRenameClick}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>เปลี่ยนชื่อ</span>
                </button>
              </div>
              <button onClick={closeStockModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              
              {/* Loading State */}
              {stockLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center space-x-3">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="text-gray-600">กำลังโหลดข้อมูล...</span>
                  </div>
                </div>
              )}

            {/* Rename Section */}
            {!stockLoading && showStockRename && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Edit3 className="w-5 h-5 text-orange-600" />
                  <h4 className="font-semibold text-orange-900">เปลี่ยนชื่ออุปกรณ์</h4>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ชื่อเดิม
                    </label>
                    <input
                      type="text"
                      value={stockRenameOldName}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ชื่อใหม่ *
                    </label>
                    <input
                      type="text"
                      value={stockRenameNewName}
                      onChange={(e) => setStockRenameNewName(e.target.value)}
                      placeholder="กรอกชื่อใหม่ที่ต้องการ"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>

                  {stockRenameOldName && stockRenameNewName && stockRenameOldName !== stockRenameNewName && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2 text-green-800 mb-2">
                        <span className="font-medium">การเปลี่ยนแปลง:</span>
                      </div>
                      <div className="text-lg">
                        <span className="text-red-600 line-through">"{stockRenameOldName}"</span>
                        <span className="mx-2">→</span>
                        <span className="text-green-600 font-medium">"{stockRenameNewName}"</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={() => setShowStockRename(false)}
                      className="px-4 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleStockRenameSubmit}
                      disabled={!stockRenameNewName.trim() || stockRenameOldName === stockRenameNewName}
                      className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      ยืนยันเปลี่ยนชื่อ
                    </button>
                  </div>
                </div>
              </div>
            )}



                          <div className="space-y-4">
                {/* Operation Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    ประเภทการดำเนินการ
                  </label>
                  <select
                    value={stockOperation}
                    onChange={(e) => {
                      const newOperation = e.target.value as 'view_current_info' | 'adjust_stock' | 'change_status_condition' | 'delete_item' | 'edit_items';
                      setStockOperation(newOperation);
                      
                      // Reset adjust stock fields when changing operation
                      setNewStatusId('');
                      setNewConditionId('');
                      setChangeQuantity(0);
                      
                      // Set current stock as starting point for adjustment
                      if (newOperation === 'adjust_stock') {
                        // For adjust_stock, use adjustable count (มี + ใช้งานได้)
                        let adjustableCount = 0;
                        if (stockInfo?.adjustableCount !== undefined) {
                          adjustableCount = stockInfo.adjustableCount;
                        } else {
                          // Fallback: คำนวณจากข้อมูลที่มี
                          const statusAvailable = stockInfo?.nonSNStatusBreakdown?.['status_available'] || 0;
                          const conditionWorking = stockInfo?.nonSNConditionBreakdown?.['cond_working'] || 0;
                          adjustableCount = Math.min(statusAvailable, conditionWorking);
                        }
                        setStockValue(adjustableCount);
                      } else if (newOperation === 'change_status_condition') {
                        // For change_status_condition, set changeQuantity to non-SN items count
                        if (stockInfo?.typeBreakdown?.withoutSN !== undefined) {
                          setChangeQuantity(stockInfo.typeBreakdown.withoutSN);
                        }
                      } else {
                        // For other operations, use stockInfo as before
                        if (stockInfo?.stockManagement?.adminDefinedStock !== undefined) {
                          setStockValue(stockInfo.stockManagement.adminDefinedStock);
                        } else {
                          setStockValue(0);
                        }
                      }
                      
                      // Update reason based on operation
                      if (newOperation === 'delete_item') {
                        setStockReason('ลบรายการทั้งหมด');
                      } else if (newOperation === 'edit_items') {
                        setStockReason('แก้ไขรายการอุปกรณ์');
                      } else if (newOperation === 'change_status_condition') {
                        setStockReason('เปลี่ยนสถานะ/สภาพ ของ Admin Stock');
                      } else if (newOperation === 'adjust_stock') {
                        // คำนวณจำนวนที่ปรับได้จริง (มี + ใช้งานได้)
                        let adjustableCount = 0;
                        if (stockInfo?.adjustableCount !== undefined) {
                          adjustableCount = stockInfo.adjustableCount;
                        } else {
                          // Fallback: คำนวณจากข้อมูลที่มี
                          const statusAvailable = stockInfo?.nonSNStatusBreakdown?.['status_available'] || 0;
                          const conditionWorking = stockInfo?.nonSNConditionBreakdown?.['cond_working'] || 0;
                          adjustableCount = Math.min(statusAvailable, conditionWorking);
                        }
                        setStockReason(`ปรับจำนวนอุปกรณ์ (มี + ใช้งานได้) จาก ${adjustableCount} ชิ้น เป็น ${stockValue} ชิ้น`);
                      } else {
                        setStockReason('ปรับจำนวน Admin Stock');
                      }
                  }}
                  onFocus={(e) => {
                    // Force dropdown to open below by moving the select element down
                    const select = e.target as HTMLSelectElement;
                    const rect = select.getBoundingClientRect();
                    const viewportHeight = window.innerHeight;
                    const spaceBelow = viewportHeight - rect.bottom;
                    
                    // Always try to position below first
                    if (spaceBelow < 200) {
                      // If not enough space below, move the select up to force dropdown below
                      select.style.position = 'relative';
                      select.style.top = '-200px';
                      select.style.marginBottom = '-200px';
                    } else {
                      // Normal positioning below
                      select.style.position = 'relative';
                      select.style.top = '0';
                      select.style.marginBottom = '0';
                    }
                  }}
                  onBlur={(e) => {
                    // Reset position when losing focus
                    const select = e.target as HTMLSelectElement;
                    select.style.position = '';
                    select.style.top = '';
                    select.style.marginBottom = '';
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 admin-inventory-dropdown"
                >
                  {/* 📊 ดูข้อมูลปัจจุบัน - มีทุกหมวดหมู่ */}
                  <option value="view_current_info">📊 ดูข้อมูลปัจจุบัน</option>
                  
                  {/* 📝 ปรับจำนวน - ยกเว้นหมวดหมู่ซิมการ์ด */}
                  {!isSIMCardSync(stockItem?.categoryId || '') && (
                    <option value="adjust_stock">
                      {(availableItems?.withoutSerialNumber?.count ?? 0) > 0 
                        ? '📝 ปรับจำนวน (อุปกรณ์ที่ไม่มี SN)' 
                        : '📝 ปรับจำนวน - ไม่พบอุปกรณ์ที่ไม่มี SN'
                      }
                    </option>
                  )}
                  
                  {/* 🔄 เปลี่ยนสถานะ/สภาพ - ยกเว้นหมวดหมู่ซิมการ์ด */}
                  {!isSIMCardSync(stockItem?.categoryId || '') && (
                    <option value="change_status_condition">🔄 เปลี่ยนสถานะ/สภาพ (อุปกรณ์ที่ไม่มี SN)</option>
                  )}
                  
                  {/* ✏️ แก้ไข/ลบ - ข้อความแตกต่างกันตามหมวดหมู่ */}
                  <option value="edit_items">
                    {isSIMCardSync(stockItem?.categoryId || '')
                      ? '✏️ แก้ไข/ลบ (อุปกรณ์ซิมการ์ด)' 
                      : '✏️ แก้ไข/ลบ (อุปกรณ์ที่มี Serial Number)'
                    }
                  </option>
                  
                  {/* 🗑️ ลบรายการทั้งหมด - มีทุกหมวดหมู่, อยู่ล่างสุดเสมอ */}
                  <option value="delete_item">🗑️ ลบรายการทั้งหมด</option>
                </select>
              </div>

              {/* View Current Info Interface */}
              {stockOperation === 'view_current_info' && !stockLoading && stockInfo && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">
                    📊 ข้อมูลปัจจุบัน: {stockItem?.itemName} (หมวดหมู่ {getCategoryName(stockItem?.categoryId || '')})
                    {stockInfo.adminStockOperations?.length > 0 && (
                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        ✅ ตรวจพบแล้ว
                      </span>
                    )}
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
                      <h6 className="font-medium text-gray-800 mb-2">สถานะอุปกรณ์</h6>
                      <div className="flex justify-between mb-1">
                        <span className="text-blue-700">มี:</span>
                        <span className="font-semibold text-green-700">{stockInfo.statusBreakdown?.['status_available'] || 0} ชิ้น</span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1 flex justify-between">
                        <span>คงเหลือ | User ถือ</span>
                        <span>
                          {(stockInfo.adminStatusBreakdown?.['status_available'] || 0)} | {(stockInfo.userStatusBreakdown?.['status_available'] || 0)}
                        </span>
                      </div>
                      {stockInfo.statusBreakdown?.['status_missing'] !== undefined && stockInfo.statusBreakdown?.['status_missing'] > 0 && (
                        <div className="flex justify-between mb-1">
                          <span className="text-blue-700">หาย:</span>
                          <span className="font-semibold text-orange-700">{stockInfo.statusBreakdown?.['status_missing'] || 0} ชิ้น</span>
                        </div>
                      )}
                      {stockInfo.statusBreakdown?.['status_missing'] !== undefined && (
                        <div className="text-xs text-gray-500 flex justify-between">
                          <span>คงเหลือ | User ถือ</span>
                          <span>
                            {(stockInfo.adminStatusBreakdown?.['status_missing'] || 0)} | {(stockInfo.userStatusBreakdown?.['status_missing'] || 0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
                      <h6 className="font-medium text-gray-800 mb-2">สภาพอุปกรณ์</h6>
                      <div className="flex justify-between mb-1">
                        <span className="text-blue-700">ใช้งานได้:</span>
                        <span className="font-semibold text-green-700">{stockInfo.conditionBreakdown?.['cond_working'] || 0} ชิ้น</span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1 flex justify-between">
                        <span>คงเหลือ | User ถือ</span>
                        <span>
                          {(stockInfo.adminConditionBreakdown?.['cond_working'] || 0)} | {(stockInfo.userConditionBreakdown?.['cond_working'] || 0)}
                        </span>
                      </div>
                      {stockInfo.conditionBreakdown?.['cond_damaged'] !== undefined && stockInfo.conditionBreakdown?.['cond_damaged'] > 0 && (
                        <div className="flex justify-between mb-1">
                          <span className="text-blue-700">ชำรุด:</span>
                          <span className="font-semibold text-red-700">{stockInfo.conditionBreakdown?.['cond_damaged'] || 0} ชิ้น</span>
                        </div>
                      )}
                      {stockInfo.conditionBreakdown?.['cond_damaged'] !== undefined && (
                        <div className="text-xs text-gray-500 flex justify-between">
                          <span>คงเหลือ | User ถือ</span>
                          <span>
                            {(stockInfo.adminConditionBreakdown?.['cond_damaged'] || 0)} | {(stockInfo.userConditionBreakdown?.['cond_damaged'] || 0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
                      <h6 className="font-medium text-gray-800 mb-2">ประเภทอุปกรณ์</h6>
                      <div className="flex justify-between mb-1">
                        <span className="text-blue-700">ไม่มี SN:</span>
                        <span className="font-semibold text-blue-900">{stockInfo.typeBreakdown?.withoutSN || 0} ชิ้น</span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1 flex justify-between">
                        <span>คงเหลือ | User ถือ</span>
                        <span>
                          {(stockInfo.adminTypeBreakdown?.withoutSN || 0)} | {(stockInfo.userTypeBreakdown?.withoutSN || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-blue-700">มี SN:</span>
                        <span className="font-semibold text-purple-700">{stockInfo.typeBreakdown?.withSN || 0} ชิ้น</span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1 flex justify-between">
                        <span>คงเหลือ | User ถือ</span>
                        <span>
                          {(stockInfo.adminTypeBreakdown?.withSN || 0)} | {(stockInfo.userTypeBreakdown?.withSN || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">มีเบอร์:</span>
                        <span className="font-semibold text-teal-700">{stockInfo.typeBreakdown?.withPhone || 0} เบอร์</span>
                      </div>
                      <div className="text-xs text-gray-500 flex justify-between">
                        <span>คงเหลือ | User ถือ</span>
                        <span>
                          {(stockInfo.adminTypeBreakdown?.withPhone || 0)} | {(stockInfo.userTypeBreakdown?.withPhone || 0)}
                        </span>
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
                      <h6 className="font-medium text-gray-800 mb-2">สรุปรวม</h6>
                      <div className="flex justify-between mb-1">
                        <span className="text-blue-700">รวมทั้งหมด:</span>
                        <span className="font-semibold text-blue-900">{stockInfo.totalQuantity || stockInfo.currentStats?.totalQuantity || 0} ชิ้น</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-blue-700">คงเหลือ:</span>
                        <span className="font-semibold text-green-700">{stockInfo.currentStats?.availableQuantity || 0} ชิ้น</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">User ถือ:</span>
                        <span className="font-semibold text-purple-700">{stockInfo.currentStats?.userOwnedQuantity || 0} ชิ้น</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading State for Current Info */}
              {stockOperation === 'view_current_info' && stockLoading && (
                <div className="bg-gray-50 p-4 rounded-lg animate-pulse">
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded mb-1"></div>
                  <div className="h-3 bg-gray-300 rounded"></div>
                </div>
              )}

              {/* Error State for Current Info */}
              {stockOperation === 'view_current_info' && !stockLoading && !stockInfo && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-red-800 text-sm">
                    ❌ ไม่สามารถโหลดข้อมูล Stock ได้
                  </div>
                </div>
              )}

              {/* Change Status/Condition Interface - New Design */}
              {stockOperation === 'change_status_condition' && (
                <div className="space-y-6">
                  {/* Current Data Display - Only show when not loading */}
                  {!stockLoading && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-blue-800 mb-2">📊 ข้อมูลปัจจุบัน</h4>
                      <div className="text-sm text-blue-700">
                      {(() => {
                        const totalNonSN = stockInfo?.typeBreakdown?.withoutSN || 0;
                        
                        if (totalNonSN === 0) {
                          return (
                            <div className="text-amber-700">
                              <div className="mb-1">⚠️ ไม่พบอุปกรณ์ที่ไม่มี SN เนื่องจากมีจำนวน 0 ชิ้น</div>
                              <div>สถานะ: -</div>
                              <div>สภาพ: -</div>
                            </div>
                          );
                        } else {
                          return (
                            <>
                              <div className="mb-2">
                                <span className="font-medium text-blue-800">📦 อุปกรณ์ที่ไม่มี SN ทั้งหมด: {totalNonSN} ชิ้น</span>
                              </div>
                              <div className="mb-1">
                                <span className="font-medium">สถานะ (เฉพาะไม่มี SN):</span>
                                {stockInfo?.nonSNStatusBreakdown && Object.keys(stockInfo.nonSNStatusBreakdown).length > 0 ? 
                                  Object.entries(stockInfo.nonSNStatusBreakdown).map(([statusId, count]) => {
                                    const statusName = getStatusText(statusId);
                                    const isPositive = statusName === 'มี';
                                    const countNum = Number(count) || 0;
                                    return (
                                      <span key={statusId} className={`ml-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                        {isPositive ? '🟢' : '🔴'} {statusName} {countNum} ชิ้น
                                      </span>
                                    );
                                  }) : <span className="ml-2 text-gray-500">ไม่มีข้อมูล</span>
                                }
                              </div>
                              <div>
                                <span className="font-medium">สภาพ (เฉพาะไม่มี SN):</span>
                                {stockInfo?.nonSNConditionBreakdown && Object.keys(stockInfo.nonSNConditionBreakdown).length > 0 ? 
                                  Object.entries(stockInfo.nonSNConditionBreakdown).map(([conditionId, count]) => {
                                    const conditionName = getConditionText(conditionId);
                                    const isUsable = conditionName === 'ใช้งานได้';
                                    const countNum = Number(count) || 0;
                                    return (
                                      <span key={conditionId} className={`ml-2 ${isUsable ? 'text-green-600' : 'text-red-600'}`}>
                                        {isUsable ? '🟢' : '🔴'} {conditionName} {countNum} ชิ้น
                                      </span>
                                    );
                                  }) : <span className="ml-2 text-gray-500">ไม่มีข้อมูล</span>
                                }
                              </div>
                            </>
                          );
                        }
                      })()}
                      </div>
                    </div>
                  )}

                  {/* Status Change Section - Only show if there are items without SN */}
                  {stockInfo?.withoutSerialNumber?.count > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-3">🔄 การเปลี่ยนสถานะ</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          สถานะปัจจุบัน
                        </label>
                        <select
                          value={currentStatusId}
                          onChange={(e) => {
                            setCurrentStatusId(e.target.value);
                            setStatusChangeQuantity(0);
                            setTargetStatusId('');
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- เลือกสถานะปัจจุบัน --</option>
                          {stockInfo?.nonSNStatusBreakdown && Object.entries(stockInfo.nonSNStatusBreakdown)
                            .filter(([statusId, count]) => (Number(count) || 0) > 0)
                            .map(([statusId, count]) => (
                              <option key={statusId} value={statusId}>
                                {getStatusText(statusId)} ({Number(count) || 0} ชิ้น)
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
                          value={statusChangeQuantity}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            const maxQuantity = currentStatusId ? (stockInfo?.nonSNStatusBreakdown?.[currentStatusId] || 0) : 0;
                            const limitedValue = Math.min(value, maxQuantity);
                            setStatusChangeQuantity(limitedValue);
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                            statusChangeQuantity > (currentStatusId ? (stockInfo?.nonSNStatusBreakdown?.[currentStatusId] || 0) : 0)
                              ? 'border-red-300 focus:ring-red-500 bg-red-50'
                              : 'border-gray-300 focus:ring-blue-500'
                          }`}
                          min="0"
                          max={currentStatusId ? (stockInfo?.nonSNStatusBreakdown?.[currentStatusId] || 0) : 0}
                        />
                        {currentStatusId && (
                          <p className="text-xs text-gray-500 mt-1">
                            สูงสุด: {stockInfo?.nonSNStatusBreakdown?.[currentStatusId] || 0} ชิ้น (จากอุปกรณ์ที่ไม่มี SN ทั้งหมด {stockInfo?.typeBreakdown?.withoutSN || 0} ชิ้น)
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        เปลี่ยนเป็น
                      </label>
                      <select
                        value={targetStatusId}
                        onChange={(e) => setTargetStatusId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- เลือกสถานะใหม่ --</option>
                        {statuses
                          .filter((st: any) => st !== currentStatusId)
                          .map((st: any) => (
                            <option key={st} value={st}>{getStatusText(st)}</option>
                          ))}
                      </select>
                    </div>
                    
                    {/* Status Change Summary */}
                    {currentStatusId && targetStatusId && statusChangeQuantity > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <h5 className="text-sm font-medium text-blue-800 mb-2">📋 สรุปการเปลี่ยนแปลงสถานะ:</h5>
                        <div className="text-sm text-blue-700">
                          <div>• สถานะ "{getStatusText(currentStatusId)}" จะลดลง {statusChangeQuantity} ชิ้น (เหลือไม่เปลี่ยน {Math.max(0, (stockInfo?.statusBreakdown?.[currentStatusId] || 0) - statusChangeQuantity)} ชิ้น)</div>
                          <div>• สถานะ "{getStatusText(targetStatusId)}" จะเพิ่มขึ้น {statusChangeQuantity} ชิ้น</div>
                        </div>
                      </div>
                    )}
                    </div>
                  )}

                  {/* Condition Change Section - Only show if there are items without SN */}
                  {stockInfo?.withoutSerialNumber?.count > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-3">🔧 การเปลี่ยนสภาพ</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          สภาพปัจจุบัน
                        </label>
                        <select
                          value={currentConditionId}
                          onChange={(e) => {
                            setCurrentConditionId(e.target.value);
                            setConditionChangeQuantity(0);
                            setTargetConditionId('');
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- เลือกสภาพปัจจุบัน --</option>
                          {stockInfo?.nonSNConditionBreakdown && Object.entries(stockInfo.nonSNConditionBreakdown)
                            .filter(([conditionId, count]) => (Number(count) || 0) > 0)
                            .map(([conditionId, count]) => (
                              <option key={conditionId} value={conditionId}>
                                {getConditionText(conditionId)} ({Number(count) || 0} ชิ้น)
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
                          value={conditionChangeQuantity}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            const maxQuantity = currentConditionId ? (stockInfo?.nonSNConditionBreakdown?.[currentConditionId] || 0) : 0;
                            const limitedValue = Math.min(value, maxQuantity);
                            setConditionChangeQuantity(limitedValue);
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                            conditionChangeQuantity > (currentConditionId ? (stockInfo?.nonSNConditionBreakdown?.[currentConditionId] || 0) : 0)
                              ? 'border-red-300 focus:ring-red-500 bg-red-50'
                              : 'border-gray-300 focus:ring-blue-500'
                          }`}
                          min="0"
                          max={currentConditionId ? (stockInfo?.nonSNConditionBreakdown?.[currentConditionId] || 0) : 0}
                        />
                        {currentConditionId && (
                          <p className="text-xs text-gray-500 mt-1">
                            สูงสุด: {stockInfo?.nonSNConditionBreakdown?.[currentConditionId] || 0} ชิ้น (จากอุปกรณ์ที่ไม่มี SN ทั้งหมด {stockInfo?.typeBreakdown?.withoutSN || 0} ชิ้น)
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        เปลี่ยนเป็น
                      </label>
                      <select
                        value={targetConditionId}
                        onChange={(e) => setTargetConditionId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- เลือกสภาพใหม่ --</option>
                        {conditionConfigs
                          .filter((config) => config.id !== currentConditionId)
                          .map((config) => (
                            <option key={config.id} value={config.id}>{config.name}</option>
                          ))}
                      </select>
                    </div>
                    
                    {/* Condition Change Summary */}
                    {currentConditionId && targetConditionId && conditionChangeQuantity > 0 && (
                      <div className="mt-3 p-3 bg-green-50 rounded-lg">
                        <h5 className="text-sm font-medium text-green-800 mb-2">📋 สรุปการเปลี่ยนแปลงสภาพ:</h5>
                        <div className="text-sm text-green-700">
                          <div>• สภาพ "{getConditionText(currentConditionId)}" จะลดลง {conditionChangeQuantity} ชิ้น (เหลือไม่เปลี่ยน {Math.max(0, (stockInfo?.conditionBreakdown?.[currentConditionId] || 0) - conditionChangeQuantity)} ชิ้น)</div>
                          <div>• สภาพ "{getConditionText(targetConditionId)}" จะเพิ่มขึ้น {conditionChangeQuantity} ชิ้น</div>
                        </div>
                      </div>
                    )}
                    </div>
                  )}

                  {/* หมายเหตุ - Only show if there are items without SN */}
                  {stockInfo?.withoutSerialNumber?.count > 0 && (
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      หมายเหตุ (เหตุผลในการเปลี่ยน)
                    </label>
                    <textarea
                      value={stockReason}
                      onChange={(e) => setStockReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="ระบุเหตุผลในการเปลี่ยนสถานะ/สภาพ"
                    />
                    </div>
                  )}
                </div>
              )}

              {/* Adjust Stock Interface */}
              {stockOperation === 'adjust_stock' && (
                <div className="space-y-4">
                  {/* ตรวจสอบว่ามีอุปกรณ์ที่ไม่มี SN หรือไม่ */}
                  {(availableItems?.withoutSerialNumber?.count ?? 0) > 0 ? (
                    <>
                      {/* จำนวนที่ต้องการปรับ */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                           จำนวนที่ต้องการปรับ (อุปกรณ์ที่ไม่มี Serial Number)
                        </label>
                        
                        {/* Plus/Minus Controls */}
                        <div className="flex items-center justify-center space-x-4 py-4">
                          <button
                            type="button"
                            onClick={() => setStockValue(Math.max(0, stockValue - 1))}
                            disabled={stockValue <= 0}
                            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg font-semibold transition-all ${
                              stockValue <= 0 
                                ? 'border-gray-300 text-gray-300 cursor-not-allowed bg-gray-50' 
                                : 'border-red-500 text-red-500 hover:bg-red-50 hover:border-red-600 hover:text-red-600 active:bg-red-100'
                            }`}
                            title="ลดจำนวน 1 ชิ้น"
                          >
                            −
                          </button>
                          
                          <input
                            type="number"
                            value={stockValue}
                            onChange={(e) => setStockValue(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-30 text-center px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                            min={0}
                          />
                          
                          <button
                            type="button"
                            onClick={() => setStockValue(stockValue + 1)}
                            className="w-10 h-10 rounded-full border-2 border-green-500 text-green-500 hover:bg-green-50 hover:border-green-600 hover:text-green-600 active:bg-green-100 flex items-center justify-center text-lg font-semibold transition-all"
                            title="เพิ่มจำนวน 1 ชิ้น"
                          >
                            +
                          </button>
                        </div>
                        
                        {/* แสดงจำนวนปัจจุบัน */}
                        <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                          <p className="text-sm text-gray-700">
                            <strong>ปัจจุบัน:</strong> {(() => {
                              // แสดงจำนวนที่ปรับได้จริง (มี + ใช้งานได้)
                              if (stockInfo?.adjustableCount !== undefined) {
                                return stockInfo.adjustableCount;
                              }
                              // Fallback: คำนวณจากข้อมูลที่มี
                              const statusAvailable = stockInfo?.nonSNStatusBreakdown?.['status_available'] || 0;
                              const conditionWorking = stockInfo?.nonSNConditionBreakdown?.['cond_working'] || 0;
                              return Math.min(statusAvailable, conditionWorking);
                            })()} ชิ้น (มีอุปกรณ์ + ใช้งานได้)
                          </p>
                          {stockValue !== (() => {
                            if (stockInfo?.adjustableCount !== undefined) {
                              return stockInfo.adjustableCount;
                            }
                            const statusAvailable = stockInfo?.nonSNStatusBreakdown?.['status_available'] || 0;
                            const conditionWorking = stockInfo?.nonSNConditionBreakdown?.['cond_working'] || 0;
                            return Math.min(statusAvailable, conditionWorking);
                          })() && (
                            <p className="text-sm mt-1">
                              <span className="text-blue-600 font-semibold">
                                📊 การเปลี่ยนแปลง: {stockValue > (() => {
                                  if (stockInfo?.adjustableCount !== undefined) {
                                    return stockInfo.adjustableCount;
                                  }
                                  const statusAvailable = stockInfo?.nonSNStatusBreakdown?.['status_available'] || 0;
                                  const conditionWorking = stockInfo?.nonSNConditionBreakdown?.['cond_working'] || 0;
                                  return Math.min(statusAvailable, conditionWorking);
                                })() ? '+' : ''}{stockValue - (() => {
                                  if (stockInfo?.adjustableCount !== undefined) {
                                    return stockInfo.adjustableCount;
                                  }
                                  const statusAvailable = stockInfo?.nonSNStatusBreakdown?.['status_available'] || 0;
                                  const conditionWorking = stockInfo?.nonSNConditionBreakdown?.['cond_working'] || 0;
                                  return Math.min(statusAvailable, conditionWorking);
                                })()} ชิ้น
                              </span>
                            </p>
                          )}
                        </div>

                        
                        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <p className="text-sm text-yellow-800 mb-2">
                            ⚠️ <strong>หมายเหตุสำคัญ:</strong> การปรับจำนวนจะส่งผลกับอุปกรณ์ที่ไม่มี SN เท่านั้น
                          </p>
                          <div className="text-xs text-gray-700 space-y-1">
                            <div className="mt-2 text-orange-600">
                              💡 <strong>ต้องการปรับอุปกรณ์สถานะอื่น?</strong> ใช้ "เปลี่ยนสถานะ/สภาพ" เพื่อเปลี่ยนให้เป็น "มี" + "ใช้งานได้" ก่อน
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* หมายเหตุ */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          หมายเหตุ (เหตุผลในการปรับ)
                        </label>
                        <textarea
                          value={stockReason}
                          onChange={(e) => setStockReason(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 admin-inventory-dropdown"
                          placeholder="ระบุเหตุผลในการปรับจำนวน"
                          rows={3}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-500 text-lg mb-2">⚠️</div>
                      <p className="text-gray-600">ไม่พบอุปกรณ์ที่ไม่มี Serial Number</p>
                      <p className="text-sm text-gray-500 mt-1">ไม่สามารถปรับจำนวนได้เนื่องจากไม่มีอุปกรณ์ที่ไม่มี SN</p>
                    </div>
                  )}
                 </div>
               )}

              {/* Edit Items Interface */}
              {stockOperation === 'edit_items' && (
                <div className="space-y-4">
                  {availableItemsLoading ? (
                    <div className="border rounded-lg p-4">
                      <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                        <div className="space-y-3">
                          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                        </div>
                        <div className="flex items-center justify-center py-8">
                          <div className="flex items-center space-x-3">
                            <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                            <span className="text-gray-600">กำลังโหลดรายการอุปกรณ์...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : availableItems ? (
                    <div className="border rounded-lg p-4">
                      {/* Items with Serial Numbers */}
                      {!isSIMCardSync(stockItem?.categoryId || '') && (
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center">
                            🔢 อุปกรณ์ที่มี Serial Number ({availableItems?.withSerialNumber ? getFilteredSerialNumberItems().length : '...'} ชิ้น)
                            {itemSearchTerm && (
                              <span className="ml-2 text-xs text-gray-500">
                                (ค้นหา: "{itemSearchTerm}")
                              </span>
                            )}
                          </h4>
                          
                          {/* Show search and filter only if there are items */}
                          {availableItems?.withSerialNumber && availableItems.withSerialNumber.length > 0 && (
                            <div className="mb-4 space-y-3">
                              {/* Search Bar */}
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="ค้นหา Serial Number..."
                                  value={itemSearchTerm}
                                  onChange={(e) => setItemSearchTerm(e.target.value)}
                                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                              
                              {/* Filter Buttons */}
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => setItemFilterBy('all')}
                                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                    itemFilterBy === 'all'
                                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                  }`}
                                >
                                  ทั้งหมด ({availableItems ? availableItems.withSerialNumber.length : '...'})
                                </button>
                                <button
                                  onClick={() => setItemFilterBy('admin')}
                                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                    itemFilterBy === 'admin'
                                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                  }`}
                                >
                                  Admin ({availableItems ? availableItems.withSerialNumber.filter(item => item.addedBy === 'admin').length : '...'})
                                </button>
                                <button
                                  onClick={() => setItemFilterBy('user')}
                                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                    itemFilterBy === 'user'
                                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                      : 'bg-gray-200 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                  }`}
                                >
                                  User ({availableItems ? availableItems.withSerialNumber.filter(item => item.addedBy === 'user').length : '...'})
                                </button>
                              </div>
                            </div>
                          )}

                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {(() => {
                                return null;
                              })()}
                              {availableItems?.withSerialNumber && availableItems.withSerialNumber.length > 0 ? (
                                getFilteredSerialNumberItems().length > 0 ? (
                                getFilteredSerialNumberItems().map((item: any) => (
                                  <div
                                    key={`${item.itemId}-${item.serialNumber}`}
                                    className="p-3 border rounded-lg hover:bg-gray-50"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-sm font-mono text-blue-600 font-medium">
                                          {item.serialNumber}
                                        </span>
                                        <span className="ml-2 text-xs text-gray-500">
                                          เพิ่มโดย: {item.addedBy === 'admin' ? 'Admin' : 'User'}
                                        </span>
                                        {/* Status and Condition on the left side */}
                                        {item.statusId && (
                                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded font-medium">
                                            {getStatusName(item.statusId)}
                                          </span>
                                        )}
                                        {item.conditionId && (
                                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded font-medium">
                                            {getConditionText(item.conditionId)}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <button
                                          onClick={() => handleEditItem(item)}
                                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                        >
                                          แก้ไข
                                        </button>
                                        <button
                                          onClick={() => handleDeleteItem(item)}
                                          className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                        >
                                          ลบ
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-center py-8 text-gray-500">
                                  {itemSearchTerm || itemFilterBy !== 'all' ? (
                                    <div>
                                      <p>ไม่พบรายการที่ตรงกับเงื่อนไข</p>
                                      <button
                                        onClick={() => {
                                          setItemSearchTerm('');
                                          setItemFilterBy('all');
                                        }}
                                        className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                                      >
                                        ล้างการค้นหา
                                      </button>
                                    </div>
                                  ) : (
                                    <p>ไม่มีรายการอุปกรณ์ที่มี Serial Number</p>
                                  )}
                                </div>
                              )
                            ) : (
                              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                <div className="flex flex-col items-center">
                                  <div className="text-4xl mb-2">📦</div>
                                  <p className="text-sm font-medium text-gray-600 mb-1">
                                    ไม่พบรายการอุปกรณ์ที่มี Serial Number
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    อุปกรณ์ประเภท "{stockItem?.itemName}" ไม่มีรายการที่มี Serial Number ในระบบ
                                  </p>
                                  {(() => {
                                    return null;
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Items with Phone Numbers (SIM Cards) */}
                      {isSIMCardSync(stockItem?.categoryId || '') && (
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center">
                            📱 ซิมการ์ดที่มีเบอร์โทรศัพท์ ({availableItems?.withPhoneNumber ? getFilteredPhoneNumberItems().length : '...'} ชิ้น)
                          </h4>
                          
                          {/* Show search and filter only if there are items */}
                          {availableItems?.withPhoneNumber && availableItems.withPhoneNumber.length > 0 && (
                            <div className="mb-4 space-y-3">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="ค้นหาเบอร์โทรศัพท์..."
                                  value={itemSearchTerm}
                                  onChange={(e) => setItemSearchTerm(e.target.value)}
                                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => setItemFilterBy('all')}
                                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                    itemFilterBy === 'all'
                                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                  }`}
                                >
                                  ทั้งหมด ({availableItems ? availableItems.withPhoneNumber.length : '...'})
                                </button>
                                <button
                                  onClick={() => setItemFilterBy('admin')}
                                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                    itemFilterBy === 'admin'
                                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                  }`}
                                >
                                  Admin ({availableItems ? availableItems.withPhoneNumber.filter((item: any) => item.addedBy === 'admin').length : '...'})
                                </button>
                                <button
                                  onClick={() => setItemFilterBy('user')}
                                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                    itemFilterBy === 'user'
                                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                      : 'bg-gray-200 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                  }`}
                                >
                                  User ({availableItems ? availableItems.withPhoneNumber.filter((item: any) => item.addedBy === 'user').length : '...'})
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {availableItems?.withPhoneNumber && availableItems.withPhoneNumber.length > 0 ? (
                              getFilteredPhoneNumberItems().length > 0 ? (
                                getFilteredPhoneNumberItems().map((item: any) => (
                                    <div
                                      key={`${item.itemId}-${item.numberPhone}`}
                                      className="p-3 border rounded-lg hover:bg-gray-50"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <span className="text-sm font-mono text-green-600 font-medium">
                                            {item.numberPhone}
                                          </span>
                                          <span className="ml-2 text-xs text-gray-500">
                                            เพิ่มโดย: {item.addedBy === 'admin' ? 'Admin' : 'User'}
                                          </span>
                                          {/* Status and Condition Display (same style as SN list) */}
                                          {item.statusId && (
                                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded font-medium">
                                              {getStatusName(item.statusId)}
                                            </span>
                                          )}
                                          {item.conditionId && (
                                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded font-medium">
                                              {getConditionText(item.conditionId)}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex space-x-2">
                                          <button
                                            onClick={() => handleEditItem(item, 'phone')}
                                            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                          >
                                            แก้ไข
                                          </button>
                                          <button
                                            onClick={() => handleDeleteItem(item, 'phone')}
                                            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                          >
                                            ลบ
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                              ) : (
                                <div className="text-center py-8 text-gray-500">
                                  {itemSearchTerm || itemFilterBy !== 'all' ? (
                                    <div>
                                      <p>ไม่พบเบอร์โทรศัพท์ที่ตรงกับเงื่อนไข</p>
                                      <button
                                        onClick={() => setItemSearchTerm('')}
                                        className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                                      >
                                        ล้างการค้นหา
                                      </button>
                                      {itemFilterBy !== 'all' && (
                                        <button
                                          onClick={() => setItemFilterBy('all')}
                                          className="ml-3 mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                                        >
                                          แสดงทั้งหมด
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <p>ไม่มีซิมการ์ดที่มีเบอร์โทรศัพท์</p>
                                  )}
                                </div>
                              )
                            ) : (
                              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                <div className="flex flex-col items-center">
                                  <div className="text-4xl mb-2">📱</div>
                                  <p className="text-sm font-medium text-gray-600 mb-1">
                                    ไม่พบรายการซิมการ์ด
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    ซิมการ์ดประเภท "{stockItem?.itemName}" ไม่มีรายการที่มีเบอร์โทรศัพท์ในระบบ
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="border rounded-lg p-4">
                      <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Warning for delete */}
              {stockOperation === 'delete_item' && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <div className="flex items-start">
                    <div className="text-red-600 mr-3">⚠️</div>
                    <div>
                      <h5 className="font-medium text-red-800">คำเตือน: การลบรายการ</h5>
                      <p className="text-sm text-red-700 mt-1">
                        การดำเนินการนี้จะลบรายการ "{stockItem.itemName}" ทั้งหมด รวมถึง:
                      </p>
                      <ul className="text-sm text-red-700 mt-2 ml-4 list-disc">
                        <li>Admin Stock: {stockInfo?.stockManagement?.adminDefinedStock || 0} ชิ้น</li>
                        <li>User Contributed: {stockInfo?.stockManagement?.userContributedCount || 0} ชิ้น</li>
                        <li>ข้อมูลประวัติทั้งหมด</li>
                      </ul>
                      <p className="text-sm text-red-800 font-medium mt-2">
                        ⚠️ ไม่สามารถยกเลิกการดำเนินการนี้ได้!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Reason Input - Hidden but functional */}
              {stockOperation !== 'edit_items' && (
                <input
                  type="hidden"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                />
              )}



            </div>

            {/* Modal Footer - Only show when there are action buttons */}
            {(stockOperation === 'adjust_stock' || stockOperation === 'change_status_condition' || stockOperation === 'delete_item') && (
              <div className="p-6">
                {/* Action Buttons - Show only for operations that need them */}
                {(stockOperation === 'adjust_stock' || stockOperation === 'change_status_condition') && (
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={closeStockModal}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                      disabled={stockLoading}
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleStockSubmit}
                      disabled={stockLoading || !stockReason.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {stockLoading ? 'กำลังดำเนินการ...' : (stockOperation === 'change_status_condition' ? 'เปลี่ยนสถานะ/สภาพ' : 'บันทึก')}
                    </button>
                  </div>
                )}

                {/* Delete operation buttons */}
                {stockOperation === 'delete_item' && (
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={closeStockModal}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                      disabled={stockLoading}
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleStockSubmit}
                      disabled={stockLoading || !stockReason.trim()}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {stockLoading ? 'กำลังดำเนินการ...' : 'ลบรายการ'}
                    </button>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditItemModal && editingItemId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto border border-white/20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {itemOperation === 'edit' ? '🔧 แก้ไขรายการ' : '🗑️ ลบรายการ'}
              </h3>
              <button 
                onClick={() => setShowEditItemModal(false)} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {itemOperation === 'edit' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isSIMCardSync(stockItem?.categoryId || '') ? 'เบอร์โทรศัพท์' : 'Serial Number'} *
                  </label>
                  <input
                    type="text"
                    value={editingSerialNum}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (isSIMCardSync(stockItem?.categoryId || '')) {
                        // สำหรับซิมการ์ด: อนุญาตเฉพาะตัวเลข และไม่เกิน 10 หลัก
                        const numericValue = value.replace(/[^0-9]/g, '');
                        if (numericValue.length <= 10) {
                          setEditingSerialNum(numericValue);
                        }
                      } else {
                        // สำหรับอุปกรณ์ทั่วไป: อนุญาตทุกตัวอักษร
                        setEditingSerialNum(value);
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isSIMCardSync(stockItem?.categoryId || '') 
                        ? editingSerialNum.length === 10 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    placeholder={isSIMCardSync(stockItem?.categoryId || '') ? 'ระบุเบอร์โทรศัพท์ 10 หลัก' : 'ระบุ Serial Number ใหม่'}
                    maxLength={isSIMCardSync(stockItem?.categoryId || '') ? 10 : undefined}
                    pattern={isSIMCardSync(stockItem?.categoryId || '') ? '[0-9]{10}' : undefined}
                  />
                      {isSIMCardSync(stockItem?.categoryId || '') && (
                    <div className="mt-1 text-sm">
                      <span className={editingSerialNum.length === 10 ? 'text-green-600' : 'text-red-600'}>
                        {editingSerialNum.length}/10 หลัก
                      </span>
                      {editingSerialNum.length !== 10 && (
                        <span className="text-red-600 ml-2">
                          (ต้องครบ 10 หลัก)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Status Change Section */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-800 mb-3">🔄 เปลี่ยนสถานะ</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        สถานะปัจจุบัน
                      </label>
                      <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                        {editingCurrentStatusId ? getStatusText(editingCurrentStatusId) : 'ไม่ระบุ'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        เปลี่ยนเป็น
                      </label>
                      <select
                        value={editingNewStatusId}
                        onChange={(e) => setEditingNewStatusId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- เลือกสถานะใหม่ --</option>
                        {statusConfigs
                          .filter((config) => config.id !== editingCurrentStatusId)
                          .map((config) => (
                            <option key={config.id} value={config.id}>{config.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Condition Change Section */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-800 mb-3">🔧 เปลี่ยนสภาพ</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        สภาพปัจจุบัน
                      </label>
                      <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                        {editingCurrentConditionId ? getConditionText(editingCurrentConditionId) : 'ไม่ระบุ'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        เปลี่ยนเป็น
                      </label>
                      <select
                        value={editingNewConditionId}
                        onChange={(e) => setEditingNewConditionId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- เลือกสภาพใหม่ --</option>
                        {conditionConfigs
                          .filter((config) => config.id !== editingCurrentConditionId)
                          .map((config) => (
                            <option key={config.id} value={config.id}>{config.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowEditItemModal(false)}
                    disabled={editItemLoading}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => handleSaveEditItem()}
                    disabled={
                      editItemLoading ||
                      (isSIMCardSync(stockItem?.categoryId || '') && editingSerialNum.trim() !== '' && editingSerialNum.length !== 10)
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {editItemLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <span>บันทึก</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <div className="flex items-start">
                    <div className="text-red-600 mr-3">⚠️</div>
                    <div>
                      <h5 className="font-medium text-red-800">คำเตือน: การลบรายการ</h5>
                      <p className="text-sm text-red-700 mt-1">
                        คุณต้องการลบ <strong>{stockItem?.itemName}</strong> ที่มี{isSIMCardSync(stockItem?.categoryId || '') ? 'เบอร์โทรศัพท์' : 'Serial Number'}: <strong>{editingSerialNum}</strong> หรือไม่?
                      </p>
                      <p className="text-sm text-red-800 font-medium mt-2">
                        ⚠️ ไม่สามารถยกเลิกการดำเนินการนี้ได้!
                      </p>
                    </div>
                  </div>
                </div>
                {/* Reason field for delete operation */}
                <div>
                  <label className="block text-sm font-medium text-red-700 mb-1">
                    เหตุผลในการลบ *
                  </label>
                  <input
                    type="text"
                    value={stockReason}
                    onChange={(e) => setStockReason(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="ระบุเหตุผลในการลบรายการ"
                    required
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowEditItemModal(false)}
                    disabled={editItemLoading}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => handleSaveEditItem()}
                    disabled={!stockReason.trim() || editItemLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {editItemLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>กำลังลบ...</span>
                      </>
                    ) : (
                      <span>ลบรายการ</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-auto transform transition-all">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-t-xl p-6 text-white">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                  <Trash2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">ลบรายการทั้งหมด</h3>
                  <p className="text-red-100 text-sm">คุณแน่ใจหรือไม่ที่ต้องการลบ "{stockItem?.itemName}" ทั้งหมด?</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Warning Section */}
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-semibold text-red-800">การกระทำนี้จะลบข้อมูลต่อไปนี้:</h4>
                    <ul className="mt-2 text-sm text-red-700 space-y-1">
                      <li>• จำนวน <strong>Admin เพิ่ม:</strong> {stockInfo?.stockManagement?.adminDefinedStock || 0} ชิ้น</li>
                      <li>• จำนวน <strong>User เพิ่ม:</strong> {stockInfo?.stockManagement?.userContributedCount || 0} ชิ้น</li>
                      <li>• หาก User กำลังใช้งาน จะถูกลบออกจากระบบด้วย</li>
                      <li>• <strong>สามารถกู้คืนได้ภายใน 30 วันหลังลบอุปกรณ์</strong><br />หลังจากนั้นจะลบถาวร</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Confirmation Input */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  พิมพ์ <span className="bg-red-100 text-red-800 px-2 py-1 rounded font-mono text-base">DELETE</span> เพื่อยืนยันการลบ:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-4 py-3 border-2 border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono text-center text-lg"
                  disabled={deleteLoading}
                  autoComplete="off"
                />
                {deleteConfirmText && deleteConfirmText !== 'DELETE' && (
                  <p className="text-red-500 text-sm mt-1">กรุณาพิมพ์ "DELETE" ให้ถูกต้อง</p>
                )}
                {deleteConfirmText === 'DELETE' && (
                  <p className="text-green-600 text-sm mt-1">✓ ยืนยันแล้ว</p>
                )}
              </div>

              {/* Hidden reason input - ใช้ค่าเริ่มต้น "ลบรายการทั้งหมด" */}
              <input
                type="hidden"
                value={stockReason}
                onChange={(e) => setStockReason(e.target.value)}
              />
            </div>

            {/* Footer */}
            <div className="bg-gray-50 rounded-b-xl px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={closeDeleteConfirmModal}
                disabled={deleteLoading}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading || deleteConfirmText !== 'DELETE' || !stockReason.trim()}
                className={`px-6 py-2.5 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium ${
                  deleteConfirmText === 'DELETE' && stockReason.trim() && !deleteLoading
                    ? 'bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-xl'
                    : 'bg-gray-400'
                }`}
              >
                {deleteLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    กำลังลบ...
                  </div>
                ) : (
                  '🗑️ ลบทั้งหมด'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Rename Confirmation Pop-up */}
      {showRenameConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-white/20 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 rounded-full p-2">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">⚠️ ยืนยันการเปลี่ยนชื่อ</h3>
                  <p className="text-orange-100 text-sm">กรุณาตรวจสอบข้อมูลให้แน่ใจ</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Change Preview */}
              <div className="text-center">
                <div className="text-lg mb-4">
                  <span className="text-red-600 line-through font-medium">"{stockRenameOldName}"</span>
                  <span className="mx-3 text-gray-400">→</span>
                  <span className="text-green-600 font-bold">"{stockRenameNewName}"</span>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-red-800 mb-2">🚨 คำเตือนสำคัญ</h4>
                    <ul className="text-red-700 text-sm space-y-1">
                      <li>• <strong>ข้อมูลทั้งหมด</strong> ที่เคยเป็น "{stockRenameOldName}" จะกลายเป็น "{stockRenameNewName}"</li>
                      <li>• <strong>รายงานเก่า</strong> จะแสดงชื่อใหม่ (ไม่ใช่ชื่อตอนที่ทำรายการ)</li>
                      <li>• <strong>การเปลี่ยนแปลงมีผลทันที</strong> ในทุกหน้าของระบบ</li>
                      <li>• <strong>ผู้ใช้ทุกคน</strong> จะเห็นชื่อใหม่ทันทีหลังการเปลี่ยน</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Process Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-blue-800 mb-2">📋 ขั้นตอนการดำเนินการ</h4>
                    <p className="text-blue-700 text-sm">
                      ระบบจะสร้าง Backup → ตรวจสอบข้อมูล → เปลี่ยนชื่อ → ตรวจสอบผลลัพธ์
                    </p>
                    <p className="text-blue-800 font-medium text-sm mt-1">
                      🔄 สามารถกู้คืนได้ภายใน 24 ชม.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowRenameConfirm(false)}
                disabled={renameLoading}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleStockRenameConfirm}
                disabled={renameLoading}
                className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {renameLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังเปลี่ยนชื่อ...</span>
                  </>
                ) : (
                  <span>ยืนยันเปลี่ยนชื่อ</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Recycle Bin Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowRecycleBin(true)}
          className="bg-gray-600 hover:bg-gray-700 text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 group"
          title="ถังขยะ"
        >
          <div className="text-2xl">🗑️</div>
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs">30d</span>
          </div>
        </button>
      </div>

      {/* Grouped Recycle Bin Modal */}
      <GroupedRecycleBinModal
        isOpen={showRecycleBin}
        onClose={() => setShowRecycleBin(false)}
        onInventoryRefresh={fetchInventory}
      />

      {/* RecycleBin Warning Modal */}
      <RecycleBinWarningModal
        isOpen={showRecycleBinWarning}
        itemName={recycleBinWarningData.itemName}
        serialNumber={recycleBinWarningData.serialNumber}
        onClose={() => setShowRecycleBinWarning(false)}
        onOpenRecycleBin={() => setShowRecycleBin(true)}
      />

      {/* Token Expiry Warning Modal */}
      <TokenExpiryModal
        isOpen={showModal}
        timeLeft={timeToExpiry || 0}
        onClose={handleCloseModal}
      />

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-2xl">🔐</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                เซสชันหมดอายุ
              </h2>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 leading-relaxed">
                เซสชันการใช้งานของคุณหมดอายุแล้ว
              </p>
              <p className="text-gray-700 leading-relaxed mt-2">
                กรุณาเข้าสู่ระบบใหม่เพื่อใช้งานต่อ
              </p>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleLogoutConfirm}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                เข้าสู่ระบบใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorData && (
        <ErrorModal
          isOpen={showErrorModal}
          onClose={() => setShowErrorModal(false)}
          title={errorData.title}
          message={errorData.message}
          reason={errorData.reason}
          nextSteps={errorData.nextSteps}
          itemName={errorData.itemName}
          adminStock={errorData.adminStock}
          userOwned={errorData.userOwned}
        />
      )}

      {/* Simple Error Modal */}
      <SimpleErrorModal
        isOpen={showSimpleError}
        onClose={() => setShowSimpleError(false)}
        message={simpleErrorMessage}
      />

    </Layout>
  );
}
