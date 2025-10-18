import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyTokenFromRequestEdge } from './lib/auth-edge';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  
  // ตรวจสอบ authentication สำหรับทุกหน้าที่ต้องการการ login
  const isProtectedRoute = !pathname.startsWith('/login') && 
                           !pathname.startsWith('/register') &&
                           !pathname.startsWith('/auth/') &&
                           pathname !== '/';
  
  if (isProtectedRoute) {
    try {
      const payload = verifyTokenFromRequestEdge(request);
      
      if (!payload) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      // ตรวจสอบว่า user อยู่ในสถานะ pendingDeletion หรือไม่
      if (payload.pendingDeletion) {
        const response = NextResponse.redirect(new URL('/login?error=account_pending_deletion', request.url));
        // ลบ auth token cookie
        response.cookies.delete('auth-token');
        return response;
      }

      // ตรวจสอบเพิ่มเติม: เรียก API auth check เพื่อตรวจสอบสถานะผู้ใช้ในฐานข้อมูล
      // (เฉพาะสำหรับการเข้าถึงหน้าที่สำคัญ)
      if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
        try {
          const authCheckResponse = await fetch(new URL('/api/auth/check', request.url), {
            headers: {
              'Cookie': request.headers.get('cookie') || '',
            },
          });
          
          if (!authCheckResponse.ok) {
            const response = NextResponse.redirect(new URL('/login?error=session_expired', request.url));
            response.cookies.delete('auth-token');
            return response;
          }
        } catch (error) {
          // ถ้าไม่สามารถตรวจสอบได้ ให้ผ่านไป (ป้องกันการบล็อกที่ไม่จำเป็น)
          console.log('⚠️ Middleware: Auth check failed, allowing access');
        }
      }
      
      // ตรวจสอบสิทธิ์ Admin เฉพาะหน้า Admin
      if (pathname.startsWith('/admin')) {
        const isAdmin = payload.isMainAdmin || 
                       payload.userRole === 'admin' || 
                       payload.userRole === 'it_admin';
        
        if (!isAdmin) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        
      } else {
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
