import InventoryItem from '@/models/InventoryItem';
import ReturnLog from '@/models/ReturnLog';
import dbConnect from '@/lib/mongodb';

interface UserDeletionResult {
  success: boolean;
  equipmentCount: number;
  returnLogId?: string;
  error?: string;
}

/**
 * สร้าง auto-return log สำหรับอุปกรณ์ทั้งหมดของผู้ใช้เมื่อถูกลบ
 */
export async function createAutoReturnForUser(
  userId: string, 
  adminUserId: string
): Promise<UserDeletionResult> {
  try {
    await dbConnect();

    // หาอุปกรณ์ทั้งหมดที่ผู้ใช้ครอบครอง
    const userEquipment = await InventoryItem.find({
      'currentOwnership.userId': userId,
      'currentOwnership.ownerType': 'user_owned',
      status: { $in: ['active', 'maintenance', 'damaged'] }
    });

    if (userEquipment.length === 0) {
      return {
        success: true,
        equipmentCount: 0
      };
    }

    // สร้าง ReturnLog อัตโนมัติ
    const returnItems = userEquipment.map((item: any) => ({
      itemId: item._id.toString(),
      inventoryItemId: item._id.toString(),
      quantity: 1,
      itemName: item.itemName,
      category: item.category || 'ไม่ระบุ',
      serialNumber: item.serialNumber || undefined,
      condition: 'good' as const
    }));

    // สร้าง return log
    const returnLog = new ReturnLog({
      firstName: 'System',
      lastName: 'Auto-Return',
      nickname: 'Auto',
      department: 'System',
      office: 'System',
      email: 'system@auto-return.local',
      phoneNumber: 'N/A',
      returnDate: new Date(),
      items: returnItems,
      status: 'pending',
      userId: userId,
      isAutoReturn: true,
      autoReturnReason: 'User account deletion',
      submittedAt: new Date(),
      notes: `Auto-return created due to user deletion. Admin: ${adminUserId}`
    });

    await returnLog.save();

    // อัปเดต ownership ของอุปกรณ์เป็น admin_stock
    const updatePromises = userEquipment.map(item => 
      InventoryItem.findByIdAndUpdate(item._id, {
        $set: {
          'currentOwnership.ownerType': 'admin_stock',
          'currentOwnership.ownedSince': new Date(),
          'currentOwnership.assignedBy': adminUserId,
          'sourceInfo.addedBy': 'admin',
          'transferInfo.transferredFrom': 'user_owned',
          'transferInfo.transferDate': new Date(),
          'transferInfo.approvedBy': adminUserId,
          'transferInfo.returnId': String(returnLog._id)
        },
        $unset: {
          'currentOwnership.userId': 1,
          'sourceInfo.addedByUserId': 1
        }
      })
    );

    await Promise.all(updatePromises);


    return {
      success: true,
      equipmentCount: userEquipment.length,
      returnLogId: String(returnLog._id)
    };

  } catch (error) {
    console.error('❌ Error creating auto-return for user:', error);
    return {
      success: false,
      equipmentCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * ตรวจสอบว่าผู้ใช้มีอุปกรณ์ที่ต้องคืนหรือไม่
 */
export async function checkUserEquipment(userId: string): Promise<number> {
  try {
    await dbConnect();
    
    const count = await InventoryItem.countDocuments({
      'currentOwnership.userId': userId,
      'currentOwnership.ownerType': 'user_owned',
      status: { $in: ['active', 'maintenance', 'damaged'] }
    });

    return count;
  } catch (error) {
    console.error('❌ Error checking user equipment:', error);
    return 0;
  }
}

/**
 * ลบผู้ใช้อย่างสมบูรณ์หลังจากอุปกรณ์ถูกคืนแล้ว
 */
export async function completeUserDeletion(userId: string): Promise<boolean> {
  try {
    await dbConnect();
    
    // ตรวจสอบว่าไม่มีอุปกรณ์เหลืออยู่
    const remainingEquipment = await checkUserEquipment(userId);
    
    if (remainingEquipment > 0) {
      console.warn(`⚠️ Cannot delete user ${userId}: still has ${remainingEquipment} equipment`);
      return false;
    }

    // ลบผู้ใช้จาก database
    const User = (await import('@/models/User')).default;
    await User.findByIdAndDelete(userId);

    return true;
    
  } catch (error) {
    console.error('❌ Error completing user deletion:', error);
    return false;
  }
}
