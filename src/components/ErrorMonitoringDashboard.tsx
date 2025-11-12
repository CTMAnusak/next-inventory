'use client';

import React, { useState, useEffect } from 'react';
import { useErrorMonitoring } from '@/hooks/useErrorMonitoring';
import { useAuth } from '@/contexts/AuthContext';

interface ErrorLog {
  id: string;
  message: string;
  stack?: string;
  timestamp: Date;
  component?: string;
  url?: string;
  count: number;
}

interface PerformanceData {
  fcp: number;
  lcp: number;
  fid: number;
  cls: number;
  ttfb: number;
  timestamp: Date;
}

/**
 * Comprehensive Error Monitoring Dashboard
 * แสดงข้อมูล error และ performance metrics แบบ real-time
 * แสดงเฉพาะสำหรับ it_admin และ admin เท่านั้น
 */
export default function ErrorMonitoringDashboard() {
  const { user } = useAuth();
  const { errors, performanceMetrics, clearErrors, getErrorSummary } = useErrorMonitoring();
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceData[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<'all' | 'errors' | 'performance'>('all');

  // Process errors into logs
  useEffect(() => {
    const errorMap = new Map<string, ErrorLog>();
    
    errors.forEach(error => {
      const key = error.message;
      if (errorMap.has(key)) {
        const existing = errorMap.get(key)!;
        existing.count++;
        existing.timestamp = error.timestamp; // Update to latest
      } else {
        errorMap.set(key, {
          id: Math.random().toString(36).substr(2, 9),
          message: error.message,
          stack: error.stack,
          timestamp: error.timestamp,
          component: error.component,
          url: error.url,
          count: 1
        });
      }
    });
    
    setErrorLogs(Array.from(errorMap.values()).sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    ));
  }, [errors]);

  // Track performance history
  useEffect(() => {
    if (performanceMetrics.fcp > 0 || performanceMetrics.lcp > 0) {
      setPerformanceHistory(prev => [
        {
          ...performanceMetrics,
          timestamp: new Date()
        },
        ...prev.slice(0, 49) // Keep last 50 entries
      ]);
    }
  }, [performanceMetrics]);

  const summary = getErrorSummary();

  // ตรวจสอบสิทธิ์การแสดง Error Monitor
  const canViewErrorMonitor = user?.userRole === 'it_admin' || user?.userRole === 'admin' || user?.userRole === 'super_admin';
  
  // ไม่แสดง Error Monitor หากไม่มีสิทธิ์
  if (!canViewErrorMonitor) {
    return null;
  }

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-colors"
          title="Open Error Monitor"
        >
          <div className="flex items-center space-x-1">
            <span className="text-sm">🚨</span>
            <span className="text-xs font-bold">{summary.totalErrors}</span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 w-96 max-h-96 bg-white border border-gray-300 rounded-lg shadow-xl z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-bold text-sm text-gray-900">Error Monitor</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={clearErrors}
            className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
            title="Clear Errors"
          >
            Clear
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="text-gray-500 hover:text-gray-700"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-2 text-xs font-medium ${
            filter === 'all' 
              ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All ({summary.totalErrors})
        </button>
        <button
          onClick={() => setFilter('errors')}
          className={`px-3 py-2 text-xs font-medium ${
            filter === 'errors' 
              ? 'bg-red-100 text-red-700 border-b-2 border-red-500' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Errors ({errorLogs.length})
        </button>
        <button
          onClick={() => setFilter('performance')}
          className={`px-3 py-2 text-xs font-medium ${
            filter === 'performance' 
              ? 'bg-green-100 text-green-700 border-b-2 border-green-500' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Performance
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-64">
        {filter === 'all' && (
          <div className="p-4 space-y-3">
            {/* Summary */}
            <div className="bg-gray-50 p-3 rounded">
              <h4 className="font-medium text-sm mb-2">Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Total Errors:</span>
                  <span className="ml-1 font-medium">{summary.totalErrors}</span>
                </div>
                <div>
                  <span className="text-gray-500">Unique:</span>
                  <span className="ml-1 font-medium">{summary.uniqueErrors}</span>
                </div>
                <div>
                  <span className="text-gray-500">FCP:</span>
                  <span className="ml-1 font-medium">{performanceMetrics.fcp.toFixed(0)}ms</span>
                </div>
                <div>
                  <span className="text-gray-500">LCP:</span>
                  <span className="ml-1 font-medium">{performanceMetrics.lcp.toFixed(0)}ms</span>
                </div>
              </div>
            </div>

            {/* Latest Error */}
            {summary.latestError && (
              <div className="bg-red-50 p-3 rounded border border-red-200">
                <h4 className="font-medium text-sm text-red-800 mb-1">Latest Error</h4>
                <p className="text-xs text-red-700 truncate">
                  {summary.latestError.message}
                </p>
                <p className="text-xs text-red-500 mt-1">
                  {summary.latestError.timestamp.toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        )}

        {filter === 'errors' && (
          <div className="p-4 space-y-2">
            {errorLogs.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-4">
                No errors detected
              </div>
            ) : (
              errorLogs.map(log => (
                <div key={log.id} className="bg-red-50 p-3 rounded border border-red-200">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium text-red-800 truncate flex-1">
                      {log.message}
                    </span>
                    <span className="text-xs text-red-500 ml-2">
                      {log.count}x
                    </span>
                  </div>
                  <div className="text-xs text-red-600">
                    {log.component && <span>{log.component} • </span>}
                    {log.timestamp.toLocaleTimeString()}
                  </div>
                  {log.stack && (
                    <details className="mt-2">
                      <summary className="text-xs text-red-500 cursor-pointer">
                        Stack Trace
                      </summary>
                      <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap">
                        {log.stack}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {filter === 'performance' && (
          <div className="p-4 space-y-3">
            {/* Current Metrics */}
            <div className="bg-green-50 p-3 rounded border border-green-200">
              <h4 className="font-medium text-sm text-green-800 mb-2">Current Metrics</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-green-600">FCP:</span>
                  <span className="ml-1 font-medium">{performanceMetrics.fcp.toFixed(0)}ms</span>
                </div>
                <div>
                  <span className="text-green-600">LCP:</span>
                  <span className="ml-1 font-medium">{performanceMetrics.lcp.toFixed(0)}ms</span>
                </div>
                <div>
                  <span className="text-green-600">FID:</span>
                  <span className="ml-1 font-medium">{performanceMetrics.fid.toFixed(0)}ms</span>
                </div>
                <div>
                  <span className="text-green-600">CLS:</span>
                  <span className="ml-1 font-medium">{performanceMetrics.cls.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-green-600">TTFB:</span>
                  <span className="ml-1 font-medium">{performanceMetrics.ttfb.toFixed(0)}ms</span>
                </div>
              </div>
            </div>

            {/* Performance History */}
            {performanceHistory.length > 0 && (
              <div className="bg-gray-50 p-3 rounded">
                <h4 className="font-medium text-sm mb-2">Recent Performance</h4>
                <div className="space-y-1">
                  {performanceHistory.slice(0, 5).map((perf, index) => (
                    <div key={index} className="flex justify-between text-xs">
                      <span className="text-gray-600">
                        {perf.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="text-gray-800">
                        FCP: {perf.fcp.toFixed(0)}ms • LCP: {perf.lcp.toFixed(0)}ms
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
