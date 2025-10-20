'use client';

import { useState, useEffect } from 'react';
import { Package, Hash, Calendar, User, CheckCircle, AlertCircle } from 'lucide-react';

// Force update timestamp: 2025-09-28 23:45:00

interface AvailableItem {
  itemId: string;
  serialNumber?: string;
  numberPhone?: string;
  status?: string;
  statusId?: string;
  conditionId?: string;
  dateAdded: string;
  addedBy: string;
  isVirtual?: boolean;
  displayIndex?: number;
}

interface AvailableItemsResponse {
  itemName: string;
  category: string;
  totalAvailable: number;
  configs: {
    statusConfigs: ConfigItem[];
    conditionConfigs: ConfigItem[];
    categoryConfigs: ConfigItem[];
  };
  withSerialNumber: AvailableItem[];
  withoutSerialNumber: {
    count: number;
    items: AvailableItem[];
    hasMore: boolean;
  };
  withPhoneNumber?: AvailableItem[];
}

interface ConfigItem {
  id: string;
  name: string;
  order: number;
}

interface InventoryConfigs {
  statusConfigs: ConfigItem[];
  conditionConfigs: ConfigItem[];
  categoryConfigs: ConfigItem[];
}

interface SelectedItem {
  itemId: string;
  serialNumber?: string;
}

interface SerialNumberSelectorProps {
  itemName: string;
  category: string;  // Category name (for display)
  categoryId?: string; // ✅ Category ID (preferred for API calls)
  requestedQuantity: number;
  requestedSerialNumbers?: string[]; // SN ที่ user เจาะจงมา
  onSelectionChange: (selectedItems: SelectedItem[]) => void;
}

