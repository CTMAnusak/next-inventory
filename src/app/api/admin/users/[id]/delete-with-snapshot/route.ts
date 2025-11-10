import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import IssueLog from '@/models/IssueLog';
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

    // 2. ตรวจสอบงานแจ้ง IT ที่ยังไม่ปิด
    const openIssueFilter = { status: { $ne: 'closed' } };

    type IssueSummary = { issueId: string; status: string; issueCategory?: string };

    const [requesterIssuesRaw, assigneeIssuesRaw] = await Promise.all([
      IssueLog.find({
        requesterId: id,
        ...openIssueFilter
      })
        .select('issueId status issueCategory')
        .lean<IssueSummary>(),
      IssueLog.find({
        assignedAdminId: id,
        ...openIssueFilter
      })
        .select('issueId status issueCategory')
        .lean<IssueSummary>()
    ]);

    const normalizeIssues = (issues: unknown): IssueSummary[] => {
      if (!Array.isArray(issues)) {
        return [];
      }

      return issues
        .filter(
          (issue): issue is { issueId: unknown; status: unknown; issueCategory?: unknown } =>
            typeof issue === 'object' &&
            issue !== null &&
            'issueId' in issue &&
            'status' in issue
        )
        .map(issue => ({
          issueId: String((issue as { issueId: unknown }).issueId),
          status: String((issue as { status: unknown }).status),
          issueCategory:
            (issue as { issueCategory?: unknown }).issueCategory !== undefined
              ? String((issue as { issueCategory?: unknown }).issueCategory)
              : undefined
        }));
    };

    const requesterIssues = normalizeIssues(requesterIssuesRaw);
    const assigneeIssues = normalizeIssues(assigneeIssuesRaw);

    const totalOpenIssues = requesterIssues.length + assigneeIssues.length;

    if (totalOpenIssues > 0) {
      const formatIssues = (issues: IssueSummary[]) => issues.slice(0, 10);

      const messageParts: string[] = [];
      if (requesterIssues.length > 0) {
        messageParts.push(`• ผู้ใช้นี้เป็นผู้แจ้งงานจำนวน ${requesterIssues.length} รายการ`);
      }
      if (assigneeIssues.length > 0) {
        messageParts.push(`• ผู้ใช้นี้เป็นผู้รับผิดชอบงานจำนวน ${assigneeIssues.length} รายการ`);
      }

      const detailedMessage = [
        'ไม่สามารถลบผู้ใช้ได้ เนื่องจากยังมีงานแจ้ง IT ที่สถานะยังไม่ถูกปิด',
        ...messageParts,
        'กรุณาปิดงานทั้งหมดให้เรียบร้อยก่อนดำเนินการลบอีกครั้ง'
      ].join('\n');

      return NextResponse.json(
        {
          error: 'ไม่สามารถลบผู้ใช้ได้',
          message: detailedMessage,
          hasOpenIssues: true,
          openIssues: {
            total: totalOpenIssues,
            asRequester: requesterIssues.length,
            asAssignee: assigneeIssues.length,
            requesterIssues: formatIssues(requesterIssues),
            assigneeIssues: formatIssues(assigneeIssues)
          }
        },
        { status: 400 }
      );
    }

    // 3. ตรวจสอบว่ามีข้อมูลที่เกี่ยวข้องใน IssueLog หรือไม่ (รวมงานทั้งหมด เพื่อสร้าง snapshot)
    const relatedIssues = await checkUserRelatedIssues(id);
    
    console.log(`📊 User ${id} has ${relatedIssues.total} related issues`);
    console.log(`   - As Requester: ${relatedIssues.asRequester}`);
    console.log(`   - As Admin: ${relatedIssues.asAdmin}`);

    // 4. Snapshot ข้อมูลล่าสุดก่อนลบ (ถ้ามีข้อมูลที่เกี่ยวข้อง)
    if (relatedIssues.hasRelatedIssues) {
      console.log(`📸 Creating snapshots for user ${id}...`);
      
      const snapshotResults = await snapshotUserBeforeDelete(id);
      
      console.log(`✅ Snapshot completed:`);
      const results = snapshotResults as any;
      console.log(`   - Requester: ${results.requester?.modifiedCount || results.issues?.requester?.modifiedCount || 0} issues`);
      console.log(`   - Admin: ${results.admin?.modifiedCount || results.issues?.admin?.modifiedCount || 0} issues`);
    } else {
      console.log(`ℹ️ No related issues found, skipping snapshot`);
    }

    // 5. ลบ User
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

