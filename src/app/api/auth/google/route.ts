import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-auth';

/**
 * เริ่มต้น Google OAuth flow
 * GET /api/auth/google?action=login|register&issueId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'login';
    const issueId = searchParams.get('issueId');
    
    // สร้าง state สำหรับเก็บข้อมูลเพิ่มเติม
    const state = JSON.stringify({
      action,
      issueId,
      timestamp: Date.now()
    });
    
    const authUrl = getAuthUrl(state);
    
    return NextResponse.json({ authUrl });
    
  } catch (error) {
    console.error('Google auth error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google' },
      { status: 500 }
    );
  }
}
