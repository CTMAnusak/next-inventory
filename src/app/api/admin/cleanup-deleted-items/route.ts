import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import { cleanupSoftDeletedItems } from '@/lib/inventory-helpers';
import { clearAllCaches } from '@/lib/cache-utils';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get user info from token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const currentUser = await User.findOne({ user_id: payload.userId });
    if (!currentUser || !['admin', 'it_admin'].includes(currentUser.userRole)) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { 
      cleanupType, 
      itemName, 
      category, 
      items, // Array of {itemName, category} for batch cleanup
      dryRun = false // Preview mode - don't actually clean up
    } = body;

    console.log(`🧹 Cleanup API - Received request:`, {
      cleanupType,
      itemName,
      category,
      itemsCount: items?.length || 0,
      dryRun,
      adminId: currentUser.user_id,
      adminName: `${currentUser.firstName} ${currentUser.lastName}`
    });

    // Validate cleanup type
    const validCleanupTypes = ['specific', 'all', 'batch', 'sync-fix'];
    if (!validCleanupTypes.includes(cleanupType)) {
      return NextResponse.json(
        { error: `cleanupType ต้องเป็น: ${validCleanupTypes.join(', ')}` },
        { status: 400 }
      );
    }

    let results: any[] = [];
    let totalCleaned = 0;

    try {
      if (cleanupType === 'specific') {
        // Clean up specific item only
        if (!itemName || !category) {
          return NextResponse.json(
            { error: 'กรุณาระบุ itemName และ category สำหรับการทำความสะอาดเฉพาะรายการ' },
            { status: 400 }
          );
        }
        
        
        if (dryRun) {
          // Preview mode - just analyze
          const InventoryItem = (await import('@/models/InventoryItem')).default;
          const softDeletedItems = await InventoryItem.find({
            itemName,
            category,
            status: 'deleted'
          });
          
          return NextResponse.json({
            dryRun: true,
            preview: {
              itemName,
              category,
              softDeletedCount: softDeletedItems.length,
              items: softDeletedItems.map(item => ({
                id: item._id,
                serialNumber: item.serialNumber,
                deletedAt: item.deletedAt,
                deleteReason: item.deleteReason
              }))
            }
          });
        }
        
        const result = await cleanupSoftDeletedItems(itemName, category);
        results.push({ itemName, category, ...result });
        totalCleaned += result.cleaned;
        
      } else if (cleanupType === 'batch') {
        // Clean up multiple specific items
        if (!items || !Array.isArray(items) || items.length === 0) {
          return NextResponse.json(
            { error: 'กรุณาระบุ items array สำหรับการทำความสะอาดแบบ batch' },
            { status: 400 }
          );
        }
        
        
        for (const item of items) {
          if (!item.itemName || !item.category) {
            console.warn(`⚠️ Skipping invalid item:`, item);
            continue;
          }
          
          try {
            if (dryRun) {
              const InventoryItem = (await import('@/models/InventoryItem')).default;
              const softDeletedItems = await InventoryItem.find({
                itemName: item.itemName,
                category: item.category,
                status: 'deleted'
              });
              
              results.push({
                itemName: item.itemName,
                category: item.category,
                preview: true,
                softDeletedCount: softDeletedItems.length
              });
            } else {
              const result = await cleanupSoftDeletedItems(item.itemName, item.category);
              results.push({ itemName: item.itemName, category: item.category, ...result });
              totalCleaned += result.cleaned;
            }
          } catch (itemError) {
            console.error(`❌ Error cleaning ${item.itemName}:`, itemError);
            results.push({
              itemName: item.itemName,
              category: item.category,
              error: itemError instanceof Error ? itemError.message : 'Unknown error'
            });
          }
        }
        
      } else if (cleanupType === 'all') {
        // Clean up all soft-deleted items in the system
        
        if (dryRun) {
          const InventoryItem = (await import('@/models/InventoryItem')).default;
          const softDeletedItems = await InventoryItem.find({ status: 'deleted' });
          
          const preview = softDeletedItems.reduce((acc: any, item) => {
            const key = `${item.itemName}|${item.category}`;
            if (!acc[key]) {
              acc[key] = {
                itemName: item.itemName,
                category: item.category,
                count: 0
              };
            }
            acc[key].count++;
            return acc;
          }, {});
          
          return NextResponse.json({
            dryRun: true,
            preview: {
              totalSoftDeleted: softDeletedItems.length,
              itemTypes: Object.values(preview)
            }
          });
        }
        
        const result = await cleanupSoftDeletedItems();
        results.push({ scope: 'all', ...result });
        totalCleaned += result.cleaned;
        
      } else if (cleanupType === 'sync-fix') {
        // Advanced: Fix sync issues comprehensively
        
        // Import the comprehensive sync function from the script
        const { checkInventorySync, fixInventorySync } = require('../../../../fix-inventory-count-sync');
        
        // This would need to be implemented as a proper function in inventory-helpers
        // For now, redirect to use the all cleanup
        const result = await cleanupSoftDeletedItems();
        results.push({ scope: 'sync-fix', ...result });
        totalCleaned += result.cleaned;
      }

      if (!dryRun) {
        // Clear all caches after cleanup
        clearAllCaches();
      }

      return NextResponse.json({
        success: true,
        dryRun,
        cleanupType,
        summary: {
          totalCleaned,
          itemsProcessed: results.length,
          errors: results.filter(r => r.error).length
        },
        results
      });
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      return NextResponse.json(
        { 
          error: 'เกิดข้อผิดพลาดในการทำความสะอาด',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Error in cleanup API:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการทำความสะอาด' },
      { status: 500 }
    );
  }
}

