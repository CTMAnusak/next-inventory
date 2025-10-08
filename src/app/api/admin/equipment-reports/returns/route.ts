import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import InventoryMaster from '@/models/InventoryMaster';
import InventoryItem from '@/models/InventoryItem';
import User from '@/models/User';
import DeletedUsers from '@/models/DeletedUser';
import { getItemNameAndCategory, getStatusNameById, getConditionNameById } from '@/lib/item-name-resolver';

// GET - Fetch all equipment return logs with enriched item data
export async function GET() {
  try {
    await dbConnect();
    
    const returns = await ReturnLog.find({})
      .sort({ submittedAt: -1 });
    
    // Enrich return logs with current item names
    const enrichedReturns = await Promise.all(
      returns.map(async (returnLog) => {
        const enrichedItems = await Promise.all(
          returnLog.items.map(async (item) => {
            // ใช้ฟังก์ชันใหม่สำหรับดึงชื่ออุปกรณ์
            const itemInfo = await getItemNameAndCategory(item.masterItemId, item.itemId);
            
            // แปลง statusOnReturn และ conditionOnReturn เป็นชื่อ
            let statusId = item.statusOnReturn || 'status_available';
            // Backward-compat: เดิมใช้ 'approved' เก็บใน statusOnReturn
            if (statusId === 'approved') {
              statusId = 'status_available';
            }
            const conditionId = item.conditionOnReturn || '';
            
            const statusName = await getStatusNameById(statusId) || statusId;
            const conditionName = await getConditionNameById(conditionId) || conditionId;
            
            return {
              ...item.toObject(),
              statusOnReturn: statusName,
              conditionOnReturn: conditionName,
              itemName: itemInfo?.itemName || 'Unknown Item',
              category: itemInfo?.category || 'Unknown Category',
              // Backward-compat: ถ้ายังไม่มี approvalStatus แต่ statusOnReturn เก่าเป็น 'approved' ให้ถือว่าอนุมัติแล้ว
              approvalStatus: item.approvalStatus || (item.statusOnReturn === 'approved' ? 'approved' : 'pending')
            };
          })
        );
        
        // Resolve user by business user_id (fallback to snapshot)
        let resolvedUser: any = null;
        try {
          resolvedUser = await User.findOne({ user_id: (returnLog as any).userId })
            .select('firstName lastName nickname department office phone');
          if (!resolvedUser) {
            const snapshot = await DeletedUsers.findOne({ user_id: (returnLog as any).userId });
            if (snapshot) {
              resolvedUser = {
                firstName: snapshot.firstName,
                lastName: snapshot.lastName,
                nickname: snapshot.nickname,
                department: snapshot.department,
                office: snapshot.office,
                phone: snapshot.phone
              } as any;
            }
          }
        } catch (e) {
          console.error('Error resolving user for return log:', e);
        }

        const base = returnLog.toObject();
        return Object.assign(base, {
          // Priority: stored returner info (for branch users) > resolved user > fallback
          firstName: (returnLog as any).returnerFirstName || resolvedUser?.firstName || 'Unknown User',
          lastName: (returnLog as any).returnerLastName || resolvedUser?.lastName || '',
          nickname: (returnLog as any).returnerNickname || resolvedUser?.nickname || '',
          department: (returnLog as any).returnerDepartment || resolvedUser?.department || '',
          office: (returnLog as any).returnerOffice || resolvedUser?.office || '',
          phoneNumber: (returnLog as any).returnerPhone || resolvedUser?.phone || base.phoneNumber || '',
          items: enrichedItems
        });
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
