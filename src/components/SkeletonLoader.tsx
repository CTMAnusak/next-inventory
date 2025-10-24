import React from 'react';

interface SkeletonProps {
  className?: string;
  height?: string;
  width?: string;
  rounded?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  height = 'h-4', 
  width = 'w-full', 
  rounded = true 
}) => {
  return (
    <div 
      className={`bg-gray-200 animate-pulse ${height} ${width} ${rounded ? 'rounded' : ''} ${className}`}
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 6 
}) => {
  return (
    <div className="space-y-3">
      {/* Header skeleton */}
      <div className="flex space-x-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width="w-24" height="h-6" />
        ))}
      </div>
      
      {/* Rows skeleton */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} width="w-24" height="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="space-y-3">
            <Skeleton height="h-6" width="w-3/4" />
            <Skeleton height="h-4" width="w-1/2" />
            <Skeleton height="h-4" width="w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const InventoryTableSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Skeleton height="h-8" width="w-48" />
          <div className="flex space-x-2">
            <Skeleton height="h-10" width="w-24" />
            <Skeleton height="h-10" width="w-24" />
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex space-x-4 mb-6">
          <Skeleton height="h-10" width="w-64" />
          <Skeleton height="h-10" width="w-32" />
          <Skeleton height="h-10" width="w-32" />
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                {Array.from({ length: 8 }).map((_, i) => (
                  <th key={i} className="px-4 py-3 text-left">
                    <Skeleton height="h-4" width="w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b">
                  {Array.from({ length: 8 }).map((_, colIndex) => (
                    <td key={colIndex} className="px-4 py-3">
                      <Skeleton height="h-4" width="w-16" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="flex justify-between items-center mt-6">
          <Skeleton height="h-4" width="w-32" />
          <div className="flex space-x-2">
            <Skeleton height="h-8" width="w-8" />
            <Skeleton height="h-8" width="w-8" />
            <Skeleton height="h-8" width="w-8" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const EquipmentTrackingSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Skeleton height="h-8" width="w-64" />
          <Skeleton height="h-10" width="w-32" />
        </div>
        
        {/* Search and Filters */}
        <div className="flex space-x-4 mb-6">
          <Skeleton height="h-10" width="w-80" />
          <Skeleton height="h-10" width="w-32" />
          <Skeleton height="h-10" width="w-32" />
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                {Array.from({ length: 10 }).map((_, i) => (
                  <th key={i} className="px-4 py-3 text-left">
                    <Skeleton height="h-4" width="w-24" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 15 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b">
                  {Array.from({ length: 10 }).map((_, colIndex) => (
                    <td key={colIndex} className="px-4 py-3">
                      <Skeleton height="h-4" width="w-20" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="flex justify-between items-center mt-6">
          <Skeleton height="h-4" width="w-40" />
          <div className="flex space-x-2">
            <Skeleton height="h-8" width="w-8" />
            <Skeleton height="h-8" width="w-8" />
            <Skeleton height="h-8" width="w-8" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const PendingSummarySkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="space-y-3">
              <Skeleton height="h-6" width="w-3/4" />
              <Skeleton height="h-8" width="w-1/2" />
              <Skeleton height="h-4" width="w-2/3" />
            </div>
          </div>
        ))}
      </div>
      
      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border">
            <div className="p-6">
              <Skeleton height="h-6" width="w-48" className="mb-4" />
              <TableSkeleton rows={5} columns={4} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
