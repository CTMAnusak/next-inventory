'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function DatePicker({ 
  value, 
  onChange, 
  placeholder = "dd/mm/yyyy", 
  className = "",
  required = false 
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with value or empty for placeholder
  useEffect(() => {
    if (!value) {
      setDisplayValue('');
      setInputValue('');
    } else {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const formattedDate = formatDateForDisplay(date);
        setDisplayValue(formattedDate);
        setInputValue(formattedDate);
      }
    }
  }, [value]);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditing(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatDateForDisplay = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const parseDateFromDisplay = (displayStr: string): Date | null => {
    const parts = displayStr.split('/');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // Month is 0-indexed
    const year = parseInt(parts[2]);
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    
    const date = new Date(year, month, day);
    if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
      return null; // Invalid date
    }
    
    return date;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setInputValue(input);
    
    // Allow typing in dd/mm/yyyy format
    if (input.length <= 10) {
      // Auto-add slashes
      if (input.length === 2 && !input.includes('/')) {
        setInputValue(input + '/');
      } else if (input.length === 5 && input.split('/').length === 2) {
        setInputValue(input + '/');
      }
    }
  };

  const handleInputBlur = () => {
    const parsedDate = parseDateFromDisplay(inputValue);
    if (parsedDate) {
      const formattedDate = formatDateForDisplay(parsedDate);
      setDisplayValue(formattedDate);
      setInputValue(formattedDate);
      onChange(formatDateForInput(parsedDate));
    } else {
      // Reset to current value if invalid
      setInputValue(displayValue);
    }
    setIsEditing(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setInputValue(displayValue);
      setIsEditing(false);
      inputRef.current?.blur();
    }
  };

  const handleDateSelect = (date: Date) => {
    const formattedDate = formatDateForDisplay(date);
    setDisplayValue(formattedDate);
    setInputValue(formattedDate);
    onChange(formatDateForInput(date));
    setIsOpen(false);
    setIsEditing(false);
  };

  const handleTodayClick = () => {
    const today = new Date();
    handleDateSelect(today);
  };

  const handleClearClick = () => {
    setDisplayValue('');
    setInputValue('');
    onChange('');
    setIsOpen(false);
    setIsEditing(false);
  };

  const generateCalendarDays = () => {
    const currentDate = value ? new Date(value) : new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === month;
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = value && date.toDateString() === new Date(value).toDateString();
      
      days.push({
        date,
        isCurrentMonth,
        isToday,
        isSelected
      });
    }
    
    return days;
  };

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const weekDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isEditing ? inputValue : displayValue}
          onChange={handleInputChange}
          onFocus={() => setIsEditing(true)}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 text-gray-900 placeholder-gray-500 ${
            className.includes('border-red-500') 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:ring-blue-500'
          }`}
          required={required}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div
          ref={calendarRef}
          className="absolute z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 min-w-[280px]"
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => {
                const currentDate = value ? new Date(value) : new Date();
                const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
                handleDateSelect(newDate);
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              ‹
            </button>
            <div className="text-center">
              <div className="font-semibold text-gray-900">
                {monthNames[value ? new Date(value).getMonth() : new Date().getMonth()]} {value ? new Date(value).getFullYear() : new Date().getFullYear()}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const currentDate = value ? new Date(value) : new Date();
                const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
                handleDateSelect(newDate);
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              ›
            </button>
          </div>

          {/* Week Days */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {generateCalendarDays().map((day, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleDateSelect(day.date)}
                className={`
                  p-2 text-sm rounded-md transition-colors
                  ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                  ${day.isToday ? 'bg-blue-100 text-blue-900 font-semibold' : ''}
                  ${day.isSelected ? 'bg-blue-600 text-white' : ''}
                  ${!day.isCurrentMonth ? 'cursor-default' : 'hover:bg-gray-100 cursor-pointer'}
                  ${day.isSelected && day.isToday ? 'bg-blue-600 text-white' : ''}
                `}
                disabled={!day.isCurrentMonth}
              >
                {day.date.getDate()}
              </button>
            ))}
          </div>

          {/* Calendar Footer */}
          <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={handleTodayClick}
              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
            >
              วันนี้
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClearClick}
                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                ล้าง
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
