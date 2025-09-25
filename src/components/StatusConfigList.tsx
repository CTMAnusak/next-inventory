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

interface IStatusConfig {
  id: string;
  name: string;
  order: number;
  isSystemConfig?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface StatusItemProps {
  id: string;
  config: IStatusConfig;
  isEditing: boolean;
  editValue: string;
  onEdit: (index: number) => void;
  onSave: (index: number) => void;
  onCancel: () => void;
  onDelete: (index: number) => void;
  onEditValueChange: (value: string) => void;
  index: number;
}

function StatusItem({
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
}: StatusItemProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border border-gray-200 rounded-lg p-3 mb-1 flex items-center gap-3 group hover:shadow-sm transition-all duration-200 bg-white ${
        isDragging ? 'shadow-lg border-blue-300' : ''
      }`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0"
      >
        <GripVertical size={18} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ชื่อสถานะ"
              autoFocus
            />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 truncate">
              {index + 1}. {config.name}
            </span>
            {config.isSystemConfig && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded ml-2">
                ระบบ
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {isEditing ? (
          <>
            <button
              onClick={() => onSave(index)}
              className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
              title="บันทึก"
            >
              <Check size={16} />
            </button>
            <button
              onClick={onCancel}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
              title="ยกเลิก"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onEdit(index)}
              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
              title="แก้ไข"
            >
              <Edit3 size={16} />
            </button>
            {!config.isSystemConfig && (
              <button
                onClick={() => onDelete(index)}
                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
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

interface StatusConfigListProps {
  statusConfigs: IStatusConfig[];
  onReorder: (newConfigs: IStatusConfig[]) => void;
  onEdit: (index: number, newConfig: IStatusConfig) => void;
  onDelete: (index: number) => void;
  title: string;
}

export default function StatusConfigList({
  statusConfigs,
  onReorder,
  onEdit,
  onDelete,
  title
}: StatusConfigListProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

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

  // Sort by order for consistent display
  const sortedConfigs = [...statusConfigs].sort((a, b) => a.order - b.order);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = sortedConfigs.findIndex((config) => config.id === active.id);
      const newIndex = sortedConfigs.findIndex((config) => config.id === over?.id);
      
      const newConfigs = arrayMove(sortedConfigs, oldIndex, newIndex);
      
      // Update order values and ensure proper serialization
      const reorderedConfigs = newConfigs.map((config, index) => ({
        id: String(config.id),
        name: String(config.name || ''),
        order: index + 1,
        createdAt: config.createdAt || new Date(),
        updatedAt: new Date()
      }));
      
      onReorder(reorderedConfigs);
    }
  }

  const handleEdit = (index: number) => {
    const config = sortedConfigs[index];
    setEditingIndex(index);
    setEditValue(config.name);
  };

  const handleSave = (index: number) => {
    if (editValue.trim()) {
      const config = sortedConfigs[index];
      const newConfig = {
        ...config,
        name: editValue.trim(),
        updatedAt: new Date()
      };
      onEdit(index, newConfig);
    }
    setEditingIndex(null);
    setEditValue('');
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const handleDelete = (index: number) => {
    onDelete(index);
  };

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <span className="text-sm text-gray-500">{sortedConfigs.length} รายการ</span>
        </div>
      )}

      {sortedConfigs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>ยังไม่มีสถานะ</p>
          <p className="text-sm mt-1">เพิ่มสถานะใหม่ด้านล่าง</p>
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
                  const actualIndex = index; // First column uses direct index
                  return (
                    <StatusItem
                      key={config.id}
                      id={config.id}
                      config={config}
                      index={actualIndex}
                      isEditing={editingIndex === actualIndex}
                      editValue={editValue}
                      onEdit={handleEdit}
                      onSave={handleSave}
                      onCancel={handleCancel}
                      onDelete={handleDelete}
                      onEditValueChange={setEditValue}
                    />
                  );
                })}
              </div>
              
              {/* Second Column */}
              <div className="space-y-1">
                {sortedConfigs.slice(Math.ceil(sortedConfigs.length / 2)).map((config, index) => {
                  const actualIndex = Math.ceil(sortedConfigs.length / 2) + index;
                  return (
                    <StatusItem
                      key={config.id}
                      id={config.id}
                      config={config}
                      index={actualIndex}
                      isEditing={editingIndex === actualIndex}
                      editValue={editValue}
                      onEdit={handleEdit}
                      onSave={handleSave}
                      onCancel={handleCancel}
                      onDelete={handleDelete}
                      onEditValueChange={setEditValue}
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
