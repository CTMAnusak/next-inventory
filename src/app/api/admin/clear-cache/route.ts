import { NextRequest, NextResponse } from 'next/server';
import { clearAllCaches } from '@/lib/cache-utils';

export async function POST(request: NextRequest) {
  try {
    // Clear all caches in the system
    console.log('🧹 Admin - Clearing all caches...');
    
    // Clear holdings cache for all users
    clearAllCaches();
    
    console.log('✅ Admin - All caches cleared successfully');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cache cleared successfully' 
    });
  } catch (error) {
    console.error('❌ Admin - Error clearing cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' }, 
      { status: 500 }
    );
  }
}
