'use client';

import React, { useState, useEffect, useMemo } from 'react';
import VirtualScrollList from '@/components/VirtualScrollList';
import LazyLoad from '@/components/LazyLoad';
import PerformanceMonitor from '@/components/PerformanceMonitor';

interface InventoryItem {
  _id: string;
  itemName: string;
  categoryId: string;
  totalQuantity: number;
  quantity: number;
  serialNumbers: string[];
  dateAdded: string;
  status: string;
  hasSerialNumber: boolean;
  userOwnedQuantity: number;
}

interface OptimizedInventoryListProps {
  items: InventoryItem[];
  loading: boolean;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  className?: string;
}

export default function OptimizedInventoryList({
  items,
  loading,
  onEdit,
  onDelete,
  className = ''
}: OptimizedInventoryListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Memoized filtered items for performance
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !categoryFilter || item.categoryId === categoryFilter;
      const matchesStatus = !statusFilter || item.status === statusFilter;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, searchTerm, categoryFilter, statusFilter]);

  // Render individual inventory item
  const renderInventoryItem = (item: InventoryItem, index: number) => (
    <LazyLoad
      key={item._id}
      threshold={0.1}
      fallback={
        <div className="animate-pulse bg-gray-200 h-16 rounded-lg"></div>
      }
    >
      <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">{item.itemName}</h3>
            <p className="text-sm text-gray-500">
              Total: {item.totalQuantity} | Available: {item.quantity} | User Owned: {item.userOwnedQuantity}
            </p>
            {item.hasSerialNumber && (
              <p className="text-xs text-blue-600">Has Serial Numbers</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs rounded-full ${
              item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {item.status}
            </span>
            <button
              onClick={() => onEdit(item)}
              className="p-1 text-blue-600 hover:text-blue-800"
              title="Edit"
            >
              ✏️
            </button>
            <button
              onClick={() => onDelete(item)}
              className="p-1 text-red-600 hover:text-red-800"
              title="Delete"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </LazyLoad>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <PerformanceMonitor
      componentName="OptimizedInventoryList"
      enableLogging={true}
      logThreshold={50}
    >
      <div className={`space-y-4 ${className}`}>
        {/* Search and Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {/* Add category options here */}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-600">
          Showing {filteredItems.length} of {items.length} items
        </div>

        {/* Virtual Scrolled List */}
        <VirtualScrollList
          items={filteredItems}
          itemHeight={80} // Height of each item
          containerHeight={600} // Height of visible container
          renderItem={renderInventoryItem}
          overscan={5} // Render 5 extra items outside visible area
          className="bg-gray-50 rounded-lg p-2"
        />
      </div>
    </PerformanceMonitor>
  );
}
