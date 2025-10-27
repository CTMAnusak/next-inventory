import { NextRequest, NextResponse } from 'next/server';

interface ErrorContext {
  endpoint: string;
  method: string;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
  userId?: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  errorCode?: string;
  details?: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Enhanced Error Handling for API Routes
 * จัดการ error แบบผู้เชี่ยวชาญพร้อม logging และ monitoring
 */
export class ApiError extends Error {
  public statusCode: number;
  public errorCode: string;
  public context?: ErrorContext;

  constructor(
    message: string, 
    statusCode: number = 500, 
    errorCode: string = 'INTERNAL_ERROR',
    context?: ErrorContext
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.context = context;
  }
}

/**
 * Error Handler Factory
 */
export function createErrorHandler(endpoint: string) {
  return function handleApiError(
    error: unknown, 
    request: NextRequest,
    context?: Partial<ErrorContext>
  ): NextResponse<ErrorResponse> {
    
    const errorContext: ErrorContext = {
      endpoint,
      method: request.method,
      timestamp: new Date(),
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown',
      ...context
    };

    // Generate unique request ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Enhanced error logging
    console.error('🚨 API Error:', {
      requestId,
      endpoint,
      method: request.method,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: errorContext,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries())
    });

    // Handle different error types
    if (error instanceof ApiError) {
      return NextResponse.json({
        success: false,
        error: error.message,
        errorCode: error.errorCode,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: errorContext.timestamp.toISOString(),
        requestId
      }, { status: error.statusCode });
    }

    // Handle validation errors
    if (error instanceof Error && error.name === 'ValidationError') {
      return NextResponse.json({
        success: false,
        error: 'ข้อมูลไม่ถูกต้อง',
        errorCode: 'VALIDATION_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: errorContext.timestamp.toISOString(),
        requestId
      }, { status: 400 });
    }

    // Handle database connection errors
    if (error instanceof Error && error.message.includes('MongoServerError')) {
      return NextResponse.json({
        success: false,
        error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล',
        errorCode: 'DATABASE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: errorContext.timestamp.toISOString(),
        requestId
      }, { status: 503 });
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return NextResponse.json({
        success: false,
        error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง',
        errorCode: 'INVALID_JSON',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: errorContext.timestamp.toISOString(),
        requestId
      }, { status: 400 });
    }

    // Handle timeout errors
    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json({
        success: false,
        error: 'การดำเนินการใช้เวลานานเกินไป',
        errorCode: 'TIMEOUT_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: errorContext.timestamp.toISOString(),
        requestId
      }, { status: 408 });
    }

    // Handle network errors
    if (error instanceof Error && error.message.includes('fetch')) {
      return NextResponse.json({
        success: false,
        error: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
        errorCode: 'NETWORK_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: errorContext.timestamp.toISOString(),
        requestId
      }, { status: 503 });
    }

    // Default error handler
    return NextResponse.json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ',
      errorCode: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : String(error)) : undefined,
      timestamp: errorContext.timestamp.toISOString(),
      requestId
    }, { status: 500 });
  };
}

/**
 * Async Error Wrapper for API Routes
 */
export function withErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
  endpoint: string
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      const request = args[0] as NextRequest;
      const errorHandler = createErrorHandler(endpoint);
      return errorHandler(error, request);
    }
  };
}

/**
 * Request Validation Helper
 */
export function validateRequest(
  request: NextRequest,
  requiredFields: string[] = [],
  requiredHeaders: string[] = []
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate required fields in body
  if (requiredFields.length > 0 && request.method !== 'GET') {
    try {
      // Note: This is a synchronous validation, actual body parsing should be done in the API handler
      // For now, we'll skip body validation in this sync function
      // Body validation should be done after await request.json() in the actual API handler
    } catch (error) {
      errors.push('Invalid JSON body');
    }
  }

  // Validate required headers
  requiredHeaders.forEach(header => {
    if (!request.headers.get(header)) {
      errors.push(`Missing required header: ${header}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Rate Limiting Helper
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = identifier;
  const current = rateLimitMap.get(key);

  if (!current || now > current.resetTime) {
    // Reset or create new entry
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: now + windowMs
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime
    };
  }

  // Increment count
  current.count++;
  rateLimitMap.set(key, current);

  return {
    allowed: true,
    remaining: limit - current.count,
    resetTime: current.resetTime
  };
}

/**
 * Performance Monitoring Helper
 */
export function withPerformanceMonitoring<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
  endpoint: string
) {
  return async (...args: T): Promise<NextResponse> => {
    const startTime = Date.now();
    const request = args[0] as NextRequest;
    
    try {
      const response = await handler(...args);
      const duration = Date.now() - startTime;
      
      // Log performance metrics
      console.log(`📊 Performance: ${endpoint} - ${duration}ms - ${response.status}`);
      
      // Add performance headers
      response.headers.set('X-Response-Time', `${duration}ms`);
      response.headers.set('X-Endpoint', endpoint);
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Performance: ${endpoint} - ${duration}ms - ERROR`);
      throw error;
    }
  };
}
