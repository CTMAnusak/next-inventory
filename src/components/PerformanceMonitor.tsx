import React, { useState, useEffect } from 'react';
import { Activity, Database, Zap, Clock, TrendingUp } from 'lucide-react';

interface PerformanceStats {
  pageLoadTime: number;
  apiResponseTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  databaseQueryTime: number;
}

interface PerformanceMonitorProps {
  showDetails?: boolean;
  className?: string;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ 
  showDetails = false, 
  className = '' 
}) => {
  const [stats, setStats] = useState<PerformanceStats>({
    pageLoadTime: 0,
    apiResponseTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    databaseQueryTime: 0
  });
  
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    // Monitor page load time
    const startTime = performance.now();
    
    const measurePageLoad = () => {
      const loadTime = performance.now() - startTime;
      setStats(prev => ({ ...prev, pageLoadTime: loadTime }));
    };
    
    // Monitor API response times
    const originalFetch = window.fetch;
    let totalApiTime = 0;
    let apiCallCount = 0;
    
    window.fetch = async (...args) => {
      const apiStartTime = performance.now();
      const response = await originalFetch(...args);
      const apiTime = performance.now() - apiStartTime;
      
      totalApiTime += apiTime;
      apiCallCount++;
      
      setStats(prev => ({
        ...prev,
        apiResponseTime: totalApiTime / apiCallCount
      }));
      
      return response;
    };
    
    // Monitor memory usage
    const updateMemoryStats = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setStats(prev => ({
          ...prev,
          memoryUsage: memory.usedJSHeapSize / 1024 / 1024 // Convert to MB
        }));
      }
    };
    
    // Initial measurements
    measurePageLoad();
    updateMemoryStats();
    
    // Update memory stats every 5 seconds
    const memoryInterval = setInterval(updateMemoryStats, 5000);
    
    // Cleanup
    return () => {
      window.fetch = originalFetch;
      clearInterval(memoryInterval);
    };
  }, []);
  
  const getPerformanceColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const getPerformanceIcon = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return '🟢';
    if (value <= thresholds.warning) return '🟡';
    return '🔴';
  };
  
  if (!isVisible) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <button
          onClick={() => setIsVisible(true)}
          className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          title="แสดง Performance Monitor"
        >
          <Activity className="w-5 h-5" />
        </button>
      </div>
    );
  }
  
  return (
    <div className={`fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-xl border p-4 w-80 ${className}`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          <Zap className="w-4 h-4 mr-1" />
          Performance Monitor
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2">
        {/* Page Load Time */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-600">Page Load:</span>
          <span className={getPerformanceColor(stats.pageLoadTime, { good: 1000, warning: 2000 })}>
            {getPerformanceIcon(stats.pageLoadTime, { good: 1000, warning: 2000 })}
            {stats.pageLoadTime.toFixed(0)}ms
          </span>
        </div>
        
        {/* API Response Time */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-600">API Response:</span>
          <span className={getPerformanceColor(stats.apiResponseTime, { good: 200, warning: 500 })}>
            {getPerformanceIcon(stats.apiResponseTime, { good: 200, warning: 500 })}
            {stats.apiResponseTime.toFixed(0)}ms
          </span>
        </div>
        
        {/* Memory Usage */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-600">Memory:</span>
          <span className={getPerformanceColor(stats.memoryUsage, { good: 50, warning: 100 })}>
            {getPerformanceIcon(stats.memoryUsage, { good: 50, warning: 100 })}
            {stats.memoryUsage.toFixed(1)}MB
          </span>
        </div>
        
        {showDetails && (
          <>
            {/* Cache Hit Rate */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-600">Cache Hit Rate:</span>
              <span className={getPerformanceColor(stats.cacheHitRate, { good: 80, warning: 60 })}>
                {getPerformanceIcon(stats.cacheHitRate, { good: 80, warning: 60 })}
                {stats.cacheHitRate.toFixed(1)}%
              </span>
            </div>
            
            {/* Database Query Time */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-600">DB Query:</span>
              <span className={getPerformanceColor(stats.databaseQueryTime, { good: 100, warning: 300 })}>
                {getPerformanceIcon(stats.databaseQueryTime, { good: 100, warning: 300 })}
                {stats.databaseQueryTime.toFixed(0)}ms
              </span>
            </div>
          </>
        )}
      </div>
      
      {/* Performance Tips */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          {stats.pageLoadTime > 2000 && (
            <div className="mb-1">💡 หน้าเว็บโหลดช้า - ลองใช้ pagination</div>
          )}
          {stats.apiResponseTime > 500 && (
            <div className="mb-1">💡 API ช้า - ตรวจสอบ database indexes</div>
          )}
          {stats.memoryUsage > 100 && (
            <div className="mb-1">💡 ใช้หน่วยความจำมาก - ล้าง cache</div>
          )}
        </div>
      </div>
    </div>
  );
};

export const PerformanceBadge: React.FC<{ 
  loadTime: number; 
  className?: string; 
}> = ({ loadTime, className = '' }) => {
  const getColor = () => {
    if (loadTime <= 1000) return 'bg-green-100 text-green-800';
    if (loadTime <= 2000) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };
  
  const getIcon = () => {
    if (loadTime <= 1000) return '🟢';
    if (loadTime <= 2000) return '🟡';
    return '🔴';
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getColor()} ${className}`}>
      {getIcon()} {loadTime.toFixed(0)}ms
    </span>
  );
};

export const LoadingPerformanceTracker: React.FC<{
  onLoadComplete: (loadTime: number) => void;
  children: React.ReactNode;
}> = ({ onLoadComplete, children }) => {
  const [startTime] = useState(performance.now());
  
  useEffect(() => {
    const loadTime = performance.now() - startTime;
    onLoadComplete(loadTime);
  }, [startTime, onLoadComplete]);
  
  return <>{children}</>;
};
