import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify admin token
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      console.log('❌ No auth token found (reject)');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    } catch (error) {
      console.log('❌ Token verification error (reject):', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin or it_admin or super_admin
    if (decoded.userRole !== 'admin' && decoded.userRole !== 'it_admin' && decoded.userRole !== 'super_admin' && !decoded.isMainAdmin) {
      console.log('❌ Insufficient permissions (reject):', {
        userRole: decoded.userRole,
        isMainAdmin: decoded.isMainAdmin,
        required: 'userRole === "admin" OR userRole === "it_admin" OR userRole === "super_admin" OR isMainAdmin === true'
      });
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    await dbConnect();

    // Find the user to reject
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.isApproved !== false) {
      return NextResponse.json({ error: 'User is already processed' }, { status: 400 });
    }

    // Delete the user (reject registration)
    await User.findByIdAndDelete(id);

    // TODO: Send rejection email to user
    // await sendUserRejectedNotification(user);

    return NextResponse.json({
      success: true,
      message: 'User registration rejected successfully'
    });

  } catch (error) {
    console.error('User rejection error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
