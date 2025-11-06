import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Office from '@/models/Office';
import { checkOfficeUsage, snapshotOfficeBeforeDelete, updateOfficeNameInAllReferences } from '@/lib/office-snapshot-helpers';
import { clearOfficeCache, clearOfficeCacheById } from '@/lib/office-helpers';

/**
 * GET - ดึงรายการ Office ทั้งหมด
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check cache first
    const { getCachedData, setCachedData } = await import('@/lib/cache-utils');
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const cacheKey = `admin_offices_${includeInactive ? 'all' : 'active'}`;
    
    const cached = getCachedData(cacheKey);
    if (cached) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Offices API - Cache hit (${Date.now() - startTime}ms)`);
      }
      return NextResponse.json(cached);
    }

    await dbConnect();
    
    // 🆕 ตรวจสอบและสร้าง Default Office อัตโนมัติก่อน (แต่ cache ผลลัพธ์)
    // ใช้ flag เพื่อไม่ให้เรียกบ่อยเกินไป
    const { ensureDefaultOffice } = await import('@/lib/office-helpers');
    // เรียก ensureDefaultOffice แบบ async แต่ไม่รอ (fire and forget) เพื่อไม่ให้ช้า
    ensureDefaultOffice().catch(err => {
      console.error('Error ensuring default office (non-blocking):', err);
    });
    
    const query: any = {
      deletedAt: null
    };
    
    if (!includeInactive) {
      query.isActive = true;
    }
    
    const offices = await Office.find(query)
      .select('office_id name description isActive isSystemOffice createdAt updatedAt')
      .sort({ isSystemOffice: 1, name: 1 }) // System office อยู่ท้ายสุด
      .lean();
    
    // Cache the result
    setCachedData(cacheKey, offices);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Offices API - Fetched ${offices.length} offices (${Date.now() - startTime}ms)`);
    }
    
    return NextResponse.json(offices);
  } catch (error: any) {
    console.error('Error fetching offices:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสาขา' },
      { status: 500 }
    );
  }
}

/**
 * POST - สร้าง Office ใหม่
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // 🆕 ตรวจสอบและสร้าง Default Office อัตโนมัติก่อน
    const { ensureDefaultOffice } = await import('@/lib/office-helpers');
    await ensureDefaultOffice();
    
    const body = await request.json();
    const { name, description } = body;
    
    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อสาขา' },
        { status: 400 }
      );
    }
    
    // ตรวจสอบว่ามีชื่อซ้ำหรือไม่ (case-insensitive)
    const existingOffice = await Office.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }, // case-insensitive match
      deletedAt: null
    });
    
    if (existingOffice) {
      return NextResponse.json(
        { error: `มีชื่อสาขานี้อยู่แล้ว: "${existingOffice.name}" (${existingOffice.office_id})` },
        { status: 400 }
      );
    }
    
    // สร้าง office_id แบบสุ่ม (ภาษาอังกฤษ + ตัวเลข)
    const generateOfficeId = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const randomPart = Array.from({ length: 8 }, () => 
        chars.charAt(Math.floor(Math.random() * chars.length))
      ).join('');
      return `OFF${randomPart}`;
    };
    
    // สร้าง office_id ที่ไม่ซ้ำ
    let newOfficeId = generateOfficeId();
    let attempts = 0;
    while (await Office.findOne({ office_id: newOfficeId }) && attempts < 10) {
      newOfficeId = generateOfficeId();
      attempts++;
    }
    
    if (attempts >= 10) {
      return NextResponse.json(
        { error: 'ไม่สามารถสร้าง office_id ที่ไม่ซ้ำได้' },
        { status: 500 }
      );
    }
    
    // สร้าง Office ใหม่
    const newOffice = new Office({
      office_id: newOfficeId,
      name: name.trim(),
      description: description?.trim() || '',
      isActive: true
    });
    
    await newOffice.save();
    
    // Clear cache
    clearOfficeCache();
    const { clearAllCaches } = await import('@/lib/cache-utils');
    clearAllCaches(); // Clear all caches since office list changed
    
    return NextResponse.json({
      success: true,
      message: 'เพิ่มสาขาสำเร็จ',
      office: newOffice
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating office:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเพิ่มสาขา' },
      { status: 500 }
    );
  }
}

