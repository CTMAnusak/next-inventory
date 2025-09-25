import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import { verifyToken } from '@/lib/auth';
import { InventoryItem } from '@/models/InventoryItemNew';
import { InventoryMaster } from '@/models/InventoryMasterNew';
import ItemMaster from '@/models/ItemMaster';
import { transferInventoryItem, updateInventoryMaster } from '@/lib/inventory-helpers';

export async function POST(request: NextRequest) {
  try {
    const returnData = await request.json();
    
    // Debug: Log the received data
    console.log('🔍 Equipment Return API - Received data:', JSON.stringify(returnData, null, 2));

    // Validate required fields
    const requiredFields = ['firstName', 'lastName', 'nickname', 'department', 'office', 'returnDate', 'items'];
    
    for (const field of requiredFields) {
      if (!returnData[field]) {
        console.error(`Missing required field: ${field}`);
        return NextResponse.json(
          { error: `กรุณากรอก ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate items
    if (!Array.isArray(returnData.items) || returnData.items.length === 0) {
      return NextResponse.json(
        { error: 'กรุณาเลือกอุปกรณ์อย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    for (const item of returnData.items) {
      console.log('🔍 Validating item:', JSON.stringify(item, null, 2));
      if (!item.itemId || !item.quantity || item.quantity <= 0) {
        console.error('❌ Invalid item data:', item);
        return NextResponse.json(
          { error: 'ข้อมูลอุปกรณ์ไม่ครบถ้วน: ไม่มี ID อุปกรณ์หรือจำนวนไม่ถูกต้อง' },
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

    // Validate that user owns the items they want to return (but don't transfer yet)
    for (const item of returnData.items) {
      console.log('🔍 Validating returned item:', item);
      
      try {
        // Find the specific InventoryItem to validate ownership
        let inventoryItem;
        
        if (item.serialNumber) {
          // Find by itemId and serial number (most precise)
          inventoryItem = await InventoryItem.findOne({
            _id: item.itemId,
            serialNumber: item.serialNumber,
            'currentOwnership.ownerType': 'user_owned',
            'currentOwnership.userId': currentUserId,
            deletedAt: { $exists: false }
          });
          console.log('🔍 Validating item with SN:', {
            itemId: item.itemId,
            serialNumber: item.serialNumber,
            userId: currentUserId
          });
        } else {
          // Find by itemId without serial number - สำหรับอุปกรณ์ไม่มี SN
          inventoryItem = await InventoryItem.findOne({
            _id: item.itemId,
            'currentOwnership.ownerType': 'user_owned',
            'currentOwnership.userId': currentUserId,
            deletedAt: { $exists: false }
          });
          console.log('🔍 Validating item without SN:', {
            itemId: item.itemId,
            userId: currentUserId
          });
        }
        
        if (!inventoryItem) {
          console.error('❌ Item not found or not owned by user:', {
            itemId: item.itemId,
            serialNumber: item.serialNumber,
            userId: currentUserId
          });
          return NextResponse.json(
            { error: `ไม่พบอุปกรณ์ ID: ${item.itemId} หรือคุณไม่มีสิทธิ์คืนอุปกรณ์นี้` },
            { status: 400 }
          );
        }
        
        console.log('✅ Item ownership validated:', {
          itemId: inventoryItem._id,
          itemName: inventoryItem.itemMasterId,
          ownedBy: inventoryItem.currentOwnership.userId
        });
        
      } catch (error) {
        console.error('❌ Error validating item ownership:', error);
        return NextResponse.json(
          { error: `เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์อุปกรณ์: ${error}` },
          { status: 500 }
        );
      }
    }

    // Create new return log with enhanced item data
    const cleanItems = returnData.items.map((item: any) => ({
      itemId: item.itemId,
      quantity: item.quantity,
      serialNumber: item.serialNumber || undefined,
      assetNumber: item.assetNumber || undefined,
      image: item.image || undefined,
      conditionOnReturn: item.conditionOnReturn || 'cond_working', // Default: ใช้งานได้
      itemNotes: item.itemNotes || undefined // หมายเหตุเฉพาะรายการ
    }));

    const returnLogData = {
      firstName: returnData.firstName,
      lastName: returnData.lastName,
      nickname: returnData.nickname,
      department: returnData.department,
      office: returnData.office,
      returnDate: new Date(returnData.returnDate),
      items: cleanItems,
      status: 'pending',
      notes: returnData.notes || undefined, // หมายเหตุรวมการคืน
      userId: currentUserId
    };

    console.log('🔍 Creating return log with data:', returnLogData);
    const newReturn = new ReturnLog(returnLogData);
    await newReturn.save();

    return NextResponse.json({
      message: 'บันทึกการคืนอุปกรณ์เรียบร้อยแล้ว',
      returnId: newReturn._id
    });

  } catch (error) {
    console.error('Equipment return error:', error);
    
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
    const filter: any = {};
    
    if (userId) {
      filter.userId = userId;
    }
    
    if (status) {
      filter.status = status;
    }
    
    // Fetch return logs with user data
    const returns = await ReturnLog.find(filter)
      .populate('userId', 'firstName lastName nickname department office phone pendingDeletion')
      .sort({ returnDate: -1 });
    
    return NextResponse.json({ returns });
    
  } catch (error) {
    console.error('Error fetching return logs:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}