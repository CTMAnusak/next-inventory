import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Inventory from '@/models/Inventory';

export async function POST(request: NextRequest) {
  try {
    // Verify admin token
    const token = request.cookies.get('auth-token')?.value;
    const payload: any = token ? verifyToken(token) : null;
    
    if (!payload || payload.userRole !== 'admin') {
      return NextResponse.json(
        { error: 'ไม่ได้รับอนุญาต - ต้องเป็น admin เท่านั้น' },
        { status: 401 }
      );
    }

    await dbConnect();

    // Test scenario: Create the same item by both admin and user
    const testItemName = 'Test Mouse Unified';
    const testCategory = 'อุปกรณ์เสริม';

    console.log('🧪 Testing unified inventory system...');

    // Simulate admin adding item
    let item = await Inventory.findOne({
      itemName: testItemName,
      category: testCategory
    });

    if (!item) {
             item = new Inventory({
         itemName: testItemName,
         category: testCategory,
         quantity: 10,
         totalQuantity: 10,
         status: 'active',
         dateAdded: new Date(),
         // Warehouse stock
       });
      await item.save();
        } else {
      item.availableQuantity += 10;
      item.totalQuantity += 10;
       // Warehouse stock
       await item.save();
     }

    // Simulate user adding the same item
    const existingItem = await Inventory.findOne({
      itemName: testItemName,
      category: testCategory
    });

    if (existingItem) {
      existingItem.totalQuantity += 5; // User adds 5 more
      const dummyUserId = 'USER1234567890'; // Simulate different user
      const existingItemAny = existingItem as any;
      if (!existingItemAny.addedBy || !existingItemAny.addedBy.some((entry: any) => entry.role === 'user' && entry.userId === dummyUserId)) {
        existingItemAny.addedBy = existingItemAny.addedBy || [];
        existingItemAny.addedBy.push({ 
          role: 'user', 
          userId: dummyUserId,
          quantity: 5,
          dateAdded: new Date()
        });
      }
      await existingItem.save();
    }

    // Fetch final result
    const finalItem = await Inventory.findOne({
      itemName: testItemName,
      category: testCategory
    });

    if (!finalItem) {
      throw new Error('Test item not found after creation');
    }

    console.log(`   - ID: ${finalItem._id}`);
    console.log(`   - Name: ${finalItem.itemName}`);
    console.log(`   - Category: ${finalItem.categoryId}`);
    console.log(`   - Available Quantity: ${finalItem.availableQuantity}`);
    console.log(`   - Total Quantity: ${finalItem.totalQuantity}`);
    console.log(`   - Added By: ${JSON.stringify((finalItem as any).addedBy)}`);

    // Test successful if same ID is used and addedBy contains both roles
    const finalItemAny = finalItem as any;
    const hasAdmin = finalItemAny.addedBy?.some((entry: any) => entry.role === 'admin') || false;
    const hasUser = finalItemAny.addedBy?.some((entry: any) => entry.role === 'user') || false;
    const success = hasAdmin && hasUser && finalItem.totalQuantity === 15 && finalItem.availableQuantity === 10;

    return NextResponse.json({
      success,
      message: success ? 
        'ทดสอบสำเร็จ - อุปกรณ์ชื่อเดียวกันใช้ ID เดียวกัน และ addedBy เป็น array' :
        'ทดสอบไม่สำเร็จ',
      testResults: {
        itemId: finalItem._id,
        itemName: finalItem.itemName,
        category: finalItem.categoryId,
        availableQuantity: finalItem.availableQuantity,
        totalQuantity: finalItem.totalQuantity,
        addedBy: (finalItem as any).addedBy || [],
        hasBothAdminAndUser: hasAdmin && hasUser
      }
    });

  } catch (error) {
    console.error('❌ Test API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการทดสอบระบบ' },
      { status: 500 }
    );
  }
}