export default function SerialNumberSelector({
  itemName,
  category,
  categoryId,
  requestedQuantity,
  requestedSerialNumbers,
  onSelectionChange
}: SerialNumberSelectorProps) {
  const [availableItems, setAvailableItems] = useState<AvailableItemsResponse | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAvailableItems();
  }, [itemName, category, categoryId]);

  // Auto-select requested serial numbers when available items are loaded
  useEffect(() => {
    if (!availableItems) return;

    // ✅ ตรวจสอบว่า user เลือก Serial Number เจาะจงมาหรือไม่
    const hasRequestedSerialNumbers = requestedSerialNumbers && 
      requestedSerialNumbers.length > 0 && 
      requestedSerialNumbers.some(sn => sn && sn.trim() !== '');

    if (hasRequestedSerialNumbers) {
      // User เลือก Serial Number เจาะจง -> auto-select SN ที่ user ระบุ
      autoSelectRequestedSerialNumbers();
    } else {
      // User เลือก "ไม่มี Serial Number (ไม่เจาะจง)"
      // ลองเลือกอุปกรณ์ไม่มี SN ก่อน ถ้าไม่มีให้เลือกแบบมี SN แทน
      if (availableItems.withoutSerialNumber.count > 0) {
        autoSelectNoSerialNumber();
      } else if (availableItems.withSerialNumber.length > 0) {
        // ✅ ถ้าไม่มีอุปกรณ์แบบไม่มี SN แต่มีแบบมี SN (เช่น ซิมการ์ด) ให้เลือกอัตโนมัติ
        autoSelectItemsWithSerialNumber();
      }
    }
  }, [availableItems, requestedSerialNumbers]);

  useEffect(() => {
    onSelectionChange(selectedItems);
  }, [selectedItems, onSelectionChange]);

  const fetchAvailableItems = async () => {
    try {
      setLoading(true);
      setError('');
      
      // ✅ ใช้ categoryId ถ้ามี, ไม่งั้นใช้ category (name)
      const categoryParam = categoryId || category;
      
      const params = new URLSearchParams({
        itemName,
        category: categoryParam
      });

      const response = await fetch(`/api/admin/equipment-reports/available-items?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      setAvailableItems(data);
    } catch (error) {
      console.error('Error fetching available items:', error);
      setError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const handleItemSelect = (item: AvailableItem) => {
    // ✅ รองรับทั้ง serialNumber และ numberPhone
    const itemIdentifier = item.serialNumber || item.numberPhone;
    const uniqueKey = itemIdentifier ? `${item.itemId}-${itemIdentifier}` : item.itemId;
    const itemToAdd: SelectedItem = {
      itemId: item.itemId,
      serialNumber: itemIdentifier // เก็บทั้ง SN และ phone number ใน field เดียวกัน
    };

    setSelectedItems(prev => {
      // Check if already selected (by unique key for SN/phone items, by itemId for non-SN items)
      const isAlreadySelected = itemIdentifier
        ? prev.some(selected => selected.itemId === item.itemId && selected.serialNumber === itemIdentifier)
        : prev.some(selected => selected.itemId === item.itemId && !selected.serialNumber);

      if (isAlreadySelected) {
        // Remove if already selected
        return itemIdentifier
          ? prev.filter(selected => !(selected.itemId === item.itemId && selected.serialNumber === itemIdentifier))
          : prev.filter(selected => !(selected.itemId === item.itemId && !selected.serialNumber));
      } else {
        // Add if not selected and under limit
        if (prev.length < requestedQuantity) {
          return [...prev, itemToAdd];
        }
        return prev;
      }
    });
  };

  const autoSelectRequestedSerialNumbers = () => {
    if (!availableItems || !requestedSerialNumbers) {
      return;
    }

    const itemsToSelect: SelectedItem[] = [];
    const unavailableSerialNumbers: string[] = [];

    // Check each requested serial number
    for (const requestedSN of requestedSerialNumbers) {
      // Find if this SN is available
      const availableItem = availableItems.withSerialNumber.find(
        item => item.serialNumber === requestedSN || item.numberPhone === requestedSN
      );

      if (availableItem) {
        itemsToSelect.push({
          itemId: availableItem.itemId,
          serialNumber: availableItem.serialNumber || availableItem.numberPhone
        });
      } else {
        unavailableSerialNumbers.push(requestedSN);
      }
    }

    // Set selected items (ติ๊กให้อัตโนมัติ แต่ยังเปลี่ยนได้)
    setSelectedItems(itemsToSelect);

    // ✅ ไม่แสดง error เลย ให้แอดมินเลือกได้อย่างอิสระ
    // แค่ pre-select ให้ตาม user request
    setError('');
  };

  const autoSelectNoSerialNumber = () => {
    if (!availableItems || availableItems.withoutSerialNumber.count === 0) {
      return;
    }

    // ✅ Auto-select items without serial numbers up to requested quantity
    // This happens when user selected "ไม่มี Serial Number (ไม่เจาะจง)" in the request form
    // Admin can still uncheck and select other items if desired
    const itemsToAdd: SelectedItem[] = [];
    const availableWithoutSN = [...availableItems.withoutSerialNumber.items].reverse(); // LIFO - newest first
    
    const needToAdd = Math.min(
      requestedQuantity,
      availableWithoutSN.length
    );
    
    for (let i = 0; i < needToAdd; i++) {
      itemsToAdd.push({
        itemId: availableWithoutSN[i].itemId,
        serialNumber: undefined
      });
    }
    
    setSelectedItems(itemsToAdd);
  };

  const autoSelectItemsWithSerialNumber = () => {
    if (!availableItems || availableItems.withSerialNumber.length === 0) {
      return;
    }

    // ✅ Auto-select items WITH serial numbers/phone numbers up to requested quantity
    // This happens when user selected "ไม่เจาะจง" but only items with SN/phone are available (e.g., SIM cards)
    // Use FIFO (oldest first) for items with serial numbers
    const itemsToAdd: SelectedItem[] = [];
    const availableWithSN = availableItems.withSerialNumber; // Already in order from API
    
    const needToAdd = Math.min(
      requestedQuantity,
      availableWithSN.length
    );
    
    for (let i = 0; i < needToAdd; i++) {
      itemsToAdd.push({
        itemId: availableWithSN[i].itemId,
        serialNumber: availableWithSN[i].serialNumber || availableWithSN[i].numberPhone
      });
    }
    
    setSelectedItems(itemsToAdd);
  };

  const handleAutoSelect = () => {
    if (!availableItems) return;

    // Auto-select items prioritizing those with serial numbers
    const autoSelected: SelectedItem[] = [];
    
    // First, select items with serial numbers
    for (const item of availableItems.withSerialNumber) {
      if (autoSelected.length < requestedQuantity) {
        autoSelected.push({
          itemId: item.itemId,
          serialNumber: item.serialNumber
        });
      }
    }
    
    // ✅ Then, select items without serial numbers from NEWEST first (reverse order)
    const itemsWithoutSN = [...availableItems.withoutSerialNumber.items].reverse();
    for (const item of itemsWithoutSN) {
      if (autoSelected.length < requestedQuantity) {
        autoSelected.push({
          itemId: item.itemId,
          serialNumber: undefined
        });
      }
    }

    setSelectedItems(autoSelected);
  };

  const isSelected = (uniqueKey: string) => {
    if (uniqueKey.includes('-')) {
      // For items with serial numbers
      const [itemId, serialNumber] = uniqueKey.split('-');
      return selectedItems.some(selected => selected.itemId === itemId && selected.serialNumber === serialNumber);
    } else {
      // For items without serial numbers
      return selectedItems.some(selected => selected.itemId === uniqueKey && !selected.serialNumber);
    }
  };

  const canSelectMore = selectedItems.length < requestedQuantity;
  const isComplete = selectedItems.length === requestedQuantity;

  // Helper functions to get config names from API response
  const getStatusName = (statusId?: string) => {
    if (!statusId || !availableItems?.configs) return '';
    
    // Use configs from API response
    const status = availableItems.configs.statusConfigs.find(s => s.id === statusId);
    if (status) return status.name;
    
    // Fallback to ID if not found
    return statusId;
  };

  const getConditionName = (conditionId?: string) => {
    if (!conditionId || !availableItems?.configs) return '';
    
    // Use configs from API response
    const condition = availableItems.configs.conditionConfigs.find(c => c.id === conditionId);
    if (condition) return condition.name;
    
    // Fallback to ID if not found
    return conditionId;
  };

  if (loading) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    const isSuccess = error.includes('✅');
    return (
      <div className={`p-4 border rounded-lg ${
        isSuccess 
          ? 'border-green-200 bg-green-50' 
          : 'border-red-200 bg-red-50'
      }`}>
        <div className={`flex items-center ${
          isSuccess ? 'text-green-600' : 'text-red-600'
        }`}>
          <AlertCircle className="w-4 h-4 mr-2" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!availableItems) {
    return (
      <div className="p-4 border rounded-lg border-gray-200">
        <div className="text-sm text-gray-500">ไม่พบข้อมูลอุปกรณ์</div>
      </div>
    );
  }

  if (availableItems.totalAvailable === 0) {
    return (
      <div className="p-4 border rounded-lg border-yellow-200 bg-yellow-50">
        <div className="flex items-center text-yellow-600">
          <AlertCircle className="w-4 h-4 mr-2" />
          <span className="text-sm">ไม่มี {itemName} ว่างในคลัง</span>
        </div>
      </div>
    );
  }

  if (availableItems.totalAvailable < requestedQuantity) {
    return (
      <div className="p-4 border rounded-lg border-red-200 bg-red-50">
        <div className="flex items-center text-red-600">
          <AlertCircle className="w-4 h-4 mr-2" />
          <span className="text-sm">
            มี {itemName} ว่างเพียง {availableItems.totalAvailable} ชิ้น แต่ขอ {requestedQuantity} ชิ้น
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 border rounded-lg">
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <span className="font-medium text-sm text-gray-900">{itemName}</span>
          <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-900 rounded">
            {selectedItems.length}/{requestedQuantity}
          </span>
        </div>
        
        <button
          onClick={handleAutoSelect}
          className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
        >
          เลือกอัตโนมัติ
        </button>
      </div>

      {/* Items without Serial Numbers - Show as single row */}
      {availableItems.withoutSerialNumber.count > 0 && (
        <div className="mb-3">
          <div
            className={`p-2 border rounded cursor-pointer transition-colors ${
              selectedItems.some(s => !s.serialNumber)
                ? 'border-blue-500 bg-blue-50'
                : canSelectMore
                ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
            }`}
            onClick={() => {
              if (!availableItems) return;
              
              // Count currently selected items without SN
              const selectedWithoutSN = selectedItems.filter(s => !s.serialNumber).length;
              
              if (selectedWithoutSN > 0) {
                // Remove all items without SN
                setSelectedItems(prev => prev.filter(s => s.serialNumber));
              } else {
                // Add items without SN up to requested quantity
                const itemsToAdd: SelectedItem[] = [];
                const availableWithoutSN = [...availableItems.withoutSerialNumber.items].reverse(); // LIFO - newest first
                
                // ✅ Fix: Calculate how many items without SN we can add
                const selectedWithoutSN = selectedItems.filter(s => !s.serialNumber).length;
                const needToAdd = Math.min(
                  requestedQuantity - selectedWithoutSN, // Only count items without SN
                  availableWithoutSN.length
                );
                
                for (let i = 0; i < needToAdd; i++) {
                  itemsToAdd.push({
                    itemId: availableWithoutSN[i].itemId,
                    serialNumber: undefined
                  });
                }
                
                setSelectedItems(prev => [...prev, ...itemsToAdd]);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedItems.some(s => !s.serialNumber)}
                  readOnly
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2 cursor-pointer"
                />
                <span className="text-sm text-gray-600">
                  อุปกรณ์ไม่มี SN
                </span>
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded">
                  {availableItems.withoutSerialNumber.count} ชิ้น
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {availableItems.withoutSerialNumber.items[0]?.statusId && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                    {getStatusName(availableItems.withoutSerialNumber.items[0].statusId)}
                  </span>
                )}
                {availableItems.withoutSerialNumber.items[0]?.conditionId && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    {getConditionName(availableItems.withoutSerialNumber.items[0].conditionId)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Items with Serial Numbers */}
      {availableItems.withSerialNumber.length > 0 && (
        <div>
          <div className="space-y-1">
            {availableItems.withSerialNumber.map((item) => {
              // ✅ รองรับทั้ง serialNumber และ numberPhone
              const itemIdentifier = item.serialNumber || item.numberPhone;
              const uniqueKey = `${item.itemId}-${itemIdentifier}`;
              
              return (
              <div
                key={uniqueKey}
                className={`p-2 border rounded cursor-pointer transition-colors ${
                  isSelected(uniqueKey)
                    ? 'border-blue-500 bg-blue-50'
                    : canSelectMore
                    ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                }`}
                onClick={() => canSelectMore || isSelected(uniqueKey) ? handleItemSelect(item) : null}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isSelected(uniqueKey)}
                      readOnly
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2 cursor-pointer"
                    />
                    <span className="text-sm font-mono text-blue-600">
                      {itemIdentifier}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {item.statusId && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                        {getStatusName(item.statusId)}
                      </span>
                    )}
                    {item.conditionId && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {getConditionName(item.conditionId)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selection Summary - Compact */}
      {selectedItems.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200">
           <div className="text-xs text-blue-600 font-medium">
             เลือกแล้ว: {selectedItems.length} ชิ้น จาก {requestedQuantity} ชิ้นที่ขอ
           </div>
           {/* Show detailed list only if there are items with serial numbers */}
           {selectedItems.some(item => item.serialNumber) && (
             <div className="text-xs text-gray-600 mt-1">
               รายละเอียด: {(() => {
                 const withSN = selectedItems.filter(item => item.serialNumber);
                 const withoutSN = selectedItems.filter(item => !item.serialNumber);
                 
                 const details = [];
                 if (withSN.length > 0) {
                   // แยกแยะระหว่าง Serial Number และเบอร์โทรศัพท์
                   const serialNumbers = withSN.filter(item => /^[A-Z0-9-]+$/.test(item.serialNumber || ''));
                   const phoneNumbers = withSN.filter(item => /^[0-9]{10}$/.test(item.serialNumber || ''));
                   
                   if (serialNumbers.length > 0) {
                     details.push(serialNumbers.map(item => item.serialNumber).join(', '));
                   }
                   if (phoneNumbers.length > 0) {
                     details.push(`เบอร์ ${phoneNumbers.map(item => item.serialNumber).join(', ')}`);
                   }
                 }
                 if (withoutSN.length > 0) {
                   details.push(`อุปกรณ์ไม่มี SN ${withoutSN.length} ชิ้น`);
                 }
                 
                 return details.join(', ');
               })()}
             </div>
           )}
        </div>
      )}
    </div>
  );
}
