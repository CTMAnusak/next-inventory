import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import IssueLog from '@/models/IssueLog';
// import { sendIssueNotification } from '@/lib/email'; // Temporarily disabled
import { generateIssueId, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const reportData = await request.json();
    console.log('Received report data:', reportData);

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

    // Validate custom category if "อื่น ๆ โปรดระบุ" is selected
    if (reportData.issueCategory === 'อื่น ๆ โปรดระบุ' && !reportData.customCategory) {
      return NextResponse.json(
        { error: 'กรุณาระบุประเภทปัญหา' },
        { status: 400 }
      );
    }

    await dbConnect();
    console.log('Database connected successfully');

    // Generate unique Issue ID
    const issueId = generateIssueId();
    console.log('Generated issue ID:', issueId);

    // Create new issue log
    const userId = (() => {
      try {
        const token = request.cookies.get('auth-token')?.value;
        const payload: any = token ? verifyToken(token) : null;
        return payload?.userId || undefined;
      } catch {
        return undefined;
      }
    })();

    const newIssue = new IssueLog({
      issueId,
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
      userId
    });

    await newIssue.save();
    console.log('Issue saved successfully:', newIssue._id);

    // Email notification temporarily disabled to resolve import issues
    console.log('Email notification disabled temporarily - Issue saved successfully');

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

    return NextResponse.json({
      issues,
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
