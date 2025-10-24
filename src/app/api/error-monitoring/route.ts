import { NextRequest, NextResponse } from 'next/server';
import { createErrorHandler } from '@/lib/api-error-handler';

const errorHandler = createErrorHandler('error-monitoring');

/**
 * Error Monitoring API
 * เก็บและจัดการข้อมูล error logs และ performance metrics
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    switch (type) {
      case 'error':
        await logError(data);
        break;
      case 'performance':
        await logPerformance(data);
        break;
      case 'user-action':
        await logUserAction(data);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid log type' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    return errorHandler(error, request);
  }
}

/**
 * Get Error Statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';
    const timeRange = searchParams.get('timeRange') || '24h';

    switch (type) {
      case 'summary':
        const summary = await getErrorSummary(timeRange);
        return NextResponse.json(summary);
      
      case 'errors':
        const errors = await getErrorLogs(timeRange);
        return NextResponse.json(errors);
      
      case 'performance':
        const performance = await getPerformanceMetrics(timeRange);
        return NextResponse.json(performance);
      
      case 'health':
        const health = await getSystemHealth();
        return NextResponse.json(health);
      
      default:
        return NextResponse.json(
          { error: 'Invalid request type' },
          { status: 400 }
        );
    }

  } catch (error) {
    return errorHandler(error, request);
  }
}

/**
 * Log Error Data
 */
async function logError(data: any) {
  const errorLog = {
    message: data.message,
    stack: data.stack,
    component: data.component,
    url: data.url,
    userAgent: data.userAgent,
    userId: data.userId,
    timestamp: new Date(),
    severity: data.severity || 'error',
    metadata: data.metadata || {}
  };

  // In a real application, you would save this to a database
  console.log('📝 Error Log:', errorLog);
  
  // You could also send to external monitoring services like Sentry, LogRocket, etc.
  // await sendToMonitoringService(errorLog);
}

/**
 * Log Performance Data
 */
async function logPerformance(data: any) {
  const performanceLog = {
    fcp: data.fcp,
    lcp: data.lcp,
    fid: data.fid,
    cls: data.cls,
    ttfb: data.ttfb,
    url: data.url,
    userAgent: data.userAgent,
    userId: data.userId,
    timestamp: new Date(),
    metadata: data.metadata || {}
  };

  console.log('📊 Performance Log:', performanceLog);
}

/**
 * Log User Action
 */
async function logUserAction(data: any) {
  const actionLog = {
    action: data.action,
    component: data.component,
    url: data.url,
    userId: data.userId,
    timestamp: new Date(),
    metadata: data.metadata || {}
  };

  console.log('👤 User Action Log:', actionLog);
}

/**
 * Get Error Summary
 */
async function getErrorSummary(timeRange: string) {
  // In a real application, you would query your database
  // For now, return mock data
  const now = new Date();
  const timeRanges = {
    '1h': new Date(now.getTime() - 60 * 60 * 1000),
    '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
    '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  };

  const startTime = timeRanges[timeRange as keyof typeof timeRanges] || timeRanges['24h'];

  return {
    timeRange,
    startTime,
    endTime: now,
    totalErrors: Math.floor(Math.random() * 100),
    uniqueErrors: Math.floor(Math.random() * 20),
    errorRate: Math.random() * 0.1,
    topErrors: [
      { message: 'Network Error', count: 15 },
      { message: 'Validation Error', count: 12 },
      { message: 'Authentication Error', count: 8 }
    ],
    errorTrend: 'decreasing' // increasing, decreasing, stable
  };
}

/**
 * Get Error Logs
 */
async function getErrorLogs(timeRange: string) {
  // Mock data - in real app, query database
  return {
    errors: [
      {
        id: '1',
        message: 'Network Error',
        stack: 'Error: Network request failed\n    at fetch...',
        component: 'Dashboard',
        url: '/dashboard',
        timestamp: new Date(),
        count: 5
      },
      {
        id: '2',
        message: 'Validation Error',
        stack: 'Error: Invalid input\n    at validate...',
        component: 'Form',
        url: '/admin/inventory',
        timestamp: new Date(),
        count: 3
      }
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      hasMore: false
    }
  };
}

/**
 * Get Performance Metrics
 */
async function getPerformanceMetrics(timeRange: string) {
  // Mock data - in real app, query database
  return {
    metrics: {
      fcp: { avg: 1200, p95: 2000, p99: 3000 },
      lcp: { avg: 1800, p95: 3000, p99: 4500 },
      fid: { avg: 50, p95: 100, p99: 200 },
      cls: { avg: 0.1, p95: 0.2, p99: 0.3 },
      ttfb: { avg: 300, p95: 500, p99: 800 }
    },
    trends: {
      fcp: 'improving',
      lcp: 'stable',
      fid: 'improving',
      cls: 'stable',
      ttfb: 'degrading'
    },
    recommendations: [
      'Optimize images to improve LCP',
      'Reduce server response time for better TTFB',
      'Minimize layout shifts to improve CLS'
    ]
  };
}

/**
 * Get System Health
 */
async function getSystemHealth() {
  // Mock data - in real app, check actual system metrics
  return {
    status: 'healthy', // healthy, warning, critical
    uptime: '99.9%',
    responseTime: 150, // ms
    errorRate: 0.01, // 1%
    activeUsers: 25,
    systemLoad: 0.3,
    memoryUsage: 0.6,
    diskUsage: 0.4,
    lastChecked: new Date(),
    alerts: [
      {
        type: 'warning',
        message: 'High memory usage detected',
        timestamp: new Date()
      }
    ]
  };
}
