import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import Inventory from '@/models/Inventory';
import { verifyTokenFromRequest } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params first (Next.js 15 requirement)
    const { id } = await params;
    
    await dbConnect();

    // Verify admin authentication
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check if user is admin (simplified check for now)
    if (!payload.userId) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }

    // Find the request
    const requestLog = await RequestLog.findById(id);
    if (!requestLog) {
      return NextResponse.json(
        { error: 'ไม่พบคำขอ' },
        { status: 404 }
      );
    }

    // Check if already completed
    if (requestLog.status === 'completed') {
      return NextResponse.json(
        { error: 'คำขอนี้ได้ดำเนินการเสร็จสิ้นแล้ว' },
        { status: 400 }
      );
    }

    // Mark request as completed
    requestLog.status = 'completed';
    await requestLog.save();

    // Update inventory for requested items
    for (const item of requestLog.items) {
      // Find inventory item by itemId
      const inventoryItem = await Inventory.findById(item.itemId);
      
      if (inventoryItem) {
        // Check if there's enough available quantity
        if (inventoryItem.quantity >= item.quantity) {
          // Reduce available quantity
          inventoryItem.quantity -= item.quantity;
          await inventoryItem.save();
          
        } else {
        }
      } else {
      }
    }


    return NextResponse.json({
      message: 'ดำเนินการเสร็จสิ้นแล้ว',
      requestId: id,
      itemsCreated: requestLog.items.length
    });

  } catch (error) {
    console.error('Error completing request:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
