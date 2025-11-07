import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';
import User from '@/models/User';
import { populateIssueInfoBatchOptimized } from '@/lib/issue-helpers-optimized';

// 🚀 GET - Fetch IT issues with pagination and optimized queries
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50'); // Default 50 items per page
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';
    const getAll = searchParams.get('all') === 'true'; // Option to get all data

    // Build filter
    const filter: any = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { issueId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (getAll) {
      // For Excel export or when explicitly requesting all data
      const issues = await IssueLog.find(filter)
        .sort({ reportDate: -1 })
        .lean(); // Use lean() for better performance
      
      const populatedIssues = await populateIssueInfoBatchOptimized(issues);
      
      return NextResponse.json({
        issues: populatedIssues,
        pagination: {
          page: 1,
          limit: issues.length,
          total: issues.length,
          pages: 1
        }
      });
    }

    // Paginated query
    const skip = (page - 1) * limit;

    // Sort: pending items by urgency and date, others by date
    const sortCriteria: any = {};
    if (status === 'pending') {
      sortCriteria.urgency = -1; // very_urgent first
      sortCriteria.reportDate = 1; // oldest first
    } else {
      sortCriteria.reportDate = -1; // newest first
    }

    // Execute queries in parallel
    const [issues, total] = await Promise.all([
      IssueLog.find(filter)
        .sort(sortCriteria)
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for better performance
      IssueLog.countDocuments(filter)
    ]);

    // 🚀 Use optimized batch populate (4-6 queries instead of 200+)
    const populatedIssues = await populateIssueInfoBatchOptimized(issues);
    
    return NextResponse.json({
      issues: populatedIssues,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching IT issues:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
