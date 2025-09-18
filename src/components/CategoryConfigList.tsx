'use client';

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit3, Trash2, Check, X, Shield, AlertTriangle } from 'lucide-react';

interface ICategoryConfig {
  id: string;
  name: string;
  isSpecial: boolean;
  isSystemCategory: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CategoryItemProps {
  id: string;
  config: ICategoryConfig;
  isEditing: boolean;
  editValue: string;
  editIsSpecial: boolean;
  onEdit: (index: number) => void;
  onSave: (index: number) => void;
  onCancel: () => void;
  onDelete: (index: number) => void;
  onEditValueChange: (value: string) => void;
  onEditSpecialChange: (isSpecial: boolean) => void;
  index: number;
}

function CategoryItem({
  id,
  config,
  isEditing,
  editValue,
  editIsSpecial,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onEditValueChange,
  onEditSpecialChange,
  index,
}: CategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  // Determine background color
  const getBackgroundColor = () => {
    if (config.isSystemCategory) return '#fef3c7'; // Yellow for system categories
    if (config.isSpecial) return '#fed7aa'; // Orange for special categories
    return '#ffffff'; // White for normal categories
  };

  const getBorderColor = () => {
    if (config.isSystemCategory) return 'border-yellow-200';
    if (config.isSpecial) return 'border-orange-200';
    return 'border-gray-200';
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: getBackgroundColor() }}
      className={`border ${getBorderColor()} rounded-lg p-3 mb-2 flex items-center gap-3 group hover:shadow-sm transition-all duration-200 ${
        isDragging ? 'shadow-lg border-blue-300' : ''
      } ${config.isSystemCategory ? 'border-dashed' : ''}`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
      >
        <GripVertical size={18} />
      </div>

      {/* Icon */}
      <div className="flex-shrink-0">
        {config.isSystemCategory ? (
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
        ) : config.isSpecial ? (
          <Shield className="w-4 h-4 text-orange-600" />
        ) : (
          <div className="w-4 h-4" /> // Placeholder for alignment
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave(index);
                if (e.key === 'Escape') onCancel();
              }}
              autoFocus
              disabled={config.isSystemCategory}
            />
            {!config.isSystemCategory && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editIsSpecial}
                  onChange={(e) => onEditSpecialChange(e.target.checked)}
                  className="rounded"
                />
                <span className="text-gray-700">หมวดหมู่พิเศษ</span>
                <span className="text-xs text-gray-500">(ต้องยืนยันการลบ 2 ขั้นตอน)</span>
              </label>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${
              config.isSystemCategory ? 'text-yellow-800' : 
              config.isSpecial ? 'text-orange-800' : 'text-gray-700'
            }`}>
              {config.name}
            </span>
            {config.isSpecial && !config.isSystemCategory && (
              <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded">
                พิเศษ
              </span>
            )}
            {config.isSystemCategory && (
              <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                ระบบ
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-1">
        {isEditing ? (
          <>
            <button
              onClick={() => onSave(index)}
              className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-all"
              title="บันทึก"
            >
              <Check size={16} />
            </button>
            <button
              onClick={onCancel}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-all"
              title="ยกเลิก"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onEdit(index)}
              className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-all"
              title="แก้ไข"
              disabled={config.isSystemCategory && config.name === 'ไม่ระบุ'}
            >
              <Edit3 size={16} />
            </button>
            <button
              onClick={() => onDelete(index)}
              className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
              title="ลบ"
              disabled={config.isSystemCategory}
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface CategoryConfigListProps {
  categoryConfigs: ICategoryConfig[];
  onReorder: (newConfigs: ICategoryConfig[]) => void;
  onEdit: (index: number, updates: Partial<ICategoryConfig>) => void;
  onDelete: (index: number) => void;
  title: string;
  newItemValue: string;
  newItemIsSpecial: boolean;
  onNewItemValueChange: (value: string) => void;
  onNewItemSpecialChange: (isSpecial: boolean) => void;
  onAddNewItem: () => void;
  editingIndex: number | null;
  editingValue: string;
  editingIsSpecial: boolean;
  onEditingValueChange: (value: string) => void;
  onEditingSpecialChange: (isSpecial: boolean) => void;
  onStartEdit: (index: number) => void;
  onSaveEdit: (index: number) => void;
  onCancelEdit: () => void;
}

export default function CategoryConfigList({
  categoryConfigs,
  onReorder,
  onEdit,
  onDelete,
  title,
  newItemValue,
  newItemIsSpecial,
  onNewItemValueChange,
  onNewItemSpecialChange,
  onAddNewItem,
  editingIndex,
  editingValue,
  editingIsSpecial,
  onEditingValueChange,
  onEditingSpecialChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: CategoryConfigListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categoryConfigs.findIndex(config => config.id === active.id);
      const newIndex = categoryConfigs.findIndex(config => config.id === over.id);
      const newConfigs = arrayMove(categoryConfigs, oldIndex, newIndex);
      
      // Update order values
      const reorderedConfigs = newConfigs.map((config, index) => ({
        ...config,
        order: index + 1,
        updatedAt: new Date()
      }));
      
      onReorder(reorderedConfigs);
    }
  }

  // Sort categories by order, with system categories at the bottom
  const sortedConfigs = [...categoryConfigs].sort((a, b) => {
    if (a.isSystemCategory && !b.isSystemCategory) return 1;
    if (!a.isSystemCategory && b.isSystemCategory) return -1;
    return a.order - b.order;
  });

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        {title}
        <span className="text-sm font-normal text-gray-500">
          (ลากเพื่อเรียงลำดับ)
        </span>
      </h3>

      {/* Add New Item */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemValue}
            onChange={(e) => onNewItemValueChange(e.target.value)}
            placeholder={`เพิ่ม${title.toLowerCase()}ใหม่`}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newItemValue.trim()) {
                onAddNewItem();
              }
            }}
          />
          <button
            onClick={onAddNewItem}
            disabled={!newItemValue.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            เพิ่ม
          </button>
        </div>
        
        <label className="flex items-center gap-2 text-sm pl-1">
          <input
            type="checkbox"
            checked={newItemIsSpecial}
            onChange={(e) => onNewItemSpecialChange(e.target.checked)}
            className="rounded"
          />
          <span className="text-gray-700">หมวดหมู่พิเศษ</span>
          <span className="text-xs text-gray-500">(ต้องยืนยันการลบ 2 ขั้นตอน)</span>
        </label>
      </div>

      {/* Category List */}
      {sortedConfigs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          ไม่มี{title.toLowerCase()}ในระบบ
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={sortedConfigs.map(config => config.id)} 
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0">
              {sortedConfigs.map((config, index) => (
                <CategoryItem
                  key={config.id}
                  id={config.id}
                  config={config}
                  index={index}
                  isEditing={editingIndex === index}
                  editValue={editingValue}
                  editIsSpecial={editingIsSpecial}
                  onEdit={onStartEdit}
                  onSave={onSaveEdit}
                  onCancel={onCancelEdit}
                  onDelete={onDelete}
                  onEditValueChange={onEditingValueChange}
                  onEditSpecialChange={onEditingSpecialChange}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
