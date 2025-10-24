import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { createPerformanceIndexes, analyzeQueryPerformance, cleanupUnusedIndexes, resolveIndexConflicts } from '@/lib/database-optimization';
import { createInitialInventoryConfig } from '@/lib/create-initial-config';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Handle empty body gracefully
    let action = 'create-indexes'; // Default action
    try {
      const body = await request.json();
      action = body.action || 'create-indexes';
    } catch (jsonError) {
      // If no JSON body, use default action
      console.log('No JSON body provided, using default action:', action);
    }
    
    switch (action) {
      case 'create-indexes':
        await createPerformanceIndexes();
        return NextResponse.json({ 
          success: true, 
          message: 'Performance indexes created successfully' 
        });
        
      case 'analyze-performance':
        await analyzeQueryPerformance();
        return NextResponse.json({ 
          success: true, 
          message: 'Query performance analysis completed' 
        });
        
      case 'cleanup-indexes':
        await cleanupUnusedIndexes();
        return NextResponse.json({ 
          success: true, 
          message: 'Index cleanup completed' 
        });
        
      case 'resolve-conflicts':
        await resolveIndexConflicts();
        return NextResponse.json({ 
          success: true, 
          message: 'Index conflicts resolved' 
        });
        
      case 'create-initial-config':
        await createInitialInventoryConfig();
        return NextResponse.json({ 
          success: true, 
          message: 'Initial InventoryConfig created successfully' 
        });
        
      case 'full-optimization':
        await resolveIndexConflicts();
        await createPerformanceIndexes();
        await analyzeQueryPerformance();
        return NextResponse.json({ 
          success: true, 
          message: 'Full database optimization completed' 
        });
        
      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use: create-indexes, analyze-performance, cleanup-indexes, resolve-conflicts, create-initial-config, or full-optimization' 
        }, { status: 400 });
    }
    
  } catch (error: any) {
    console.error('Database optimization error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการปรับปรุงฐานข้อมูล', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