// GET - Check inventory sync issues (comprehensive analysis)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get user info from token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const currentUser = await User.findOne({ user_id: payload.userId });
    if (!currentUser || !['admin', 'it_admin'].includes(currentUser.userRole)) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get('itemName');
    const category = searchParams.get('category');
    const analysisType = searchParams.get('type') || 'full'; // 'full' | 'soft-deleted-only'


    // Import models
    const InventoryItem = (await import('@/models/InventoryItem')).default;
    const InventoryMaster = (await import('@/models/InventoryMaster')).default;
    
    // Build query
    let itemQuery: any = {};
    if (itemName) itemQuery.itemName = itemName;
    if (category) itemQuery.category = category;

    if (analysisType === 'soft-deleted-only') {
      // Only check soft-deleted items
      itemQuery.status = 'deleted';
      const softDeletedItems = await InventoryItem.find(itemQuery).select('itemName category serialNumber numberPhone deletedAt deleteReason');
      
      const summary = softDeletedItems.reduce((acc: any, item) => {
        const key = `${item.itemName}|${item.category}`;
        if (!acc[key]) {
          acc[key] = {
            itemName: item.itemName,
            category: item.category,
            count: 0,
            items: []
          };
        }
        acc[key].count++;
        acc[key].items.push({
          id: item._id,
          serialNumber: item.serialNumber,
          numberPhone: item.numberPhone,
          deletedAt: item.deletedAt,
          deleteReason: item.deleteReason
        });
        return acc;
      }, {});

      return NextResponse.json({
        analysisType: 'soft-deleted-only',
        totalSoftDeleted: softDeletedItems.length,
        summary: Object.values(summary),
        queryScope: itemName && category ? 'specific' : 'all'
      });
    }

    // Full inventory sync analysis
    const allItems = await InventoryItem.find(itemQuery);
    
    // Group by itemName + category
    const itemGroups: any = {};
    for (const item of allItems) {
      const key = `${item.itemName}|${item.category}`;
      if (!itemGroups[key]) {
        itemGroups[key] = {
          itemName: item.itemName,
          category: item.category,
          allItems: [],
          activeItems: [],
          softDeletedItems: []
        };
      }
      
      itemGroups[key].allItems.push(item);
      
      if (item.status === 'deleted') {
        itemGroups[key].softDeletedItems.push({
          id: item._id,
          serialNumber: item.serialNumber,
          numberPhone: item.numberPhone,
          deletedAt: item.deletedAt,
          deleteReason: item.deleteReason
        });
      } else {
        itemGroups[key].activeItems.push({
          id: item._id,
          serialNumber: item.serialNumber,
          status: item.status,
          ownerType: item.currentOwnership?.ownerType
        });
      }
    }


    const analysisResults = [];
    let totalProblems = 0;

    // Analyze each group
    for (const [key, group] of Object.entries(itemGroups)) {
      const masterItem = await InventoryMaster.findOne({
        itemName: group.itemName,
        category: group.category
      });

      const totalInItems = group.allItems.length;
      const activeInItems = group.activeItems.length;
      const softDeletedCount = group.softDeletedItems.length;
      const totalInMaster = masterItem ? masterItem.totalQuantity : 0;
      const availableInMaster = masterItem ? masterItem.availableQuantity : 0;
      const userOwnedInMaster = masterItem ? masterItem.userOwnedQuantity : 0;

      // Check for problems
      const hasSoftDeleted = softDeletedCount > 0;
      const hasCountMismatch = activeInItems !== totalInMaster;
      const hasProblem = hasSoftDeleted || hasCountMismatch;

      if (hasProblem) totalProblems++;

      analysisResults.push({
        itemName: group.itemName,
        category: group.category,
        inventoryItems: {
          total: totalInItems,
          active: activeInItems,
          softDeleted: softDeletedCount,
          activeDetails: group.activeItems,
          softDeletedDetails: group.softDeletedItems
        },
        inventoryMaster: {
          exists: !!masterItem,
          total: totalInMaster,
          available: availableInMaster,
          userOwned: userOwnedInMaster
        },
        issues: {
          hasSoftDeleted,
          hasCountMismatch,
          hasProblem
        },
        recommendations: hasProblem ? [
          ...(hasSoftDeleted ? ['ลบรายการที่ถูก soft delete ออกจาก database'] : []),
          ...(hasCountMismatch ? ['อัพเดตจำนวนใน inventorymasters ให้ตรงกับจำนวนจริง'] : [])
        ] : []
      });
    }

    return NextResponse.json({
      analysisType: 'full',
      summary: {
        totalItemTypes: Object.keys(itemGroups).length,
        problemItemTypes: totalProblems,
        healthyItemTypes: Object.keys(itemGroups).length - totalProblems
      },
      queryScope: itemName && category ? 'specific' : (itemName ? 'by-item' : (category ? 'by-category' : 'all')),
      results: analysisResults.sort((a, b) => {
        // Sort problems first, then by item name
        if (a.issues.hasProblem && !b.issues.hasProblem) return -1;
        if (!a.issues.hasProblem && b.issues.hasProblem) return 1;
        return a.itemName.localeCompare(b.itemName);
      })
    });

  } catch (error) {
    console.error('❌ Error in inventory sync analysis:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการวิเคราะห์' },
      { status: 500 }
    );
  }
}
