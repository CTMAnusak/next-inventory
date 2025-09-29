import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export function generateToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }); // 7 วันสำหรับการใช้งานจริง
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Edge Runtime compatible token verification
export function verifyTokenEdge(token: string): any {
  try {
    // Simple JWT decode without signature verification for Edge Runtime
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check expiration
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
}

// Helper function สำหรับ verifyToken จาก NextRequest (Node.js Runtime)
export function verifyTokenFromRequest(request: any): any {
  try {
    // ใช้ manual parsing เป็นหลัก (เพราะ NextJS cookies API มีปัญหา)
    const cookieHeader = request.headers.get('cookie');
    let actualToken = null;
    
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim());
      for (const cookie of cookies) {
        if (cookie.startsWith('auth-token=')) {
          actualToken = cookie.split('=')[1];
          break;
        }
      }
    }
    
    // Fallback: ลองใช้ NextJS cookies API
    if (!actualToken) {
      const authToken = request.cookies.get('auth-token')?.value;
      const token = request.cookies.get('token')?.value;
      actualToken = authToken || token;
    }
    
    if (!actualToken) {
      console.log('❌ No auth-token found in cookies');
      return null;
    }
    
    return jwt.verify(actualToken, JWT_SECRET);
  } catch (error) {
    console.log('❌ Token verification error:', error.message);
    return null;
  }
}

// Edge Runtime compatible helper function
export function verifyTokenFromRequestEdge(request: any): any {
  try {
    // ใช้ manual parsing เป็นหลัก (เพราะ NextJS cookies API มีปัญหา)
    const cookieHeader = request.headers.get('cookie');
    let actualToken = null;
    
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map((c: string) => c.trim());
      for (const cookie of cookies) {
        if (cookie.startsWith('auth-token=')) {
          actualToken = cookie.split('=')[1];
          break;
        }
      }
    }
    
    // Fallback: ลองใช้ NextJS cookies API
    if (!actualToken) {
      const authToken = request.cookies.get('auth-token')?.value;
      const token = request.cookies.get('token')?.value;
      actualToken = authToken || token;
    }
    
    if (!actualToken) {
      console.log('❌ No auth-token found in cookies');
      return null;
    }
    
    return verifyTokenEdge(actualToken);
  } catch (error) {
    console.log('❌ Token verification error:', error);
    return null;
  }
}

export function generateIssueId(): string {
  return 'IT' + Date.now() + Math.floor(Math.random() * 1000);
}
