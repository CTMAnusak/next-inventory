# การปรับปรุงหน้า Equipment Tracking

## ภาพรวมการปรับปรุง

หน้า `admin/equipment-tracking` ได้รับการปรับปรุงให้แสดงชื่ออุปกรณ์ปัจจุบันและรองรับการติดตามอุปกรณ์ตาม User ID และ Item ID เพื่อให้เห็นข้อมูลว่า ผู้ใช้คนไหนครอบครองอุปกรณ์อะไรบ้าง

## การเปลี่ยนแปลงที่ทำ

### 1. ปรับปรุง Interface และ Model

#### EquipmentTracking Interface:
```typescript
interface EquipmentTracking {
  _id: string;
  requestId: string;
  firstName: string;
  lastName: string;
  nickname: string;
  department: string;
  office: string;
  phone: string;
  requestDate: string;
  deliveryLocation: string;
  urgency: string;
  reason: string;
  items: Array<{
    itemId: string;        // Primary reference to inventory
    itemName: string;      // Current name from inventory
    quantity: number;
    serialNumber?: string;
  }>;
  submittedAt: string;
}
```

### 2. เพิ่ม State สำหรับเก็บข้อมูล Inventory ปัจจุบัน

```typescript
// State for current inventory data
const [inventoryItems, setInventoryItems] = useState<{[key: string]: string}>({});

// New filter states
const [userIdFilter, setUserIdFilter] = useState('');
const [itemIdFilter, setItemIdFilter] = useState('');
```

### 3. เพิ่มฟังก์ชันสำหรับ Fetch ข้อมูล Inventory

```typescript
// Fetch current inventory data to get updated item names
const fetchInventoryData = async () => {
  try {
    const response = await fetch('/api/inventory');
    if (response.ok) {
      const data = await response.json();
      const items = data.items || [];
      
      // Create a map of itemId to current itemName
      const inventoryMap: {[key: string]: string} = {};
      items.forEach((item: any) => {
        inventoryMap[item._id] = item.itemName;
      });
      
      setInventoryItems(inventoryMap);
    }
  } catch (error) {
    console.error('Error fetching inventory data:', error);
  }
};
```

### 4. เพิ่มฟังก์ชันสำหรับ Get ชื่ออุปกรณ์ปัจจุบัน

```typescript
// Get current item name from inventory or fallback to stored name
const getCurrentItemName = (item: any) => {
  if (item.itemId && inventoryItems[item.itemId]) {
    return inventoryItems[item.itemId];
  }
  return item.itemName || 'Unknown Item';
};
```

### 5. ปรับปรุง Pagination

```typescript
// Pagination - แสดงไม่เกิน 15 รายการต่อหน้า
const itemsPerPage = 15;
```

### 6. เพิ่มฟิลเตอร์ใหม่

#### User ID Filter:
```typescript
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    User ID
  </label>
  <input
    type="text"
    value={userIdFilter}
    onChange={(e) => setUserIdFilter(e.target.value)}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
    placeholder="ระบุ User ID"
  />
</div>
```

#### Item ID Filter:
```typescript
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Item ID
  </label>
  <input
    type="text"
    value={itemIdFilter}
    onChange={(e) => setItemIdFilter(e.target.value)}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
    placeholder="ระบุ Item ID"
  />
</div>
```

### 7. ปรับปรุง API Endpoint

#### Equipment Tracking API:
```typescript
// GET - Fetch equipment request logs with filters
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const itemId = searchParams.get('itemId');
    const department = searchParams.get('department');
    const office = searchParams.get('office');
    
    // Build filter object
    const filter: any = {};
    
    if (userId) {
      filter.userId = userId;
    }
    
    if (department) {
      filter.department = department;
    }
    
    if (office) {
      filter.office = office;
    }
    
    // Fetch request logs with filters
    let requests = await RequestLog.find(filter).sort({ requestDate: -1 });
    
    // Filter by itemId if provided
    if (itemId) {
      requests = requests.filter(request => 
        request.items.some(item => item.itemId === itemId)
      );
    }
    
    // Transform data
    const trackingData = requests.map(request => ({
      ...request.toObject(),
      requestId: request._id.toString()
    }));
    
    return NextResponse.json(trackingData);
  } catch (error) {
    console.error('Error fetching equipment tracking data:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
      { status: 500 }
    );
  }
}
```

