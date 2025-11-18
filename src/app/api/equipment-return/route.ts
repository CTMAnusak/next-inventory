import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import { authenticateUser } from '@/lib/auth-helpers';
import InventoryItem from '@/models/InventoryItem';
import { InventoryMaster } from '@/models/InventoryMasterNew';
import { transferInventoryItem, updateInventoryMaster } from '@/lib/inventory-helpers';
import { sendEquipmentReturnNotification } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const returnData = await request.json();
    
    // 🔍 Debug: Log the received data with timestamp
    const requestTimestamp = new Date().toISOString();
    console.log('\n📥 [API] Received equipment return request at:', requestTimestamp);
    console.log('  User data:', {
      firstName: returnData.firstName,
      lastName: returnData.lastName,
      nickname: returnData.nickname,
      department: returnData.department,
      phone: returnData.phone,
      office: returnData.office
    });
    console.log('  Items count:', returnData.items?.length);
    console.log('  Return date:', returnData.returnDate);

    // Validate required fields
    const requiredFields = ['returnDate', 'items'];
    
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
      if (!item.itemId || !item.quantity || item.quantity <= 0) {
        console.error('❌ Invalid item data:', item);
        return NextResponse.json(
          { error: 'ข้อมูลอุปกรณ์ไม่ครบถ้วน: ไม่มี ID อุปกรณ์หรือจำนวนไม่ถูกต้อง' },
          { status: 400 }
        );
      }
    }

    await dbConnect();

    // 🆕 ตรวจสอบ authentication และ user ใน database
    const { error, user } = await authenticateUser(request);
    if (error) return error;
    
    const currentUserId = user!.user_id;

    // Check for pending returns first
    const pendingReturns = await ReturnLog.find({
      userId: currentUserId,
      status: 'pending'
    });

    // Check if any items are already in pending returns
    for (const item of returnData.items) {
      const hasPendingReturn = pendingReturns.some(returnLog => 
        returnLog.items.some((returnItem: any) => 
          returnItem.itemId === item.itemId &&
          (!item.serialNumber || returnItem.serialNumber === item.serialNumber)
        )
      );

      if (hasPendingReturn) {
        // Get item name for better error message
        const inventoryItem = await InventoryItem.findById(item.itemId);
        const itemName = (inventoryItem as any)?.itemName || 'อุปกรณ์';
        return NextResponse.json(
          { error: `${itemName} ${item.serialNumber ? `(S/N: ${item.serialNumber}) ` : ''}อยู่ในรายการคืนที่รออนุมัติอยู่แล้ว` },
          { status: 400 }
        );
      }
    }

    // Validate that user owns the items they want to return (but don't transfer yet)
    for (const item of returnData.items) {
      
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
        } else if (item.numberPhone) {
          // Find by itemId and phone number (for SIM cards)
          inventoryItem = await InventoryItem.findOne({
            _id: item.itemId,
            numberPhone: item.numberPhone,
            'currentOwnership.ownerType': 'user_owned',
            'currentOwnership.userId': currentUserId,
            deletedAt: { $exists: false }
          });
        } else {
          // Find by itemId without serial number - สำหรับอุปกรณ์ไม่มี SN
          inventoryItem = await InventoryItem.findOne({
            _id: item.itemId,
            'currentOwnership.ownerType': 'user_owned',
            'currentOwnership.userId': currentUserId,
            deletedAt: { $exists: false }
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
        
      } catch (error) {
        console.error('❌ Error validating item ownership:', error);
        return NextResponse.json(
          { error: `เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์อุปกรณ์: ${error}` },
          { status: 500 }
        );
      }
    }

    // 🆕 สร้าง snapshots สำหรับ items ที่คืน
    const { createInventoryItemSnapshotsBatch } = await import('@/lib/snapshot-helpers');
    const itemIds = returnData.items.map((item: any) => item.itemId);
    const snapshots = await createInventoryItemSnapshotsBatch(itemIds);
    const snapshotMap = new Map(snapshots.map(s => [s?.itemId, s]));

    // Create new return log with new structure (real-time lookup + snapshots)
    const cleanItems = returnData.items.map((item: any) => {
      const snapshot = snapshotMap.get(item.itemId);
      
      return {
        itemId: item.itemId,
        // 🆕 เพิ่ม snapshot fields
        itemName: snapshot?.itemName,
        category: snapshot?.categoryName,
        categoryId: snapshot?.categoryId,
        quantity: item.quantity,
        serialNumber: snapshot?.serialNumber || item.serialNumber || undefined,
        numberPhone: snapshot?.numberPhone || item.numberPhone || undefined,
        assetNumber: item.assetNumber || undefined,
        image: item.image || undefined,
        statusOnReturn: item.statusOnReturn || 'status_available',
        conditionOnReturn: item.conditionOnReturn || 'cond_working',
        // 🔧 CRITICAL FIX: ใช้ค่าจาก item ที่ frontend ส่งมา ไม่ใช่จาก snapshot
        statusOnReturnName: item.statusOnReturnName || snapshot?.statusName,
        conditionOnReturnName: item.conditionOnReturnName || snapshot?.conditionName,
        itemNotes: item.itemNotes || undefined
      };
    });

    const returnLogData = {
      userId: currentUserId,
      // Store user info for branch users (who don't have user profiles)
      returnerFirstName: returnData.firstName || undefined,
      returnerLastName: returnData.lastName || undefined,
      returnerNickname: returnData.nickname || undefined,
      returnerDepartment: returnData.department || undefined,
      returnerPhone: returnData.phone || undefined,
      returnerEmail: returnData.email || user?.email || undefined,
      returnerOffice: returnData.office || undefined,
      returnDate: new Date(returnData.returnDate),
      items: cleanItems,
      notes: returnData.notes || undefined
    };

    const newReturn = new ReturnLog(returnLogData);
    await newReturn.save();

    try {
      console.log('📧 [API] About to send equipment return notification email at:', new Date().toISOString());
      const emailPayload = {
        ...newReturn.toObject(),
        firstName: returnData.firstName || user?.firstName,
        lastName: returnData.lastName || user?.lastName,
        nickname: returnData.nickname || user?.nickname,
        department: returnData.department || user?.department,
        office: returnData.office || user?.office,
        phone: returnData.phone || user?.phone,
        email: returnData.email || user?.email
      };
      await sendEquipmentReturnNotification(emailPayload);
      console.log('✅ [API] Equipment return notification email sent successfully at:', new Date().toISOString());
    } catch (emailError) {
      console.error('❌ [API] Equipment return email notification error:', emailError);
    }

    // ✅ Clear cache to ensure dashboard shows updated pending return status
    const { clearAllCaches } = await import('@/lib/cache-utils');
    clearAllCaches();

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
  const startTime = Date.now();
  
  try {
    await dbConnect();
    
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    
    // Check cache first
    const { getCachedData, setCachedData } = await import('@/lib/cache-utils');
    const cacheKey = `equipment_return_${userId || 'all'}_${status || 'all'}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Equipment Return API - Cache hit (${Date.now() - startTime}ms)`);
      }
      return NextResponse.json(cached);
    }
    
    // Build filter object
    const filter: any = {};
    
    if (userId) {
      filter.userId = userId;
    }
    
    if (status) {
      filter.status = status;
    }
    
    // Fetch return logs with lean() and select only needed fields
    const returns = await ReturnLog.find(filter)
      .select('_id userId returnDate items status notes returnerFirstName returnerLastName returnerNickname returnerDepartment returnerPhone returnerEmail returnerOffice createdAt updatedAt')
      .sort({ returnDate: -1 })
      .lean();
    
    // ใช้ populate functions เพื่อ populate ข้อมูลล่าสุด
    const { populateReturnLogCompleteBatch } = await import('@/lib/equipment-populate-helpers');
    const populatedReturns = await populateReturnLogCompleteBatch(returns);
    
    const result = { returns: populatedReturns };
    
    // Cache the result
    setCachedData(cacheKey, result);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Equipment Return API - Fetched ${populatedReturns.length} returns (${Date.now() - startTime}ms)`);
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error fetching return logs:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    );
  }
}