import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import Inventory from '@/models/Inventory';
import InventoryItem from '@/models/InventoryItem';

// GET - Fetch all equipment tracking data (including user-owned items and request logs minus returns)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const itemId = searchParams.get('itemId');
    const department = searchParams.get('department');
    const office = searchParams.get('office');
    
    // Build filter object for request logs
    const requestFilter: any = {};
    
    if (userId) {
      requestFilter.userId = userId;
    }
    
    if (department) {
      requestFilter.department = department;
    }
    
    if (office) {
      requestFilter.office = office;
    }
    
    // Fetch request logs with filters (only actual requests, not user-owned)
    let requests = await RequestLog.find({ ...requestFilter, requestType: 'request' }).sort({ requestDate: -1 });
    
    // Filter by itemId if provided
    if (itemId) {
      requests = requests.filter(request => 
        request.items.some(item => item.itemId === itemId)
      );
    }
    
    // Fetch all return logs to exclude returned items
    const returnLogs = await ReturnLog.find({});
    
    // Create a map of returned items (userId + itemId + serialNumber)
    const returnedItems = new Set();
    returnLogs.forEach(returnLog => {
      returnLog.items.forEach(item => {
        const key = `${returnLog.userId}-${item.itemId}-${item.serialNumber || ''}`;
        returnedItems.add(key);
      });
    });
    
    // Transform request logs data and filter out returned items
    const trackingDataFromRequests: any[] = [];
    requests.forEach(request => {
      request.items.forEach(item => {
        const key = `${request.userId}-${item.itemId}-${item.serialNumber || ''}`;
        if (!returnedItems.has(key)) {
          trackingDataFromRequests.push({
            _id: `${request._id}-${item.itemId}`,
            requestId: request._id.toString(),
            firstName: request.firstName,
            lastName: request.lastName,
            nickname: request.nickname,
            department: request.department,
            office: request.office,
            phone: request.phone,
            requestDate: request.requestDate,
            deliveryLocation: request.deliveryLocation,
            urgency: request.urgency,
            reason: request.reason,
            userId: request.userId,
            itemId: item.itemId,
            itemName: item.itemName,
            quantity: item.quantity,
            serialNumber: item.serialNumber || item.assignedSerialNumbers?.[0] || null,
            submittedAt: request.submittedAt || request.createdAt,
            source: 'request'
          });
        }
      });
    });
    
    // No need for separate user-owned items - all data comes from RequestLog now
    // Items added via dashboard are stored as special RequestLog entries
    
    // Use only tracking data from requests
    const combinedData = trackingDataFromRequests;
    
    // Get inventory data for categories and serial numbers
    const inventoryItems = await Inventory.find({});
    const inventoryMap: {[key: string]: any} = {};
    inventoryItems.forEach(item => {
      inventoryMap[item._id.toString()] = {
        itemName: item.itemName,
        category: item.category || 'ไม่ระบุ'
      };
    });

    // Get actual serial numbers from InventoryItem for each tracking record
    const inventoryItemIds = trackingDataFromRequests.map(item => item.itemId);
    const actualInventoryItems = await InventoryItem.find({
      _id: { $in: inventoryItemIds },
      status: { $in: ['active', 'maintenance', 'damaged'] }
    });

    // Create a map of actual serial numbers
    const serialNumberMap: {[key: string]: string} = {};
    actualInventoryItems.forEach(item => {
      if (item.serialNumber) {
        serialNumberMap[item._id.toString()] = item.serialNumber;
      }
    });
    
    // Add category information and actual serial numbers to tracking data
    const trackingDataWithCategories = combinedData.map(item => ({
      ...item,
      category: inventoryMap[item.itemId]?.category || 'ไม่ระบุ',
      currentItemName: inventoryMap[item.itemId]?.itemName || item.itemName,
      serialNumber: serialNumberMap[item.itemId] || item.serialNumber || null
    }));
    
    // Sort by category first, then by item name
    trackingDataWithCategories.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category, 'th');
      }
      return a.currentItemName.localeCompare(b.currentItemName, 'th');
    });
    
    return NextResponse.json(trackingDataWithCategories);
  } catch (error) {
    console.error('Error fetching equipment tracking data:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
