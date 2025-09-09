import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import { verifyToken } from '@/lib/auth';
import { InventoryItem } from '@/models/InventoryItem';
import { InventoryMaster } from '@/models/InventoryMaster';
import RequestLog from '@/models/RequestLog';
import { transferInventoryItem, updateInventoryMaster } from '@/lib/inventory-helpers';
// Removed unused cache imports

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
            'currentOwnership.userId': currentUserId
          });
          console.log('🔍 Validating item with SN:', {
            itemId: item.itemId,
            serialNumber: item.serialNumber,
            userId: currentUserId
          });
        } else {
          // Find by itemId without serial number
          inventoryItem = await InventoryItem.findOne({
            _id: item.itemId,
            $or: [
              { serialNumber: { $exists: false } },
              { serialNumber: '' },
              { serialNumber: null }
            ],
            'currentOwnership.ownerType': 'user_owned',
            'currentOwnership.userId': currentUserId
          });
          console.log('🔍 Validating item without SN:', {
            itemId: item.itemId,
            userId: currentUserId,
            found: inventoryItem ? 'YES' : 'NO',
            foundItem: inventoryItem ? {
              id: inventoryItem._id,
              name: inventoryItem.itemName,
              sn: inventoryItem.serialNumber,
              owner: inventoryItem.currentOwnership
            } : null
          });
        }
        
        if (inventoryItem) {
          console.log(`✅ Validated ownership of ${inventoryItem.itemName} (${inventoryItem.serialNumber || 'No SN'})`);
        } else {
          console.warn(`⚠️ User does not own this item or item not found:`, item);
          
          // Debug: Find what items this user actually owns
          const userOwnedItems = await InventoryItem.find({
            'currentOwnership.ownerType': 'user_owned',
            'currentOwnership.userId': currentUserId
          }).select('_id itemName serialNumber');
          
          console.warn(`🔍 Debug - User ${currentUserId} actually owns:`, userOwnedItems.map(i => ({
            id: i._id,
            name: i.itemName,
            sn: i.serialNumber || 'No SN'
          })));
          
          // Check if the itemId exists at all
          const anyItem = await InventoryItem.findById(item.itemId);
          console.warn(`🔍 Debug - ItemId ${item.itemId} exists:`, anyItem ? {
            id: anyItem._id,
            name: anyItem.itemName,
            owner: anyItem.currentOwnership
          } : 'NOT_FOUND');
          
          return NextResponse.json(
            { error: `ไม่พบอุปกรณ์ที่ต้องการคืน หรือคุณไม่ได้เป็นเจ้าของอุปกรณ์นี้: ${item.itemName || item.itemId}` },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error(`❌ Error validating return for item:`, item, error);
        return NextResponse.json(
          { error: 'เกิดข้อผิดพลาดในการตรวจสอบอุปกรณ์' },
          { status: 500 }
        );
      }
    }

    // Create new return log with enhanced item data
    const cleanItems = returnData.items.map((item: any) => ({
      itemId: item.itemId,
      quantity: item.quantity,
      serialNumber: item.serialNumber || undefined, // Include serial number
      assetNumber: item.assetNumber || undefined,
      image: item.image || undefined
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
      userId: currentUserId
    };

    console.log('🔍 Creating return log with data:', returnLogData);
    const newReturn = new ReturnLog(returnLogData);
    await newReturn.save();

    // Cache clearing removed - data is now dynamically fetched

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

    const returns = await ReturnLog.find({})
      .sort({ createdAt: -1 })
      .limit(50);

    return NextResponse.json(returns);

  } catch (error) {
    console.error('Fetch equipment returns error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
