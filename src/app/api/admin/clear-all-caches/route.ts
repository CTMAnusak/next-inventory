import { NextRequest, NextResponse } from 'next/server';
import { clearAllCaches } from '@/lib/cache-utils';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Admin - Clearing all caches...');
    
    // Clear all caches in the system
    clearAllCaches();
    
    
    return NextResponse.json({ 
      success: true, 
      message: 'All caches cleared successfully' 
    });
  } catch (error) {
    console.error('❌ Admin - Error clearing all caches:', error);
    return NextResponse.json(
      { error: 'Failed to clear all caches' }, 
      { status: 500 }
    );
  }
}
