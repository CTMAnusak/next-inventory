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
import { GripVertical, Edit3, Trash2, Check, X } from 'lucide-react';

interface ICategoryConfig {
  id: string;
  name: string;
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
  onEdit: (categoryId: string) => void;
  onSave: (categoryId: string) => void;
  onCancel: () => void;
  onDelete: (categoryId: string) => void;
  onEditValueChange: (value: string) => void;
  index: number;
  showBackgroundColors?: boolean;
}

function CategoryItem({
  id,
  config,
  isEditing,
  editValue,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onEditValueChange,
  index,
  showBackgroundColors = false,
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

  // Always use white background and gray border
  const getBackgroundColor = () => '#ffffff';
  const getBorderColor = () => 'border-gray-200';

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: getBackgroundColor() }}
      className={`border ${getBorderColor()} rounded-lg p-3 mb-1 flex items-center gap-3 group hover:shadow-sm transition-all duration-200 ${
        isDragging ? 'shadow-lg border-blue-300' : ''
      }`}
    >
      {/* Drag Handle */}
      <div
        {...(config.id !== 'cat_unassigned' && config.id !== 'cat_sim_card' ? attributes : {})}
        {...(config.id !== 'cat_unassigned' && config.id !== 'cat_sim_card' ? listeners : {})}
        className={`flex-shrink-0 transition-colors ${
          (config.id === 'cat_unassigned' || config.id === 'cat_sim_card')
            ? 'cursor-not-allowed text-gray-300' 
            : 'cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600'
        }`}
      >
        <GripVertical size={18} />
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
                if (e.key === 'Enter') onSave(id);
                if (e.key === 'Escape') onCancel();
              }}
              autoFocus
              disabled={config.isSystemCategory}
            />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {index + 1}. {String(config.name || '')}
            </span>
            {config.isSystemCategory && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded ml-2">
                {config.id === 'cat_unassigned' || config.id === 'cat_sim_card' ? 'ระบบ (ไม่สามารถย้ายได้)' : 'ระบบ'}
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
              onClick={() => onSave(id)}
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
              onClick={() => onEdit(id)}
              className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-all"
              title="แก้ไข"
            >
              <Edit3 size={16} />
            </button>
            {!config.isSystemCategory && (
              <button
                onClick={() => onDelete(id)}
                className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-all"
                title="ลบ"
              >
                <Trash2 size={16} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface CategoryConfigListProps {
  categoryConfigs: ICategoryConfig[];
  onReorder: (newConfigs: ICategoryConfig[]) => void;
  onEdit: (categoryId: string, updates: Partial<ICategoryConfig>) => void;
  onDelete: (categoryId: string) => void;
  title: string;
  newItemValue: string;
  onNewItemValueChange: (value: string) => void;
  onAddNewItem: () => void;
  editingCategoryId: string | null;
  editingValue: string;
  onEditingValueChange: (value: string) => void;
  onStartEdit: (categoryId: string) => void;
  onSaveEdit: (categoryId: string) => void;
  onCancelEdit: () => void;
  showBackgroundColors?: boolean;
}

export default function CategoryConfigList({
  categoryConfigs,
  onReorder,
  onEdit,
  onDelete,
  title,
  newItemValue,
  onNewItemValueChange,
  onAddNewItem,
  editingCategoryId,
  editingValue,
  onEditingValueChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  showBackgroundColors = false,
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
      // Work with the same list used for rendering to keep indices aligned
      const sourceList = sortedConfigs;
      const oldIndex = sourceList.findIndex(config => config.id === active.id);
      const newIndex = sourceList.findIndex(config => config.id === over.id);
      
      // Prevent moving locked categories from their position
      if (active.id === 'cat_unassigned' || active.id === 'cat_sim_card') {
        return; // Don't allow moving "ไม่ระบุ"
      }
      
      // Prevent moving other items to the position of locked categories
      if (over.id === 'cat_unassigned' || over.id === 'cat_sim_card') {
        return; // Don't allow moving to locked positions
      }
      
      const newConfigsSorted = arrayMove(sourceList, oldIndex, newIndex);
      
      // Update order values and ensure proper serialization
      const reorderedConfigs = newConfigsSorted.map((config, index) => ({
        id: String(config.id),
        name: String(config.name || ''),
        isSystemCategory: Boolean(config.isSystemCategory),
        order: config.id === 'cat_unassigned' ? 999 : index + 1, // Keep "ไม่ระบุ" at order 999
        createdAt: config.createdAt ? new Date(config.createdAt) : new Date(),
        updatedAt: new Date()
      }));
      
      onReorder(reorderedConfigs);
    }
  }

  // Sort categories by order, with "ไม่ระบุ" always at the bottom
  const sortedConfigs = categoryConfigs && Array.isArray(categoryConfigs) 
    ? [...categoryConfigs]
        .filter(config => config && typeof config === 'object' && config.id)
        .sort((a, b) => {
          // "ไม่ระบุ" (cat_unassigned) always goes to the bottom
          if (a.id === 'cat_unassigned' && b.id !== 'cat_unassigned') return 1;
          if (a.id !== 'cat_unassigned' && b.id === 'cat_unassigned') return -1;
          
          // "ซิมการ์ด" (cat_sim_card) is always just above "ไม่ระบุ"
          if (a.id === 'cat_sim_card' && b.id !== 'cat_unassigned') return 1;
          if (a.id !== 'cat_unassigned' && b.id === 'cat_sim_card') return -1;
          
          // Other system categories go after regular categories
          if (a.isSystemCategory && !b.isSystemCategory && a.id !== 'cat_unassigned') return 1;
          if (!a.isSystemCategory && b.isSystemCategory && b.id !== 'cat_unassigned') return -1;
          
          return (a.order || 0) - (b.order || 0);
        })
        .map(config => ({
          id: String(config.id),
          name: String(config.name || ''),
          isSystemCategory: Boolean(config.isSystemCategory),
          order: Number(config.order || 0),
          createdAt: config.createdAt ? new Date(config.createdAt) : new Date(),
          updatedAt: config.updatedAt ? new Date(config.updatedAt) : new Date()
        }))
    : [];

  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          {title}
          <span className="text-xs font-normal text-gray-400">
            (ลากเพื่อเรียงลำดับ)
          </span>
        </h3>
      )}

      {/* Add New Item */}
      <div className="mb-3 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemValue}
            onChange={(e) => onNewItemValueChange(e.target.value)}
            placeholder="เพิ่มหมวดหมู่ใหม่"
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
        
      </div>

      {/* Category List */}
      {!sortedConfigs || sortedConfigs.length === 0 ? (
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First Column */}
              <div className="space-y-1">
                {sortedConfigs.slice(0, Math.ceil(sortedConfigs.length / 2)).map((config, index) => {
                  if (!config || !config.id) {
                    return null;
                  }
                  const actualIndex = index; // First column uses direct index
                  return (
                    <CategoryItem
                      key={config.id}
                      id={config.id}
                      config={config}
                      index={actualIndex}
                      isEditing={editingCategoryId === config.id}
                      editValue={editingValue}
                      onEdit={(categoryId) => onStartEdit(categoryId)}
                      onSave={(categoryId) => onSaveEdit(categoryId)}
                      onCancel={onCancelEdit}
                      onDelete={(categoryId) => onDelete(categoryId)}
                      onEditValueChange={onEditingValueChange}
                      showBackgroundColors={showBackgroundColors}
                    />
                  );
                })}
              </div>
              
              {/* Second Column */}
              <div className="space-y-1">
                {sortedConfigs.slice(Math.ceil(sortedConfigs.length / 2)).map((config, index) => {
                  if (!config || !config.id) {
                    return null;
                  }
                  const actualIndex = Math.ceil(sortedConfigs.length / 2) + index;
                  return (
                    <CategoryItem
                      key={config.id}
                      id={config.id}
                      config={config}
                      index={actualIndex}
                      isEditing={editingCategoryId === config.id}
                      editValue={editingValue}
                      onEdit={(categoryId) => onStartEdit(categoryId)}
                      onSave={(categoryId) => onSaveEdit(categoryId)}
                      onCancel={onCancelEdit}
                      onDelete={(categoryId) => onDelete(categoryId)}
                      onEditValueChange={onEditingValueChange}
                      showBackgroundColors={showBackgroundColors}
                    />
                  );
                })}
              </div>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
