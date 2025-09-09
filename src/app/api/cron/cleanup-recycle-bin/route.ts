import { NextRequest, NextResponse } from 'next/server';
import { permanentDeleteExpiredItems } from '@/lib/recycle-bin-helpers';

/**
 * Auto-cleanup API for RecycleBin
 * This endpoint should be called by a cron job daily to cleanup expired items
 * 
 * Usage:
 * - Set up a cron job to call this endpoint daily
 * - Or use Vercel Cron Jobs if deployed on Vercel
 * - Or call manually from admin panel for testing
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authorization header check for cron jobs
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('❌ Unauthorized cron job request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🕒 Starting scheduled recycle bin cleanup...');
    console.log(`📅 Cleanup time: ${new Date().toISOString()}`);

    const result = await permanentDeleteExpiredItems();

    if (result.deletedCount > 0) {
      console.log(`✅ Cleanup completed: ${result.deletedCount} items permanently deleted`);
      console.log('📋 Deleted items:', result.items.map(item => 
        `${item.itemName} (SN: ${item.serialNumber || 'No SN'}) - Deleted: ${item.deletedAt.toISOString()}`
      ));
    } else {
      console.log('✅ Cleanup completed: No expired items found');
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup completed successfully`,
      deletedCount: result.deletedCount,
      cleanupTime: new Date().toISOString(),
      nextCleanup: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      deletedItems: result.items
    });

  } catch (error) {
    console.error('❌ Recycle Bin Cleanup Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        cleanupTime: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// GET - Check cleanup status (for monitoring)
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authorization for monitoring
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const RecycleBin = (await import('@/models/RecycleBin')).default;
    await (await import('@/lib/mongodb')).default();

    // Get statistics about recycle bin
    const totalItems = await RecycleBin.countDocuments({});
    const expiredItems = await RecycleBin.countDocuments({
      permanentDeleteAt: { $lte: new Date() }
    });
    const soonToExpire = await RecycleBin.countDocuments({
      permanentDeleteAt: { 
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        $gt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      statistics: {
        totalItems,
        expiredItems,
        soonToExpire,
        lastCheck: new Date().toISOString()
      },
      nextCleanup: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

  } catch (error) {
    console.error('❌ Recycle Bin Status Check Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Status check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
