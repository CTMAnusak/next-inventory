'use client';

import { useState, useEffect } from 'react';
import { Package, Hash, Calendar, User, CheckCircle, AlertCircle } from 'lucide-react';

interface AvailableItem {
  itemId: string;
  serialNumber?: string;
  status: string;
  dateAdded: string;
  addedBy: string;
  isVirtual?: boolean;
  displayIndex?: number;
}

interface AvailableItemsResponse {
  itemName: string;
  category: string;
  totalAvailable: number;
  withSerialNumber: AvailableItem[];
  withoutSerialNumber: {
    count: number;
    items: AvailableItem[];
    hasMore: boolean;
  };
}

interface SelectedItem {
  itemId: string;
  serialNumber?: string;
}

interface SerialNumberSelectorProps {
  itemName: string;
  category: string;
  requestedQuantity: number;
  requestedSerialNumbers?: string[]; // SN ที่ user เจาะจงมา
  onSelectionChange: (selectedItems: SelectedItem[]) => void;
}

export default function SerialNumberSelector({
  itemName,
  category,
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
  }, [itemName, category]);

  // Auto-select requested serial numbers when available items are loaded
  useEffect(() => {
    if (availableItems && requestedSerialNumbers && requestedSerialNumbers.length > 0) {
      autoSelectRequestedSerialNumbers();
    }
  }, [availableItems, requestedSerialNumbers]);

  useEffect(() => {
    onSelectionChange(selectedItems);
  }, [selectedItems, onSelectionChange]);

  const fetchAvailableItems = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams({
        itemName,
        category
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
    const uniqueKey = item.serialNumber ? `${item.itemId}-${item.serialNumber}` : item.itemId;
    const itemToAdd: SelectedItem = {
      itemId: item.itemId,
      serialNumber: item.serialNumber
    };

    setSelectedItems(prev => {
      // Check if already selected (by unique key for SN items, by itemId for non-SN items)
      const isAlreadySelected = item.serialNumber 
        ? prev.some(selected => selected.itemId === item.itemId && selected.serialNumber === item.serialNumber)
        : prev.some(selected => selected.itemId === item.itemId && !selected.serialNumber);

      if (isAlreadySelected) {
        // Remove if already selected
        return item.serialNumber
          ? prev.filter(selected => !(selected.itemId === item.itemId && selected.serialNumber === item.serialNumber))
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
        item => item.serialNumber === requestedSN
      );

      if (availableItem) {
        itemsToSelect.push({
          itemId: availableItem.itemId,
          serialNumber: availableItem.serialNumber
        });
      } else {
        unavailableSerialNumbers.push(requestedSN);
      }
    }

    // Set selected items
    setSelectedItems(itemsToSelect);

    // Show status messages
    if (unavailableSerialNumbers.length > 0) {
      setError(`⚠️ Serial Numbers ที่ไม่พบในคลัง: ${unavailableSerialNumbers.join(', ')}`);
    } else if (itemsToSelect.length > 0) {
      setError(`✅ ล็อค Serial Numbers แล้ว: ${itemsToSelect.map(item => item.serialNumber).join(', ')}`);
    } else {
      setError(''); // Clear any previous errors
    }
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
    
    // Then, select items without serial numbers if needed
    for (const item of availableItems.withoutSerialNumber.items) {
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
    <div className="p-4 border rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Package className="w-4 h-4 mr-2 text-blue-600" />
          <span className="font-medium text-sm text-gray-900">{itemName}</span>
          <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-900 rounded font-medium">
            เลือก {selectedItems.length}/{requestedQuantity}
          </span>
        </div>
        
        {isComplete && (
          <div className="flex items-center text-green-600">
            <CheckCircle className="w-4 h-4 mr-1" />
            <span className="text-xs">เลือกครบแล้ว</span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mb-3">
        <button
          onClick={handleAutoSelect}
          className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium"
        >
          เลือกอัตโนมัติ
        </button>
        {selectedItems.length > 0 && (
          <button
            onClick={() => setSelectedItems([])}
            className="ml-2 px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            ล้างการเลือก
          </button>
        )}
      </div>

      {/* Items with Serial Numbers */}
      {availableItems.withSerialNumber.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
            <Hash className="w-3 h-3 mr-1" />
            อุปกรณ์ที่มี Serial Number ({availableItems.withSerialNumber.length} ชิ้น)
          </h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
            {availableItems.withSerialNumber.map((item) => (
              <div
                key={`${item.itemId}-${item.serialNumber}`}
                className={`p-2 border rounded cursor-pointer transition-colors ${
                  isSelected(`${item.itemId}-${item.serialNumber}`)
                    ? 'border-blue-500 bg-blue-50'
                    : canSelectMore
                    ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                }`}
                onClick={() => canSelectMore || isSelected(`${item.itemId}-${item.serialNumber}`) ? handleItemSelect(item) : null}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded border mr-2 ${
                      isSelected(`${item.itemId}-${item.serialNumber}`)
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300'
                    }`}>
                      {isSelected(`${item.itemId}-${item.serialNumber}`) && (
                        <CheckCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-sm font-mono text-blue-600">
                      {item.serialNumber}
                    </span>
                  </div>
                  <div className="flex items-center text-xs text-gray-500">
                    <User className="w-3 h-3 mr-1" />
                    {item.addedBy === 'admin' ? 'Admin' : 'User'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items without Serial Numbers */}
      {availableItems.withoutSerialNumber.count > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            อุปกรณ์ที่ไม่มี Serial Number ({availableItems.withoutSerialNumber.count} ชิ้น)
          </h4>
          <div className="space-y-1">
            {availableItems.withoutSerialNumber.items.map((item, index) => (
              <div
                key={item.itemId}
                className={`p-2 border rounded cursor-pointer transition-colors ${
                  isSelected(item.itemId)
                    ? 'border-blue-500 bg-blue-50'
                    : canSelectMore
                    ? item.isVirtual 
                      ? 'border-purple-200 hover:border-purple-300 hover:bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                }`}
                onClick={() => canSelectMore || isSelected(item.itemId) ? handleItemSelect(item) : null}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded border mr-2 ${
                      isSelected(item.itemId)
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300'
                    }`}>
                      {isSelected(item.itemId) && (
                        <CheckCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className={`text-sm ${item.isVirtual ? 'text-purple-600' : 'text-gray-600'}`}>
                      ชิ้นที่ {item.displayIndex || index + 1} (ไม่มี SN) {item.isVirtual ? '[Virtual]' : ''}
                    </span>
                  </div>
                  <div className="flex items-center text-xs text-gray-500">
                    <Calendar className="w-3 h-3 mr-1" />
                    {new Date(item.dateAdded).toLocaleDateString('th-TH')}
                  </div>
                </div>
              </div>
            ))}
            {availableItems.withoutSerialNumber.hasMore && (
              <div className="text-xs text-gray-500 text-center py-1">
                และอีก {availableItems.withoutSerialNumber.count - availableItems.withoutSerialNumber.items.length} ชิ้น
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selection Summary */}
      {selectedItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-600 mb-1">รายการที่เลือก:</div>
          <div className="flex flex-wrap gap-1">
            {selectedItems.map((item, index) => (
              <span
                key={item.itemId}
                className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
              >
                {item.serialNumber || `ชิ้นที่ ${index + 1}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
