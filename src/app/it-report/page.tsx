'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { toast } from 'react-hot-toast';
import { Upload, X } from 'lucide-react';
import RequesterInfoForm from '@/components/RequesterInfoForm';
import { handleAuthError } from '@/lib/auth-error-handler';
import AuthGuard from '@/components/AuthGuard';

const issueCategories = [
  'ปัญหา Internet',
  'ปัญหา Notebook/Computer',
  'ปัญหา ปริ้นเตอร์ และ อุปกรณ์',
  'ปัญหา TV/VDO Conference',
  'ปัญหา ตู้ฝากเงิน',
  'ปัญหา อุปกรณ์ มือถือและแท็บเลต',
  'ปัญหา เบอร์โทรศัพท์',
  'ปัญหา Nas เข้าไม่ได้ ใช้งานไม่ได้',
  'ขอ User Account Email ระบบงาน',
  'อื่น ๆ (โปรดระบุ)'
];

export default function ITReportPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  // Google Auth removed - no longer needed
  const [savedIssueId, setSavedIssueId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageURLs, setImageURLs] = useState<string[]>([]);
  // ✅ เพิ่ม ref เพื่อป้องกันการ submit ซ้ำจาก React Strict Mode
  const isSubmittingRef = useRef(false);

  // Mount check
  useEffect(() => {
    setMounted(true);
  }, []);

  // Set office and email in formData when user data is available
  useEffect(() => {
    if (user?.officeName) {
      setFormData(prev => ({
        ...prev,
        office: user.officeName
      }));
    } else if (user?.office) {
      setFormData(prev => ({
        ...prev,
        office: user.office || ''
      }));
    }
  }, [user?.officeName, user?.office]);

  // Form data including personal info for branch users
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    nickname: '',
    phone: '',
    email: user?.email || '',
    department: '',
    office: '',
    issueCategory: '',
    customCategory: '',
    urgency: 'normal',
    description: '',
  });

  // Set email from user profile if available
  useEffect(() => {
    if (user?.email && !formData.email) {
      setFormData(prev => ({
        ...prev,
        email: user.email
      }));
    }
  }, [user?.email]);

  // ตรวจสอบ URL parameters สำหรับ Google Auth callback
  useEffect(() => {
    if (!mounted) return;

    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (success === 'email_sent') {
      toast.success('ส่งอีเมลแจ้งทีม IT Support เรียบร้อยแล้ว');
      setSavedIssueId(null);
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      let errorMessage = 'เกิดข้อผิดพลาด';
      switch (error) {
        case 'google_auth_cancelled':
          errorMessage = 'ยกเลิกการล็อกอิน Google';
          break;
        case 'email_send_failed':
          errorMessage = 'ไม่สามารถส่งอีเมลได้';
          break;
        case 'callback_failed':
          errorMessage = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
          break;
      }
      toast.error(errorMessage);
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [mounted]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Validation for phone number
    if (name === 'phone') {
      // Allow only numbers and limit to 10 digits
      const numbersOnly = value.replace(/[^0-9]/g, '');
      if (numbersOnly.length <= 10) {
        setFormData(prev => ({
          ...prev,
          [name]: numbersOnly
        }));
      }
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Create preview URLs when images are selected
  useEffect(() => {
    // Clean up old URLs
    imageURLs.forEach(url => URL.revokeObjectURL(url));
    
    // Create new URLs
    const newURLs = selectedImages.map(file => URL.createObjectURL(file));
    setImageURLs(newURLs);
    
    // Cleanup function
    return () => {
      newURLs.forEach(url => URL.revokeObjectURL(url));
    };
  }, [selectedImages]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedImages(prev => [...prev, ...files]);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const openImagePreview = (imageUrl: string) => {
    setPreviewImage(imageUrl);
  };

  const closeImagePreview = () => {
    setPreviewImage(null);
  };

  // Google Auth functions removed - no longer needed

  const uploadImages = async (files: File[]): Promise<string[]> => {
    const uploadPromises = files.map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'IssueLog');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload ${file.name}`);
      }

      const data = await response.json();
      return data.filename;
    });

    return await Promise.all(uploadPromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ ป้องกันการ submit ซ้ำ (ใช้ ref เพื่อป้องกัน React Strict Mode)
    if (isLoading || isSubmittingRef.current) {
      console.log('⚠️ Form is already submitting, ignoring duplicate submission', {
        isLoading,
        isSubmittingRef: isSubmittingRef.current
      });
      return;
    }
    
    // ✅ Set ref flag ทันทีเพื่อป้องกันการเรียกซ้ำ
    isSubmittingRef.current = true;
    
    // ✅ Set loading state ทันทีเพื่อป้องกันการกดซ้ำ
    setIsLoading(true);
    setIsSubmitted(true);
    
    console.log('📧 [handleSubmit] Starting form submission');

    try {
      // ✅ ตรวจสอบว่ามีการ submit ซ้ำหรือไม่ (ป้องกัน double-click)
      if (!isSubmittingRef.current) {
        console.log('⚠️ Submit was cancelled, aborting');
        setIsLoading(false);
        return;
      }

      // Validate form - required fields
      if (!formData.email || !formData.issueCategory || !formData.description) {
        toast.error('กรุณากรอกอีเมล ประเภทปัญหา และรายละเอียดให้ครบถ้วน');
        setIsLoading(false);
        isSubmittingRef.current = false; // ✅ Reset ref เมื่อ validation fail
        return;
      }

      // Additional validation for branch users
      if (user?.userType === 'branch') {
        if (!formData.firstName || !formData.lastName || !formData.nickname || !formData.department || !formData.phone) {
          toast.error('กรุณากรอกข้อมูลส่วนตัวให้ครบถ้วน');
          setIsLoading(false);
          isSubmittingRef.current = false; // ✅ Reset ref เมื่อ validation fail
          return;
        }
      }

      // Validate phone number (must be exactly 10 digits) - only for branch users
      // ✅ EXCEPTION: Allow 000-000-0000 for admin users
      if (user?.userType === 'branch' && formData.phone !== '000-000-0000' && formData.phone.length !== 10) {
        toast.error('เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น');
        setIsLoading(false);
        isSubmittingRef.current = false; // ✅ Reset ref เมื่อ validation fail
        return;
      }

      // Validate email format (required)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error('รูปแบบอีเมลล์ไม่ถูกต้อง');
        setIsLoading(false);
        isSubmittingRef.current = false; // ✅ Reset ref เมื่อ validation fail
        return;
      }

      // Validate custom category if "อื่น ๆ (โปรดระบุ)" is selected
      if (formData.issueCategory === 'อื่น ๆ (โปรดระบุ)' && !formData.customCategory) {
        toast.error('กรุณาระบุประเภทปัญหา');
        setIsLoading(false);
        isSubmittingRef.current = false; // ✅ Reset ref เมื่อ validation fail
        return;
      }

      // Upload images (optional)
      let uploadedImages: string[] = [];
      if (selectedImages.length > 0) {
        try {
          uploadedImages = await uploadImages(selectedImages);
        } catch (error) {
          console.error('Image upload failed:', error);
          // Don't fail the request if image upload fails
          console.log('Continuing without images due to upload failure');
        }
      }

      const reportData = {
        // Use user profile data for individual users, form data for branch users
        firstName: user?.userType === 'individual' ? user.firstName : formData.firstName,
        lastName: user?.userType === 'individual' ? user.lastName : formData.lastName,
        nickname: user?.userType === 'individual' ? (user.nickname || '') : formData.nickname,
        department: user?.userType === 'individual' ? (user.department || '') : formData.department,
        office: user?.office || '',
        phone: user?.userType === 'individual' ? (user.phone || '') : formData.phone,
        email: formData.email || user?.email || '',
        issueCategory: formData.issueCategory,
        customCategory: formData.customCategory,
        urgency: formData.urgency,
        description: formData.description,
        images: uploadedImages,
        reportDate: new Date() // ใช้วันที่ปัจจุบัน
      };

      // ส่งข้อมูลไปยัง API เพื่อบันทึกใน database
      console.log('Sending data to API:', reportData);
      
      const response = await fetch('/api/it-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      console.log('API Response status:', response.status);
      console.log('API Response content-type:', response.headers.get('content-type'));
      
      // ✅ จัดการ 401/403 error - เด้งออกจากระบบทันที
      if (handleAuthError(response)) {
        return;
      }
      
      // ตรวจสอบว่า response เป็น JSON หรือไม่
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('Non-JSON response:', textResponse);
        throw new Error('Server returned invalid response format');
      }
      
      const data = await response.json();
      console.log('API Response data:', data);

      if (response.ok) {
        // บันทึกสำเร็จแล้ว - ไม่แสดงตัวเลือกส่งอีเมล
        setSavedIssueId(data.issueId);
        toast.success(`บันทึกการแจ้งงาน IT เรียบร้อยแล้ว\nหมายเลข Issue: ${data.issueId}`);
        // Reset form
        setIsSubmitted(false);
        setFormData({
          firstName: '',
          lastName: '',
          nickname: '',
          phone: '',
          email: user?.email || '',
          department: '',
          office: '',
          issueCategory: '',
          customCategory: '',
          urgency: 'normal',
          description: '',
        });
        setSelectedImages([]);
        setImageURLs([]);
      } else {
        console.error('API Error:', data);
        const errorMessage = data?.error || data?.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล';
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(`เกิดข้อผิดพลาดในการเชื่อมต่อ: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // ✅ Reset ทั้ง state และ ref เพื่อให้สามารถ submit ใหม่ได้
      setIsLoading(false);
      isSubmittingRef.current = false;
      console.log('✅ [handleSubmit] Form submission completed, reset flags');
    }
  };

  if (!mounted) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl px-5 py-8 sm:p-8 border border-white/50">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded mb-6"></div>
              <div className="space-y-4">
                <div className="h-12 bg-gray-200 rounded"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <AuthGuard>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl px-5 py-8 sm:p-8 border border-white/50">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">แจ้งงาน IT</h1>
            <div className="text-center sm:text-right mt-4 sm:mt-0">
              <div className="text-sm text-gray-600">วันที่แจ้ง</div>
              <div className="text-lg font-medium text-blue-600">
                {new Date().toLocaleDateString('th-TH', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'Asia/Bangkok'
                })}
              </div>
              <div className="text-sm text-gray-500">
                {new Date().toLocaleTimeString('th-TH', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Asia/Bangkok'
                })} น.
              </div>
            </div>
          </div>

          {/* User Profile Display */}
          <RequesterInfoForm 
            formData={{
              ...formData,
              office: formData.office || user?.officeName || user?.office || ''
            }}
            onInputChange={handleInputChange}
            showEmail={true}
            title="ข้อมูลผู้ประสงค์แจ้งงาน IT"
          />

          <form onSubmit={handleSubmit} className={`space-y-6 ${isSubmitted ? 'form-submitted' : ''}`}>

            {/* Issue Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หัวข้อปัญหา *
                </label>
                <select
                  name="issueCategory"
                  value={formData.issueCategory}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  required
                >
                  <option value="">-- เลือกหัวข้อปัญหา --</option>
                  {issueCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ระดับความเร่งด่วน *
                </label>
                <select
                  name="urgency"
                  value={formData.urgency}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  required
                >
                  <option value="normal">ปกติ</option>
                  <option value="very_urgent">ด่วนมาก</option>
                </select>
              </div>
            </div>

            {/* Custom Category Input */}
            {formData.issueCategory === 'อื่น ๆ (โปรดระบุ)' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  โปรดระบุประเภทปัญหา *
                </label>
                <input
                  type="text"
                  name="customCategory"
                  value={formData.customCategory}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="ระบุประเภทปัญหา"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                รายละเอียด *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                placeholder="อธิบายปัญหาอย่างละเอียด"
                required
              />
            </div>

            {/* Image Upload */}
            <div className='mb-10'>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                อัปโหลดรูปภาพ
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                      <span>เลือกไฟล์รูปภาพ</span>
                      <input
                        type="file"
                        className="sr-only"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                      />
                    </label>
                    <p className="pl-1">หรือลากไฟล์มาวาง</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, GIF ขนาดไม่เกิน 10MB ต่อไฟล์
                  </p>
                </div>
              </div>

              {/* Preview Selected Images */}
              {selectedImages.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    ไฟล์ที่เลือก ({selectedImages.length} ไฟล์)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {selectedImages.map((file, index) => (
                      <div key={index} className="relative group">
                        <div 
                          className="aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity shadow-md"
                          onClick={() => openImagePreview(imageURLs[index])}
                        >
                          <img
                            src={imageURLs[index]}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="mt-2 text-xs text-gray-600 truncate text-center">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-500 text-center">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 shadow-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={isLoading || isSubmittingRef.current}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={(e) => {
                  // ✅ ป้องกัน double-click โดยตรวจสอบ state ก่อน
                  if (isLoading || isSubmittingRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('⚠️ Button click prevented - already submitting');
                    return false;
                  }
                }}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    กำลังส่งข้อมูล...
                  </div>
                ) : (
                  'บันทึกการแจ้งงาน'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          onClick={closeImagePreview}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={closeImagePreview}
              className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-red-600 shadow-lg z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain mx-auto rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Google Auth Modal removed - no longer needed */}
    </Layout>
    </AuthGuard>
  );
}
