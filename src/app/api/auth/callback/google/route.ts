import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode, getUserProfile } from '@/lib/google-auth';

/**
 * Google OAuth Callback
 * จัดการหลังจากผู้ใช้ล็อกอิน Google สำเร็จ
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL('/login?error=google_auth_cancelled', request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/login?error=missing_auth_code', request.url)
      );
    }

    // Parse state to determine action
    let action = 'login';
    if (state) {
      try {
        const stateData = JSON.parse(state);
        action = stateData.action || 'login';
      } catch (e) {
        console.error('State parse error:', e);
      }
    }

    // Handle different actions
    if (action === 'register') {
      // For register action, get user profile first then redirect
      try {
        const tokens = await getTokensFromCode(code);
        if (!tokens.access_token) {
          throw new Error('No access token received');
        }

        const profile = await getUserProfile(tokens.access_token);
        if (!profile) {
          throw new Error('Failed to get user profile');
        }

        // Redirect to register page with profile data
        const profileParam = encodeURIComponent(JSON.stringify(profile));
        return NextResponse.redirect(
          new URL(`/auth/google-register?profile=${profileParam}`, request.url)
        );
      } catch (error) {
        console.error('Error getting profile for registration:', error);
        return NextResponse.redirect(
          new URL('/login?error=profile_fetch_failed', request.url)
        );
      }
    } else {
      // Handle login via API
      const response = await fetch(new URL('/api/auth/google-login', request.url).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, action }),
      });

      const data = await response.json();

      if (data.redirect) {
        return NextResponse.redirect(new URL(data.redirect, request.url));
      }

      if (data.success) {
        // Successful login
        const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url));
        
        // Copy all cookies from the API response
        const cookies = response.headers.getSetCookie();
        if (cookies && cookies.length > 0) {
          cookies.forEach(cookie => {
            redirectResponse.headers.append('set-cookie', cookie);
          });
        }
        
        return redirectResponse;
      } else {
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(data.error || 'authentication_failed')}`, request.url)
        );
      }
    }

  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/login?error=callback_error', request.url)
    );
  }
}