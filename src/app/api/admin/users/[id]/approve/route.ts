import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify admin token
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      console.log('❌ No auth token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    } catch (error) {
      console.log('❌ Token verification error:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin or it_admin
    if (decoded.userRole !== 'admin' && decoded.userRole !== 'it_admin' && !decoded.isMainAdmin) {
      console.log('❌ Insufficient permissions:', {
        userRole: decoded.userRole,
        isMainAdmin: decoded.isMainAdmin,
        required: 'userRole === "admin" OR userRole === "it_admin" OR isMainAdmin === true'
      });
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { userRole } = await request.json();

    if (!userRole || !['user', 'admin', 'it_admin'].includes(userRole)) {
      return NextResponse.json({ error: 'Invalid user role' }, { status: 400 });
    }

    const { id } = await params;

    await dbConnect();

    // Find the user to approve
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.isApproved !== false) {
      return NextResponse.json({ error: 'User is already approved' }, { status: 400 });
    }

    // Generate user_id if not exists
    let userId = user.user_id;
    if (!userId || userId === 'UNaN') {
      const lastUser = await User.findOne({ 
        user_id: { $regex: /^U\d{3}$/ } 
      }).sort({ user_id: -1 });
      
      let nextUserId = 'U001';
      if (lastUser && lastUser.user_id) {
        const lastId = parseInt(lastUser.user_id.substring(1));
        if (!isNaN(lastId)) {
          nextUserId = `U${String(lastId + 1).padStart(3, '0')}`;
        }
      }
      
      userId = nextUserId;
    }

    // Update user
    user.isApproved = true;
    user.userRole = userRole;
    user.user_id = userId;
    user.approvedBy = decoded.userId;
    user.approvedAt = new Date();

    await user.save();

    return NextResponse.json({
      success: true,
      message: 'User approved successfully',
      user: {
        _id: user._id,
        user_id: user.user_id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        userRole: user.userRole,
        isApproved: user.isApproved
      }
    });

  } catch (error) {
    console.error('User approval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
