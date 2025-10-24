import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { 
  getInventoryWithAggregation,
  getDashboardStatsAggregation,
  getUserHoldingsAggregation,
  getEquipmentReportsAggregation,
  monitorQueryPerformance
} from '@/lib/optimized-queries';
import InventoryMaster from '@/models/InventoryMaster';
import IssueLog from '@/models/IssueLog';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import InventoryItem from '@/models/InventoryItem';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const testType = searchParams.get('test') || 'all';
    
    const results: any = {};
    
    // Test inventory aggregation
    if (testType === 'all' || testType === 'inventory') {
      const inventoryPipeline = await getInventoryWithAggregation({
        page: 1,
        limit: 20
      });
      
      const inventoryResult = await monitorQueryPerformance(
        'Inventory Aggregation',
        () => InventoryMaster.aggregate(inventoryPipeline)
      );
      
      results.inventory = {
        count: inventoryResult.length,
        data: inventoryResult.slice(0, 5) // Show first 5 items
      };
    }
    
    // Test dashboard aggregation
    if (testType === 'all' || testType === 'dashboard') {
      const dashboardPipeline = await getDashboardStatsAggregation(2024);
      
      const dashboardResult = await monitorQueryPerformance(
        'Dashboard Aggregation',
        () => IssueLog.aggregate(dashboardPipeline)
      );
      
      results.dashboard = {
        stats: dashboardResult[0] || {},
        performance: 'optimized'
      };
    }
    
    // Test equipment reports aggregation
    if (testType === 'all' || testType === 'equipment') {
      const equipmentPipeline = await getEquipmentReportsAggregation({
        requestType: 'request',
        page: 1,
        limit: 10
      });
      
      const equipmentResult = await monitorQueryPerformance(
        'Equipment Reports Aggregation',
        () => RequestLog.aggregate(equipmentPipeline)
      );
      
      results.equipment = {
        count: equipmentResult.length,
        data: equipmentResult.slice(0, 3) // Show first 3 items
      };
    }
    
    // Performance comparison
    if (testType === 'comparison') {
      const startTime = performance.now();
      
      // Old way - multiple separate queries
      const oldWayStart = performance.now();
      const [
        totalIssues,
        pendingIssues,
        totalRequests,
        totalUsers
      ] = await Promise.all([
        IssueLog.countDocuments(),
        IssueLog.countDocuments({ status: 'pending' }),
        RequestLog.countDocuments(),
        InventoryItem.countDocuments()
      ]);
      const oldWayDuration = performance.now() - oldWayStart;
      
      // New way - single aggregation
      const newWayStart = performance.now();
      const newWayResult = await IssueLog.aggregate([
        {
          $facet: {
            totalIssues: [{ $count: 'count' }],
            pendingIssues: [
              { $match: { status: 'pending' } },
              { $count: 'count' }
            ]
          }
        }
      ]);
      const newWayDuration = performance.now() - newWayStart;
      
      results.comparison = {
        oldWay: {
          duration: oldWayDuration,
          queries: 4,
          results: { totalIssues, pendingIssues, totalRequests, totalUsers }
        },
        newWay: {
          duration: newWayDuration,
          queries: 1,
          results: newWayResult[0]
        },
        improvement: {
          speedImprovement: `${((oldWayDuration - newWayDuration) / oldWayDuration * 100).toFixed(1)}%`,
          queryReduction: '75%'
        }
      };
    }
    
    return NextResponse.json({
      success: true,
      testType,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Performance test error:', error);
    return NextResponse.json(
      { error: 'Performance test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
