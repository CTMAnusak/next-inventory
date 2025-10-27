'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  componentCount: number;
  lastUpdate: Date;
}

interface PerformanceMonitorProps {
  componentName: string;
  children: React.ReactNode;
  enableLogging?: boolean;
  logThreshold?: number; // Log if render time exceeds this threshold (ms)
}

export default function PerformanceMonitor({
  componentName,
  children,
  enableLogging = false,
  logThreshold = 100
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    componentCount: 0,
    lastUpdate: new Date()
  });
  
  const renderStartTime = useRef<number>(0);
  const componentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    renderStartTime.current = performance.now();
    
    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      
      // Get memory usage if available
      const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
      
      const newMetrics: PerformanceMetrics = {
        renderTime,
        memoryUsage,
        componentCount: React.Children.count(children),
        lastUpdate: new Date()
      };
      
      setMetrics(newMetrics);
      
      // Log performance if enabled and exceeds threshold
      if (enableLogging && renderTime > logThreshold) {
        console.warn(`🐌 Slow render detected in ${componentName}:`, {
          renderTime: `${renderTime.toFixed(2)}ms`,
          memoryUsage: `${(memoryUsage / 1024 / 1024).toFixed(2)}MB`,
          componentCount: newMetrics.componentCount
        });
      }
    };
  }, [children, componentName, enableLogging, logThreshold]);

  return (
    <div ref={componentRef} data-component={componentName}>
      {children}
    </div>
  );
}

// Hook for measuring component performance
export function usePerformanceMonitor(componentName: string) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    componentCount: 0,
    lastUpdate: new Date()
  });
  
  const measureRender = useCallback((callback: () => void) => {
    const startTime = performance.now();
    callback();
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
    
    setMetrics(prev => ({
      ...prev,
      renderTime,
      memoryUsage,
      lastUpdate: new Date()
    }));
    
    return renderTime;
  }, []);

  return { metrics, measureRender };
}

// Hook for measuring API call performance
export function useApiPerformanceMonitor() {
  const [apiMetrics, setApiMetrics] = useState<Record<string, {
    duration: number;
    timestamp: Date;
    success: boolean;
  }>>({});

  const measureApiCall = useCallback(async <T,>(
    apiCall: () => Promise<T>,
    endpoint: string
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await apiCall();
      const duration = performance.now() - startTime;
      
      setApiMetrics(prev => ({
        ...prev,
        [endpoint]: {
          duration,
          timestamp: new Date(),
          success: true
        }
      }));
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      setApiMetrics(prev => ({
        ...prev,
        [endpoint]: {
          duration,
          timestamp: new Date(),
          success: false
        }
      }));
      
      throw error;
    }
  }, []);

  return { apiMetrics, measureApiCall };
}