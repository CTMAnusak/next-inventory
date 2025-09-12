import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';
import User from '@/models/User';
import { getItemNameAndCategory } from '@/lib/item-name-resolver';

// GET - Fetch all equipment return logs with enriched item data
export async function GET() {
  try {
    await dbConnect();
    
    const returns = await ReturnLog.find({})
      .populate('userId', 'firstName lastName nickname department office phone pendingDeletion')
      .sort({ submittedAt: -1 });
    
    // Enrich return logs with current item names
    const enrichedReturns = await Promise.all(
      returns.map(async (returnLog) => {
        const enrichedItems = await Promise.all(
          returnLog.items.map(async (item) => {
            // ใช้ฟังก์ชันใหม่สำหรับดึงชื่ออุปกรณ์
            const itemInfo = await getItemNameAndCategory(item.masterItemId, item.itemId);
            
            return {
              ...item.toObject(),
              itemName: itemInfo?.itemName || 'Unknown Item',
              category: itemInfo?.category || 'Unknown Category'
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
