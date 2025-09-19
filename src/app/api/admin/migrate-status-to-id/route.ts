import { NextRequest, NextResponse } from 'next/server';
import { runStatusMigration, rollbackStatusMigration } from '@/scripts/migrate-status-to-id';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, dryRun = true } = body as { 
      action: 'migrate' | 'rollback' | 'analyze'; 
      dryRun?: boolean;
    };

    let result;
    
    switch (action) {
      case 'migrate':
        result = await runStatusMigration(dryRun);
        break;
        
      case 'rollback':
        result = await rollbackStatusMigration();
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: migrate, rollback' }, 
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      dryRun: action === 'migrate' ? dryRun : false,
      logs: result
    });

  } catch (error) {
    console.error('Status migration API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    info: 'Status Migration API',
    endpoints: {
      'POST /': {
        description: 'Run status migration',
        body: {
          action: 'migrate | rollback',
          dryRun: 'boolean (default: true for migrate)'
        }
      }
    },
    usage: [
      'POST with { "action": "migrate", "dryRun": true } - Dry run migration',
      'POST with { "action": "migrate", "dryRun": false } - Execute migration', 
      'POST with { "action": "rollback" } - Rollback migration'
    ]
  });
}
