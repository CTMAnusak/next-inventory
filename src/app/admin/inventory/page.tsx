'use client';

import React, { useState, useEffect } from 'react';
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


interface InventoryItem {
  _id: string;
  itemName: string;
  category: string;
  quantity: number;
  totalQuantity?: number;
  serialNumbers?: string[]; // แก้ไขจาก serialNumber เป็น serialNumbers
  status: string;
  dateAdded: string;
}

interface InventoryFormData {
  itemName: string;
  category: string;
  quantity: number;
  totalQuantity: number;
  serialNumber: string;
  status: string;
}

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  
  // Stock Rename states
  const [showStockRename, setShowStockRename] = useState(false);
  const [stockRenameOldName, setStockRenameOldName] = useState('');
  const [stockRenameNewName, setStockRenameNewName] = useState('');
  const [showRenameConfirm, setShowRenameConfirm] = useState(false);
  
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
  const [statusFilter, setStatusFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [serialNumberFilter, setSerialNumberFilter] = useState<'all' | 'with' | 'without'>('all'); // เพิ่มฟิลเตอร์ Serial Numbers

  // Form data
  const [formData, setFormData] = useState<InventoryFormData>({
    itemName: '',
    category: '',
    quantity: 0,
    totalQuantity: 0,
    serialNumber: '',
    status: 'active'
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [categories, setCategories] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>(['active','maintenance','damaged','retired']);
  const [newCategory, setNewCategory] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');
  const [editingStatusIndex, setEditingStatusIndex] = useState<number | null>(null);
  const [editingStatusValue, setEditingStatusValue] = useState('');

  // New state for improved add item flow
  const [selectedCategory, setSelectedCategory] = useState('');
  const [existingItemsInCategory, setExistingItemsInCategory] = useState<string[]>([]);
  const [selectedExistingItem, setSelectedExistingItem] = useState('');
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  
  // Serial Number management state
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [editingSerialNumber, setEditingSerialNumber] = useState<{index: number, value: string} | null>(null);
  
  // Stock Management state
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockItem, setStockItem] = useState<{itemName: string, category: string} | null>(null);
  const [stockOperation, setStockOperation] = useState<'adjust_stock' | 'delete_item' | 'edit_items'>('adjust_stock');
  const [stockValue, setStockValue] = useState<number>(0);
  const [stockReason, setStockReason] = useState<string>('');
  const [stockLoading, setStockLoading] = useState(false);
  const [stockInfo, setStockInfo] = useState<any>(null);

  // Edit Items state
  const [availableItems, setAvailableItems] = useState<{
    withSerialNumber: any[];
    withoutSerialNumber: { count: number; items: any[] };
  } | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingSerialNum, setEditingSerialNum] = useState<string>('');
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [itemOperation, setItemOperation] = useState<'edit' | 'delete'>('edit');
  
  // Search and filter for edit items
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemFilterBy, setItemFilterBy] = useState<'all' | 'admin' | 'user'>('all');

  // State for delete confirmation
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);


  useEffect(() => {
    fetchInventory();
    fetchConfig();
  }, []);

  // Fetch available items when switching to edit_items operation
  useEffect(() => {
    if (stockOperation === 'edit_items' && stockItem) {
      fetchAvailableItems();
    }
  }, [stockOperation, stockItem]);

  useEffect(() => {
    applyFilters();
  }, [items, searchTerm, categoryFilter, statusFilter, lowStockFilter, serialNumberFilter]); // เพิ่ม serialNumberFilter

  const fetchInventory = async () => {
    setLoading(true);
    try {
      // Clear cache by adding timestamp to prevent caching
      const response = await fetch(`/api/admin/inventory?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Raw inventory data from API:', data);
        setItems(data);
      } else {
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  // Function to refresh data and clear all caches
  const refreshAndClearCache = async () => {
    try {
      // Clear all caches in the system first
      const response = await fetch('/api/admin/clear-all-caches', { method: 'POST' });
      if (response.ok) {
        toast.success('ล้าง cache และรีเฟรชข้อมูลเรียบร้อยแล้ว');
      } else {
        toast.error('เกิดข้อผิดพลาดในการล้าง cache');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
    
    // Always refresh inventory data
    await fetchInventory();
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/inventory/config');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (Array.isArray(data.statuses)) setStatuses(data.statuses);
      }
    } catch (error) {
      // ใช้ค่าเริ่มต้นหากโหลดไม่ได้
    }
  };

  const applyFilters = () => {
    let filtered = items.filter(item => {
      const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.serialNumbers && Array.isArray(item.serialNumbers) && item.serialNumbers.some(sn => sn.toLowerCase().includes(searchTerm.toLowerCase())));
      
      const matchesCategory = !categoryFilter || item.category === categoryFilter;
      const matchesStatus = !statusFilter || getStatusText(item.status) === getStatusText(statusFilter);
      
      // เพิ่มฟิลเตอร์ Serial Numbers
      const hasSerials = Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0;
      const matchesSerialNumber = serialNumberFilter === 'all' ||
                                  (serialNumberFilter === 'with' && hasSerials) ||
                                  (serialNumberFilter === 'without' && !hasSerials);
      
      return matchesSearch && matchesCategory && matchesStatus && matchesSerialNumber;
    });

    // Group by itemName + category
    const groupedMap = new Map<string, any>();
    for (const it of filtered) {
      const key = `${it.itemName}||${it.category}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          _id: `grouped-${key}`, // Use key as stable unique ID
          key,
          itemName: it.itemName,
          category: it.category,
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
    if (lowStockFilter) {
      grouped = grouped.filter(
        (g) => g.quantity <= 2 && (!g.serialNumbers || g.serialNumbers.length === 0)
      );
    }

    // Sort by low stock items first (non-serial groups only), then by date added
    grouped.sort((a, b) => {
      const aIsLowStock = a.quantity <= 2 && (!a.serialNumbers || a.serialNumbers.length === 0);
      const bIsLowStock = b.quantity <= 2 && (!b.serialNumbers || b.serialNumbers.length === 0);
      if (aIsLowStock && !bIsLowStock) return -1;
      if (!aIsLowStock && bIsLowStock) return 1;
      return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
    });

    console.log('🔍 Grouped items:', grouped);
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
      if (!formData.itemName || !formData.category || formData.quantity <= 0) {
        toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
        setLoading(false);
        return;
      }

      const url = editingItem ? `/api/admin/inventory/${editingItem._id}` : '/api/admin/inventory';
      const method = editingItem ? 'PUT' : 'POST';

      // Force quantity/totalQuantity to 1 when adding from SN flow
      const payload = addFromSN && !editingItem
        ? { ...formData, quantity: 1, totalQuantity: 1 }
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingItem ? 'อัพเดตข้อมูลเรียบร้อยแล้ว' : 'เพิ่มรายการเรียบร้อยแล้ว');
        await fetchInventory();
        resetForm();
        setShowAddModal(false);
        setShowEditModal(false);
        setAddFromSN(false);
      } else {
        const data = await response.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      itemName: item.itemName,
      category: item.category,
      quantity: item.quantity,
      totalQuantity: item.totalQuantity ?? item.quantity,
      serialNumber: item.serialNumbers && item.serialNumbers.length > 0 ? item.serialNumbers[0] : '',
      status: item.status
    });
    setShowEditModal(true);
  };

  // Stock Modal functions
  const openStockModal = async (item: any) => {
    setStockItem({ itemName: item.itemName, category: item.category });
    setStockOperation('adjust_stock');
    setStockValue(0);
    setStockReason('ปรับจำนวน Admin Stock');
    setShowStockRename(false);
    setStockRenameOldName('');
    setStockRenameNewName('');
    setShowRenameConfirm(false);
    setStockLoading(true);
    
    try {
      console.log(`📱 Frontend: Fetching stock info for ${item.itemName} (${item.category})`);
      
      // Fetch current stock info (includes auto-detection)
      const response = await fetch(`/api/admin/stock-management?itemName=${encodeURIComponent(item.itemName)}&category=${encodeURIComponent(item.category)}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Ensure data structure is complete
        if (!data.stockManagement) {
          console.log('⚠️ No stockManagement found, creating default structure');
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
        
        console.log(`📊 Frontend: Set default stock value to ${adminStock}`);
        
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to fetch stock info:', response.status, errorData);
        toast.error(errorData.error || 'ไม่สามารถโหลดข้อมูล Stock ได้');
        setStockInfo(null);
      }
    } catch (error) {
      console.error('❌ Error fetching stock info:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      setStockInfo(null);
    } finally {
      setStockLoading(false);
      setShowStockModal(true);
    }
  };

  const closeStockModal = () => {
    setShowStockModal(false);
    setStockItem(null);
    setStockOperation('adjust_stock');
    setStockValue(0);
    setStockReason('');
    setShowStockRename(false);
    setStockRenameOldName('');
    setStockRenameNewName('');
    setShowRenameConfirm(false);
    
    // Reset additional states
    setStockInfo(null);
    setAvailableItems(null);
    setEditingItemId(null);
    setEditingSerialNum('');
    setShowEditItemModal(false);
    setItemOperation('edit');
    setItemSearchTerm('');
    setItemFilterBy('all');
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

      console.log('🔍 Rename API Response:', {
        status: response.status,
        ok: response.ok,
        data: data
      });

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
          category: stockItem?.category || ''
        };
        
        // ปิด rename mode และเปิด stock modal ใหม่ด้วยข้อมูลใหม่
        setShowStockRename(false);
        setStockRenameOldName('');
        setStockRenameNewName('');
        
        // Delay เล็กน้อยเพื่อให้ inventory update เสร็จก่อน
        setTimeout(async () => {
          console.log(`🔄 Reopening stock modal with new name: ${updatedItem.itemName}`);
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





  const fetchAvailableItems = async () => {
    if (!stockItem) return;
    
    try {
      console.log(`📱 Fetching available items for: ${stockItem.itemName} (${stockItem.category})`);
      
      const params = new URLSearchParams({
        itemName: stockItem.itemName,
        category: stockItem.category
      });

      const response = await fetch(`/api/admin/equipment-reports/available-items?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`📊 Available items response:`, data);
        setAvailableItems(data);
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch available items:', response.status, errorData);
        setAvailableItems(null);
      }
    } catch (error) {
      console.error('Error fetching available items:', error);
      setAvailableItems(null);
    }
  };



  const handleEditItem = (item: any) => {
    setEditingItemId(item.itemId);
    setEditingSerialNum(item.serialNumber || '');
    setItemOperation('edit');
    setShowEditItemModal(true);
  };

  const handleDeleteItem = (item: any) => {
    setEditingItemId(item.itemId);
    setEditingSerialNum(item.serialNumber || '');
    setItemOperation('delete');
    setStockReason(''); // Reset reason for new operation
    setShowEditItemModal(true);
  };

  // Filter and search functions for edit items
  const getFilteredSerialNumberItems = () => {
    if (!availableItems?.withSerialNumber) return [];
    
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

  const handleSaveEditItem = async () => {
    if (!editingItemId || !stockItem) return;

    try {
      const isDelete = itemOperation === 'delete';
      
      // Reason is auto-generated, no need to validate
      
      if (!isDelete && !editingSerialNum.trim()) {
        toast.error('กรุณาระบุ Serial Number');
        return;
      }

      const response = await fetch('/api/admin/inventory/edit-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: editingItemId,
          itemName: stockItem.itemName,
          category: stockItem.category,
          operation: itemOperation,
          newSerialNumber: editingSerialNum,
          reason: stockReason,
          oldSerialNumber: availableItems?.withSerialNumber?.find(item => item.itemId === editingItemId)?.serialNumber || editingSerialNum
        }),
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

      // Refresh available items
      await fetchAvailableItems();
      
      // Close modal
      setShowEditItemModal(false);
      setEditingItemId(null);
      setEditingSerialNum('');
      setStockReason('');

    } catch (error) {
      console.error('Error saving item:', error);
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
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

    setDeleteLoading(true);

    try {
      console.log(`🗑️ Frontend: Executing PERMANENT deletion for ${stockItem.itemName}`);
      
      const response = await fetch(`/api/admin/inventory`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemName: stockItem.itemName,
          category: stockItem.category,
          deleteAll: true,
          reason: stockReason || 'Complete item deletion via admin management'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('🗑️ ลบรายการทั้งหมดเรียบร้อยแล้ว');
        await fetchInventory();
        closeDeleteConfirmModal();
        closeStockModal();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาดในการลบ');
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
      // Show delete confirmation modal instead of browser confirm
      setShowDeleteConfirmModal(true);
      setStockLoading(false);
      return;
    } else {
      // Validation for other operations
      // Reason is auto-generated, no need to validate

      if (stockOperation === 'adjust_stock' && stockValue < 0) {
        toast.error('จำนวน stock ต้องเป็นจำนวนบวก');
        return;
      }
    }

    setStockLoading(true);

    try {
      // Handle stock management operations (adjust_stock only)
      const currentStock = stockInfo?.stockManagement?.adminDefinedStock || 0;
      const operationType = 'adjust_stock';

      console.log(`📱 Frontend: Submitting stock adjustment:`, {
        itemName: stockItem.itemName,
        category: stockItem.category,
        operationType,
        currentStock,
        newStockValue: stockValue,  // This is the absolute value we want
        reason: stockReason
      });

      const response = await fetch('/api/admin/stock-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemName: stockItem.itemName,
          category: stockItem.category,
          operationType: operationType,
          value: stockValue,  // ✅ Send absolute value (API will calculate adjustment)
          reason: stockReason
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        await fetchInventory();
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



  // Serial Number management functions
  const handleAddSerialNumber = async () => {
    if (!newSerialNumber.trim()) return;
    
    if (!snModal.itemKey) {
      toast.error('ไม่พบ ID ของรายการที่ต้องการแก้ไข');
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/inventory/${snModal.itemKey}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'addSerialNumber',
          serialNumber: newSerialNumber.trim()
        }),
      });

      if (response.ok) {
        toast.success('เพิ่ม Serial Number สำเร็จ');
        setNewSerialNumber('');
        
        // รีเฟรชข้อมูล inventory และอัปเดต Modal ทันที
        await fetchInventory();
        
        // อัปเดต Modal data ด้วยข้อมูลใหม่ที่รวม Serial Number ทั้งหมด
        updateModalWithAllSerialNumbers();
        
      } else {
        const data = await response.json();
        toast.error(data.error || 'เกิดข้อผิดพลาดในการเพิ่ม Serial Number');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleEditSerialNumber = (oldValue: string, index: number) => {
    setEditingSerialNumber({ index, value: oldValue });
  };

  const handleUpdateSerialNumber = async () => {
    if (!editingSerialNumber) return;
    
    if (!snModal.itemKey) {
      toast.error('ไม่พบ ID ของรายการที่ต้องการแก้ไข');
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/inventory/${snModal.itemKey}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateSerialNumber',
          oldValue: editingSerialNumber.value,
          newValue: editingSerialNumber.value
        }),
      });

      if (response.ok) {
        toast.success('อัปเดต Serial Number สำเร็จ');
        setEditingSerialNumber(null);
        
        // รีเฟรชข้อมูล inventory และอัปเดต Modal ทันที
        await fetchInventory();
        
        // อัปเดต Modal data ด้วยข้อมูลใหม่ที่รวม Serial Number ทั้งหมด
        updateModalWithAllSerialNumbers();
        
      } else {
        const data = await response.json();
        toast.error(data.error || 'เกิดข้อผิดพลาดในการอัปเดต Serial Number');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleDeleteSerialNumber = async (serialNumber: string, index: number) => {
    if (!confirm(`คุณต้องการลบ Serial Number "${serialNumber}" จริงหรือไม่?`)) return;
    
    if (!snModal.itemKey) {
      toast.error('ไม่พบ ID ของรายการที่ต้องการแก้ไข');
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/inventory/${snModal.itemKey}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'deleteSerialNumber',
          serialNumber: serialNumber
        }),
      });

      if (response.ok) {
        toast.success('ลบ Serial Number สำเร็จ');
        
        // รีเฟรชข้อมูล inventory และอัปเดต Modal ทันที
        await fetchInventory();
        
        // อัปเดต Modal data ด้วยข้อมูลใหม่ที่รวม Serial Number ทั้งหมด
        updateModalWithAllSerialNumbers();
      } else {
        const data = await response.json();
        toast.error(data.error || 'เกิดข้อผิดพลาดในการลบ Serial Number');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const resetForm = () => {
    setFormData({
      itemName: '',
      category: '',
      quantity: 0,
      totalQuantity: 0,
      serialNumber: '',
      status: 'active'
    });
    setEditingItem(null);
    setAddFromSN(false);
    
    // Reset new states
    setSelectedCategory('');
    setExistingItemsInCategory([]);
    setSelectedExistingItem('');
    setIsAddingNewItem(false);
  };

  // Function to handle category selection and fetch existing items
  const handleCategorySelection = async (category: string) => {
    setSelectedCategory(category);
    setFormData(prev => ({ ...prev, category }));
    setSelectedExistingItem('');
    setIsAddingNewItem(false);

    if (category) {
      try {
        // Fetch existing item names in this category
        const response = await fetch('/api/admin/inventory');
        if (response.ok) {
          const allItems = await response.json();
          const itemsInCategory = allItems
            .filter((item: any) => item.category === category)
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

  const exportToExcel = () => {
    // This would implement Excel export functionality
    toast('ฟีเจอร์ Export Excel จะพัฒนาในอนาคต');
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      active: 'ใช้งานได้',
      maintenance: 'ซ่อมบำรุง',
      damaged: 'ชำรุด',
      retired: 'เลิกใช้',
    };
    return map[status] || status;
  };

  const getStatusClass = (status: string) => {
    if (status === 'active') return 'bg-green-100 text-green-800';
    if (status === 'maintenance') return 'bg-yellow-100 text-yellow-800';
    if (status === 'damaged') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const saveConfig = async () => {
    try {
      const response = await fetch('/api/admin/inventory/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories, statuses })
      });
      if (response.ok) {
        toast.success('บันทึกการตั้งค่าเรียบร้อย');
        setShowSettingsModal(false);
      } else {
        const data = await response.json();
        toast.error(data.error || 'บันทึกไม่สำเร็จ');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredItems.slice(startIndex, endIndex);
  const [snModal, setSnModal] = useState<{ open: boolean; name: string; category?: string; sns: string[]; itemKey?: string }>({ open: false, name: '', category: undefined, sns: [], itemKey: undefined });
  const [addFromSN, setAddFromSN] = useState(false);

  const findInventoryBySerial = (itemName: string, serialNumber: string, category?: string) => {
    return items.find(
      (it) => it.itemName === itemName && it.serialNumbers && it.serialNumbers.includes(serialNumber) && (!category || it.category === category)
    );
  };

  const openEditBySerial = (serialNumber: string) => {
    const inv = findInventoryBySerial(snModal.name, serialNumber, snModal.category);
    if (inv) {
      setSnModal({ open: false, name: '', category: undefined, sns: [], itemKey: undefined });
      handleEdit(inv);
    } else {
      toast.error('ไม่พบรายการสำหรับ Serial Number นี้');
    }
  };

  const findNonSerialDocForGroup = (groupItem: any): InventoryItem | undefined => {
    return items.find(
      (it) => it.itemName === groupItem.itemName && it.category === groupItem.category && (!it.serialNumbers || it.serialNumbers.length === 0)
    );
  };

  // Helper function to update modal with all serial numbers for the same item name and category
  const updateModalWithAllSerialNumbers = () => {
    const allItemsWithSameName = items.filter(item => 
      item.itemName === snModal.name && 
      item.category === snModal.category
    );
    
    const allSerialNumbers = allItemsWithSameName.reduce((acc: string[], item) => {
      if (item.serialNumbers && Array.isArray(item.serialNumbers)) {
        acc.push(...item.serialNumbers);
      }
      return acc;
    }, []);
    
    setSnModal(prev => ({
      ...prev,
      sns: allSerialNumbers
    }));
    
    console.log('🔍 อัปเดต Modal:', {
      itemName: snModal.name,
      category: snModal.category,
      totalItems: allItemsWithSameName.length,
      allSerialNumbers: allSerialNumbers
    });
  };

  const deleteBySerial = (serialNumber: string) => {
    const inv = findInventoryBySerial(snModal.name, serialNumber, snModal.category);
    if (inv && inv._id) {
      setSnModal({ open: false, name: '', category: undefined, sns: [], itemKey: undefined });
      
      // For serial number items, always delete 1
      const deleteQuantity = 1;
      
      // Show warning and confirmation
      const warningMessage = `⚠️ คำเตือน: คุณจะลบ Serial Number "${serialNumber}" จริงไหมเพราะลบแล้ว ทุกบัญชีที่มีอุปกรณ์รายการนี้ อุปกรณ์ในบัญชีนั้นจะถูกลบด้วย\n\n`;
      const confirmationMessage = `กรุณาพิมพ์ "Delete" (D ตัวใหญ่) เพื่อยืนยันการลบ:`;
      
      const userConfirmation = prompt(warningMessage + confirmationMessage);
      
      if (userConfirmation !== 'Delete') {
        toast.error('การลบถูกยกเลิก');
        return;
      }

      // Call handleDelete with the item ID
      handleDelete(inv._id);
    } else {
      toast.error('ไม่พบรายการสำหรับ Serial Number นี้');
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/50">
          {/* Header */}
          <div className="flex flex-col justify-between items-center mb-7 xl:flex-row">
            <h1 className="text-2xl font-bold text-gray-900 pb-5 xl:pb-0">จัดการคลังสินค้า</h1>
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
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>รีเฟรช</span>
              </button>
              <button
                onClick={exportToExcel}
                className="w-full min-[440px]:w-3/7 min-[650px]:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
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
                      placeholder="ชื่ออุปกรณ์, หมวดหมู่, Serial Number"
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
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
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
                    {statuses.map((st) => (
                      <option key={st} value={st}>{getStatusText(st)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serial Numbers
                  </label>
                  <select
                    value={serialNumberFilter}
                    onChange={(e) => setSerialNumberFilter(e.target.value as 'all' | 'with' | 'without')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="all">ทั้งหมด</option>
                    <option value="with">มี Serial Number</option>
                    <option value="without">ไม่มี Serial Number</option>
                  </select>
                </div>
              </div>
              <div className="flex">
                <label className="flex items-center space-x-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={lowStockFilter}
                    onChange={(e) => setLowStockFilter(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>สินค้าใกล้หมด (≤ 2 ชิ้น)</span>
                </label>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className=" min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ชื่ออุปกรณ์
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    หมวดหมู่
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    จำนวนคงเหลือ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    จำนวนทั้งหมด
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    สถานะ
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    วันที่เพิ่ม
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    เพิ่มเติม
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      <RefreshCw className="inline-block w-4 h-4 mr-2 animate-spin text-gray-400" />
                      กำลังโหลดข้อมูล
                    </td>
                  </tr>
                )}
                {!loading && currentItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">ไม่พบข้อมูล</td>
                  </tr>
                )}
                {currentItems.map((item) => {
                  const hasSerials = Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0;
                  const isLowStock = item.quantity <= 2 && !hasSerials;
                  return (
                    <tr key={item._id} className={isLowStock ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                        {item.itemName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {item.category}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        isLowStock ? 'text-red-600' : 'text-gray-900'
                      } text-center`}>
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {item.totalQuantity ?? item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(item.status)}`}>
                          {item.hasMixedStatus ? 'หลากหลาย' : getStatusText(item.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {new Date(item.dateAdded).toLocaleDateString('th-TH')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium relative">
                        <div className="flex justify-center space-x-2">
                          {Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0 ? (
                            <button
                              onClick={() => {
                                // Find the first item with serial numbers to get the correct _id
                                const firstSerialItem = items.find(it => 
                                  it.itemName === item.itemName && 
                                  it.category === item.category && 
                                  it.serialNumbers && 
                                  it.serialNumbers.length > 0
                                );
                                setSnModal({ 
                                  open: true, 
                                  name: item.itemName, 
                                  category: item.category, 
                                  sns: item.serialNumbers || [], 
                                  itemKey: firstSerialItem?._id
                                });
                              }}
                              className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-md text-sm font-medium"
                              aria-label="รายละเอียด"
                            >
                              รายละเอียด
                            </button>
                          ) : null}
                          
                          <button
                            onClick={() => openStockModal(item)}
                            className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-md text-sm font-medium"
                            aria-label="จัดการ Stock"
                          >
                            จัดการ Stock
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">เพิ่มรายการใหม่</h3>
                <button
                  onClick={() => { setShowAddModal(false); setAddFromSN(false); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
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
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
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
                        <div className="text-sm text-gray-600 mb-2">รายการที่มีอยู่ในหมวดหมู่ "{selectedCategory}":</div>
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
                        disabled={addFromSN || formData.serialNumber.trim() !== ''}
                      />
                      {(addFromSN || formData.serialNumber.trim() !== '') && (
                        <p className="text-xs text-blue-600 mt-1">
                          {addFromSN ? '* เพิ่มจากรายการ Serial Number: จำนวนทั้งหมดถูกตั้งเป็น 1 และแก้ไขไม่ได้' : '* เมื่อระบุ Serial Number จำนวนทั้งหมดจะเป็น 1 อัตโนมัติ'}
                        </p>
                      )}
                    </div>

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
                        required={addFromSN}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {addFromSN ? 'กรุณากรอก Serial Number ของรายการใหม่' : 'เมื่อใส่ Serial Number จำนวนจะถูกตั้งเป็น 1 อัตโนมัติ'}
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
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status === 'active' ? 'ใช้งานได้' : 
                             status === 'maintenance' ? 'ซ่อมบำรุง' : 
                             status === 'damaged' ? 'เสียหาย' : 
                             status === 'retired' ? 'เลิกใช้' : status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => { setShowAddModal(false); setAddFromSN(false); }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
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
                    </div>
                  </>
                )}
              </form>
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
                  <h3 className="text-lg font-bold text-red-800">ไม่สามารถลดจำนวนได้</h3>
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
                          <span className="font-bold text-red-600">
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
                <h3 className="text-xl font-bold text-gray-900">แก้ไขรายการ</h3>
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
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  >
                    <option value="">-- เลือกหมวดหมู่ --</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
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
                    {statuses.map((st) => (
                      <option key={st} value={st}>{getStatusText(st)}</option>
                    ))}
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
            <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl max-w-3xl w-full mx-4 border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">ตั้งค่าหมวดหมู่และสถานะ</h3>
                <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Categories */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">หมวดหมู่</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto p-2 border rounded-lg">
                    {categories.map((cat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {editingCategoryIndex === idx ? (
                          <input
                            className="flex-1 px-3 py-2 border rounded-md"
                            value={editingCategoryValue}
                            onChange={(e) => setEditingCategoryValue(e.target.value)}
                          />
                        ) : (
                          <span className="flex-1 text-gray-800">{cat}</span>
                        )}
                        {editingCategoryIndex === idx ? (
                          <button
                            className="px-2 py-1 text-white bg-blue-600 rounded"
                            onClick={() => {
                              const next = [...categories];
                              next[idx] = editingCategoryValue.trim() || next[idx];
                              setCategories(next);
                              setEditingCategoryIndex(null);
                              setEditingCategoryValue('');
                            }}
                          >บันทึก</button>
                        ) : (
                          <button
                            className="px-2 py-1 text-blue-600 hover:underline"
                            onClick={() => {
                              setEditingCategoryIndex(idx);
                              setEditingCategoryValue(cat);
                            }}
                          >แก้ไข</button>
                        )}
                        <button
                          className="px-2 py-1 text-red-600 hover:underline"
                          onClick={() => setCategories(categories.filter((_, i) => i !== idx))}
                        >ลบ</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <input
                      className="flex-1 px-3 py-2 border rounded-md"
                      placeholder="เพิ่มหมวดหมู่ใหม่"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    />
                    <button
                      className="px-3 py-2 bg-gray-900 text-white rounded-md"
                      onClick={() => {
                        const v = newCategory.trim();
                        if (!v) return;
                        if (categories.includes(v)) {
                          toast.error('เพิ่มข้อมูลไม่ได้ เนื่องจากข้อมูลซ้ำ', { duration: 4000 });
                        } else {
                          setCategories([...categories, v]);
                        }
                        setNewCategory('');
                      }}
                    >เพิ่ม</button>
                  </div>
                </div>

                {/* Statuses */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">สถานะ</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto p-2 border rounded-lg">
                    {statuses.map((st, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {editingStatusIndex === idx ? (
                          <input
                            className="flex-1 px-3 py-2 border rounded-md"
                            value={editingStatusValue}
                            onChange={(e) => setEditingStatusValue(e.target.value)}
                          />
                        ) : (
                          <span className="flex-1 text-gray-800">{st}</span>
                        )}
                        {editingStatusIndex === idx ? (
                          <button
                            className="px-2 py-1 text-white bg-blue-600 rounded"
                            onClick={() => {
                              const next = [...statuses];
                              next[idx] = editingStatusValue.trim() || next[idx];
                              setStatuses(next);
                              setEditingStatusIndex(null);
                              setEditingStatusValue('');
                            }}
                          >บันทึก</button>
                        ) : (
                          <button
                            className="px-2 py-1 text-blue-600 hover:underline"
                            onClick={() => {
                              setEditingStatusIndex(idx);
                              setEditingStatusValue(st);
                            }}
                          >แก้ไข</button>
                        )}
                        <button
                          className="px-2 py-1 text-red-600 hover:underline"
                          onClick={() => setStatuses(statuses.filter((_, i) => i !== idx))}
                        >ลบ</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <input
                      className="flex-1 px-3 py-2 border rounded-md"
                      placeholder="เพิ่มสถานะใหม่"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                    />
                    <button
                      className="px-3 py-2 bg-gray-900 text-white rounded-md"
                      onClick={() => {
                        const v = newStatus.trim();
                        if (!v) return;
                        if (statuses.includes(v)) {
                          toast.error('เพิ่มข้อมูลไม่ได้ เนื่องจากข้อมูลซ้ำ', { duration: 4000 });
                        } else {
                          setStatuses([...statuses, v]);
                        }
                        setNewStatus('');
                      }}
                    >เพิ่ม</button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >ยกเลิก</button>
                <button
                  onClick={saveConfig}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >บันทึก</button>
              </div>
            </div>
          </div>
        )}
      </div>



      {snModal.open && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-2xl max-w-lg w-full mx-4 border border-white/20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">รายละเอียด Serial Number - {snModal.name}</h3>
              <button onClick={() => setSnModal({ open: false, name: '', sns: [], itemKey: undefined })} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Add new Serial Number */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="เพิ่ม Serial Number ใหม่"
                  value={newSerialNumber}
                  onChange={(e) => setNewSerialNumber(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddSerialNumber}
                  disabled={!newSerialNumber.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  เพิ่ม
                </button>
              </div>
            </div>

            {/* Serial Numbers List */}
            {snModal.sns.length === 0 ? (
              <div className="text-center text-gray-500 py-4">ไม่มี Serial Number</div>
            ) : (
              <ul className="space-y-2 max-h-60 overflow-auto">
                {snModal.sns.map((sn, idx) => (
                  <li key={`sn-${idx}-${sn}`} className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                    {editingSerialNumber && editingSerialNumber.index === idx ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingSerialNumber.value}
                          onChange={(e) => setEditingSerialNumber(prev => prev ? { ...prev, value: e.target.value } : null)}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          autoFocus
                        />
                        <button
                          onClick={handleUpdateSerialNumber}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                        >
                          บันทึก
                        </button>
                        <button
                          onClick={() => setEditingSerialNumber(null)}
                          className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <React.Fragment key={`view-${sn}-${idx}`}>
                        <span className="text-gray-800 font-medium">{sn}</span>
                        <span className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditSerialNumber(sn, idx)}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            title="แก้ไข"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSerialNumber(sn, idx)}
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </span>
                      </React.Fragment>
                    )}
                  </li>
                ))}
              </ul>
            )}
            

          </div>
        </div>
      )}

      {/* Stock Management Modal */}
      {showStockModal && stockItem && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] border border-white/20 flex flex-col">
            {/* Modal Header - Fixed */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 rounded-t-2xl bg-white/95">
              <div className="flex items-center space-x-4">
                <h3 className="text-xl font-bold text-gray-900">
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

            {/* Current Stock Info */}
            {stockLoading ? (
              <div className="bg-gray-50 p-4 rounded-lg mb-6 animate-pulse">
                <div className="h-4 bg-gray-300 rounded mb-2"></div>
                <div className="h-3 bg-gray-300 rounded mb-1"></div>
                <div className="h-3 bg-gray-300 rounded"></div>
              </div>
            ) : !stockLoading && stockInfo ? (
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <h4 className="font-semibold text-blue-900 mb-3">
                  ข้อมูลปัจจุบัน:
                  {stockInfo.adminStockOperations?.length > 0 && (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      ✅ ตรวจพบแล้ว
                    </span>
                  )}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Admin ตั้งไว้:</span>
                    <span className="font-bold text-blue-900 ml-2">
                      {stockInfo.stockManagement?.adminDefinedStock || 0} ชิ้น
                    </span>
                    {stockInfo.stockManagement?.adminDefinedStock === 0 && (
                      <span className="text-xs text-orange-600 ml-1">
                        (ยังไม่มีการตั้งค่า)
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-blue-700">User เพิ่มมา:</span>
                    <span className="font-bold text-purple-600 ml-2">
                      {stockInfo.stockManagement?.userContributedCount || 0} ชิ้น
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <span className="text-blue-700">รวมทั้งหมด:</span>
                  <span className="font-bold text-blue-900 ml-2">
                    {stockInfo.currentStats?.totalQuantity || 0} ชิ้น
                  </span>
                  <span className="text-xs text-blue-600 ml-2">
                    (Admin: {stockInfo.stockManagement?.adminDefinedStock || 0} + User: {stockInfo.stockManagement?.userContributedCount || 0})
                  </span>
                </div>
                
                {/* 🆕 Information about items with Serial Numbers */}
                {stockInfo.currentStats?.adminItemsWithSN > 0 && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center text-blue-600">
                      <div className="text-blue-600 mr-2">ℹ️</div>
                      <span className="text-sm text-blue-800">
                        มีอุปกรณ์ที่มี Serial Number อีก <span className="font-semibold">{stockInfo.currentStats.adminItemsWithSN} ชิ้น</span> ในคลัง Admin
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1 ml-6">
                      หากต้องการแก้ไขอุปกรณ์ที่มี Serial Number ให้ใช้ "แก้ไขรายการ - แก้ไข/ลบ อุปกรณ์ที่มี Serial Number"
                    </p>
                  </div>
                )}
                
                {/* Debug Info - Show if no data detected */}
                {(stockInfo.stockManagement?.adminDefinedStock === 0 && stockInfo.stockManagement?.userContributedCount === 0 && stockInfo.currentStats?.totalQuantity > 0) && (
                  <div className="mt-3 pt-3 border-t border-orange-200 bg-orange-50 p-3 rounded">
                    <div className="text-xs text-orange-800">
                      🔍 <strong>Debug:</strong> มีข้อมูล {stockInfo.currentStats.totalQuantity} ชิ้นใน DB แต่ยังไม่ได้แยกแยะ Admin vs User
                      <br />
                      ระบบกำลังตรวจสอบข้อมูลเดิม...
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-red-50 p-4 rounded-lg mb-6">
                <div className="text-red-800 text-sm">
                  ❌ ไม่สามารถโหลดข้อมูล Stock ได้
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Operation Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ประเภทการดำเนินการ
                </label>
                <select
                  value={stockOperation}
                  onChange={(e) => {
                    const newOperation = e.target.value as 'adjust_stock' | 'delete_item' | 'edit_items';
                    setStockOperation(newOperation);
                    
                    // Set current admin stock as starting point for adjustment
                    if (newOperation === 'adjust_stock') {
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
                    } else {
                      setStockReason('ปรับจำนวน Admin Stock');
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  <option value="adjust_stock">ปรับจำนวนอุปกรณ์ที่ไม่มี Serial Number</option>
                  <option value="edit_items">แก้ไขรายการ - แก้ไข/ลบ อุปกรณ์ที่มี Serial Number</option>
                  <option value="delete_item">ลบรายการ - ลบทั้งหมด (ไม่สามารถยกเลิก)</option>
                </select>
              </div>

              {/* Value Input - Hide for delete operation and edit_items */}
              {stockOperation !== 'delete_item' && stockOperation !== 'edit_items' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    จำนวนใหม่ที่ต้องการ (แสดงปัจจุบัน)
                  </label>
                  <input
                    type="number"
                    value={stockValue}
                    onChange={(e) => setStockValue(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`ปัจจุบัน: ${stockInfo?.stockManagement?.adminDefinedStock || 0} ชิ้น`}
                    min={0}
                  />
                  <p className="text-sm text-blue-600 mt-1">
                    💡 Field แสดงจำนวนปัจจุบัน ({stockInfo?.stockManagement?.adminDefinedStock || 0} ชิ้น) → แก้ไขเป็นจำนวนใหม่ที่ต้องการ
                  </p>
                </div>
              )}

              {/* Edit Items Interface */}
              {stockOperation === 'edit_items' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <div className="flex items-center text-blue-600 mb-2">
                      <div className="text-blue-600 mr-2">ℹ️</div>
                      <h5 className="font-medium text-blue-800">คุณสามารถแก้ไขหรือลบอุปกรณ์ที่มี Serial Number ได้เท่านั้น</h5>
                    </div>
                    <p className="text-sm text-blue-700">
                      อุปกรณ์ที่ไม่มี Serial Number จะแสดงเป็นรายการเดียวพร้อมจำนวน
                    </p>
                  </div>

                  {availableItems ? (
                    <div className="border rounded-lg p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <span className="font-medium text-sm text-gray-900">{stockItem?.itemName}</span>
                          <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-900 rounded">
                            รวม {(availableItems.withSerialNumber?.length || 0) + (availableItems.withoutSerialNumber?.count || 0)} ชิ้น
                          </span>
                        </div>
                      </div>

                      {/* Search and Filter Controls */}
                      {/* Items without Serial Numbers - แสดงก่อน */}
                      {availableItems.withoutSerialNumber && availableItems.withoutSerialNumber.count > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-gray-800 mb-2">
                            📦 อุปกรณ์ที่ไม่มี Serial Number
                          </h4>
                          <div className="p-3 border rounded-lg bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="text-sm text-gray-600">
                                  รายการที่ไม่มี Serial Number
                                </span>
                                <span className="ml-2 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">
                                  จำนวน: {availableItems.withoutSerialNumber.count} ชิ้น
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                ไม่สามารถแก้ไขรายการนี้ได้
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Search & Filter for Serial Number Items - แสดงตรงกลาง */}
                      {availableItems.withSerialNumber && availableItems.withSerialNumber.length > 0 && (
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
                              ทั้งหมด ({availableItems.withSerialNumber.length})
                            </button>
                            <button
                              onClick={() => setItemFilterBy('admin')}
                              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                itemFilterBy === 'admin'
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                              }`}
                            >
                              Admin ({availableItems.withSerialNumber.filter(item => item.addedBy === 'admin').length})
                            </button>
                            <button
                              onClick={() => setItemFilterBy('user')}
                              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                itemFilterBy === 'user'
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : 'bg-gray-200 text-gray-600 border border-gray-200 hover:bg-gray-200'
                              }`}
                            >
                              User ({availableItems.withSerialNumber.filter(item => item.addedBy === 'user').length})
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Items with Serial Numbers - แสดงสุดท้าย */}
                      {availableItems.withSerialNumber && availableItems.withSerialNumber.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center">
                            🔢 อุปกรณ์ที่มี Serial Number ({getFilteredSerialNumberItems().length} ชิ้น)
                            {itemSearchTerm && (
                              <span className="ml-2 text-xs text-gray-500">
                                (ค้นหา: "{itemSearchTerm}")
                              </span>
                            )}
                          </h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {getFilteredSerialNumberItems().length > 0 ? (
                              getFilteredSerialNumberItems().map((item: any) => (
                                <div
                                  key={`${item.itemId}-${item.serialNumber}`}
                                  className="p-3 border rounded-lg hover:bg-gray-50"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                      <span className="text-sm font-mono text-blue-600 font-medium">
                                        {item.serialNumber}
                                      </span>
                                      <span className="ml-2 text-xs text-gray-500">
                                        เพิ่มโดย: {item.addedBy === 'admin' ? 'Admin' : 'User'}
                                      </span>
                                    </div>
                                    <div className="flex space-x-2">
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
                            )}
                          </div>
                        </div>
                      )}



                      {/* No items */}
                      {(!availableItems.withSerialNumber || availableItems.withSerialNumber.length === 0) &&
                       (!availableItems.withoutSerialNumber || availableItems.withoutSerialNumber.count === 0) && (
                        <div className="text-center py-8 text-gray-500">
                          <p>ไม่มีรายการอุปกรณ์ในคลัง</p>
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

              {/* Hidden Reason Input - Auto-generated based on operation type */}
              <input
                type="hidden"
                value={stockReason}
                onChange={(e) => setStockReason(e.target.value)}
              />



            </div>

            {/* Modal Footer - Fixed */}
            <div className="p-6">
              {/* Action Buttons - Hide for edit_items */}
              {stockOperation !== 'edit_items' && (
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
                    disabled={stockLoading}
                    className={`px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${
                      stockOperation === 'delete_item'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {stockLoading ? 'กำลังดำเนินการ...' : 
                     stockOperation === 'delete_item' ? 'ลบรายการ' : 'บันทึก'}
                  </button>
                </div>
              )}

              {/* Close button for edit_items mode */}
              {stockOperation === 'edit_items' && (
                <div className="flex justify-end">
                  <button
                    onClick={closeStockModal}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    ปิด
                  </button>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditItemModal && editingItemId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto border border-white/20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">
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
                    Serial Number *
                  </label>
                  <input
                    type="text"
                    value={editingSerialNum}
                    onChange={(e) => setEditingSerialNum(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ระบุ Serial Number ใหม่"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowEditItemModal(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => handleSaveEditItem()}
                    disabled={!editingSerialNum.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    บันทึก
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
                        คุณต้องการลบ <strong>{stockItem?.itemName}</strong> ที่มี Serial Number: <strong>{editingSerialNum}</strong> หรือไม่?
                      </p>
                      <p className="text-sm text-red-800 font-medium mt-2">
                        ⚠️ ไม่สามารถยกเลิกการดำเนินการนี้ได้!
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    เหตุผลในการลบ *
                  </label>
                  <textarea
                    value={stockReason}
                    onChange={(e) => setStockReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    rows={3}
                    placeholder="ระบุเหตุผลในการลบรายการนี้..."
                    required
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowEditItemModal(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => handleSaveEditItem()}
                    disabled={false}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ลบรายการ
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
                  <h3 className="text-xl font-bold">ลบรายการทั้งหมด</h3>
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
                      <li>• <strong>ไม่สามารถกู้คืนได้</strong> หลังจากลบแล้ว</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Confirmation Input */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  พิมพ์ <span className="bg-red-100 text-red-800 px-2 py-1 rounded font-mono text-base">DELETE</span> เพื่อยืนยัน:
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

              {/* Reason Input */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">เหตุผลในการลบ:</label>
                <textarea
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  placeholder="ระบุเหตุผลในการลบรายการทั้งหมด..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                  disabled={deleteLoading}
                />
              </div>
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
                disabled={deleteLoading || deleteConfirmText !== 'DELETE'}
                className={`px-6 py-2.5 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium ${
                  deleteConfirmText === 'DELETE' && !deleteLoading
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
                  <h3 className="text-xl font-bold">⚠️ ยืนยันการเปลี่ยนชื่อ</h3>
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
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleStockRenameConfirm}
                className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                ยืนยันเปลี่ยนชื่อ
              </button>
            </div>
          </div>
        </div>
      )}


    </Layout>
  );
}