### 8. ปรับปรุงการแสดงผล

#### แสดง User ID:
```typescript
{record.userId && (
  <div className="flex items-center space-x-2 text-sm text-gray-600">
    <Hash className="w-4 h-4" />
    <span>User ID: {record.userId}</span>
  </div>
)}
```

#### แสดง Item ID:
```typescript
<div className="flex items-center space-x-2 text-sm text-gray-600">
  <Hash className="w-3 h-3" />
  <span>Item ID: {item.itemId}</span>
</div>
```

#### แสดงชื่ออุปกรณ์ปัจจุบัน:
```typescript
<div className="font-medium text-gray-900">{getCurrentItemName(item)}</div>
```

### 9. ปรับปรุงการค้นหาและฟิลเตอร์

```typescript
// Search filter with current item names
const matchesSearch = !searchTerm || 
  record.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
  record.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
  record.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
  record.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
  record.office.toLowerCase().includes(searchTerm.toLowerCase()) ||
  record.phone.includes(searchTerm) ||
  record.items.some(item => {
    const currentItemName = getCurrentItemName(item);
    return currentItemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.serialNumber && item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()));
  });

// User ID filter
const matchesUserId = !userIdFilter || record.userId === userIdFilter;

// Item ID filter
const matchesItemId = !itemIdFilter || 
  record.items.some(item => item.itemId === itemIdFilter);
```

### 10. ปรับปรุงการแสดงผลตามฟิลเตอร์

```typescript
<p className="text-gray-600 mt-1">
  {userIdFilter && itemIdFilter 
    ? `ติดตามอุปกรณ์ Item ID: ${itemIdFilter} ที่ User ID: ${userIdFilter} ครอบครอง`
    : userIdFilter 
      ? `ติดตามอุปกรณ์ที่ User ID: ${userIdFilter} ครอบครอง`
      : itemIdFilter 
        ? `ติดตามอุปกรณ์ Item ID: ${itemIdFilter} ที่ผู้ใช้ครอบครอง`
        : 'ค้นหาและติดตามว่าใครเบิกอุปกรณ์อะไรไป'
  }
</p>
```

## การทำงานของระบบใหม่

### 1. การโหลดข้อมูล:
1. `fetchTrackingData()` - โหลดข้อมูล request logs ตามฟิลเตอร์
2. `fetchInventoryData()` - โหลดข้อมูล inventory ปัจจุบัน
3. สร้าง map ของ `itemId` ไปยัง `itemName` ปัจจุบัน

### 2. การแสดงผล:
1. ใช้ `getCurrentItemName(item)` แทน `item.itemName`
2. แสดง User ID และ Item ID ในแต่ละรายการ
3. แสดงชื่ออุปกรณ์ปัจจุบันจาก inventory

### 3. การค้นหาและฟิลเตอร์:
1. รองรับการค้นหาด้วย User ID และ Item ID
2. ใช้ชื่ออุปกรณ์ปัจจุบันในการค้นหา
3. ฟิลเตอร์ตามแผนก, สาขา, วันที่, ความเร่งด่วน

### 4. Pagination:
1. แสดงไม่เกิน 15 รายการต่อหน้า
2. รองรับการนำทางระหว่างหน้า

## ข้อดีของการปรับปรุง

