import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';
import User from '@/models/User';
import { populateIssueInfoBatch } from '@/lib/issue-helpers';

// GET - Fetch all IT issues
export async function GET() {
  try {
    await dbConnect();
    
    const issues = await IssueLog.find({})
      .populate('userId', 'firstName lastName nickname department office phone pendingDeletion')
      .sort({ reportDate: -1 });
    
    // Populate both requester and admin information
    const populatedIssues = await populateIssueInfoBatch(issues);
    
    return NextResponse.json(populatedIssues);
  } catch (error) {
    console.error('Error fetching IT issues:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
