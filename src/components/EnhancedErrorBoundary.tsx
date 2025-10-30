'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ErrorState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorRecoveryOptions {
  retry?: () => void;
  reset?: () => void;
  fallback?: React.ReactNode;
}

/**
 * Enhanced Error Boundary with Recovery Options
 */
export class EnhancedErrorBoundary extends React.Component<
  { 
    children: React.ReactNode; 
    fallback?: React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    recoveryOptions?: ErrorRecoveryOptions;
  },
  ErrorState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Enhanced Error Boundary caught an error:', error, errorInfo);
    
    this.setState({ error, errorInfo });
    
    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send error to monitoring service
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    };
    
    console.error('Error Data:', errorData);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    if (this.props.recoveryOptions?.retry) {
      this.props.recoveryOptions.retry();
    }
  };

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    if (this.props.recoveryOptions?.reset) {
      this.props.recoveryOptions.reset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback 
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          onReset={this.handleReset}
          recoveryOptions={this.props.recoveryOptions}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Error Fallback Component
 */
function ErrorFallback({ 
  error, 
  errorInfo, 
  onRetry, 
  onReset, 
  recoveryOptions 
}: {
  error?: Error;
  errorInfo?: React.ErrorInfo;
  onRetry: () => void;
  onReset: () => void;
  recoveryOptions?: ErrorRecoveryOptions;
}) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">เกิดข้อผิดพลาด</h3>
            <p className="text-sm text-gray-500 mt-1">
              เกิดข้อผิดพลาดที่ไม่คาดคิดในระบบ
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              {showDetails ? 'ซ่อน' : 'แสดง'} รายละเอียดข้อผิดพลาด
            </button>
            
            {showDetails && (
              <div className="mt-2 p-3 bg-gray-100 rounded text-xs">
                <div className="font-medium text-gray-800 mb-1">Error Message:</div>
                <div className="text-red-600 mb-2">{error.message}</div>
                
                {error.stack && (
                  <>
                    <div className="font-medium text-gray-800 mb-1">Stack Trace:</div>
                    <pre className="text-gray-600 whitespace-pre-wrap text-xs">
                      {error.stack}
                    </pre>
                  </>
                )}
                
                {errorInfo?.componentStack && (
                  <>
                    <div className="font-medium text-gray-800 mb-1 mt-2">Component Stack:</div>
                    <pre className="text-gray-600 whitespace-pre-wrap text-xs">
                      {errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={onRetry}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            ลองใหม่
          </button>
          
          <button
            onClick={onReset}
            className="w-full bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            รีเซ็ต
          </button>
          
          <button
            onClick={handleReload}
            className="w-full bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
          >
            รีเฟรชหน้าเว็บ
          </button>
          
          <button
            onClick={handleGoHome}
            className="w-full bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            กลับหน้าหลัก
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          หากปัญหายังคงเกิดขึ้น กรุณาติดต่อทีม IT Support
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for handling async errors in components
 */
export function useAsyncErrorHandler() {
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAsync = async <T,>(
    asyncFn: () => Promise<T>,
    onError?: (error: Error) => void
  ): Promise<T | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await asyncFn();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      
      console.error('🚨 Async Error:', error);
      
      if (onError) {
        onError(error);
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    error,
    isLoading,
    handleAsync,
    clearError
  };
}

/**
 * Hook for handling API errors
 */
export function useApiErrorHandler() {
  const [apiError, setApiError] = useState<{
    message: string;
    code?: string;
    status?: number;
  } | null>(null);

  const handleApiError = (error: any) => {
    console.error('🚨 API Error:', error);
    
    if (error.response) {
      // Server responded with error status
      setApiError({
        message: error.response.data?.error || 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์',
        code: error.response.data?.errorCode,
        status: error.response.status
      });
    } else if (error.request) {
      // Request was made but no response received
      setApiError({
        message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
        code: 'NETWORK_ERROR'
      });
    } else {
      // Something else happened
      setApiError({
        message: error.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
        code: 'UNKNOWN_ERROR'
      });
    }
  };

  const clearApiError = () => {
    setApiError(null);
  };

  return {
    apiError,
    handleApiError,
    clearApiError
  };
}

/**
 * Global Error Handler for unhandled errors
 */
export function setupGlobalErrorHandling() {
  if (typeof window === 'undefined') return;

  // Handle unhandled errors
  window.addEventListener('error', (event) => {
    console.error('🚨 Global Error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled Promise Rejection:', event.reason);
  });
}
