import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryMaster from '@/models/InventoryMaster';
import Inventory from '@/models/Inventory'; // Legacy inventory model for POST compatibility
import User from '@/models/User';
import { verifyTokenFromRequest } from '@/lib/auth';
import { getCachedData, setCachedData } from '@/lib/cache-utils';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check cache for simple queries (no filters)
    const { searchParams } = new URL(request.url);
    const hasFilters = searchParams.get('search') || searchParams.get('category') || 
                      searchParams.get('status') || searchParams.get('addedBy') || 
                      searchParams.get('userId') || searchParams.get('page') !== '1';
    
    if (!hasFilters) {
      const cacheKey = 'inventory_basic';
      const cachedResult = getCachedData(cacheKey);
      if (cachedResult && process.env.NODE_ENV === 'development') {
        return NextResponse.json(cachedResult);
      }
    }

    await dbConnect();
    if (process.env.NODE_ENV === 'development') {
    }

    // Parse query parameters (reuse searchParams from above)
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || '';
    const addedBy = searchParams.get('addedBy') || '';
    const userId = searchParams.get('userId') || '';

    // Build filter object
    const filter: any = {};
    
    if (search) {
      filter.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      filter.categoryId = category; // Now expecting categoryId instead of category name
    }
    
    if (status) {
      filter.status = status;
    }
    
    if (addedBy) {
      filter['addedBy.role'] = addedBy;
    }
    
    if (userId) {
      filter.user_id = userId;
    }

    const skip = (page - 1) * limit;

    const queryStart = Date.now();
    const [items, total] = await Promise.all([
      InventoryMaster.find(filter)
        .sort({ itemName: 1, updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      InventoryMaster.countDocuments(filter)
    ]);

    // Don't enrich with category names - let frontend handle it
    console.log('🔍 Raw items from database:', items.map(item => ({ 
      _id: item._id, 
      itemName: item.itemName, 
      categoryId: item.categoryId,
      category: item.category,
      availableQuantity: item.availableQuantity
    })));
    
    console.log('🔍 Items count:', { 
      rawItems: items.length
    });
    
    // Convert InventoryMaster to format expected by equipment-request UI
    const formattedItems = items.map(item => {
      console.log('🔍 Mapping item:', { 
        _id: item._id, 
        itemName: item.itemName, 
        categoryId: item.categoryId,
        availableQuantity: item.availableQuantity 
      });
      return {
        _id: item._id,
        itemName: item.itemName,
        categoryId: item.categoryId, // ใช้ categoryId เป็นหลัก
        // ไม่ส่ง category name ใน API response - ให้ frontend ใช้ categoryId ในการ lookup
        quantity: item.availableQuantity, // จำนวนที่เหลือให้เบิก
        totalQuantity: item.totalQuantity,
        serialNumbers: [], // Will be populated from InventoryItem if needed
        status: 'active',
        dateAdded: item.updatedAt,
        hasSerialNumber: item.itemDetails?.withSerialNumber > 0,
        userOwnedQuantity: item.userOwnedQuantity
      };
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Inventory API - Formatted ${formattedItems.length} items for UI:`, 
        formattedItems.map(item => `${item.itemName}: ${item.quantity} available`));
      console.log(`✅ Inventory API - Total Time: ${Date.now() - startTime}ms`);
    }

    const result = {
      items: formattedItems,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    // Cache simple queries
    if (!hasFilters) {
      setCachedData('inventory_basic', result);
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Inventory fetch error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const itemData = await request.json();
    
    // Get user info from token
    const payload: any = verifyTokenFromRequest(request);
    
    if (!payload) {
      console.log('❌ Inventory API - No token payload');
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Validate required fields
    const requiredFields = ['itemName', 'categoryId'];
    
    for (const field of requiredFields) {
      if (!itemData[field]) {
        return NextResponse.json(
          { error: `กรุณากรอก ${field}` },
          { status: 400 }
        );
      }
    }

    await dbConnect();

    // Get user info from database using Mongoose
    
    const currentUser = await User.findOne({ user_id: payload.userId });
    
    if (!currentUser) {
      console.log('❌ Inventory API - User not found');
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลผู้ใช้' },
        { status: 401 }
      );
    }
    
    console.log('✅ Inventory API - User authenticated:', {
      userId: currentUser.user_id,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName
    });

    // 🔧 CRITICAL FIX: Remove legacy Inventory model usage entirely
    // Use new inventory system only - no more checking for existing items
    console.log('📝 Inventory API - Creating new items using new system:', {
      itemName: itemData.itemName,
      category: itemData.category,
      serialNumber: itemData.serialNumber || undefined,
      quantity: itemData.quantity || 1
    });

    // Use new inventory system with proper serial number validation
    const { createInventoryItem } = await import('@/lib/inventory-helpers');
    
    const itemsToCreate = [];
    
    if (itemData.serialNumber && itemData.serialNumber.trim() !== '') {
      // Create single item with serial number
      itemsToCreate.push({
        itemName: itemData.itemName,
        categoryId: itemData.categoryId,
        serialNumber: itemData.serialNumber.trim(),
        addedBy: 'user' as const,
        addedByUserId: currentUser.user_id,
        initialOwnerType: 'user_owned' as const,
        userId: currentUser.user_id,
        statusId: itemData.statusId || 'status_available',
        conditionId: itemData.conditionId,
        notes: itemData.notes || 'Added by user via dashboard'
      });
    } else {
      // Create multiple items without serial numbers
      const quantity = itemData.quantity || 1;
      for (let i = 0; i < quantity; i++) {
        itemsToCreate.push({
          itemName: itemData.itemName,
          categoryId: itemData.categoryId,
          addedBy: 'user' as const,
          addedByUserId: currentUser.user_id,
          initialOwnerType: 'user_owned' as const,
          userId: currentUser.user_id,
          statusId: itemData.statusId || 'status_available',
          conditionId: itemData.conditionId,
          notes: itemData.notes || `Added by user via dashboard (${i + 1}/${quantity})`
        });
      }
    }
    
    // Create all items
    const createdItems = [];
    for (const itemToCreate of itemsToCreate) {
      const newItem = await createInventoryItem(itemToCreate);
      createdItems.push(newItem);
    }
    
    
    return NextResponse.json({
      message: 'เพิ่มสินค้าเรียบร้อยแล้ว',
      items: createdItems,
      summary: {
        itemName: itemData.itemName,
        category: itemData.categoryId,
        quantity: createdItems.length,
        withSerialNumber: createdItems.filter(item => item.serialNumber).length,
        withoutSerialNumber: createdItems.filter(item => !item.serialNumber).length
      }
    });

  } catch (error) {
    console.error('❌ Inventory API - Error occurred:', error);
    console.error('❌ Inventory API - Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // 🔧 Enhanced error handling for validation
    if (error instanceof Error) {
      // Handle Item Name validation errors (recycle bin)
      if (error.message.includes('เพิ่มรายการไม่ได้เพราะชื่อซ้ำกับในถังขยะ')) {
        console.log('❌ Inventory API - Item Name validation error from createInventoryItem');
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      
      if (error.message.startsWith('ACTIVE_SN_EXISTS:') || error.message.startsWith('RECYCLE_SN_EXISTS:')) {
        console.log('❌ Inventory API - Serial Number validation error from createInventoryItem');
        // For users, show generic message regardless of whether SN is active or in recycle bin
        return NextResponse.json(
          { error: 'เคยมี Serial Number นี้ในระบบแล้ว กรุณาติดต่อ Admin IT' },
          { status: 400 }
        );
      }
    }
    
    console.log('❌ Inventory API - Generic error, returning 500');
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
