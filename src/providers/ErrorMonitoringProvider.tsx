'use client';

import React, { useEffect } from 'react';
import { EnhancedErrorBoundary, setupGlobalErrorHandling } from '@/components/EnhancedErrorBoundary';
import { ErrorMonitoringDashboard } from '@/components/ErrorMonitoringDashboard';

interface ErrorMonitoringProviderProps {
  children: React.ReactNode;
  enableDashboard?: boolean;
  enableGlobalHandling?: boolean;
}

/**
 * Error Monitoring Provider
 * จัดการ error monitoring สำหรับทั้งแอปพลิเคชัน
 */
export function ErrorMonitoringProvider({ 
  children, 
  enableDashboard = true,
  enableGlobalHandling = true 
}: ErrorMonitoringProviderProps) {
  
  useEffect(() => {
    if (enableGlobalHandling) {
      setupGlobalErrorHandling();
    }
  }, [enableGlobalHandling]);

  return (
    <EnhancedErrorBoundary
      onError={(error, errorInfo) => {
        // Send error to monitoring service
        fetch('/api/error-monitoring', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'error',
            data: {
              message: error.message,
              stack: error.stack,
              component: 'ErrorBoundary',
              url: window.location.href,
              userAgent: navigator.userAgent,
              severity: 'critical',
              metadata: {
                componentStack: errorInfo.componentStack,
                errorBoundary: true
              }
            }
          })
        }).catch(console.error);
      }}
      recoveryOptions={{
        retry: () => {
          console.log('🔄 Retrying after error...');
        },
        reset: () => {
          console.log('🔄 Resetting after error...');
        }
      }}
    >
      {children}
      {enableDashboard && <ErrorMonitoringDashboard />}
    </EnhancedErrorBoundary>
  );
}

/**
 * Hook for sending performance metrics
 */
export function usePerformanceMonitoring() {
  useEffect(() => {
    const sendPerformanceMetrics = () => {
      if ('performance' in window && 'getEntriesByType' in performance) {
        // Get performance metrics
        const fcpEntry = performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint');
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];

        const metrics = {
          fcp: fcpEntry?.startTime || 0,
          lcp: lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : 0,
          fid: 0, // Would need to be measured separately
          cls: 0, // Would need to be measured separately
          ttfb: navEntries.length > 0 ? navEntries[0].responseStart - navEntries[0].requestStart : 0,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date()
        };

        // Send to monitoring service
        fetch('/api/error-monitoring', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'performance',
            data: metrics
          })
        }).catch(console.error);
      }
    };

    // Send metrics after page load
    if (document.readyState === 'complete') {
      sendPerformanceMetrics();
    } else {
      window.addEventListener('load', sendPerformanceMetrics);
    }

    return () => {
      window.removeEventListener('load', sendPerformanceMetrics);
    };
  }, []);
}

/**
 * Hook for tracking user actions
 */
export function useUserActionTracking() {
  const trackAction = (action: string, component: string, metadata?: any) => {
    fetch('/api/error-monitoring', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'user-action',
        data: {
          action,
          component,
          url: window.location.href,
          timestamp: new Date(),
          metadata
        }
      })
    }).catch(console.error);
  };

  return { trackAction };
}

/**
 * Component for tracking page views
 */
export function PageViewTracker({ pageName }: { pageName: string }) {
  const { trackAction } = useUserActionTracking();

  useEffect(() => {
    trackAction('page_view', pageName, {
      referrer: document.referrer,
      timestamp: new Date()
    });
  }, [pageName, trackAction]);

  return null;
}

/**
 * Component for tracking component errors
 */
export function ComponentErrorTracker({ componentName }: { componentName: string }) {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      fetch('/api/error-monitoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'error',
          data: {
            message: event.message,
            stack: event.error?.stack,
            component: componentName,
            url: window.location.href,
            userAgent: navigator.userAgent,
            severity: 'error',
            metadata: {
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno
            }
          }
        })
      }).catch(console.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [componentName]);

  return null;
}

/**
 * Higher-order component for error tracking
 */
export function withErrorTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return function TrackedComponent(props: P) {
    return (
      <>
        <ComponentErrorTracker componentName={componentName} />
        <Component {...props} />
      </>
    );
  };
}

/**
 * Utility for manual error reporting
 */
export function reportError(error: Error, context?: string, metadata?: any) {
  fetch('/api/error-monitoring', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'error',
      data: {
        message: error.message,
        stack: error.stack,
        component: context || 'Manual',
        url: window.location.href,
        userAgent: navigator.userAgent,
        severity: 'error',
        metadata: {
          ...metadata,
          manual: true
        }
      }
    })
  }).catch(console.error);
}

/**
 * Utility for manual performance reporting
 */
export function reportPerformance(metrics: {
  name: string;
  value: number;
  unit?: string;
  metadata?: any;
}) {
  fetch('/api/error-monitoring', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'performance',
      data: {
        ...metrics,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date()
      }
    })
  }).catch(console.error);
}
