import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const payload = verifyTokenFromRequest(request);
    
    console.log('- Cookie header:', request.headers.get('cookie'));
    console.log('- JWT payload:', payload);
    
    return NextResponse.json({
      success: true,
      payload: payload,
      cookieHeader: request.headers.get('cookie')
    });
  } catch (error) {
    console.error('Debug token error:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    });
  }
}
