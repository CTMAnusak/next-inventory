import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import { InventoryItem } from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';
import Inventory from '@/models/Inventory';
import { verifyToken } from '@/lib/auth';
import { createInventoryItem } from '@/lib/inventory-helpers';

// GET: list owned equipment for a user (from InventoryItem only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '';
    const firstName = searchParams.get('firstName') || '';
    const lastName = searchParams.get('lastName') || '';
    const office = searchParams.get('office') || '';

    await dbConnect();

    // Build filter for RequestLog
    const requestFilter: any = {};
    
    if (userId) {
      requestFilter.userId = userId;
    } else if (firstName && lastName) {
      requestFilter.firstName = firstName;
      requestFilter.lastName = lastName;
      if (office) {
        requestFilter.office = office;
      }
    } else {
      return NextResponse.json({ items: [] });
    }

    // Determine userId to search for
    const userIdToFind = userId || `${firstName}-${lastName}`;

    // Get current user-owned items from InventoryItem (single source of truth)
    const userOwnedInventoryItems = await InventoryItem.find({
      'currentOwnership.ownerType': 'user_owned',
      'currentOwnership.userId': userIdToFind
    });

    console.log(`🔍 Found ${userOwnedInventoryItems.length} user-owned InventoryItems for user: ${userIdToFind}`);

    // Always use InventoryItem as the source of truth (new system)
    console.log('✅ Using InventoryItem data (new system) as source of truth');
    
    if (userOwnedInventoryItems.length > 0) {
      console.log(`📦 Found ${userOwnedInventoryItems.length} user-owned InventoryItems - building response`);
      
      // Build list from InventoryItem only
      const inventoryItemGroups: { [key: string]: any } = {};
      
      userOwnedInventoryItems.forEach(item => {
        // Skip corrupted items
        if (!item.itemName || item.itemName === 'Unknown Item' || !item.category || item.category === 'ไม่ระบุ') {
          console.warn(`⚠️ Skipping corrupted InventoryItem: ${item._id}`);
          return;
        }
        
        const groupKey = `${item.itemName}-${item.category}`;
        
        if (!inventoryItemGroups[groupKey]) {
          inventoryItemGroups[groupKey] = {
            _id: item._id.toString(),
            itemId: item._id.toString(),
            itemName: item.itemName,
            category: item.category,
            displayName: item.itemName,
            displayCategory: item.category,
            totalQuantity: 0,
            serialNumbers: [],
            items: [],
            itemIdMap: {}, // Map serial number to actual itemId
            requestDate: item.currentOwnership.ownedSince,
            searchText: `${item.itemName} ${item.category} ${item.serialNumber || ''}`.toLowerCase()
          };
        }
        
        inventoryItemGroups[groupKey].totalQuantity = (inventoryItemGroups[groupKey].totalQuantity || 0) + 1;
        
        // Store itemId mapping for each serial number or no-SN items
        if (item.serialNumber) {
          inventoryItemGroups[groupKey].serialNumbers.push(item.serialNumber);
          inventoryItemGroups[groupKey].itemIdMap[item.serialNumber] = item._id.toString();
        } else {
          // For items without serial numbers, store directly in the group
          // Since there's no SN to distinguish, we'll store the first item's ID as default
          if (!inventoryItemGroups[groupKey].defaultItemId) {
            inventoryItemGroups[groupKey].defaultItemId = item._id.toString();
          }
          // Also store with counter for multiple items
          const noSnKey = `no_sn_${inventoryItemGroups[groupKey].totalQuantity}`;
          inventoryItemGroups[groupKey].itemIdMap[noSnKey] = item._id.toString();
        }
        
        inventoryItemGroups[groupKey].items.push({
          requestId: 'inventory-item',
          quantity: 1,
          serialNumbers: item.serialNumber ? [item.serialNumber] : [],
          requestDate: item.currentOwnership.ownedSince,
          source: 'inventory-item',
          actualItemId: item._id.toString() // Store actual itemId for each item
        });
        
        console.log(`🔍 Added InventoryItem: ${item.itemName} (${item.serialNumber || 'No SN'}) with itemId: ${item._id}`);
      });
      
      const finalEquipment = Object.values(inventoryItemGroups);
      console.log('📤 Returning InventoryItem-based equipment:', finalEquipment);
      
      return NextResponse.json({ items: finalEquipment });
    } else {
      // No InventoryItems found - user has no equipment
      console.log('📤 No InventoryItems found - user has no equipment');
      return NextResponse.json({ items: [] });
    }

  } catch (error) {
    console.error('Fetch owned equipment error:', error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

// POST: add equipment as "owned" (creates InventoryItem directly)
export async function POST(request: NextRequest) {
  try {
    const equipmentData = await request.json();
    
    // Get user info from token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    console.log('🔍 POST /api/user/owned-equipment - Received data:', equipmentData);

    // Check if we have itemName and category, or need to resolve from itemId
    let itemName = equipmentData.itemName;
    let category = equipmentData.category;
    
    if (!itemName || !category) {
      if (!equipmentData.itemId) {
        return NextResponse.json(
          { error: 'กรุณาระบุข้อมูลอุปกรณ์ (itemName + category หรือ itemId)' },
          { status: 400 }
        );
      }
      
      // Try to find item details from InventoryMaster using itemId
      try {
        const inventoryMaster = await InventoryMaster.findById(equipmentData.itemId);
        if (inventoryMaster) {
          itemName = inventoryMaster.itemName;
          category = inventoryMaster.category;
          console.log('🔍 Resolved from InventoryMaster:', { itemName, category });
        } else {
          return NextResponse.json(
            { error: 'ไม่พบข้อมูลอุปกรณ์ที่ระบุ' },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error('Error finding InventoryMaster:', error);
        return NextResponse.json(
          { error: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลอุปกรณ์' },
          { status: 500 }
        );
      }
    }

    // Validate required fields
    if (!equipmentData.quantity || parseInt(equipmentData.quantity) <= 0) {
      return NextResponse.json(
        { error: 'กรุณาระบุจำนวนที่ถูกต้อง' },
        { status: 400 }
      );
    }

    await dbConnect();

    const quantity = parseInt(equipmentData.quantity) || 1;
    const createdItems = [];

    // Create InventoryItems for each quantity
    for (let i = 0; i < quantity; i++) {
      const serialNumber = equipmentData.serialNumber && equipmentData.serialNumber.trim() !== '' 
        ? equipmentData.serialNumber.trim() 
        : undefined;
      
      console.log(`🔄 Creating InventoryItem ${i + 1}/${quantity}:`, {
        itemName,
        category,
        serialNumber,
        userId: payload.userId
      });

      try {
        const inventoryItem = await createInventoryItem({
          itemName,
          category,
          serialNumber,
          initialOwnerType: 'user_owned',
          userId: payload.userId,
          addedBy: 'user',
          addedByUserId: payload.userId,
          notes: 'อุปกรณ์ที่ผู้ใช้เพิ่มเอง'
        });

        createdItems.push(inventoryItem);
        console.log(`✅ Created InventoryItem: ${inventoryItem._id} for ${itemName}`);
      } catch (error) {
        console.error(`❌ Error creating InventoryItem ${i + 1}:`, error);
        throw error;
      }
    }

    console.log(`🎉 Successfully created ${createdItems.length} InventoryItems for user ${payload.userId}`);

    return NextResponse.json({
      message: `เพิ่มอุปกรณ์เรียบร้อยแล้ว ${quantity} ชิ้น`,
      createdItems: createdItems.length,
      itemIds: createdItems.map(item => item._id.toString())
    });

  } catch (error) {
    console.error('Add owned equipment error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}