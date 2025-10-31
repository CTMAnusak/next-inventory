import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InventorySnapshot from '@/models/InventorySnapshot';
import { createSnapshotForMonth } from '@/lib/snapshot-helpers';
import { verifyTokenFromRequest } from '@/lib/auth';

/**
 * POST /api/admin/inventory-snapshot/create
 * สร้าง snapshot สำหรับเดือน/ปีที่ระบุ
 * Query params:
 *   - year: ปี (เช่น 2568)
 *   - month: เดือน (1-12)
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Verify admin authentication
    const payload = verifyTokenFromRequest(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบเป็น Admin' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');

    // ถ้าไม่ระบุปี/เดือน ให้ใช้เดือนปัจจุบัน
    const now = new Date();
    const thaiYear = yearParam ? parseInt(yearParam) : now.getFullYear() + 543;
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'เดือนต้องอยู่ระหว่าง 1-12' },
        { status: 400 }
      );
    }

    // คำนวณวันแรกและวันสุดท้ายของเดือน
    const startDate = new Date(thaiYear - 543, month - 1, 1, 0, 0, 0);
    const endDate = new Date(thaiYear - 543, month, 0, 23, 59, 59);
    const snapshotDate = endDate;

    // ตรวจสอบว่ามี snapshot อยู่แล้วหรือไม่ (ทั้งปีและเดือนต้องตรงกัน)
    const existingSnapshot = await InventorySnapshot.findOne({ year: thaiYear, month });
    const isUpdate = !!existingSnapshot;

    // ใช้ helper function เพื่อสร้าง snapshot
    const result = await createSnapshotForMonth(thaiYear, month);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'เกิดข้อผิดพลาดในการสร้าง snapshot' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: isUpdate 
        ? `อัพเดต snapshot สำหรับเดือน ${month}/${thaiYear} สำเร็จ (ทับข้อมูลเดิม)`
        : `สร้าง snapshot สำหรับเดือน ${month}/${thaiYear} สำเร็จ`,
      isUpdate,
      snapshot: result.snapshot
    });
  } catch (error: any) {
    console.error('Error creating inventory snapshot:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้าง snapshot', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/inventory-snapshot/create
 * ดึง snapshot สำหรับเดือน/ปีที่ระบุ
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Verify admin authentication
    const payload = verifyTokenFromRequest(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบเป็น Admin' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');

    if (!yearParam || !monthParam) {
      return NextResponse.json(
        { error: 'กรุณาระบุ year และ month' },
        { status: 400 }
      );
    }

    const thaiYear = parseInt(yearParam);
    const month = parseInt(monthParam);

    const snapshot = await InventorySnapshot.findOne({
      year: thaiYear,
      month
    }).lean();

    if (!snapshot) {
      return NextResponse.json(
        { error: `ไม่พบ snapshot สำหรับเดือน ${month}/${thaiYear}` },
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
        itemDetails: snapshot.itemDetails || []
      }
    });
  } catch (error: any) {
    console.error('Error fetching inventory snapshot:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึง snapshot', details: error.message },
      { status: 500 }
    );
  }
}

