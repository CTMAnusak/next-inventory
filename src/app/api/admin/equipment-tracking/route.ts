import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import { InventoryItem } from '@/models/InventoryItemNew';
import ItemMaster from '@/models/ItemMaster';
import User from '@/models/User';
import InventoryConfig from '@/models/InventoryConfig';

// GET - ดึงข้อมูลการติดตามอุปกรณ์ทั้งหมด
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const itemMasterId = searchParams.get('itemMasterId');
    const categoryId = searchParams.get('categoryId');
    const department = searchParams.get('department');
    const office = searchParams.get('office');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Build filter objects
    const requestFilter: any = { requestType: 'request' };
    const returnFilter: any = {};
    const itemFilter: any = { deletedAt: { $exists: false } };
    
    if (userId) {
      requestFilter.userId = userId;
      returnFilter.userId = userId;
      itemFilter['currentOwnership.userId'] = userId;
    }
    
    if (department) {
      requestFilter.department = department;
      returnFilter.department = department;
    }
    
    if (office) {
      requestFilter.office = office;
      returnFilter.office = office;
    }
    
    if (status) {
      requestFilter.status = status;
      returnFilter.status = status;
    }
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      requestFilter.requestDate = { $gte: fromDate };
      returnFilter.returnDate = { $gte: fromDate };
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      if (requestFilter.requestDate) {
        requestFilter.requestDate.$lte = toDate;
      } else {
        requestFilter.requestDate = { $lte: toDate };
      }
      if (returnFilter.returnDate) {
        returnFilter.returnDate.$lte = toDate;
      } else {
        returnFilter.returnDate = { $lte: toDate };
      }
    }
    
    if (itemMasterId) {
      itemFilter.itemMasterId = itemMasterId;
    }
    
    if (categoryId) {
      itemFilter.categoryId = categoryId;
    }
    
    // Get configurations for display
    const config = await InventoryConfig.findOne({});
    const statusConfigs = config?.statusConfigs || [];
    const conditionConfigs = config?.conditionConfigs || [];
    const categoryConfigs = config?.categoryConfigs || [];
    
    // Fetch data in parallel
    const [requestLogs, returnLogs, ownedItems, itemMasters] = await Promise.all([
      // Request logs
      RequestLog.find(requestFilter)
        .populate('userId', 'firstName lastName nickname department office phone pendingDeletion')
        .sort({ requestDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      
      // Return logs
      ReturnLog.find(returnFilter)
        .populate('userId', 'firstName lastName nickname department office phone pendingDeletion')
        .sort({ returnDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      
      // Currently owned items
      InventoryItem.find(itemFilter)
        .populate('itemMasterId', 'itemName categoryId hasSerialNumber')
        .sort({ 'currentOwnership.ownedSince': -1 }),
      
      // Item masters for reference
      ItemMaster.find({ isActive: true })
        .sort({ itemName: 1 })
    ]);
    
    // Create item master lookup
    const itemMasterLookup = new Map();
    itemMasters.forEach(master => {
      itemMasterLookup.set(master._id.toString(), master);
    });
    
    // Process request logs
    const processedRequests = requestLogs.map(request => {
      const user = request.userId as any;
      return {
        id: request._id,
        type: 'request',
        user: user ? {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          nickname: user.nickname,
          department: user.department,
          office: user.office,
          phone: user.phone
        } : null,
        date: request.requestDate,
        status: request.status,
        urgency: request.urgency,
        deliveryLocation: request.deliveryLocation,
        notes: request.notes,
        items: request.items.map((item: any) => ({
          itemMasterId: item.itemMasterId,
          itemName: item.itemName,
          categoryId: item.categoryId,
          quantity: item.quantity,
          serialNumber: item.serialNumber
        }))
      };
    });
    
    // Process return logs
    const processedReturns = returnLogs.map(returnLog => {
      const user = returnLog.userId as any;
      return {
        id: returnLog._id,
        type: 'return',
        user: user ? {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          nickname: user.nickname,
          department: user.department,
          office: user.office,
          phone: user.phone
        } : null,
        date: returnLog.returnDate,
        status: returnLog.status,
        notes: returnLog.notes,
        items: returnLog.items.map((item: any) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          serialNumber: item.serialNumber,
          conditionOnReturn: item.conditionOnReturn,
          itemNotes: item.itemNotes
        }))
      };
    });
    
    // Process currently owned items
    const processedOwnedItems = ownedItems.map(item => {
      const itemMaster = itemMasterLookup.get(item.itemMasterId.toString());
      const statusConfig = statusConfigs.find(s => s.id === item.statusId);
      const conditionConfig = conditionConfigs.find(c => c.id === item.conditionId);
      const categoryConfig = categoryConfigs.find(c => c.id === itemMaster?.categoryId);
      
      return {
        id: item._id,
        type: 'owned',
        itemMasterId: item.itemMasterId,
        itemName: itemMaster?.itemName || 'ไม่ระบุ',
        categoryId: itemMaster?.categoryId || 'ไม่ระบุ',
        categoryName: categoryConfig?.name || 'ไม่ระบุ',
        serialNumber: item.serialNumber,
        numberPhone: item.numberPhone,
        statusId: item.statusId,
        statusName: statusConfig?.name || 'ไม่ระบุ',
        statusColor: statusConfig?.color || '#6B7280',
        conditionId: item.conditionId,
        conditionName: conditionConfig?.name || 'ไม่ระบุ',
        conditionColor: conditionConfig?.color || '#6B7280',
        ownedSince: item.currentOwnership.ownedSince,
        sourceInfo: item.sourceInfo,
        createdAt: item.createdAt
      };
    });
    
    // Combine and sort all activities
    const allActivities = [
      ...processedRequests,
      ...processedReturns,
      ...processedOwnedItems
    ].sort((a, b) => new Date(b.date || b.ownedSince || b.createdAt).getTime() - new Date(a.date || a.ownedSince || a.createdAt).getTime());
    
    // Apply search filter if provided
    let filteredActivities = allActivities;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredActivities = allActivities.filter(activity => {
        if (activity.type === 'owned') {
          return activity.itemName.toLowerCase().includes(searchLower) ||
                 activity.serialNumber?.toLowerCase().includes(searchLower) ||
                 activity.numberPhone?.includes(search) ||
                 activity.categoryName.toLowerCase().includes(searchLower);
        } else {
          return activity.user?.name.toLowerCase().includes(searchLower) ||
                 activity.user?.department.toLowerCase().includes(searchLower) ||
                 activity.user?.office.toLowerCase().includes(searchLower) ||
                 activity.items?.some((item: any) => 
                   item.itemName?.toLowerCase().includes(searchLower) ||
                   item.serialNumber?.toLowerCase().includes(searchLower)
                 );
        }
      });
    }
    
    // Get total count for pagination
    const totalCount = filteredActivities.length;
    const paginatedActivities = filteredActivities.slice((page - 1) * limit, page * limit);
    
    return NextResponse.json({
      activities: paginatedActivities,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      summary: {
        totalRequests: processedRequests.length,
        totalReturns: processedReturns.length,
        totalOwnedItems: processedOwnedItems.length,
        totalActivities: allActivities.length
      }
    });
    
  } catch (error) {
    console.error('Error fetching equipment tracking data:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลการติดตามอุปกรณ์' },
      { status: 500 }
    );
  }
}