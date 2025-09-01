import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventoryMaster from '@/models/InventoryMaster';
import Inventory from '@/models/Inventory'; // Legacy inventory model for POST compatibility
import User from '@/models/User';
import { verifyTokenFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    await dbConnect();
    console.log(`⏱️ Inventory API - DB Connect: ${Date.now() - startTime}ms`);

    const { searchParams } = new URL(request.url);
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
      filter.category = category;
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
    console.log(`⏱️ Inventory API - Query: ${Date.now() - queryStart}ms (${items.length}/${total} records, filters: ${Object.keys(filter).join(', ')})`);

    // Convert InventoryMaster to format expected by equipment-request UI
    const formattedItems = items.map(item => ({
      _id: item._id,
      itemName: item.itemName,
      category: item.category,
      quantity: item.availableQuantity, // จำนวนที่เหลือให้เบิก
      totalQuantity: item.totalQuantity,
      serialNumbers: [], // Will be populated from InventoryItem if needed
      status: 'active',
      dateAdded: item.updatedAt,
      hasSerialNumber: item.hasSerialNumber,
      userOwnedQuantity: item.userOwnedQuantity
    }));

    console.log(`📊 Inventory API - Formatted ${formattedItems.length} items for UI:`, 
      formattedItems.map(item => `${item.itemName}: ${item.quantity} available`));

    console.log(`✅ Inventory API - Total Time: ${Date.now() - startTime}ms`);
    return NextResponse.json({
      items: formattedItems,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

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
    console.log('📝 Inventory API - POST request received');
    const itemData = await request.json();
    console.log('📝 Inventory API - Request data:', itemData);
    
    // Get user info from token
    const payload: any = verifyTokenFromRequest(request);
    console.log('📝 Inventory API - Token payload:', payload);
    
    if (!payload) {
      console.log('❌ Inventory API - No token payload');
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Validate required fields
    const requiredFields = ['itemName', 'category'];
    
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
    console.log('🔍 Inventory API - Looking for user with user_id:', payload.userId);
    
    const currentUser = await User.findOne({ user_id: payload.userId });
    console.log('🔍 Inventory API - User found:', currentUser ? currentUser._id : 'None');
    
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

    // Check if item already exists
    console.log('🔍 Inventory API - Checking for existing item:', {
      itemName: itemData.itemName,
      category: itemData.category
    });
    
    const existingItem = await Inventory.findOne({
      itemName: itemData.itemName,
      category: itemData.category
    });

    console.log('🔍 Inventory API - Existing item found:', existingItem ? existingItem._id : 'None');

    if (existingItem) {
      console.log('📝 Inventory API - Updating existing item:', existingItem._id);
      
      // Update existing item - add user quantity to totalQuantity
      existingItem.totalQuantity += (itemData.quantity || 1);
      existingItem.dateAdded = new Date();
      
      console.log('📝 Inventory API - Updated quantities:', {
        oldTotalQuantity: existingItem.totalQuantity - (itemData.quantity || 1),
        newTotalQuantity: existingItem.totalQuantity,
        addedQuantity: itemData.quantity || 1
      });
      
      // Add user to addedBy array if not already present
      if (!existingItem.addedBy || !existingItem.addedBy.some(entry => entry.role === 'user' && entry.userId === currentUser.user_id)) {
        existingItem.addedBy = existingItem.addedBy || [];
        existingItem.addedBy.push({ 
          role: 'user', 
          userId: currentUser.user_id,
          quantity: itemData.quantity || 1,
          dateAdded: new Date()
        });
        console.log('📝 Inventory API - Added new user to addedBy array');
      } else {
        // Update quantity for existing user entry
        const userEntry = existingItem.addedBy.find(entry => entry.role === 'user' && entry.userId === currentUser.user_id);
        if (userEntry) {
          userEntry.quantity += (itemData.quantity || 1);
          userEntry.dateAdded = new Date();
          console.log('📝 Inventory API - Updated existing user quantity:', userEntry.quantity);
        }
      }
      
      await existingItem.save();
      console.log('✅ Inventory API - Existing item updated successfully');
      
      return NextResponse.json({
        message: 'อัปเดตสินค้าเรียบร้อยแล้ว',
        item: existingItem
      });
    } else {
      // Create new item
      console.log('📝 Inventory API - Creating new item with data:', {
        itemName: itemData.itemName,
        category: itemData.category,
        serialNumber: itemData.serialNumber || undefined,
        quantity: 0,
        totalQuantity: itemData.quantity || 1,
        addedBy: [{ 
          role: 'user', 
          userId: currentUser.user_id,
          quantity: itemData.quantity || 1,
          dateAdded: new Date()
        }]
      });
      
      const newItem = new Inventory({
        itemName: itemData.itemName,
        category: itemData.category,
        serialNumber: itemData.serialNumber || undefined,
        quantity: 0, // User owned, not available for others to request
        totalQuantity: itemData.quantity || 1,
        dateAdded: new Date(),
        addedBy: [{ 
          role: 'user', 
          userId: currentUser.user_id,
          quantity: itemData.quantity || 1,
          dateAdded: new Date()
        }]
      });

      console.log('📝 Inventory API - New item object created:', newItem);
      
      await newItem.save();
      console.log('✅ Inventory API - New item saved successfully:', newItem._id);
      
      return NextResponse.json({
        message: 'เพิ่มสินค้าเรียบร้อยแล้ว',
        item: newItem
      });
    }

  } catch (error) {
    console.error('❌ Inventory API - Error occurred:', error);
    console.error('❌ Inventory API - Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    if (error instanceof Error && error.message.includes('duplicate key')) {
      console.log('❌ Inventory API - Duplicate key error');
      return NextResponse.json(
        { error: 'Serial Number นี้มีอยู่ในระบบแล้ว' },
        { status: 400 }
      );
    }
    
    console.log('❌ Inventory API - Generic error, returning 500');
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
