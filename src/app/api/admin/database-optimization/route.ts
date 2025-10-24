import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { createPerformanceIndexes, analyzeQueryPerformance, cleanupUnusedIndexes } from '@/lib/database-optimization';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { action } = await request.json();
    
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
        
      case 'full-optimization':
        await createPerformanceIndexes();
        await analyzeQueryPerformance();
        return NextResponse.json({ 
          success: true, 
          message: 'Full database optimization completed' 
        });
        
      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use: create-indexes, analyze-performance, cleanup-indexes, or full-optimization' 
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
