import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';
import InventoryConfig from '@/models/InventoryConfig';
import { verifyToken } from '@/lib/auth';

// GET - ดึงอุปกรณ์ที่ User เป็นเจ้าของ
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Verify user token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    
    const userId = payload.userId;
    
    // Get user's owned items
    const ownedItems = await InventoryItem.find({
      'currentOwnership.ownerType': 'user_owned',
      'currentOwnership.userId': userId,
      deletedAt: { $exists: false }
    }).sort({ 'currentOwnership.ownedSince': -1 });

    // Get all return logs (approved and pending)
    const ReturnLog = (await import('@/models/ReturnLog')).default;
    const allReturns = await ReturnLog.find({
      userId: userId
    });

    // Create a set of approved returned items to filter out
    const returnedItems = new Set();
    // Create a set of pending return items to mark
    const pendingReturnItems = new Set();
    
    allReturns.forEach(returnLog => {
      returnLog.items.forEach((item: any) => {
        const itemKey = item.serialNumber 
          ? `${item.itemId}-${item.serialNumber}` 
          : item.itemId;
        
        // If approved, add to returned items (to filter out)
        if (item.approvalStatus === 'approved') {
          returnedItems.add(itemKey);
        }
        // If pending, add to pending items (to mark with badge)
        else if (item.approvalStatus === 'pending' || !item.approvalStatus) {
          pendingReturnItems.add(itemKey);
        }
      });
    });

    // Filter out items that have been approved for return
    const availableItems = ownedItems.filter(item => {
      const itemKey = item.serialNumber ? `${item._id}-${item.serialNumber}` : item._id.toString();
      return !returnedItems.has(itemKey);
    });
    
    // Get configurations for display
    const config = await InventoryConfig.findOne({});
    const statusConfigs = config?.statusConfigs || [];
    const conditionConfigs = config?.conditionConfigs || [];
    const categoryConfigs = config?.categoryConfigs || [];
    
    // ประกอบข้อมูลด้วยฟิลด์จาก InventoryItem โดยตรง + mapping จาก InventoryConfig
    const populatedItems = availableItems.map((item) => {
      const statusConfig = statusConfigs.find(s => s.id === item.statusId);
      const conditionConfig = conditionConfigs.find(c => c.id === item.conditionId);
      const categoryConfig = categoryConfigs.find(c => c.id === (item as any).categoryId);

      // Check if this item has pending return
      const itemKey = item.serialNumber ? `${item._id}-${item.serialNumber}` : item._id.toString();
      const hasPendingReturn = pendingReturnItems.has(itemKey);

      return {
        _id: item._id,
        itemMasterId: (item as any).itemMasterId,
        itemName: (item as any).itemName || 'ไม่ระบุ',
        categoryId: (item as any).categoryId || 'ไม่ระบุ',
        category: categoryConfig?.name || 'ไม่ระบุ',
        serialNumber: item.serialNumber,
        numberPhone: item.numberPhone,
        statusId: item.statusId,
        statusName: statusConfig?.name || 'ไม่ระบุ',
        conditionId: item.conditionId,
        conditionName: conditionConfig?.name || 'ไม่ระบุ',
        currentOwnership: item.currentOwnership,
        sourceInfo: item.sourceInfo,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        hasPendingReturn // ✅ เพิ่ม flag นี้
      };
    });
    
    return NextResponse.json({
      items: populatedItems,
      totalCount: populatedItems.length
    });
    
  } catch (error) {
    console.error('Error fetching owned equipment:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์' },
      { status: 500 }
    );
  }
}

// POST - เพิ่มอุปกรณ์ที่มี (User)
export async function POST(request: NextRequest) {
  try {
    // Verify user token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    
    await dbConnect();
    
    const equipmentData = await request.json();
    const {
      itemName,
      categoryId,
      serialNumber,
      numberPhone,
      statusId = 'status_available',
      conditionId = 'cond_working',
      quantity = 1,
      notes
    } = equipmentData;
    
    // Validate required fields
    if (!itemName || !categoryId) {
      return NextResponse.json(
        { error: 'กรุณาระบุชื่ออุปกรณ์และหมวดหมู่' },
        { status: 400 }
      );
    }
    
    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'กรุณาระบุจำนวนที่ถูกต้อง' },
        { status: 400 }
      );
    }
    
    // Use the new inventory helper
    const { createInventoryItem } = await import('@/lib/inventory-helpers');
    
    const createdItems = [];
    
    // Create multiple items if quantity > 1
    for (let i = 0; i < quantity; i++) {
      const itemData = {
        itemName,
        categoryId,
        serialNumber: i === 0 ? serialNumber : undefined, // Only first item gets serial number
        numberPhone: i === 0 ? numberPhone : undefined,   // Only first item gets phone number
        statusId,
        conditionId,
        addedBy: 'user' as const,
        addedByUserId: payload.userId,
        initialOwnerType: 'user_owned' as const,
        userId: payload.userId,
        notes: notes || undefined
      };
      
      const newItem = await createInventoryItem(itemData);
      createdItems.push(newItem);
    }
    
    return NextResponse.json({
      message: `เพิ่มอุปกรณ์เรียบร้อยแล้ว ${quantity} ชิ้น`,
      createdItems: createdItems.length,
      itemIds: createdItems.map(item => item._id.toString())
    });
    
  } catch (error) {
    console.error('Add owned equipment error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Serial Number')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      if (error.message.includes('Phone Number')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: 'เกิดข้อผิดพลาดในการเพิ่มอุปกรณ์', 
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined 
      },
      { status: 500 }
    );
  }
}