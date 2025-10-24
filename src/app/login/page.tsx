'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Package, X, AlertCircle, CheckCircle, Mail } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoginLoading, setGoogleLoginLoading] = useState(false);
  const [googleRegisterLoading, setGoogleRegisterLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorData, setErrorData] = useState<{
    title: string;
    message: string;
    details: string;
    type: 'pending_approval' | 'already_exists' | 'email_taken' | 'error';
  } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if user is already logged in
  useEffect(() => {
    const checkIfLoggedIn = async () => {
      try {
        const response = await fetch('/api/auth/check', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user) {
            // User is already logged in, redirect to dashboard
            router.replace('/dashboard');
            return;
          }
        }
      } catch (error) {
        // User is not logged in, continue to show login page
        console.log('Not logged in');
      } finally {
        setCheckingAuth(false);
      }
    };

    checkIfLoggedIn();
  }, [router]);

  useEffect(() => {
    // Handle URL messages
    const message = searchParams?.get('message');
    const error = searchParams?.get('error');
    const suggestion = searchParams?.get('suggestion');

    if (message === 'registration_pending') {
      setErrorData({
        title: '✅ สมัครสมาชิกเรียบร้อยแล้ว',
        message: 'รอการอนุมัติจากผู้ดูแลระบบ',
        details: 'ทางทีมงานจะตรวจสอบและอนุมัติบัญชีของคุณโดยเร็วที่สุด กรุณารอการแจ้งเตือนทางอีเมล',
        type: 'pending_approval'
      });
      setShowErrorModal(true);
    } else if (error) {
      // Handle decoded error from URL (from Google OAuth callback)
      const decodedError = decodeURIComponent(error);
      
      // Check if it's a "no account" error
      if (decodedError.includes('ไม่พบบัญชีผู้ใช้') || error === 'no_account') {
        setErrorData({
          title: '❌ ไม่พบบัญชีผู้ใช้',
          message: 'บัญชีผู้ใช้ไม่พบในระบบ',
          details: 'กรุณาสมัครสมาชิกด้วย Google หรือติดต่อผู้ดูแลระบบหากปัญหายังคงมีอยู่',
          type: 'error'
        });
      } else {
        setErrorData({
          title: '❌ เกิดข้อผิดพลาด',
          message: decodedError,
          details: 'กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบหากปัญหายังคงมีอยู่',
          type: 'error'
        });
      }
      setShowErrorModal(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('เข้าสู่ระบบสำเร็จ', { duration: 2000 });
        // Use timeout to ensure toast shows before redirect
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด', { duration: 4000 });
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ', { duration: 4000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoginLoading(true);
    try {
      const response = await fetch('/api/auth/google?action=login');
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else if (data.error) {
        // Handle specific error types with popup
        const errorInfo = getErrorInfo(data);
        setErrorData(errorInfo);
        setShowErrorModal(true);
      } else {
        toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ Google');
      }
    } catch (error) {
      setErrorData({
        title: '❌ เกิดข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
        details: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและลองใหม่อีกครั้ง',
        type: 'error'
      });
      setShowErrorModal(true);
    } finally {
      setGoogleLoginLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setGoogleRegisterLoading(true);
    try {
      const response = await fetch('/api/auth/google?action=register', {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else if (data.error) {
        console.log('❌ Google Register Error:', data);
        // Handle specific error types
        const errorInfo = getErrorInfo(data);
        setErrorData(errorInfo);
        setShowErrorModal(true);
      } else {
        console.log('❌ No authUrl and no error in response:', data);
        setErrorData({
          title: '❌ เกิดข้อผิดพลาด',
          message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google',
          details: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและลองใหม่อีกครั้ง',
          type: 'error'
        });
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('❌ Google Register Catch Error:', error);
      setErrorData({
        title: '❌ เกิดข้อผิดพลาด',
        message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
        details: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและลองใหม่อีกครั้ง',
        type: 'error'
      });
      setShowErrorModal(true);
    } finally {
      setGoogleRegisterLoading(false);
    }
  };

  const getErrorInfo = (data: any) => {
    const { error, errorType, details } = data;
    
    switch (errorType) {
      case 'pending_approval':
        return {
          title: '⏳ รอการอนุมัติ',
          message: error,
          details: details || 'กรุณารอการอนุมัติจากผู้ดูแลระบบ',
          type: 'pending_approval' as const
        };
      case 'already_exists':
        return {
          title: '✅ บัญชีมีอยู่แล้ว',
          message: error,
          details: details || 'กรุณาใช้ปุ่ม "เข้าสู่ระบบด้วย Google" แทน',
          type: 'already_exists' as const
        };
      case 'email_taken':
        return {
          title: '📧 อีเมลถูกใช้แล้ว',
          message: error,
          details: details || 'กรุณาใช้วิธีเข้าสู่ระบบปกติ หรือใช้อีเมล Google อื่น',
          type: 'email_taken' as const
        };
      case 'no_account':
        return {
          title: '❌ ไม่พบบัญชีผู้ใช้',
          message: error,
          details: details || 'กรุณาสมัครสมาชิกด้วย Google หรือติดต่อผู้ดูแลระบบหากปัญหายังคงมีอยู่',
          type: 'error' as const
        };
      default:
        return {
          title: '❌ เกิดข้อผิดพลาด',
          message: error,
          details: details || 'กรุณาลองใหม่อีกครั้ง',
          type: 'error' as const
        };
    }
  };

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-white text-lg">กำลังตรวจสอบ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-semibold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              เข้าสู่ระบบ
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Inventory Management Dashboard
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  อีเมล
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 appearance-none relative block w-full px-4 py-3 border border-gray-200 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="กรอกอีเมล"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  รหัสผ่าน
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 appearance-none relative block w-full px-4 py-3 border border-gray-200 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="กรอกรหัสผ่าน"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    กำลังเข้าสู่ระบบ...
                  </div>
                ) : (
                  'เข้าสู่ระบบ'
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">หรือ</span>
              </div>
            </div>
          </div>

          {/* Google Login Buttons */}
          <div className="mt-6 space-y-3">
            <button
              onClick={handleGoogleLogin}
              disabled={googleLoginLoading || googleRegisterLoading || isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
            >
              {googleLoginLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  กำลังเชื่อมต่อ Google...
                </div>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  เข้าสู่ระบบด้วย Google
                </>
              )}
            </button>

            <button
              onClick={(e) => {
                handleGoogleRegister();
              }}
              disabled={googleLoginLoading || googleRegisterLoading || isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-green-300 rounded-xl text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
            >
              {googleRegisterLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                  กำลังเชื่อมต่อ Google...
                </div>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  สมัครสมาชิกด้วย Google
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Modal */}
      {showErrorModal && errorData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in duration-300">
            {/* Close Button */}
            <button
              onClick={() => setShowErrorModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              {errorData.type === 'pending_approval' && (
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-yellow-600" />
                </div>
              )}
              {errorData.type === 'already_exists' && (
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              )}
              {errorData.type === 'email_taken' && (
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <Mail className="w-8 h-8 text-blue-600" />
                </div>
              )}
              {errorData.type === 'error' && (
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {errorData.title}
              </h3>
              <p className="text-gray-700 mb-3">
                {errorData.message}
              </p>
              <p className="text-sm text-gray-500 mb-6">
                {errorData.details}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {errorData.type === 'already_exists' && (
                <button
                  onClick={() => {
                    setShowErrorModal(false);
                    handleGoogleLogin();
                  }}
                  className="flex-1 bg-green-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-green-700 transition-colors"
                >
                  เข้าสู่ระบบด้วย Google
                </button>
              )}
              
              <button
                onClick={() => {
                  setShowErrorModal(false);
                  // ถ้าเป็น session_expired error ให้ redirect ไปหน้า login โดยไม่มี error parameter
                  if (errorData?.message === 'session_expired') {
                    window.location.href = '/login';
                  }
                }}
                className={`${errorData.type === 'already_exists' ? 'flex-1' : 'w-full'} bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 transition-colors`}
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
