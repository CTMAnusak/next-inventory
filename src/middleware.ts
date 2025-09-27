import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyTokenFromRequestEdge } from './lib/auth-edge';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  console.log('🔍 Middleware triggered for:', pathname);
  
  // ตรวจสอบ authentication สำหรับทุกหน้าที่ต้องการการ login
  const isProtectedRoute = !pathname.startsWith('/login') && 
                           !pathname.startsWith('/register') &&
                           !pathname.startsWith('/auth/') &&
                           pathname !== '/';
  
  if (isProtectedRoute) {
    try {
      const payload = verifyTokenFromRequestEdge(request);
      
      if (!payload) {
        console.log('🚫 Middleware: No valid token found, redirecting to login');
        return NextResponse.redirect(new URL('/login', request.url));
      }

      // ตรวจสอบว่า user อยู่ในสถานะ pendingDeletion หรือไม่
      if (payload.pendingDeletion) {
        console.log('🚫 Middleware: User is pending deletion, forcing logout');
        const response = NextResponse.redirect(new URL('/login?error=account_pending_deletion', request.url));
        // ลบ auth token cookie
        response.cookies.delete('auth-token');
        return response;
      }
      
      // ตรวจสอบสิทธิ์ Admin เฉพาะหน้า Admin
      if (pathname.startsWith('/admin')) {
        const isAdmin = payload.isMainAdmin || 
                       payload.userRole === 'admin' || 
                       payload.userRole === 'it_admin';
        
        console.log('🔍 Middleware: Admin check -', { 
          userRole: payload.userRole, 
          isMainAdmin: payload.isMainAdmin, 
          isAdmin,
          pathname 
        });
        
        if (!isAdmin) {
          console.log('🚫 Middleware: User is not admin, redirecting to dashboard');
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        
        console.log('✅ Middleware: Admin access granted');
      } else {
        console.log('✅ Middleware: User access granted to:', pathname);
      }
    } catch (error) {
      console.log('❌ Middleware: Token verification error:', error);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (public assets)
     * - api (most API routes handle their own auth)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|assets|login).*)',
  ],
};