### ✅ ข้อดี:
1. **ชื่ออุปกรณ์ปัจจุบัน**: แสดงชื่ออุปกรณ์ล่าสุดที่อัปเดตในคลังสินค้า
2. **การติดตามตาม User ID**: สามารถติดตามอุปกรณ์ที่ผู้ใช้คนไหนครอบครอง
3. **การติดตามตาม Item ID**: สามารถติดตามอุปกรณ์ชิ้นไหนที่ผู้ใช้ครอบครอง
4. **การค้นหาที่แม่นยำ**: รองรับการค้นหาด้วย ID และชื่อใหม่ที่อัปเดต
5. **Pagination ที่เหมาะสม**: แสดงไม่เกิน 15 รายการต่อหน้า
6. **ข้อมูลครบถ้วน**: แสดง User ID และ Item ID ในแต่ละรายการ

### ⚠️ ข้อควรระวัง:
1. **การ Refresh**: ต้องกดปุ่ม "รีเฟรช" เพื่ออัปเดตชื่ออุปกรณ์
2. **Fallback**: ถ้าไม่พบ `itemId` ใน inventory จะแสดงชื่อเก่า
3. **Data Consistency**: ข้อมูลใน `requestlogs` ยังคงเป็นชื่อเก่า

## การทดสอบ

### 1. ทดสอบการเปลี่ยนชื่ออุปกรณ์:
1. ไปที่หน้า "จัดการคลังสินค้า"
2. เปลี่ยนชื่ออุปกรณ์ (เช่น จาก "Mouse" เป็น "Mouse555")
3. ไปที่หน้า "ติดตามอุปกรณ์"
4. กดปุ่ม "รีเฟรช"
5. ตรวจสอบว่าชื่ออุปกรณ์ในรายการเปลี่ยนเป็นชื่อใหม่

### 2. ทดสอบการติดตามตาม User ID:
1. ระบุ User ID ในฟิลเตอร์
2. กดปุ่ม "รีเฟรช"
3. ตรวจสอบว่าสามารถติดตามอุปกรณ์ที่ผู้ใช้คนนั้นครอบครองได้

### 3. ทดสอบการติดตามตาม Item ID:
1. ระบุ Item ID ในฟิลเตอร์
2. กดปุ่ม "รีเฟรช"
3. ตรวจสอบว่าสามารถติดตามอุปกรณ์ชิ้นนั้นที่ผู้ใช้ครอบครองได้

### 4. ทดสอบการค้นหา:
1. ใช้ชื่ออุปกรณ์ใหม่ในการค้นหา
2. ตรวจสอบว่าสามารถค้นหาข้อมูลได้

### 5. ทดสอบ Pagination:
1. ตรวจสอบว่าแสดงไม่เกิน 15 รายการต่อหน้า
2. ทดสอบการนำทางระหว่างหน้า

## สรุป

การปรับปรุงนี้ทำให้หน้า equipment-tracking สามารถ:

1. **แสดงชื่ออุปกรณ์ปัจจุบัน** แม้ว่าข้อมูลใน `requestlogs` จะเป็นชื่อเก่า
2. **ติดตามอุปกรณ์ตาม User ID** เพื่อดูว่าผู้ใช้คนไหนครอบครองอุปกรณ์อะไรบ้าง
3. **ติดตามอุปกรณ์ตาม Item ID** เพื่อดูว่าอุปกรณ์ชิ้นไหนที่ผู้ใช้ครอบครอง
4. **รองรับการค้นหาด้วยชื่อใหม่** ที่อัปเดตในคลังสินค้า
5. **แสดงข้อมูลครบถ้วน** รวมถึง User ID และ Item ID
6. **จัดการ Pagination** ที่เหมาะสม แสดงไม่เกิน 15 รายการต่อหน้า

ระบบจะทำงานโดยใช้ `itemId` เป็น primary reference และ populate ชื่ออุปกรณ์จาก inventory ปัจจุบัน ทำให้สามารถติดตามอุปกรณ์ได้อย่างแม่นยำและทันสมัย
