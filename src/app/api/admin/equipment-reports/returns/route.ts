import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';

// GET - Fetch all equipment return logs with enriched item data
export async function GET() {
  try {
    await dbConnect();
    
    const returns = await ReturnLog.find({}).sort({ submittedAt: -1 });
    
    // Enrich return logs with current item names
    const enrichedReturns = await Promise.all(
      returns.map(async (returnLog) => {
        const enrichedItems = await Promise.all(
          returnLog.items.map(async (item) => {
            let currentItemName = item.itemName || 'Unknown Item';
            
            try {
              // First try to find by InventoryItem._id (new system)
              const inventoryItem = await InventoryItem.findById(item.itemId);
              if (inventoryItem) {
                currentItemName = inventoryItem.itemName;
              } else {
                // Fallback: try to find by InventoryMaster._id (legacy)
                const inventoryMaster = await InventoryMaster.findById(item.itemId);
                if (inventoryMaster) {
                  currentItemName = inventoryMaster.itemName;
                }
              }
            } catch (error) {
              console.warn(`Could not find inventory item for ID: ${item.itemId}`, error);
            }
            
            return {
              ...item.toObject(),
              itemName: currentItemName
            };
          })
        );
        
        return {
          ...returnLog.toObject(),
          items: enrichedItems
        };
      })
    );
    
    return NextResponse.json(enrichedReturns);
  } catch (error) {
    console.error('Error fetching return logs:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
