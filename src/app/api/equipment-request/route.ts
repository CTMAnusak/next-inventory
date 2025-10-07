import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import { verifyToken } from '@/lib/auth';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';
import { findAvailableItems } from '@/lib/inventory-helpers';

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    
    // Debug: Log the received data

    // Validate required fields (notes no longer required)
    const requiredFields = ['firstName', 'lastName', 'requestDate', 'urgency', 'deliveryLocation', 'items'];
    
    for (const field of requiredFields) {
      if (!requestData[field]) {
        console.error(`Missing required field: ${field}`);
        return NextResponse.json(
          { error: `กรุณากรอก ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate items
    if (!Array.isArray(requestData.items) || requestData.items.length === 0) {
      return NextResponse.json(
        { error: 'กรุณาเลือกอุปกรณ์อย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    // Enhanced validation logging
    
    for (const item of requestData.items) {
      // ใช้รูปแบบใหม่: ต้องมี masterId
      if (!item.masterId) {
        console.error('🔍 API - Missing masterId:', item);
        return NextResponse.json(
          { error: 'ข้อมูลอุปกรณ์ไม่ครบถ้วน: ต้องระบุ Master ID อุปกรณ์' },
          { status: 400 }
        );
      }
      
      if (!item.quantity || item.quantity <= 0) {
        console.error('🔍 API - Invalid quantity:', item);
        return NextResponse.json(
          { error: 'จำนวนอุปกรณ์ต้องมากกว่า 0' },
          { status: 400 }
        );
      }
    }

    await dbConnect();

    // Get user ID for personal item updates
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    const currentUserId = payload?.userId;

    if (!currentUserId) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check for pending requests first
    const pendingRequests = await RequestLog.find({
      userId: currentUserId,
      status: 'pending'
    });

    // Check if any requested items are already in pending requests
    for (const item of requestData.items) {
      const hasPendingRequest = pendingRequests.some(request => 
        request.items.some((requestItem: any) => 
          requestItem.masterId === item.masterId &&
          (!item.serialNumber || requestItem.serialNumber === item.serialNumber)
        )
      );

      if (hasPendingRequest) {
        const master = await InventoryMaster.findById(item.masterId);
        const itemName = master?.itemName || 'อุปกรณ์';
        return NextResponse.json(
          { error: `${itemName} ${item.serialNumber ? `(S/N: ${item.serialNumber}) ` : ''}อยู่ในรายการเบิกที่รออนุมัติอยู่แล้ว` },
          { status: 400 }
        );
      }
    }

    // Validate that requested items are available
    const validatedItems = [];
    
    for (const item of requestData.items) {
      
      try {
        // ค้นหาข้อมูลจาก InventoryMaster (ไม่พึ่งพา InventoryItem อีกต่อไป)
        const master = await InventoryMaster.findById(item.masterId);
        if (!master) {
          return NextResponse.json(
            { error: `ไม่พบประเภทอุปกรณ์ ID: ${item.masterId}` },
            { status: 400 }
          );
        }

        const itemName = master.itemName; // ใช้ชื่อจาก master โดยตรง
        const categoryId = master.categoryId;
        
        // ตรวจสอบความพร้อมใช้งานจาก InventoryItem โดยใช้ itemName และ categoryId
        const availableItems = await findAvailableItems(itemName, categoryId, item.quantity);
        
        if (availableItems.length < item.quantity) {
          return NextResponse.json(
            { 
              error: `อุปกรณ์ "${itemName}" มีไม่เพียงพอ (ต้องการ: ${item.quantity}, มี: ${availableItems.length})`,
              itemName: itemName,
              requested: item.quantity,
              available: availableItems.length
            },
            { status: 400 }
          );
        }

        // เตรียมข้อมูลสำหรับบันทึกคำขอ
        const cleanItems = {
          masterId: item.masterId,
          itemName: itemName,
          categoryId: categoryId,
          quantity: item.quantity,
          // ✅ บันทึก serialNumbers เป็น array (ตาม model)
          serialNumbers: item.serialNumber ? [item.serialNumber] : undefined,
          availableItemIds: availableItems.map(it => it._id.toString()),
          itemNotes: item.itemNotes || undefined
        };

        validatedItems.push(cleanItems);
        
      } catch (error) {
        console.error('❌ Error validating item:', error);
        return NextResponse.json(
          { error: `เกิดข้อผิดพลาดในการตรวจสอบอุปกรณ์: ${error}` },
          { status: 500 }
        );
      }
    }

    // Create new request log with new structure (real-time lookup)
    const requestLogData = {
      userId: currentUserId,
      requestDate: new Date(requestData.requestDate),
      urgency: requestData.urgency,
      deliveryLocation: requestData.deliveryLocation,
      items: validatedItems,
      status: 'pending',
      requestType: 'request'
    };

    const newRequest = new RequestLog(requestLogData);
    await newRequest.save();
    const newRequestId = newRequest._id;

    // NOTE: ไม่ต้อง deduct inventory ที่นี่ เพราะจะ deduct เมื่อ Admin อนุมัติแล้วเท่านั้น
    // การ deduct จะเกิดขึ้นใน approve-with-selection API แทน

    return NextResponse.json({
      message: 'บันทึกการเบิกอุปกรณ์เรียบร้อยแล้ว',
      requestId: newRequestId,
      userIdSaved: currentUserId
    });

  } catch (error) {
    console.error('Equipment request error:', error);
    
    // Enhanced error logging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { 
        error: 'เกิดข้อผิดพลาดในระบบ', 
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    
    // Build filter object
    const filter: any = { requestType: 'request' };
    
    if (userId) {
      filter.userId = userId;
    }
    
    if (status) {
      filter.status = status;
    }
    
    // Fetch request logs with user data
    const requests = await RequestLog.find(filter)
      .populate('userId', 'firstName lastName nickname department office phone pendingDeletion')
      .sort({ requestDate: -1 });
    
    return NextResponse.json({ requests });
    
  } catch (error) {
    console.error('Error fetching request logs:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}