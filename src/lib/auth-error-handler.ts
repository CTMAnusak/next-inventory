/**
 * Authentication Error Handler
 * จัดการ 401/403 errors แบบ centralized
 */

/**
 * ตรวจสอบและจัดการ authentication errors
 * @param response - Response object จาก fetch
 * @returns true ถ้าเป็น auth error และได้ redirect แล้ว, false ถ้าไม่ใช่ auth error
 */
export function handleAuthError(response: Response): boolean {
  if (response.status === 401) {
    console.log('❌ User authentication failed (401), redirecting to login');
    if (typeof window !== 'undefined') {
      window.location.href = '/login?error=session_expired';
    }
    return true;
  }
  
  if (response.status === 403) {
    console.log('❌ User access denied (403), redirecting to login');
    if (typeof window !== 'undefined') {
      window.location.href = '/login?error=access_denied';
    }
    return true;
  }
  
  return false;
}

/**
 * Wrapper สำหรับ fetch ที่จัดการ auth errors อัตโนมัติ
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Promise<Response | null> - null ถ้าเป็น auth error
 */
export async function fetchWithAuthErrorHandling(
  url: string, 
  options: RequestInit = {}
): Promise<Response | null> {
  try {
    const response = await fetch(url, options);
    
    // จัดการ auth errors
    if (handleAuthError(response)) {
      return null;
    }
    
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}
