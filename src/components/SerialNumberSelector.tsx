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

      {/* Items without Serial Numbers */}
      {availableItems.withoutSerialNumber.count > 0 && (
        <div className="mb-3">
          <div className="space-y-1">
            {availableItems.withoutSerialNumber.items.map((item, index) => (
              <div
                key={item.itemId}
                className={`p-2 border rounded cursor-pointer transition-colors ${
                  isSelected(item.itemId)
                    ? 'border-blue-500 bg-blue-50'
                    : canSelectMore
                    ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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
                    <span className="text-sm text-gray-600">
                      ชิ้นที่ {item.displayIndex || index + 1}
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
            ))}
          </div>
        </div>
      )}

      {/* Items with Serial Numbers */}
      {availableItems.withSerialNumber.length > 0 && (
        <div>
          <div className="space-y-1">
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
                      {item.serialNumber || item.numberPhone}
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
            ))}
          </div>
        </div>
      )}

      {/* Selection Summary - Compact */}
      {selectedItems.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-600">
            เลือกแล้ว: {selectedItems.map((item, index) => 
              item.serialNumber || `ชิ้นที่ ${index + 1}`
            ).join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}
