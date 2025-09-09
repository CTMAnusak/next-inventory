/**
 * Utility functions for handling authentication and token expiry
 */

/**
 * Handle 401 Unauthorized response (token expired)
 * @param response - The fetch response object
 * @param errorMessage - Custom error message to show
 */
export function handleTokenExpiry(response: Response, errorMessage?: string) {
  if (response.status === 401) {
    console.log('🔐 Token expired, redirecting to login...');
    
    // Clear auth token
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    // Show error message
    const message = errorMessage || 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
    
    // Use toast if available, otherwise use alert
    if (typeof window !== 'undefined' && (window as any).toast) {
      (window as any).toast.error(message);
    } else {
      alert(message);
    }
    
    // Redirect to login after a short delay
    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
    
    return true; // Indicates token expiry was handled
  }
  
  return false; // No token expiry
}

/**
 * Enhanced fetch wrapper that automatically handles token expiry
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param errorMessage - Custom error message for token expiry
 */
export async function fetchWithAuth(
  url: string, 
  options: RequestInit = {}, 
  errorMessage?: string
): Promise<Response> {
  const response = await fetch(url, options);
  
  // Handle token expiry automatically
  if (handleTokenExpiry(response, errorMessage)) {
    // Return a rejected promise to stop further processing
    throw new Error('Token expired - redirecting to login');
  }
  
  return response;
}

/**
 * Check if the current user is authenticated
 * @returns boolean indicating if user has valid token
 */
export function isAuthenticated(): boolean {
  if (typeof document === 'undefined') return false;
  
  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('auth-token='))
    ?.split('=')[1];
    
  if (!token) return false;
  
  try {
    // Decode JWT payload to check expiry
    const base64Payload = token.split('.')[1];
    const payload = JSON.parse(atob(base64Payload));
    const currentTime = Math.floor(Date.now() / 1000);
    
    return payload.exp > currentTime;
  } catch (error) {
    console.error('Error checking token validity:', error);
    return false;
  }
}

/**
 * Get remaining time until token expires (in seconds)
 * @returns number of seconds until expiry, or null if no valid token
 */
export function getTokenTimeRemaining(): number | null {
  if (typeof document === 'undefined') return null;
  
  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('auth-token='))
    ?.split('=')[1];
    
  if (!token) return null;
  
  try {
    const base64Payload = token.split('.')[1];
    const payload = JSON.parse(atob(base64Payload));
    const currentTime = Math.floor(Date.now() / 1000);
    
    return Math.max(0, payload.exp - currentTime);
  } catch (error) {
    console.error('Error getting token time remaining:', error);
    return null;
  }
}
