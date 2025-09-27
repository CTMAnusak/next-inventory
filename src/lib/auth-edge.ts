// Lightweight JWT helpers for Edge Runtime (no Node APIs)

export function decodeJwtWithoutVerify(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    );
    if (decoded && decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function verifyTokenFromRequestEdge(request: any): any | null {
  try {
    const cookieHeader = request.headers.get('cookie');
    let actualToken: string | null = null;

    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map((c: string) => c.trim());
      for (const cookie of cookies) {
        if (cookie.startsWith('auth-token=')) {
          actualToken = cookie.split('=')[1];
          break;
        }
      }
    }

    if (!actualToken) {
      const authToken = request.cookies.get('auth-token')?.value;
      const token = request.cookies.get('token')?.value;
      actualToken = authToken || token || null;
    }

    if (!actualToken) return null;
    return decodeJwtWithoutVerify(actualToken);
  } catch {
    return null;
  }
}


