'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';

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
  placeholder = "dd/mm/yyyy (พ.ศ.)", 
  className = "",
  required = false 
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentViewDate, setCurrentViewDate] = useState(() => {
    return value ? new Date(value) : new Date();
  });
  const calendarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with value or empty for placeholder
  useEffect(() => {
    if (!value) {
      setDisplayValue('');
      setInputValue('');
      setCurrentViewDate(new Date());
    } else {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const formattedDate = formatDateForDisplay(date);
        setDisplayValue(formattedDate);
        setInputValue(formattedDate);
        setCurrentViewDate(new Date(date));
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
    const year = date.getFullYear() + 543; // แปลงเป็น พ.ศ.
    return `${day}/${month}/${year}`;
  };

  const formatDateForInput = (date: Date): string => {
    // Use local date to avoid timezone issues
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDateFromDisplay = (displayStr: string): Date | null => {
    const parts = displayStr.split('/');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // Month is 0-indexed
    const buddhist_year = parseInt(parts[2]);
    
    if (isNaN(day) || isNaN(month) || isNaN(buddhist_year)) return null;
    
    // แปลง พ.ศ. เป็น ค.ศ.
    const gregorian_year = buddhist_year - 543;
    const date = new Date(gregorian_year, month, day);
    if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== gregorian_year) {
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
    setCurrentViewDate(new Date(today));
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
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    
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

  // Navigation functions
  const navigateToPreviousMonth = () => {
    setCurrentViewDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  const navigateToNextMonth = () => {
    setCurrentViewDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  const navigateToPreviousYear = () => {
    setCurrentViewDate(prev => {
      const newDate = new Date(prev);
      newDate.setFullYear(prev.getFullYear() - 1);
      return newDate;
    });
  };

  const navigateToNextYear = () => {
    setCurrentViewDate(prev => {
      const newDate = new Date(prev);
      newDate.setFullYear(prev.getFullYear() + 1);
      return newDate;
    });
  };

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
          className="absolute z-[9999] mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 min-w-[320px]"
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            {/* Year Navigation */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={navigateToPreviousYear}
                className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-800 transition-colors"
                title="ปีก่อนหน้า"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[3rem] text-center">
                {currentViewDate.getFullYear() + 543}
              </span>
              <button
                type="button"
                onClick={navigateToNextYear}
                className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-800 transition-colors"
                title="ปีถัดไป"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={navigateToPreviousMonth}
                className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-800 transition-colors"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-semibold text-gray-900 text-lg min-w-[6rem] text-center">
                {monthNames[currentViewDate.getMonth()]}
              </span>
              <button
                type="button"
                onClick={navigateToNextMonth}
                className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-800 transition-colors"
                title="เดือนถัดไป"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
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
              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              วันนี้
            </button>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setCurrentViewDate(new Date())}
                className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors"
              >
                เดือนนี้
              </button>
              {value && (
                <button
                  type="button"
                  onClick={handleClearClick}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-1 transition-colors"
                >
                  <X className="h-3 w-3" />
                  ล้าง
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
