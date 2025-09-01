import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';

import RequestLog from '@/models/RequestLog';
import { verifyToken } from '@/lib/auth';
import InventoryMaster from '@/models/InventoryMaster';
// Removed unused cache import

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    
    // Debug: Log the received data
    console.log('🔍 Equipment Request API - Received data:', JSON.stringify(requestData, null, 2));

    // Validate required fields
    const requiredFields = ['firstName', 'lastName', 'requestDate', 'urgency', 'deliveryLocation', 'reason', 'items'];
    
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
    console.log('🔍 API - Validating items:', JSON.stringify(requestData.items, null, 2));
    
    for (const item of requestData.items) {
      console.log('🔍 API - Validating item:', JSON.stringify(item, null, 2));
      
      if (!item.itemId) {
        console.error('🔍 API - Missing itemId:', item);
        return NextResponse.json(
          { error: 'ข้อมูลอุปกรณ์ไม่ครบถ้วน: ไม่มี ID อุปกรณ์' },
          { status: 400 }
        );
      }
      
      if (!item.quantity || item.quantity <= 0) {
        console.error('🔍 API - Invalid quantity:', item);
        return NextResponse.json(
          { error: 'ข้อมูลอุปกรณ์ไม่ครบถ้วน: จำนวนไม่ถูกต้อง' },
          { status: 400 }
        );
      }
    }

    await dbConnect();

    // Determine userId from token or body
    const tokenUserId = (() => {
      try {
        const token = request.cookies.get('auth-token')?.value;
        const payload: any = token ? verifyToken(token) : null;
        return payload?.userId || undefined;
      } catch {
        return undefined;
      }
    })();
    const userId: string | undefined = requestData.userId || tokenUserId;

    // Validate inventory availability BEFORE doing anything (use itemId as primary key)
    for (const item of requestData.items) {
      // For non-serial items, check if we have enough quantity using itemId
      if (!item.serialNumber || String(item.serialNumber).trim() === '') {
        // Get inventory record by itemId
        const inventoryItem = await InventoryMaster.findById(item.itemId);
        
        if (!inventoryItem) {
          return NextResponse.json(
            { error: `ไม่พบข้อมูลอุปกรณ์สำหรับ ID: ${item.itemId}` },
            { status: 400 }
          );
        }
        
        const availableQuantity = inventoryItem.availableQuantity || 0;
        
        console.log(`🔍 Inventory validation: ${inventoryItem.itemName}, Available: ${availableQuantity}, Requested: ${item.quantity}`);
        
        if (availableQuantity < item.quantity) {
          console.log(`❌ Not enough inventory: ${inventoryItem.itemName}, Available: ${availableQuantity}, Requested: ${item.quantity}`);
          return NextResponse.json(
            { error: `อุปกรณ์ "${inventoryItem.itemName}" มีไม่เพียงพอ (คงเหลือ: ${availableQuantity})` },
            { status: 400 }
          );
        }
        
        console.log(`✅ Inventory validation passed: ${inventoryItem.itemName}`);
        
        // Also populate item details for the request
        item.itemName = inventoryItem.itemName;
        item.category = inventoryItem.category;
        
        console.log(`📝 Item populated: ${item.itemName} (${item.category})`);
      }
    }

    // Get user profile data for complete information
    let userProfile = null;
    if (userId) {
      try {
        // Import User model dynamically to avoid circular dependencies
        const User = mongoose.model('User') || require('@/models/User').default;
        userProfile = await User.findOne({ user_id: userId });
      } catch (error) {
        console.log('Could not fetch user profile for additional data:', error);
      }
    }

    // Create RequestLog including itemName, category, and serialNumbers for admin interface
    const cleanItems = requestData.items.map((item: any) => ({
      itemId: item.itemId,
      quantity: item.quantity,
      itemName: item.itemName,
      category: item.category,
      serialNumbers: item.serialNumber ? [item.serialNumber] : [] // Convert single SN to array
    }));
    
    console.log(`📋 CleanItems prepared:`, JSON.stringify(cleanItems, null, 2));

    const requestLogData = {
      firstName: requestData.firstName,
      lastName: requestData.lastName,
      nickname: requestData.nickname || '',
      department: requestData.department || '',
      office: requestData.office || '',
      requestDate: new Date(requestData.requestDate),
      urgency: requestData.urgency,
      deliveryLocation: requestData.deliveryLocation,
      phone: requestData.phone || '',
      reason: requestData.reason,
      items: cleanItems,
      status: 'pending',
      requestType: 'request', // การเบิกอุปกรณ์
      userId
    };

    console.log('🔍 Creating request log with data:', requestLogData);
    const newRequest = new RequestLog(requestLogData);
    await newRequest.save();
    const newRequestId = newRequest._id;

    // NOTE: ไม่ต้อง deduct inventory ที่นี่ เพราะจะ deduct เมื่อ Admin อนุมัติแล้วเท่านั้น
    // การ deduct จะเกิดขึ้นใน approve-with-selection API แทน

    // Cache clearing removed - data is now dynamically fetched

    return NextResponse.json({
      message: 'บันทึกการเบิกอุปกรณ์เรียบร้อยแล้ว',
      requestId: newRequestId,
      userIdSaved: userId
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

    const requests = await RequestLog.find({})
      .sort({ createdAt: -1 })
      .limit(50);

    return NextResponse.json(requests);

  } catch (error) {
    console.error('Fetch equipment requests error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
