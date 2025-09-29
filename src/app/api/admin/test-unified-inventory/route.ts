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
       item.quantity += 10;
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
      if (!existingItem.addedBy || !existingItem.addedBy.some(entry => entry.role === 'user' && entry.userId === dummyUserId)) {
        existingItem.addedBy = existingItem.addedBy || [];
        existingItem.addedBy.push({ 
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
    console.log(`   - Category: ${finalItem.category}`);
    console.log(`   - Available Quantity: ${finalItem.quantity}`);
    console.log(`   - Total Quantity: ${finalItem.totalQuantity}`);
    console.log(`   - Added By: ${JSON.stringify(finalItem.addedBy)}`);

    // Test successful if same ID is used and addedBy contains both roles
    const hasAdmin = finalItem.addedBy?.some(entry => entry.role === 'admin') || false;
    const hasUser = finalItem.addedBy?.some(entry => entry.role === 'user') || false;
    const success = hasAdmin && hasUser && finalItem.totalQuantity === 15 && finalItem.quantity === 10;

    return NextResponse.json({
      success,
      message: success ? 
        'ทดสอบสำเร็จ - อุปกรณ์ชื่อเดียวกันใช้ ID เดียวกัน และ addedBy เป็น array' :
        'ทดสอบไม่สำเร็จ',
      testResults: {
        itemId: finalItem._id,
        itemName: finalItem.itemName,
        category: finalItem.category,
        availableQuantity: finalItem.quantity,
        totalQuantity: finalItem.totalQuantity,
        addedBy: finalItem.addedBy || [],
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
