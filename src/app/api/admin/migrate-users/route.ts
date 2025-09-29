import { NextRequest, NextResponse } from 'next/server';
import { migrateExistingUsersToNewSchema } from '@/scripts/migrate-existing-users-to-new-schema';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    // Verify admin token
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is main admin
    if (!decoded.isMainAdmin) {
      return NextResponse.json({ error: 'Only main admin can run migrations' }, { status: 403 });
    }

    const result = await migrateExistingUsersToNewSchema();

    return NextResponse.json({
      success: true,
      message: 'User migration completed',
      result: {
        total: result.total,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
        details: result.details.slice(0, 50) // Limit details to prevent large response
      }
    });

  } catch (error) {
    console.error('Migration API error:', error);
    return NextResponse.json(
      { 
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
