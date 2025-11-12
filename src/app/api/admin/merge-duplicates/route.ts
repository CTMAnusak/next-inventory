import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Inventory from '@/models/Inventory';
import { verifyToken } from '@/lib/auth';

// POST - Merge duplicate inventory items by itemName
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Verify admin access
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload || (payload.userRole !== 'admin' && payload.userRole !== 'it_admin' && payload.userRole !== 'super_admin')) {
      return NextResponse.json(
        { error: 'ไม่ได้รับอนุญาต' },
        { status: 401 }
      );
    }


    // Find all items grouped by itemName
    const duplicateGroups = await Inventory.aggregate([
      {
        $group: {
          _id: "$itemName",
          count: { $sum: 1 },
          items: { $push: "$$ROOT" }
        }
      },
      {
        $match: {
          count: { $gt: 1 } // Only groups with more than 1 item
        }
      }
    ]);


    const mergeResults = [];

    for (const group of duplicateGroups) {
      const itemName = group._id;
      const items = group.items;
      
      
      // Sort items by priority: warehouse stock first (quantity > 0), then personal items
      // Also by dateAdded: oldest first (to keep the original one)
      items.sort((a: any, b: any) => {
        const aIsWarehouse = (a.quantity || 0) > 0; // Has available quantity (warehouse stock)
        const bIsWarehouse = (b.quantity || 0) > 0; // Has available quantity (warehouse stock)
        
        if (aIsWarehouse !== bIsWarehouse) {
          return aIsWarehouse ? -1 : 1; // warehouse items first
        }
        return new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime(); // oldest first
      });

      // The first item will be the "master" record
      const masterItem = items[0];
      const itemsToMerge = items.slice(1);


      // Calculate combined totals
      let totalQuantitySum = masterItem.totalQuantity || 0;
      let quantitySum = masterItem.quantity || 0;

      // Collect all serial numbers (non-empty ones)
      const serialNumbers = [];
      if (masterItem.serialNumber) {
        serialNumbers.push(masterItem.serialNumber);
      }

      for (const item of itemsToMerge) {
        totalQuantitySum += (item.totalQuantity || 0);
        quantitySum += (item.quantity || 0);
        
        if (item.serialNumber) {
          serialNumbers.push(item.serialNumber);
        }
      }

      // Update the master item with combined values
      const updateData: any = {
        quantity: quantitySum,
        totalQuantity: totalQuantitySum,
        dateAdded: new Date() // Update to current time
      };

      // Handle serial numbers - if multiple, keep the first one
      if (serialNumbers.length > 0) {
        updateData.serialNumber = serialNumbers[0];
        if (serialNumbers.length > 1) {
        }
      }

      console.log(`  ➕ New totals: quantity=${quantitySum}, totalQuantity=${totalQuantitySum}`);

      // Update master item
      await Inventory.findByIdAndUpdate(masterItem._id, updateData);

      // Delete the duplicate items
      const idsToDelete = itemsToMerge.map((item: any) => item._id);
      await Inventory.deleteMany({ _id: { $in: idsToDelete } });


      mergeResults.push({
        itemName,
        masterItemId: masterItem._id,
        mergedCount: itemsToMerge.length,
        newQuantity: quantitySum,
        newTotalQuantity: totalQuantitySum,
        serialNumbersFound: serialNumbers.length
      });
    }


    return NextResponse.json({
      success: true,
      message: `รวมรายการซ้ำเรียบร้อยแล้ว`,
      results: mergeResults,
      summary: {
        groupsProcessed: duplicateGroups.length,
        totalItemsMerged: mergeResults.reduce((sum, r) => sum + r.mergedCount, 0)
      }
    });

  } catch (error) {
    console.error('Merge duplicates error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการรวมรายการ' },
      { status: 500 }
    );
  }
}
