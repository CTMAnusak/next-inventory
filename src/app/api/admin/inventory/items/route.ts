import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenFromRequest } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import InventoryItem from '@/models/InventoryItem';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    // ตรวจสอบ token แบบเดียวกับ API endpoints อื่นๆ
    const payload = verifyTokenFromRequest(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // ตรวจสอบว่าเป็น admin หรือไม่ (ไม่บังคับเพราะ API อื่นๆ ไม่ได้เช็ค)
    // if (payload.role !== 'admin') {
    //   return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    // }

    console.log('Token verified, fetching inventory items...');

    // รับ query parameters สำหรับการฟิลเตอร์
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('searchTerm') || '';
    const categoryFilter = searchParams.get('categoryFilter') || '';
    const statusFilter = searchParams.get('statusFilter') || '';
    const conditionFilter = searchParams.get('conditionFilter') || '';
    const dateFilter = searchParams.get('dateFilter') || '';

    // สร้าง query สำหรับการฟิลเตอร์
    const query: any = { 
      deletedAt: { $exists: false } 
    };

    // ฟิลเตอร์ตาม category
    if (categoryFilter) {
      query.categoryId = categoryFilter;
    }

    // ฟิลเตอร์ตาม status
    if (statusFilter) {
      query.statusId = statusFilter;
    }

    // ฟิลเตอร์ตาม condition
    if (conditionFilter) {
      query.conditionId = conditionFilter;
    }

    // ฟิลเตอร์ตามวันที่
    if (dateFilter && dateFilter.trim() !== '') {
      const filterDate = new Date(dateFilter);
      filterDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      query.$or = [
        {
          'sourceInfo.dateAdded': {
            $gte: filterDate,
            $lt: nextDay
          }
        },
        {
          createdAt: {
            $gte: filterDate,
            $lt: nextDay
          }
        }
      ];
    }

    // ดึงข้อมูลทั้งหมดจาก inventoryitems ตาม query
    let inventoryItems = await InventoryItem.find(query).lean();
    
    // ฟิลเตอร์ตาม searchTerm (ฝั่ง application เพราะต้องค้นหา categoryName ด้วย)
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      inventoryItems = inventoryItems.filter((item: any) => {
        const itemNameMatch = (item.itemName || '').toLowerCase().includes(term);
        // Note: categoryName filtering will be done in frontend as we need category configs
        return itemNameMatch;
      });
    }
    
    console.log(`Found ${inventoryItems.length} inventory items`);

    // แปลงข้อมูลให้อยู่ในรูปแบบที่ frontend ต้องการ
    const formattedItems = inventoryItems.map((item: any) => {
      // แปลง serialNumber (string) เป็น serialNumbers (array)
      let serialNumbers: string[] = [];
      if (item.serialNumber && item.serialNumber.trim() !== '') {
        serialNumbers = [item.serialNumber];
      }

      return {
        _id: item._id.toString(),
        itemName: item.itemName,
        categoryId: item.categoryId,
        serialNumbers: serialNumbers,
        numberPhone: item.numberPhone || '',
        quantity: 1, // แต่ละ item ใน InventoryItem = 1 ชิ้น
        statusId: item.statusId,
        status: item.statusId, // backward compatibility
        conditionId: item.conditionId,
        condition: item.conditionId, // backward compatibility
        dateAdded: item.sourceInfo?.dateAdded || item.createdAt,
        currentOwnership: item.currentOwnership,
        sourceInfo: item.sourceInfo,
      };
    });

    console.log(`Returning ${formattedItems.length} formatted items`);
    return NextResponse.json(formattedItems, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching inventory items:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

