'use client';

import React from 'react';
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

interface DraggableItemProps {
  id: string;
  value: string;
  isEditing: boolean;
  editValue: string;
  onEdit: (index: number) => void;
  onSave: (index: number) => void;
  onCancel: () => void;
  onDelete: (index: number) => void;
  onEditValueChange: (value: string) => void;
  index: number;
}

function DraggableItem({
  id,
  value,
  isEditing,
  editValue,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onEditValueChange,
  index,
}: DraggableItemProps) {
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
      className={`bg-white border border-gray-200 rounded-lg p-3 mb-2 flex items-center gap-3 group hover:shadow-sm transition-all duration-200 ${
        isDragging ? 'shadow-lg border-blue-300 bg-blue-50' : ''
      }`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
      >
        <GripVertical size={18} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
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
          />
        ) : (
          <span className="text-gray-700 text-sm font-medium">{value}</span>
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
            >
              <Edit3 size={16} />
            </button>
            <button
              onClick={() => onDelete(index)}
              className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
              title="ลบ"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface DraggableListProps {
  items: string[];
  onReorder: (newItems: string[]) => void;
  onEdit: (index: number, newValue: string) => void;
  onDelete: (index: number) => void;
  title: string;
  addNewItem: () => void;
  newItemValue: string;
  onNewItemValueChange: (value: string) => void;
  onAddNewItem: () => void;
  editingIndex: number | null;
  editingValue: string;
  onEditingValueChange: (value: string) => void;
  onStartEdit: (index: number) => void;
  onSaveEdit: (index: number) => void;
  onCancelEdit: () => void;
}

export default function DraggableList({
  items,
  onReorder,
  onEdit,
  onDelete,
  title,
  newItemValue,
  onNewItemValueChange,
  onAddNewItem,
  editingIndex,
  editingValue,
  onEditingValueChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: DraggableListProps) {
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
      const oldIndex = items.findIndex(item => item === active.id);
      const newIndex = items.findIndex(item => item === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      onReorder(newItems);
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        {title}
        <span className="text-sm font-normal text-gray-500">
          (ลากเพื่อเรียงลำดับ)
        </span>
      </h3>

      {/* Add New Item */}
      <div className="mb-4 flex gap-2">
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

      {/* Draggable List */}
      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          ไม่มี{title.toLowerCase()}ในระบบ
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <div className="space-y-0">
              {items.map((item, index) => (
                <DraggableItem
                  key={item}
                  id={item}
                  value={item}
                  index={index}
                  isEditing={editingIndex === index}
                  editValue={editingValue}
                  onEdit={onStartEdit}
                  onSave={onSaveEdit}
                  onCancel={onCancelEdit}
                  onDelete={onDelete}
                  onEditValueChange={onEditingValueChange}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
