import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ReturnLog from '@/models/ReturnLog';
import { populateReturnLogCompleteBatch } from '@/lib/equipment-populate-helpers';

// GET - Fetch all equipment return logs with enriched item data
export async function GET() {
  try {
    await dbConnect();
    
    const returns = await ReturnLog.find({})
      .sort({ submittedAt: -1 });
    
    // 🔍 Debug: Log raw data before populate
    console.log('\n=== 🔍 RAW RETURN LOGS DATA (Before Populate) ===');
    returns.slice(0, 5).forEach((log: any, index: number) => {
      console.log(`\n--- Return Log ${index + 1} ---`);
      console.log('_id:', log._id?.toString());
      console.log('userId:', log.userId);
      console.log('returnerFirstName:', log.returnerFirstName);
      console.log('returnerLastName:', log.returnerLastName);
      console.log('returnerNickname:', log.returnerNickname);
      console.log('returnerDepartment:', log.returnerDepartment);
      console.log('returnerPhone:', log.returnerPhone);
      console.log('returnerOffice:', log.returnerOffice);
    });
    
    // ใช้ populate functions เพื่อ populate ข้อมูลล่าสุด
    // - Populate User info (ถ้า User ยังมีอยู่)
    // - Populate Item names, Categories, Status, Condition (ถ้ายังมีอยู่)
    // - ถ้าข้อมูลถูกลบ จะใช้ Snapshot ที่เก็บไว้
    const populatedReturns = await populateReturnLogCompleteBatch(returns);
    
    // 🔍 Debug: Log populated data
    console.log('\n=== 🔍 POPULATED RETURN LOGS DATA (After Populate) ===');
    populatedReturns.slice(0, 5).forEach((log: any, index: number) => {
      console.log(`\n--- Return Log ${index + 1} ---`);
      console.log('_id:', log._id?.toString());
      console.log('userId:', log.userId);
      console.log('firstName:', log.firstName);
      console.log('lastName:', log.lastName);
      console.log('nickname:', log.nickname);
      console.log('department:', log.department);
      console.log('phone:', log.phone);
      console.log('office:', log.office);
      console.log('returnerFirstName:', log.returnerFirstName);
      console.log('returnerLastName:', log.returnerLastName);
      console.log('deliveryLocation:', (log.deliveryLocation || 'NOT FOUND'));
      console.log('items count:', log.items?.length || 0);
      if (log.items && log.items.length > 0) {
        log.items.forEach((item: any, itemIdx: number) => {
          console.log(`  Item ${itemIdx + 1}: itemId=${item.itemId}`);
        });
      }
    });
    
    return NextResponse.json(populatedReturns);
  } catch (error) {
    console.error('Error fetching return logs:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
