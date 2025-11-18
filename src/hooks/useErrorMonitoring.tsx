import React, { useEffect, useState, useRef } from 'react';

interface ErrorInfo {
  message: string;
  stack?: string;
  timestamp: Date;
  component?: string;
  url?: string;
  userAgent?: string;
}

interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

/**
 * Comprehensive Error Monitoring and Performance Tracking System
 * ติดตาม error และ performance metrics แบบ real-time
 */
export function useErrorMonitoring() {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    fcp: 0,
    lcp: 0,
    fid: 0,
    cls: 0,
    ttfb: 0
  });
  
  // ✅ Track shown errors to prevent duplicates
  const shownErrorsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Global error handler
    const handleError = (event: ErrorEvent) => {
      // ✅ Create error key to check for duplicates
      const errorKey = `${event.message}-${event.filename}-${event.lineno}`;
      
      // ✅ Skip if this error was already shown
      if (shownErrorsRef.current.has(errorKey)) {
        return;
      }
      
      shownErrorsRef.current.add(errorKey);
      
      const errorInfo: ErrorInfo = {
        message: event.message,
        stack: event.error?.stack,
        timestamp: new Date(),
        component: 'Global',
        url: window.location.href,
        userAgent: navigator.userAgent
      };
      
      setErrors(prev => {
        // ✅ Check if this exact error already exists in state
        const exists = prev.some(e => 
          e.message === errorInfo.message && 
          e.stack === errorInfo.stack &&
          Math.abs(e.timestamp.getTime() - errorInfo.timestamp.getTime()) < 1000 // Within 1 second
        );
        if (exists) {
          return prev;
        }
        return [...prev, errorInfo];
      });
      console.error('🚨 Global Error:', errorInfo);
    };

    // Unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // ✅ Create error key to check for duplicates
      const reasonStr = typeof event.reason === 'object' ? JSON.stringify(event.reason) : String(event.reason);
      const errorKey = `Unhandled Promise Rejection: ${reasonStr}`;
      
      // ✅ Skip if this error was already shown
      if (shownErrorsRef.current.has(errorKey)) {
        return;
      }
      
      shownErrorsRef.current.add(errorKey);
      
      const errorInfo: ErrorInfo = {
        message: `Unhandled Promise Rejection: ${reasonStr}`,
        stack: event.reason?.stack,
        timestamp: new Date(),
        component: 'Promise',
        url: window.location.href,
        userAgent: navigator.userAgent
      };
      
      setErrors(prev => {
        // ✅ Check if this exact error already exists in state
        const exists = prev.some(e => 
          e.message === errorInfo.message &&
          Math.abs(e.timestamp.getTime() - errorInfo.timestamp.getTime()) < 1000 // Within 1 second
        );
        if (exists) {
          return prev;
        }
        return [...prev, errorInfo];
      });
      console.error('🚨 Unhandled Promise Rejection:', errorInfo);
    };

    // Performance monitoring
    const measurePerformance = () => {
      if ('performance' in window && 'getEntriesByType' in performance) {
        // First Contentful Paint
        const fcpEntry = performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          setPerformanceMetrics(prev => ({ ...prev, fcp: fcpEntry.startTime }));
        }

        // Largest Contentful Paint
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries.length > 0) {
          const lcp = lcpEntries[lcpEntries.length - 1];
          setPerformanceMetrics(prev => ({ ...prev, lcp: lcp.startTime }));
        }

        // Navigation timing
        const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        if (navEntries.length > 0) {
          const nav = navEntries[0];
          setPerformanceMetrics(prev => ({ 
            ...prev, 
            ttfb: nav.responseStart - nav.requestStart 
          }));
        }
      }
    };

    // Add event listeners
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    // Measure performance after page load
    if (document.readyState === 'complete') {
      measurePerformance();
    } else {
      window.addEventListener('load', measurePerformance);
    }

    // Cleanup
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('load', measurePerformance);
    };
  }, []);

  // Clear errors function
  const clearErrors = () => {
    setErrors([]);
  };

  // Get error summary
  const getErrorSummary = () => {
    const errorCounts = errors.reduce((acc, error) => {
      acc[error.message] = (acc[error.message] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalErrors: errors.length,
      uniqueErrors: Object.keys(errorCounts).length,
      errorCounts,
      latestError: errors[errors.length - 1],
      performanceMetrics
    };
  };

  return {
    errors,
    performanceMetrics,
    clearErrors,
    getErrorSummary
  };
}

/**
 * Error Boundary Component for catching React errors
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 React Error Boundary caught an error:', error, errorInfo);
    
    // Send error to monitoring service
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };
    
    // You can send this to your error monitoring service
    console.error('Error Data:', errorData);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">เกิดข้อผิดพลาด</h3>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณารีเฟรชหน้าเว็บหรือติดต่อทีม IT Support
              </p>
            </div>
            <div className="mt-4">
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                รีเฟรชหน้าเว็บ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Performance Monitor Component
 */
export function PerformanceMonitor() {
  const { performanceMetrics, getErrorSummary } = useErrorMonitoring();
  const [isVisible, setIsVisible] = useState(false);

  const summary = getErrorSummary();

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 z-50"
        title="Show Error Monitor"
      >
        🚨 {summary.totalErrors}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-sm">Error Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div>
          <strong>Errors:</strong> {summary.totalErrors} ({summary.uniqueErrors} unique)
        </div>
        
        <div>
          <strong>Performance:</strong>
          <div className="ml-2">
            <div>FCP: {performanceMetrics.fcp.toFixed(2)}ms</div>
            <div>LCP: {performanceMetrics.lcp.toFixed(2)}ms</div>
            <div>TTFB: {performanceMetrics.ttfb.toFixed(2)}ms</div>
          </div>
        </div>
        
        {summary.latestError && (
          <div>
            <strong>Latest Error:</strong>
            <div className="ml-2 text-red-600 truncate">
              {summary.latestError.message}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
