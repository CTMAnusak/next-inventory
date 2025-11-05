'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import SearchableSelect from '@/components/SearchableSelect';

interface RequesterInfoFormProps {
  formData: {
    firstName: string;
    lastName: string;
    nickname: string;
    department: string;
    phone: string;
    office: string;
    officeId?: string; // 🆕 Office ID
    email?: string;
  };
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onOfficeChange?: (officeId: string) => void; // 🆕 Callback สำหรับเมื่อเลือก office
  showEmail?: boolean;
  title?: string;
  lockPersonalInfo?: boolean; // New prop to lock personal info fields (except phone)
  lockOffice?: boolean; // 🆕 Prop สำหรับล็อค office field
}

export default function RequesterInfoForm({ 
  formData, 
  onInputChange, 
  onOfficeChange,
  showEmail = false, 
  title = "ข้อมูลผู้ขอเบิก", 
  lockPersonalInfo = false,
  lockOffice = false // 🆕 Default ไม่ล็อค
}: RequesterInfoFormProps) {
  const { user } = useAuth();
  const [officeOptions, setOfficeOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loadingOffices, setLoadingOffices] = useState(false);

  // ดึงรายการ Office สำหรับ dropdown
  useEffect(() => {
    const fetchOffices = async () => {
      setLoadingOffices(true);
      try {
        const response = await fetch('/api/admin/offices');
        if (response.ok) {
          const offices = await response.json();
          setOfficeOptions(offices.map((office: any) => ({
            value: office.office_id,
            label: office.name
          })));
        }
      } catch (error) {
        console.error('Error fetching offices:', error);
      } finally {
        setLoadingOffices(false);
      }
    };

    fetchOffices();
  }, []);

  if (!user) return null;

  const handleOfficeSelectChange = (officeId: string) => {
    // หา office name จาก options
    const selectedOffice = officeOptions.find(opt => opt.value === officeId);
    
    // สร้าง synthetic event สำหรับ backward compatibility
    const syntheticEvent = {
      target: {
        name: 'office',
        value: selectedOffice?.label || officeId
      }
    } as React.ChangeEvent<HTMLInputElement>;
    
    onInputChange(syntheticEvent);
    
    // เรียก callback ถ้ามี
    if (onOfficeChange) {
      onOfficeChange(officeId);
    }
  };

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
              <p className="text-lg font-medium text-gray-900 mt-1">{user.officeName || '-'}</p>
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
                <p className="text-lg font-medium text-gray-900 mt-1">{user.email || '-'}</p>
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
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${lockPersonalInfo ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                placeholder="ชื่อ"
                required
                disabled={lockPersonalInfo}
                readOnly={lockPersonalInfo}
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
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${lockPersonalInfo ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                placeholder="นามสกุล"
                required
                disabled={lockPersonalInfo}
                readOnly={lockPersonalInfo}
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
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${lockPersonalInfo ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                placeholder="ชื่อเล่น"
                required
                disabled={lockPersonalInfo}
                readOnly={lockPersonalInfo}
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
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${lockPersonalInfo ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                placeholder="แผนก"
                required
                disabled={lockPersonalInfo}
                readOnly={lockPersonalInfo}
              />
            </div>
          </div>
          
          {/* Third row - Office and Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                ออฟฟิศ/สาขา *
              </label>
              {loadingOffices ? (
                <input
                  type="text"
                  value="กำลังโหลด..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 cursor-not-allowed"
                  disabled
                />
              ) : (
                <SearchableSelect
                  options={officeOptions}
                  value={formData.officeId || user?.officeId || ''}
                  onChange={handleOfficeSelectChange}
                  placeholder="เลือกสาขา"
                  className="w-full"
                  disabled={lockOffice || user?.userType === 'branch'} // 🆕 ล็อคสำหรับผู้ใช้ประเภทสาขาหรือเมื่อ lockOffice = true
                />
              )}
              {(lockOffice || user?.userType === 'branch') && (
                <p className="text-xs text-gray-500 mt-1">
                  🔒 สาขาถูกล็อคตามบัญชีที่ล็อคอินอยู่ (จะอัพเดตอัตโนมัติเมื่อมีการแก้ไขสาขาในระบบ)
                </p>
              )}
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                เบอร์โทร *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={(e) => {
                  // Allow only numbers and limit to 10 digits
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  const syntheticEvent = {
                    ...e,
                    target: {
                      ...e.target,
                      name: 'phone',
                      value: value
                    }
                  } as React.ChangeEvent<HTMLInputElement>;
                  onInputChange(syntheticEvent);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="กรอกเบอร์โทรศัพท์ 10 หลัก"
                required
                pattern="[0-9]{10}"
                title="กรุณากรอกเบอร์โทรศัพท์ 10 หลัก (ตัวเลขเท่านั้น)"
                maxLength={10}
              />
            </div>
          </div>
          
          {/* Fourth row - Email (if needed) */}
          {showEmail && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  อีเมล
                </label>
                <input
                  type="email"
                  name="email"
                  value={user.email || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 cursor-not-allowed"
                  placeholder="อีเมล (ดึงจากบัญชีผู้ใช้)"
                  disabled
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">
                  🔒 อีเมลถูกล็อคตามบัญชีที่ล็อคอินอยู่
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
