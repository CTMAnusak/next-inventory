'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { customToast } from '@/lib/custom-toast';
import { Package, User, Building, Phone, Mail, MapPin, Briefcase } from 'lucide-react';

interface GoogleProfile {
  id: string;
  email: string;
  name: string;
}

interface ProfileCompletionForm {
  firstName: string;
  lastName: string;
  nickname: string;
  department: string;
  officeId: string;
  officeName: string;
  phone: string;
  userType: 'individual' | 'branch';
  requestMessage?: string;
}

interface OfficeOption {
  value: string;
  label: string;
}

export default function GoogleRegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [googleProfile, setGoogleProfile] = useState<GoogleProfile | null>(null);
  const [officeOptions, setOfficeOptions] = useState<OfficeOption[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(true);
  
  const [formData, setFormData] = useState<ProfileCompletionForm>({
    firstName: '',
    lastName: '',
    nickname: '',
    department: '',
    officeId: '',
    officeName: '',
    phone: '',
    userType: 'individual',
    requestMessage: ''
  });

  useEffect(() => {
    // ดึงข้อมูลจาก URL parameters (จาก Google OAuth callback)
    const profileData = searchParams.get('profile');
    if (profileData) {
      try {
        const profile: GoogleProfile = JSON.parse(decodeURIComponent(profileData));
        setGoogleProfile(profile);
        
        // แยกชื่อจาก Google name (เฉพาะผู้ใช้ประเภทบุคคล)
        const nameParts = profile.name.split(' ');
        setFormData(prev => ({
          ...prev,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || ''
        }));
      } catch (error) {
        console.error('Error parsing profile data:', error);
        toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูลโปรไฟล์');
        router.push('/login');
      }
    } else {
      // ถ้าไม่มีข้อมูลโปรไฟล์ ให้กลับไปหน้า login
      router.push('/login');
    }
  }, [searchParams, router]);

  useEffect(() => {
    const fetchOffices = async () => {
      setLoadingOffices(true);
      try {
        const response = await fetch('/api/admin/offices');
        if (!response.ok) {
          throw new Error('Failed to fetch offices');
        }
        const data = await response.json();
        const options = data
          .filter((office: any) => office.isActive !== false)
          .map((office: any) => ({
            value: office.office_id,
            label: office.name
          }));
        setOfficeOptions(options);
      } catch (error) {
        console.error('Error fetching offices:', error);
        toast.error('ไม่สามารถโหลดข้อมูลสาขาได้ กรุณาลองใหม่อีกครั้ง');
      } finally {
        setLoadingOffices(false);
      }
    };

    fetchOffices();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Validation for phone number
    if (name === 'phone') {
      const numbersOnly = value.replace(/[^0-9]/g, '');
      if (numbersOnly.length <= 10) {
        setFormData(prev => ({
          ...prev,
          [name]: numbersOnly
        }));
      }
      return;
    }
    
    // Clear firstName/lastName when switching to branch user type
    if (name === 'officeId') {
      const selectedOption = officeOptions.find(option => option.value === value);
      setFormData(prev => ({
        ...prev,
        officeId: value,
        officeName: selectedOption?.label || ''
      }));
      return;
    }

    if (name === 'userType' && value === 'branch') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        firstName: '',
        lastName: '',
        nickname: '',
        department: ''
      }));
      return;
    }
    
    // Restore firstName/lastName from Google profile when switching back to individual
    if (name === 'userType' && value === 'individual' && googleProfile) {
      const nameParts = googleProfile.name.split(' ');
      setFormData(prev => ({
        ...prev,
        [name]: value,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || ''
      }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (loadingOffices) {
      toast.error('ระบบกำลังโหลดข้อมูลสาขา กรุณารอสักครู่');
      return false;
    }

    if (formData.userType === 'individual') {
      if (!formData.firstName || !formData.lastName || !formData.nickname || 
          !formData.department || !formData.officeId || !formData.phone) {
        toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
        return false;
      }
    } else {
      if (!formData.officeId || !formData.phone) {
        toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
        return false;
      }
    }

    // Validate phone number
    // ✅ EXCEPTION: Allow 000-000-0000 for admin users
    if (formData.phone && formData.phone !== '000-000-0000' && formData.phone.length !== 10) {
      toast.error('เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ ป้องกันการ submit ซ้ำ
    if (loading) {
      console.log('⚠️ Form is already submitting, ignoring duplicate submission');
      return;
    }
    
    if (!validateForm() || !googleProfile) return;

    setLoading(true);
    try {
      const selectedOffice = officeOptions.find(option => option.value === formData.officeId);

      const response = await fetch('/api/auth/google-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleProfile,
          profileData: {
            ...formData,
            officeName: selectedOffice?.label || formData.officeName
          }
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('สมัครสมาชิกเรียบร้อยแล้ว รอการอนุมัติจากทีม IT Support', { duration: 5000 });
        setTimeout(() => {
          router.push('/login?message=registration_pending');
        }, 2000);
      } else {
        // Check if it's a duplicate error with multiple fields
        if (data.duplicateFields && data.duplicateFields.length > 1) {
          // Show detailed error for multiple duplicates
          const errorList = data.duplicateFields.map((field: string) => `• ${field}`).join('\n');
          customToast.error(`ไม่สามารถสมัครสมาชิกได้ เนื่องจาก:\n${errorList}`, { 
            duration: 15000, // เพิ่มเวลาเพราะมีข้อมูลเยอะ
            style: {
              whiteSpace: 'pre-line',
              textAlign: 'left',
              maxWidth: '600px',
              lineHeight: '1.6',
              padding: '20px',
              paddingRight: '40px', // เผื่อที่สำหรับปุ่มปิด
            },
            dismissible: true, // ให้สามารถปิดได้
          });
        } else {
          // Show simple error for single duplicate or other errors
          customToast.error(data.error || 'เกิดข้อผิดพลาด', { 
            duration: 10000,
            style: {
              maxWidth: '500px',
              padding: '18px',
              paddingRight: '40px', // เผื่อที่สำหรับปุ่มปิด
            },
            dismissible: true, // ให้สามารถปิดได้
          });
        }
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  if (!googleProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-semibold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              สมัครสมาชิก
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              กรุณากรอกข้อมูลเพิ่มเติมเพื่อสมัครสมาชิก
            </p>
          </div>

          {/* Google Profile Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-4">
              <div>
                <p className="font-medium text-gray-900">
                  <Mail className="w-4 h-4 inline mr-2" />
                  {googleProfile.email}
                </p>
                <p className="text-sm text-gray-500">ข้อมูลจาก Google Account</p>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ประเภทผู้ใช้ *
              </label>
              <select
                name="userType"
                value={formData.userType}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              >
                <option value="individual">บุคคล</option>
                <option value="branch">สาขา</option>
              </select>
            </div>

            {formData.userType === 'individual' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="w-4 h-4 inline mr-1" />
                      ชื่อ *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="w-4 h-4 inline mr-1" />
                      นามสกุล *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ชื่อเล่น *
                    </label>
                    <input
                      type="text"
                      name="nickname"
                      value={formData.nickname}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Briefcase className="w-4 h-4 inline mr-1" />
                      แผนก *
                    </label>
                    <input
                      type="text"
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="เช่น IT, การเงิน, ทรัพยากรบุคคล"
                      required
                    />
                  </div>
                </div>
              </>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                ออฟฟิศ/สาขา *
              </label>
              <select
                name="officeId"
                value={formData.officeId}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
                disabled={loadingOffices || officeOptions.length === 0}
              >
                <option value="" disabled>
                  {loadingOffices ? 'กำลังโหลดข้อมูลสาขา...' : 'เลือกออฟฟิศ/สาขา'}
                </option>
                {officeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {formData.officeId && formData.officeName && (
                <p className="mt-2 text-sm text-gray-500">
                  สาขาที่เลือก: {formData.officeName}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-1" />
                เบอร์โทร *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="0812345678"
                pattern="[0-9]{10}"
                maxLength={10}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ข้อความถึงทีม IT Support (ไม่บังคับ)
              </label>
              <textarea
                name="requestMessage"
                value={formData.requestMessage}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                rows={3}
                placeholder="เช่น ต้องการเข้าใช้งานระบบเพื่อ..."
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-medium">หมายเหตุ:</span> ข้อมูลของคุณจะถูกส่งไปยังทีม IT Support เพื่อพิจารณาอนุมัติ 
                คุณจะได้รับการแจ้งเตือนทางอีเมลเมื่อบัญชีของคุณได้รับการอนุมัติแล้ว
              </p>
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    กำลังสมัครสมาชิก...
                  </div>
                ) : (
                  'สมัครสมาชิก'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
