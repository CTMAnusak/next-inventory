import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';
import { sendIssueUpdateNotification } from '@/lib/email';

// Update issue status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { status, notes } = await request.json();

    if (!status) {
      return NextResponse.json(
        { error: 'กรุณาระบุสถานะ' },
    { status: 400 }
  );
}

await dbConnect();

const { id } = await params;
const issue = await IssueLog.findById(id);
if (!issue) {
      return NextResponse.json(
        { error: 'ไม่พบรายการแจ้งงานนี้' },
        { status: 404 }
      );
    }

    // Update issue
    const updateData: any = { status };
    
    if (status === 'completed') {
      updateData.completedDate = new Date();
    } else if (status === 'closed') {
      updateData.closedDate = new Date();
    }
    
    if (notes) {
      updateData.notes = notes;
    }

  const updatedIssue = await IssueLog.findByIdAndUpdate(
    id,
    updateData,
    { new: true }
  );

    // Send email notification when status changes to completed
    if (status === 'completed') {
      try {
        await sendIssueUpdateNotification(updatedIssue);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      message: 'อัพเดตสถานะเรียบร้อยแล้ว',
      issue: updatedIssue
    });

  } catch (error) {
    console.error('Update issue error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}

// Get single issue
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const { id } = await params;
    const issue = await IssueLog.findById(id);
    if (!issue) {
      return NextResponse.json(
        { error: 'ไม่พบรายการแจ้งงานนี้' },
        { status: 404 }
      );
    }

    return NextResponse.json(issue);

  } catch (error) {
    console.error('Fetch issue error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
