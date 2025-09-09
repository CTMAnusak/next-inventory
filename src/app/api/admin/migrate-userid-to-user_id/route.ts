import { NextRequest, NextResponse } from 'next/server';
import migrateUserIdToUserId from '@/scripts/migrate-userid-to-user_id';

export async function POST(request: NextRequest) {
  try {
    await migrateUserIdToUserId();
    
    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully'
    });
  } catch (error) {
    console.error('Migration API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Migration failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
