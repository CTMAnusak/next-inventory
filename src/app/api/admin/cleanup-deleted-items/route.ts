import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import { cleanupSoftDeletedItems } from '@/lib/inventory-helpers-old';
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
    if (!currentUser || !['admin', 'it_admin', 'super_admin'].includes(currentUser.userRole)) {
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
          if (!item.itemName || !item.categoryId) {
            console.warn(`⚠️ Skipping invalid item:`, item);
            continue;
          }
          
          try {
            if (dryRun) {
              const InventoryItem = (await import('@/models/InventoryItem')).default;
              const softDeletedItems = await InventoryItem.find({
                itemName: item.itemName,
                category: item.categoryId,
                status: 'deleted'
              });
              
              results.push({
                itemName: item.itemName,
                category: item.categoryId,
                preview: true,
                softDeletedCount: softDeletedItems.length
              });
            } else {
              const result = await cleanupSoftDeletedItems(item.itemName, item.categoryId);
              results.push({ itemName: item.itemName, category: item.categoryId, ...result });
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
            const key = `${item.itemName}|${item.categoryId}`;
            if (!acc[key]) {
              acc[key] = {
                itemName: item.itemName,
                category: item.categoryId,
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
        // Advanced: Fix sync issues comprehensively - fallback to cleanup all for now
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
    if (!currentUser || !['admin', 'it_admin', 'super_admin'].includes(currentUser.userRole)) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get('itemName');
    const category = searchParams.get('category');
    const analysisType = searchParams.get('type') || 'full';

    const InventoryItem = (await import('@/models/InventoryItem')).default;
    const InventoryMaster = (await import('@/models/InventoryMaster')).default;
    
    let itemQuery: any = {};
    if (itemName) itemQuery.itemName = itemName;
    if (category) itemQuery.categoryId = category;

    if (analysisType === 'soft-deleted-only') {
      itemQuery.statusId = 'status_deleted';
      const softDeletedItems = await InventoryItem.find(itemQuery).select('itemName categoryId serialNumber numberPhone deletedAt deleteReason');
      const summary = softDeletedItems.reduce((acc: any, item) => {
        const key = `${item.itemName}|${item.categoryId}`;
        if (!acc[key]) { acc[key] = { itemName: item.itemName, category: item.categoryId, count: 0, items: [] }; }
        acc[key].count++;
        acc[key].items.push({ id: item._id, serialNumber: item.serialNumber, numberPhone: item.numberPhone, deletedAt: item.deletedAt, deleteReason: item.deleteReason });
        return acc;
      }, {});
      return NextResponse.json({ analysisType: 'soft-deleted-only', totalSoftDeleted: softDeletedItems.length, summary: Object.values(summary), queryScope: itemName && category ? 'specific' : 'all' });
    }

    const allItems = await InventoryItem.find(itemQuery);
    const itemGroups: any = {};
    for (const item of allItems) {
      const key = `${item.itemName}|${item.categoryId}`;
      if (!itemGroups[key]) { itemGroups[key] = { itemName: item.itemName, category: item.categoryId, allItems: [], activeItems: [], softDeletedItems: [] }; }
      itemGroups[key].allItems.push(item);
      if (item.statusId === 'status_deleted') {
        itemGroups[key].softDeletedItems.push({ id: item._id, serialNumber: item.serialNumber, numberPhone: item.numberPhone, deletedAt: item.deletedAt, deleteReason: item.deleteReason });
      } else {
        itemGroups[key].activeItems.push({ id: item._id, serialNumber: item.serialNumber, status: item.statusId, ownerType: item.currentOwnership?.ownerType });
      }
    }

    const analysisResults: any[] = [];
    let totalProblems = 0;
    for (const [key, group] of Object.entries(itemGroups)) {
      const masterItem = await InventoryMaster.findOne({ itemName: (group as any).itemName, categoryId: (group as any).category });
      const totalInItems = (group as any).allItems.length;
      const activeInItems = (group as any).activeItems.length;
      const softDeletedCount = (group as any).softDeletedItems.length;
      const totalInMaster = masterItem ? (masterItem as any).totalQuantity : 0;
      const availableInMaster = masterItem ? (masterItem as any).availableQuantity : 0;
      const userOwnedInMaster = masterItem ? (masterItem as any).userOwnedQuantity : 0;
      const hasSoftDeleted = softDeletedCount > 0;
      const hasCountMismatch = activeInItems !== totalInMaster;
      const hasProblem = hasSoftDeleted || hasCountMismatch;
      if (hasProblem) totalProblems++;
      analysisResults.push({
        itemName: (group as any).itemName,
        category: (group as any).category,
        inventoryItems: { total: totalInItems, active: activeInItems, softDeleted: softDeletedCount, activeDetails: (group as any).activeItems, softDeletedDetails: (group as any).softDeletedItems },
        inventoryMaster: { exists: !!masterItem, total: totalInMaster, available: availableInMaster, userOwned: userOwnedInMaster },
        issues: { hasSoftDeleted, hasCountMismatch, hasProblem },
        recommendations: hasProblem ? [ ...(hasSoftDeleted ? ['ลบรายการที่ถูก soft delete ออกจาก database'] : []), ...(hasCountMismatch ? ['อัพเดตจำนวนใน inventorymasters ให้ตรงกับจำนวนจริง'] : []) ] : []
      });
    }

    return NextResponse.json({ analysisType: 'full', summary: { totalItemTypes: Object.keys(itemGroups).length, problemItemTypes: totalProblems, healthyItemTypes: Object.keys(itemGroups).length - totalProblems }, queryScope: itemName && category ? 'specific' : (itemName ? 'by-item' : (category ? 'by-category' : 'all')), results: analysisResults.sort((a, b) => { if ((a as any).issues.hasProblem && !(b as any).issues.hasProblem) return -1; if (!(a as any).issues.hasProblem && (b as any).issues.hasProblem) return 1; return (a as any).itemName.localeCompare((b as any).itemName); }) });

  } catch (error) {
    console.error('❌ Error in inventory sync analysis:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการวิเคราะห์' },
      { status: 500 }
    );
  }
}
