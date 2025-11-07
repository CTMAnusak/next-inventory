import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';
import { sendIssueNotification } from '@/lib/email';
import { generateIssueId } from '@/lib/auth';
import { populateIssueInfoBatch, formatIssueForEmail } from '@/lib/issue-helpers';
import { authenticateUser } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const reportData = await request.json();
    console.log('📝 Received report data:', reportData);
    console.log('📝 Form data - firstName:', reportData.firstName);
    console.log('📝 Form data - lastName:', reportData.lastName);
    console.log('📝 Form data - phone:', reportData.phone);
    console.log('📝 Form data - email:', reportData.email);

    // Validate required fields (including email for notifications)
    const requiredFields = ['firstName', 'lastName', 'nickname', 'phone', 'email', 'department', 'office', 'issueCategory', 'urgency', 'description'];
    
    for (const field of requiredFields) {
      if (!reportData[field] || reportData[field].toString().trim() === '') {
        console.error(`Missing required field: ${field}`, reportData[field]);
        return NextResponse.json(
          { error: `กรุณากรอก ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate custom category if "อื่น ๆ (โปรดระบุ)" is selected
    if (reportData.issueCategory === 'อื่น ๆ (โปรดระบุ)' && !reportData.customCategory) {
      return NextResponse.json(
        { error: 'กรุณาระบุประเภทปัญหา' },
        { status: 400 }
      );
    }

    await dbConnect();
    console.log('Database connected successfully');

    // 🆕 ตรวจสอบ authentication และ user ใน database
    const { error, user } = await authenticateUser(request);
    if (error) return error;

    // Generate unique Issue ID
    const issueId = generateIssueId();
    console.log('Generated issue ID:', issueId);

    // Determine requester type and ID
    const requesterType = reportData.requesterType || user.userType;
    const requesterId = reportData.requesterId || user.user_id; // ✅ เก็บ ID สำหรับทั้ง individual และ branch
    const officeId = user.officeId; // ✅ เก็บ office ID สำหรับ populate (ไม่ใช่ชื่อสาขา)
    const officeName = user.officeName || user.office || reportData.office; // ✅ เก็บชื่อสาขา

    const newIssue = new IssueLog({
      issueId,
      requesterType,
      requesterId,  // ✅ เก็บสำหรับทั้ง individual และ branch
      officeId,     // ✅ เก็บ office ID (จาก user.officeId)
      officeName,   // ✅ เก็บชื่อสาขา (จาก user.officeName)
      firstName: reportData.firstName,
      lastName: reportData.lastName,
      nickname: reportData.nickname,
      phone: reportData.phone,
      email: reportData.email,
      department: reportData.department,
      office: reportData.office,
      issueCategory: reportData.issueCategory,
      customCategory: reportData.customCategory || undefined,
      urgency: reportData.urgency,
      description: reportData.description,
      images: reportData.images || [],
    status: 'pending',
    reportDate: reportData.reportDate || new Date(),
    closeLink: `/close-issue/${issueId}`,
    userId: user?.user_id || undefined // Keep for backward compatibility
  });

    console.log('💾 Saving IssueLog with data:');
    console.log('💾 - firstName:', newIssue.firstName);
    console.log('💾 - lastName:', newIssue.lastName);
    console.log('💾 - phone:', newIssue.phone);
    console.log('💾 - email:', newIssue.email);
    console.log('💾 - requesterId:', newIssue.requesterId);
    console.log('💾 - requesterType:', newIssue.requesterType);
    console.log('💾 - officeId:', newIssue.officeId);
    console.log('💾 - officeName:', newIssue.officeName);
    console.log('💾 - office:', newIssue.office);

    await newIssue.save();
    console.log('Issue saved successfully:', newIssue._id);

    // 1. ส่งอีเมลแจ้ง IT Admin ทันทีเมื่อมีการแจ้งงาน
    try {
      const { sendIssueNotification, sendIssueConfirmationToReporter } = await import('@/lib/email');
      
      // Format issue data for email (with populated requester info)
      const emailData = await formatIssueForEmail({
        ...newIssue.toObject(),
        images: reportData.images || []
      });
      
      console.log('📧 Email data images:', emailData.images);
      
      // 1.1 ส่งอีเมลให้ IT Admin
      const emailResult = await sendIssueNotification(emailData);
      
      if (emailResult.success) {
        console.log(`✅ Email sent to ${emailResult.totalSent} IT admins successfully`);
      } else {
        console.error('❌ Failed to send email to IT admins:', emailResult.error);
      }

      // 1.2 ส่งอีเมลยืนยันให้ผู้แจ้ง
      const confirmationResult = await sendIssueConfirmationToReporter(emailData);
      
      if (confirmationResult.success) {
        console.log(`✅ Confirmation email sent to reporter: ${emailData.email}`);
      } else {
        console.error('❌ Failed to send confirmation email to reporter:', confirmationResult.error);
      }
    } catch (emailError) {
      console.error('Email notification error:', emailError);
      // ไม่ให้ email error ทำให้การบันทึกล้มเหลว
    }

    return NextResponse.json({
      message: 'บันทึกการแจ้งงานเรียบร้อยแล้ว',
      issueId: newIssue.issueId,
      id: newIssue._id
    });

  } catch (error) {
    console.error('IT report error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';

    // Build filter object
    const filter: any = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { issueId: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    // Sort by urgency (very_urgent first) then by reportDate
    const sortCriteria: any = {};
    if (status === 'pending') {
      sortCriteria.urgency = -1; // very_urgent first
      sortCriteria.reportDate = 1; // oldest first for pending items
    } else {
      sortCriteria.reportDate = -1; // newest first for completed/closed items
    }

    const [issues, total] = await Promise.all([
      IssueLog.find(filter)
        .sort(sortCriteria)
        .skip(skip)
        .limit(limit),
      IssueLog.countDocuments(filter)
    ]);

    // Populate both requester and admin information
    const populatedIssues = await populateIssueInfoBatch(issues);

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
    console.error('Fetch IT reports error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
