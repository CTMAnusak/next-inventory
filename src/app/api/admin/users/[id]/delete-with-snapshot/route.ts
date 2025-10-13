import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import { snapshotUserBeforeDelete, checkUserRelatedIssues } from '@/lib/snapshot-helpers';

/**
 * DELETE - ลบ User พร้อม Snapshot ข้อมูลล่าสุดใน IssueLog
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin token
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = verifyToken(token) as any;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin
    if (decoded.userRole !== 'admin' && !decoded.isMainAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await dbConnect();
    
    const { id } = await params;

    // 1. ตรวจสอบว่า User มีอยู่จริง
    const user = await User.findOne({ user_id: id });
    if (!user) {
      return NextResponse.json(
        { error: 'ไม่พบผู้ใช้ที่ต้องการลบ' },
        { status: 404 }
      );
    }

    // 2. ตรวจสอบว่ามีข้อมูลที่เกี่ยวข้องใน IssueLog หรือไม่
    const relatedIssues = await checkUserRelatedIssues(id);
    
    console.log(`📊 User ${id} has ${relatedIssues.total} related issues`);
    console.log(`   - As Requester: ${relatedIssues.asRequester}`);
    console.log(`   - As Admin: ${relatedIssues.asAdmin}`);

    // 3. Snapshot ข้อมูลล่าสุดก่อนลบ (ถ้ามีข้อมูลที่เกี่ยวข้อง)
    if (relatedIssues.hasRelatedIssues) {
      console.log(`📸 Creating snapshots for user ${id}...`);
      
      const snapshotResults = await snapshotUserBeforeDelete(id);
      
      console.log(`✅ Snapshot completed:`);
      console.log(`   - Requester: ${snapshotResults.requester.modifiedCount} issues`);
      console.log(`   - Admin: ${snapshotResults.admin.modifiedCount} issues`);
    } else {
      console.log(`ℹ️ No related issues found, skipping snapshot`);
    }

    // 4. ลบ User
    await User.deleteOne({ user_id: id });
    
    console.log(`✅ User ${id} deleted successfully`);

    return NextResponse.json({
      message: 'ลบผู้ใช้เรียบร้อยแล้ว',
      userId: id,
      relatedIssues: relatedIssues.total,
      snapshot: relatedIssues.hasRelatedIssues ? {
        requester: relatedIssues.asRequester,
        admin: relatedIssues.asAdmin
      } : null
    });

  } catch (error) {
    console.error('Error deleting user with snapshot:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบผู้ใช้' },
      { status: 500 }
    );
  }
}

