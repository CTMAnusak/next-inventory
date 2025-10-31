import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventorySnapshot from '@/models/InventorySnapshot';
import { createSnapshotForMonth } from '@/lib/snapshot-helpers';

/**
 * POST /api/admin/inventory-snapshot/auto-create
 * Auto-create snapshot สำหรับเดือนก่อนหน้า (รันทุกสิ้นเดือน)
 * 
 * ใช้เรียกจาก cron job หรือ scheduled task
 * 
 * Query params:
 *   - month: เดือนที่ต้องการสร้าง (optional, default = เดือนก่อนหน้า)
 *   - year: ปีที่ต้องการสร้าง (optional, default = ปีปัจจุบัน)
 *   - secret: secret key สำหรับ authentication (required)
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    // รองรับทั้ง query param และ environment variable สำหรับ Vercel Cron
    const secret = searchParams.get('secret') || process.env.VERCEL_SNAPSHOT_SECRET_KEY;
    
    // ตรวจสอบ secret key
    const expectedSecret = process.env.SNAPSHOT_SECRET_KEY || process.env.VERCEL_SNAPSHOT_SECRET_KEY || 'default-secret-key-change-in-production';
    if (!secret || secret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid secret key' },
        { status: 401 }
      );
    }

    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');

    // ถ้าไม่ระบุ ให้ใช้เดือนก่อนหน้า
    const now = new Date();
    let targetMonth: number;
    let targetYear: number;

    if (monthParam && yearParam) {
      targetMonth = parseInt(monthParam);
      targetYear = parseInt(yearParam);
    } else {
      // เดือนก่อนหน้า
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      targetMonth = lastMonth.getMonth() + 1;
      targetYear = lastMonth.getFullYear() + 543; // แปลงเป็นปี พ.ศ.
    }

    if (targetMonth < 1 || targetMonth > 12) {
      return NextResponse.json(
        { error: 'เดือนต้องอยู่ระหว่าง 1-12' },
        { status: 400 }
      );
    }

    // ตรวจสอบว่ามี snapshot อยู่แล้วหรือไม่
    const existingSnapshot = await InventorySnapshot.findOne({ 
      year: targetYear, 
      month: targetMonth 
    });

    // สร้าง snapshot
    const result = await createSnapshotForMonth(targetYear, targetMonth);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: existingSnapshot 
          ? `อัพเดต snapshot สำหรับเดือน ${targetMonth}/${targetYear} สำเร็จ (ทับข้อมูลเดิม)`
          : `สร้าง snapshot สำหรับเดือน ${targetMonth}/${targetYear} สำเร็จ`,
        isUpdate: !!existingSnapshot,
        snapshot: result.snapshot
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'เกิดข้อผิดพลาดในการสร้าง snapshot' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in auto-create snapshot:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้าง snapshot', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/inventory-snapshot/auto-create
 * ตรวจสอบสถานะของ snapshot หรือทดสอบการสร้าง snapshot
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    // รองรับทั้ง query param และ environment variable สำหรับ Vercel Cron
    const secret = searchParams.get('secret') || process.env.VERCEL_SNAPSHOT_SECRET_KEY;
    
    // ตรวจสอบ secret key
    const expectedSecret = process.env.SNAPSHOT_SECRET_KEY || process.env.VERCEL_SNAPSHOT_SECRET_KEY || 'default-secret-key-change-in-production';
    if (!secret || secret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid secret key' },
        { status: 401 }
      );
    }

    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');

    if (!monthParam || !yearParam) {
      // แสดงสถานะ snapshot ของเดือนล่าสุด
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const targetMonth = lastMonth.getMonth() + 1;
      const targetYear = lastMonth.getFullYear() + 543;

      const snapshot = await InventorySnapshot.findOne({
        year: targetYear,
        month: targetMonth
      }).lean();

      return NextResponse.json({
        success: true,
        message: `สถานะ snapshot สำหรับเดือน ${targetMonth}/${targetYear}`,
        exists: !!snapshot,
        snapshot: snapshot ? {
          year: snapshot.year,
          month: snapshot.month,
          snapshotDate: snapshot.snapshotDate,
          totalInventoryItems: snapshot.totalInventoryItems,
          totalInventoryCount: snapshot.totalInventoryCount,
          lowStockItems: snapshot.lowStockItems,
          updatedAt: snapshot.updatedAt
        } : null
      });
    }

    const targetMonth = parseInt(monthParam);
    const targetYear = parseInt(yearParam);

    const snapshot = await InventorySnapshot.findOne({
      year: targetYear,
      month: targetMonth
    }).lean();

    if (!snapshot) {
      return NextResponse.json(
        { error: `ไม่พบ snapshot สำหรับเดือน ${targetMonth}/${targetYear}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      snapshot: {
        year: snapshot.year,
        month: snapshot.month,
        snapshotDate: snapshot.snapshotDate,
        totalInventoryItems: snapshot.totalInventoryItems,
        totalInventoryCount: snapshot.totalInventoryCount,
        lowStockItems: snapshot.lowStockItems,
        updatedAt: snapshot.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Error fetching snapshot status:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล snapshot', details: error.message },
      { status: 500 }
    );
  }
}

