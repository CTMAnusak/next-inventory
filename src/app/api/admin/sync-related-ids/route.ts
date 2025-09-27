import { NextRequest, NextResponse } from 'next/server';
import { syncAllRelatedItemIds } from '@/lib/inventory-helpers';

export async function POST(request: NextRequest) {
  try {
    const result = await syncAllRelatedItemIds();
    
    return NextResponse.json({
      success: true,
      message: 'RelatedItemIds sync completed successfully',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to sync relatedItemIds',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
