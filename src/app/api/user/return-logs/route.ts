import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import InventoryConfig from '@/models/InventoryConfig';
import InventoryItem from '@/models/InventoryItem';
import { verifyToken } from '@/lib/auth';

// GET - ดึงประวัติการคืนของผู้ใช้
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Verify user token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }
    
    const userId = payload.userId;
    
    // Get user's return logs
    const returnLogs = await ReturnLog.find({
      userId: userId
    }).sort({ returnDate: -1 });

    // Get configurations for display
    const config = await InventoryConfig.findOne({});
    const statusConfigs = config?.statusConfigs || [];
    const conditionConfigs = config?.conditionConfigs || [];
    const categoryConfigs = config?.categoryConfigs || [];
    
    // Populate item names and config names
    const populatedLogs = await Promise.all(
      returnLogs.map(async (log) => {
        const items = await Promise.all(
          log.items.map(async (item: any) => {
            // Get item details
            const inventoryItem = await InventoryItem.findById(item.itemId);
            const itemName = inventoryItem?.itemName || 'ไม่พบข้อมูล';
            const categoryId = inventoryItem?.categoryId;
            
            const categoryConfig = categoryConfigs.find((c: any) => c.id === categoryId);
            const statusConfig = statusConfigs.find((s: any) => s.id === item.statusOnReturn);
            const conditionConfig = conditionConfigs.find((c: any) => c.id === item.conditionOnReturn);
            
            return {
              ...item.toObject(),
              itemName,
              category: categoryConfig?.name || 'ไม่ระบุ',
              statusName: statusConfig?.name || 'ไม่ระบุ',
              conditionName: conditionConfig?.name || 'ไม่ระบุ'
            };
          })
        );
        
        return {
          _id: log._id,
          returnDate: log.returnDate,
          notes: log.notes,
          items,
          createdAt: log.createdAt,
          updatedAt: log.updatedAt
        };
      })
    );
    
    return NextResponse.json({
      returnLogs: populatedLogs
    });
    
  } catch (error) {
    console.error('Error fetching return logs:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการคืน' },
      { status: 500 }
    );
  }
}

