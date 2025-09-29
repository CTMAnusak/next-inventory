import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { updateAllItemDetails } from '@/lib/inventory-helpers';
import { verifyTokenFromRequest } from '@/lib/auth-utils';

/**
 * API Endpoint: Migration สำหรับอัปเดต itemDetails structure
 * GET /api/admin/migrate-item-details-extended
 */
export async function GET(request: NextRequest) {
  try {
    
    await dbConnect();

    // ตรวจสอบสิทธิ์ admin
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // ตรวจสอบว่าเป็น admin หรือไม่
    if (!['admin', 'it_admin'].includes(payload.userRole)) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึง' },
        { status: 403 }
      );
    }


    // ตรวจสอบสถานะปัจจุบัน
    const { default: InventoryMaster } = await import('@/models/InventoryMaster');
    const masterCount = await InventoryMaster.countDocuments();
    const mastersWithNewStructure = await InventoryMaster.countDocuments({
      'itemDetails.withSerialNumber.count': { $exists: true }
    });


    if (mastersWithNewStructure === masterCount) {
      return NextResponse.json({
        success: true,
        message: 'Migration already completed',
        data: {
          totalMasters: masterCount,
          alreadyMigrated: mastersWithNewStructure,
          needsMigration: 0
        }
      });
    }

    // รัน migration
    await updateAllItemDetails();

    // ตรวจสอบผลลัพธ์
    const finalCount = await InventoryMaster.countDocuments({
      'itemDetails.withSerialNumber.count': { $exists: true }
    });


    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      data: {
        totalMasters: masterCount,
        migrated: finalCount,
        needsMigration: masterCount - finalCount
      }
    });

  } catch (error) {
    console.error('❌ Migration API failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
