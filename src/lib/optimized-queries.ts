import mongoose from 'mongoose';

/**
 * Optimized Database Query Helpers
 * ใช้ aggregation pipeline เพื่อเพิ่มประสิทธิภาพ
 */

// Optimized inventory aggregation pipeline
export async function getInventoryWithAggregation(filters: {
  search?: string;
  category?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const {
    search = '',
    category = '',
    status = '',
    page = 1,
    limit = 50
  } = filters;

  const pipeline: any[] = [];

  // Match stage for filtering
  const matchStage: any = {
    $or: [
      { totalQuantity: { $gt: 0 } },
      { availableQuantity: { $gt: 0 } },
      { userOwnedQuantity: { $gt: 0 } }
    ]
  };

  if (search) {
    matchStage.$and = [
      {
        $or: [
          { itemName: { $regex: search, $options: 'i' } },
          { serialNumber: { $regex: search, $options: 'i' } }
        ]
      }
    ];
  }

  if (category) {
    matchStage.categoryId = category;
  }

  if (status) {
    matchStage.status = status;
  }

  pipeline.push({ $match: matchStage });

  // Add computed fields
  pipeline.push({
    $addFields: {
      hasSerialNumber: { $gt: ['$itemDetails.withSerialNumber.count', 0] },
      isLowStock: { $lte: ['$availableQuantity', 2] },
      stockRatio: {
        $cond: {
          if: { $gt: ['$totalQuantity', 0] },
          then: { $divide: ['$availableQuantity', '$totalQuantity'] },
          else: 0
        }
      }
    }
  });

  // Sort stage
  pipeline.push({ $sort: { lastUpdated: -1 } });

  // Pagination
  const skip = (page - 1) * limit;
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  // Project only needed fields
  pipeline.push({
    $project: {
      _id: 1,
      itemName: 1,
      categoryId: 1,
      totalQuantity: 1,
      availableQuantity: 1,
      userOwnedQuantity: 1,
      lastUpdated: 1,
      hasSerialNumber: 1,
      isLowStock: 1,
      stockRatio: 1
    }
  });

  return pipeline;
}

// Optimized dashboard statistics aggregation
export async function getDashboardStatsAggregation(year: number, month?: number) {
  const startDate = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const endDate = month ? new Date(year, month, 0, 23, 59, 59) : new Date(year, 11, 31, 23, 59, 59);

  const pipeline = [
    // Get all statistics in parallel using $facet
    {
      $facet: {
        // Issue statistics
        issueStats: [
          { $match: { reportDate: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: null,
              totalIssues: { $sum: 1 },
              pendingIssues: {
                $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
              },
              inProgressIssues: {
                $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
              },
              completedIssues: {
                $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
              },
              urgentIssues: {
                $sum: { $cond: [{ $eq: ['$urgency', 'very_urgent'] }, 1, 0] }
              }
            }
          }
        ],
        // Request statistics
        requestStats: [
          { $match: { status: { $in: ['approved', 'completed'] } } },
          { $unwind: '$items' },
          {
            $group: {
              _id: null,
              totalRequests: { $sum: 1 },
              requestsByUrgency: {
                $push: {
                  urgency: '$urgency',
                  count: 1
                }
              }
            }
          }
        ],
        // Return statistics
        returnStats: [
          { $unwind: '$items' },
          { $match: { 'items.approvalStatus': 'approved' } },
          {
            $group: {
              _id: null,
              totalReturns: { $sum: 1 }
            }
          }
        ],
        // Inventory statistics
        inventoryStats: [
          {
            $group: {
              _id: null,
              totalItems: { $sum: 1 },
              lowStockItems: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $lte: ['$availableQuantity', 2] },
                        { $gte: ['$availableQuantity', 0] },
                        { $gt: ['$totalQuantity', 0] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              },
              userAddedItems: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$sourceInfo.acquisitionMethod', 'self_reported'] },
                        { $eq: ['$currentOwnership.ownerType', 'user_owned'] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ]
      }
    }
  ];

  return pipeline;
}

// Optimized user holdings aggregation
export async function getUserHoldingsAggregation(userId: string) {
  const pipeline = [
    // Get user's request logs
    {
      $match: { userId, requestType: 'request' }
    },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'inventoryitems',
        localField: 'items.itemId',
        foreignField: '_id',
        as: 'inventoryItem'
      }
    },
    { $unwind: '$inventoryItem' },
    {
      $lookup: {
        from: 'inventorymasters',
        localField: 'inventoryItem.itemMasterId',
        foreignField: '_id',
        as: 'inventoryMaster'
      }
    },
    { $unwind: '$inventoryMaster' },
    {
      $group: {
        _id: {
          itemId: '$items.itemId',
          serialNumber: '$items.serialNumber'
        },
        itemName: { $first: '$inventoryMaster.itemName' },
        categoryId: { $first: '$inventoryMaster.categoryId' },
        quantity: { $sum: '$items.quantity' },
        requestDate: { $first: '$requestDate' },
        status: { $first: '$status' }
      }
    },
    {
      $project: {
        _id: 0,
        itemId: '$_id.itemId',
        serialNumber: '$_id.serialNumber',
        itemName: 1,
        categoryId: 1,
        quantity: 1,
        requestDate: 1,
        status: 1
      }
    },
    { $sort: { requestDate: -1 } }
  ];

  return pipeline;
}

// Optimized equipment reports aggregation
export async function getEquipmentReportsAggregation(filters: {
  requestType?: string;
  status?: string;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}) {
  const {
    requestType = 'request',
    status,
    userId,
    dateFrom,
    dateTo,
    page = 1,
    limit = 50
  } = filters;

  const pipeline: any[] = [];

  // Match stage
  const matchStage: any = { requestType };
  
  if (status) matchStage.status = status;
  if (userId) matchStage.userId = userId;
  if (dateFrom || dateTo) {
    matchStage.requestDate = {};
    if (dateFrom) matchStage.requestDate.$gte = dateFrom;
    if (dateTo) matchStage.requestDate.$lte = dateTo;
  }

  pipeline.push({ $match: matchStage });

  // Lookup user information
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: 'user_id',
      as: 'userInfo'
    }
  });

  // Lookup deleted user information if not found
  pipeline.push({
    $lookup: {
      from: 'deletedusers',
      localField: 'userId',
      foreignField: 'user_id', // ✅ แก้ไข: ใช้ user_id แทน originalUserId
      as: 'deletedUserInfo'
    }
  });

  // Add computed user information
  pipeline.push({
    $addFields: {
      userInfo: {
        $cond: {
          if: { $gt: [{ $size: '$userInfo' }, 0] },
          then: {
            $mergeObjects: [
              { $arrayElemAt: ['$userInfo', 0] },
              { isActive: true }
            ]
          },
          else: {
            $cond: {
              if: { $gt: [{ $size: '$deletedUserInfo' }, 0] },
              then: {
                $mergeObjects: [
                  { $arrayElemAt: ['$deletedUserInfo', 0] },
                  { isActive: false }
                ]
              },
              else: {
                firstName: 'Unknown',
                lastName: 'User',
                isActive: false
              }
            }
          }
        }
      }
    }
  });

  // Sort
  pipeline.push({ $sort: { requestDate: -1, createdAt: -1 } });

  // Pagination
  const skip = (page - 1) * limit;
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  // Project only needed fields
  pipeline.push({
    $project: {
      _id: 1,
      userId: 1,
      requestDate: 1,
      createdAt: 1,
      status: 1,
      items: 1,
      approvedBy: 1,
      userInfo: {
        firstName: 1,
        lastName: 1,
        nickname: 1,
        department: 1,
        phone: 1,
        office: 1,
        email: 1,
        isActive: 1
      }
    }
  });

  return pipeline;
}

// Performance monitoring for queries
export async function monitorQueryPerformance<T>(
  queryName: string,
  queryFunction: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await queryFunction();
    const duration = performance.now() - startTime;
    
    if (duration > 100) { // Log slow queries (>100ms)
      console.warn(`🐌 Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`❌ Query failed: ${queryName} after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
}
