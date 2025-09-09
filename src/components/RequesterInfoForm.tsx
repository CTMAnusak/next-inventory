'use client';

import { useAuth } from '@/contexts/AuthContext';

interface RequesterInfoFormProps {
  formData: {
    firstName: string;
    lastName: string;
    nickname: string;
    department: string;
    phone: string;
    office: string;
    email?: string;
  };
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showEmail?: boolean;
  title?: string;
}

export default function RequesterInfoForm({ formData, onInputChange, showEmail = false, title = "ข้อมูลผู้ขอเบิก" }: RequesterInfoFormProps) {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-200 mb-5">
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      
      {/* For individual users, show read-only info */}
      {user.userType === 'individual' ? (
        <div className="space-y-4">
          {/* First row - Name and Nickname */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">ชื่อ</span>
              <p className="text-lg font-medium text-gray-900 mt-1">{user.firstName} {user.lastName}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">ชื่อเล่น</span>
              <p className="text-lg font-medium text-gray-900 mt-1">{user.nickname || '-'}</p>
            </div>
          </div>
          
          {/* Second row - Department and Office */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">แผนก</span>
              <p className="text-lg font-medium text-gray-900 mt-1">{user.department || '-'}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">ออฟฟิศ/สาขา</span>
              <p className="text-lg font-medium text-gray-900 mt-1">{user.office || '-'}</p>
            </div>
          </div>
          
          {/* Third row - Phone and Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">เบอร์โทร</span>
              <p className="text-lg font-medium text-gray-900 mt-1">{user.phone || '-'}</p>
            </div>
            {showEmail && (
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">อีเมล</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email || user.email || ''}
                  onChange={onInputChange}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
                  placeholder="อีเมล"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* For branch users, show editable form fields */
        <div className="space-y-4">
          {/* First row - Name and Last Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                ชื่อ *
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={onInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="ชื่อ"
                required
              />
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                นามสกุล *
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={onInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="นามสกุล"
                required
              />
            </div>
          </div>
          
          {/* Second row - Nickname and Department */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                ชื่อเล่น *
              </label>
              <input
                type="text"
                name="nickname"
                value={formData.nickname}
                onChange={onInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="ชื่อเล่น"
                required
              />
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                แผนก *
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={onInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="แผนก"
                required
              />
            </div>
          </div>
          
          {/* Third row - Office and Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                ออฟฟิศ/สาขา
              </label>
              <input
                type="text"
                value={user.office || '-'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-900 cursor-not-allowed"
                disabled
                readOnly
              />
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                เบอร์โทร *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={onInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="เบอร์โทร"
                required
              />
            </div>
          </div>
          
          {/* Fourth row - Email (if needed) */}
          {showEmail && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  อีเมล *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || user.email || ''}
                  onChange={onInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="อีเมล"
                  required
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
