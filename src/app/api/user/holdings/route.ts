import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import InventoryItem from '@/models/InventoryItem';
import InventoryMaster from '@/models/InventoryMaster';

type HoldingKey = string; // `${itemId}||${serialNumber}||${firstName}||${lastName}` where serialNumber can be ''

import { getCachedData, setCachedData, isCached } from '@/lib/cache-utils';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '';

    if (!userId) {
      return NextResponse.json({ items: [] });
    }

    // ตรวจสอบว่า user อยู่ในสถานะ pendingDeletion หรือไม่
    await dbConnect();
    const { default: User } = await import('@/models/User');
    const user = await User.findOne({ user_id: userId });
    if (user && user.pendingDeletion) {
      console.log(`🚫 User ${userId} is pending deletion, blocking holdings access`);
      return NextResponse.json(
        { error: 'บัญชีของคุณอยู่ในสถานะรอลบ ไม่สามารถเข้าถึงข้อมูลได้' },
        { status: 403 }
      );
    }

    // Check cache first
    const cacheKey = `holdings_${userId}`;
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`💾 Holdings API - Cache Hit: ${Date.now() - startTime}ms`);
      }
      return NextResponse.json(cachedResult);
    }

    await dbConnect();
    if (process.env.NODE_ENV === 'development') {
      console.log(`⏱️ Holdings API - DB Connect: ${Date.now() - startTime}ms`);
    }

    // Collect requests and returns for the user
    const queryStart = Date.now();
    const [requestLogs, returnLogs] = await Promise.all([
      RequestLog.find({ userId }),
      ReturnLog.find({ userId })
    ]);
    console.log(`⏱️ Holdings API - Request/Return Query: ${Date.now() - queryStart}ms (${requestLogs.length + returnLogs.length} records)`);

    const qtyByKey: Record<HoldingKey, number> = {};

    // Add requests
    for (const log of requestLogs) {
      for (const it of (log.items as any[]) || []) {
        const sn = it.serialNumber && String(it.serialNumber).trim() !== '-' ? String(it.serialNumber).trim() : '';
        // Include user info in the key to separate items by different users
        const key: HoldingKey = `${it.itemId || it.itemName}||${sn}||${log.firstName || ''}||${log.lastName || ''}`;
        const q = Number(it.quantity || 0);
        qtyByKey[key] = (qtyByKey[key] || 0) + (q > 0 ? q : 0);
      }
    }

    // Subtract returns
    for (const log of returnLogs) {
      for (const it of (log.items as any[]) || []) {
        const sn = it.serialNumber && String(it.serialNumber).trim() !== '-' ? String(it.serialNumber).trim() : '';
        // Include user info in the key to separate items by different users
        const key: HoldingKey = `${it.itemId || it.itemName}||${sn}||${log.firstName || ''}||${log.lastName || ''}`;
        const q = Number(it.quantity || 0);
        qtyByKey[key] = (qtyByKey[key] || 0) - (q > 0 ? q : 0);
      }
    }

    // Build list and lookup categories from Inventory
    const entries = Object.entries(qtyByKey)
      .filter(([, q]) => q > 0)
      .map(([key, quantity]) => {
        const [itemId, sn, firstName, lastName] = key.split('||');
        return { 
          itemId, 
          serialNumber: sn || undefined, 
          quantity,
          firstName: firstName || '',
          lastName: lastName || ''
        };
      });

    if (entries.length === 0) return NextResponse.json({ items: [] });

    const itemIds = Array.from(new Set(entries.map(e => e.itemId)));
    const invQueryStart = Date.now();
    // Get inventory master data for the items
    const invList = await InventoryMaster.find({ 
      $or: [
        { _id: { $in: itemIds } },
        { itemName: { $in: itemIds } }  // Fallback for itemName-based lookup
      ]
    });
    console.log(`⏱️ Holdings API - Inventory Query: ${Date.now() - invQueryStart}ms (${itemIds.length} IDs → ${invList.length} records)`);

    const items = entries.map((e) => {
      // Find inventory item by ID
      const inventoryItem = invList.find((i: any) => String(i._id) === e.itemId);
      const category = inventoryItem?.category || 'อื่นๆ';
      const inventoryId = inventoryItem?._id ? String(inventoryItem._id) : undefined;
      
      // Find the most recent request log for this specific user and item to get complete user info
      const mostRecentRequest = requestLogs
        .filter((log: any) => 
          log.firstName === e.firstName && 
          log.lastName === e.lastName &&
          log.items?.some((item: any) => 
            (item.itemId || item.itemName) === e.itemId && 
            (e.serialNumber ? item.serialNumber === e.serialNumber : true)
          )
        )
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      return { 
        ...e, 
        itemName: inventoryItem?.itemName || 'Unknown Item', // Add itemName for display
        category, 
        inventoryId,
        // Use user info from the entry (already extracted from key)
        firstName: e.firstName,
        lastName: e.lastName,
        nickname: mostRecentRequest?.nickname || '',
        department: mostRecentRequest?.department || '',
        phone: mostRecentRequest?.phone || '',
        office: mostRecentRequest?.office || ''
      };
    })
      // Filter out holdings that no longer exist in inventory
      .filter((e) => !!e.inventoryId);

    // Cache the result
    const result = { items };
    setCachedData(cacheKey, result);
    
    console.log(`✅ Holdings API - Total Time: ${Date.now() - startTime}ms (returned ${items.length} items, cached)`);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Fetch user holdings error:', error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}


