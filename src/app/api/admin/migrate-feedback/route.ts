import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    console.log('Connected to MongoDB');
    
    // หา documents ที่มี userFeedback แต่ไม่มี userFeedbackHistory
    const issuesWithFeedback = await IssueLog.find({
      userFeedback: { $exists: true, $ne: null },
      userFeedbackHistory: { $exists: false }
    });
    
    console.log(`Found ${issuesWithFeedback.length} issues to migrate`);
    
    let migratedCount = 0;
    
    for (const issue of issuesWithFeedback) {
      const updateData: any = {
        userFeedbackHistory: [issue.userFeedback]
      };
      
      // ถ้ามี notes แต่ไม่มี notesHistory ก็ย้ายด้วย
      if (issue.notes && !issue.notesHistory) {
        updateData.notesHistory = [{
          note: issue.notes,
          adminId: issue.assignedAdminId || 'unknown',
          adminName: issue.assignedAdmin?.name || 'Admin',
          createdAt: issue.completedDate || issue.updatedAt || new Date()
        }];
      }
      
      await IssueLog.findByIdAndUpdate(issue._id, updateData);
      
      migratedCount++;
      console.log(`Migrated issue ${issue.issueId} (${migratedCount}/${issuesWithFeedback.length})`);
    }
    
    return NextResponse.json({
      success: true,
      message: `Migration completed! Migrated ${migratedCount} issues`,
      migratedCount
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error },
      { status: 500 }
    );
  }
}
