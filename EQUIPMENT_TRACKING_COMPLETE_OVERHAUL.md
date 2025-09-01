# การปรับปรุงระบบ Equipment Tracking แบบครบถ้วน

## ภาพรวมการปรับปรุง

หน้า `admin/equipment-tracking` ได้รับการปรับปรุงครั้งใหญ่เพื่อแสดงข้อมูลอุปกรณ์ครบถ้วนจากทุกแหล่ง รวมถึง:

1. **อุปกรณ์ที่เบิกมา** จากการเบิกอุปกรณ์ (`RequestLog`)
2. **อุปกรณ์ที่เพิ่มเอง** ในหน้า Dashboard (`UserOwnedItem`)
3. **ไม่แสดงอุปกรณ์ที่คืนแล้ว** (ตรวจสอบจาก `ReturnLog`)
4. **แสดงในรูปแบบตาราง** 1 แถว ต่อ 1 รายการอุปกรณ์
5. **เรียงลำดับตามหมวดหมู่** แล้วตามชื่ออุปกรณ์

## การเปลี่ยนแปลงหลัก

### 1. ปรับปรุง API Endpoint (`/api/admin/equipment-tracking/route.ts`)

#### เพิ่ม Import Models:
```typescript
import RequestLog from '@/models/RequestLog';
import ReturnLog from '@/models/ReturnLog';
import UserOwnedItem from '@/models/UserOwnedItem';
import Inventory from '@/models/Inventory';
```

#### ระบบการ Fetch ข้อมูลจากหลายแหล่ง:

##### 1. ดึงข้อมูลจาก RequestLog:
```typescript
// Fetch request logs with filters
let requests = await RequestLog.find(requestFilter).sort({ requestDate: -1 });

// Filter by itemId if provided
if (itemId) {
  requests = requests.filter(request => 
    request.items.some(item => item.itemId === itemId)
  );
}
```

##### 2. ตรวจสอบอุปกรณ์ที่คืนแล้ว:
```typescript
// Fetch all return logs to exclude returned items
const returnLogs = await ReturnLog.find({});

// Create a map of returned items (userId + itemId + serialNumber)
const returnedItems = new Set();
returnLogs.forEach(returnLog => {
  returnLog.items.forEach(item => {
    const key = `${returnLog.userId}-${item.itemId}-${item.serialNumber || ''}`;
    returnedItems.add(key);
  });
});
```

##### 3. แปลงข้อมูล RequestLog และกรองอุปกรณ์ที่คืนแล้ว:
```typescript
// Transform request logs data and filter out returned items
const trackingDataFromRequests: any[] = [];
requests.forEach(request => {
  request.items.forEach(item => {
    const key = `${request.userId}-${item.itemId}-${item.serialNumber || ''}`;
    if (!returnedItems.has(key)) {
      trackingDataFromRequests.push({
        _id: `${request._id}-${item.itemId}`,
        requestId: request._id.toString(),
        firstName: request.firstName,
        lastName: request.lastName,
        nickname: request.nickname,
        department: request.department,
        office: request.office,
        phone: request.phone,
        requestDate: request.requestDate,
        userId: request.userId,
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
        serialNumber: item.serialNumber,
        submittedAt: request.submittedAt || request.createdAt,
        source: 'request'
      });
    }
  });
});
```

##### 4. ดึงข้อมูลจาก UserOwnedItem:
```typescript
// Fetch user-owned items (อุปกรณ์ที่เพิ่มเองใน dashboard)
let userOwnedItems = await UserOwnedItem.find({}).populate('userId', 'firstName lastName nickname department office phone');

// Apply filters to user-owned items
if (userId) {
  userOwnedItems = userOwnedItems.filter(item => item.userId._id.toString() === userId);
}

if (itemId) {
  userOwnedItems = userOwnedItems.filter(item => item.itemId === itemId);
}

if (department) {
  userOwnedItems = userOwnedItems.filter(item => item.userId.department === department);
}

if (office) {
  userOwnedItems = userOwnedItems.filter(item => item.userId.office === office);
}
```

##### 5. แปลงข้อมูล UserOwnedItem:
```typescript
// Transform user-owned items data to match tracking format
const trackingDataFromUserOwned = userOwnedItems.map(item => ({
  _id: `user-owned-${item._id}`,
  requestId: item._id.toString(),
  firstName: item.userId.firstName,
  lastName: item.userId.lastName,
  nickname: item.userId.nickname,
  department: item.userId.department,
  office: item.userId.office,
  phone: item.userId.phone,
  requestDate: item.createdAt || new Date(),
  deliveryLocation: 'ไม่ระบุ',
  urgency: 'normal',
  reason: 'อุปกรณ์ที่มีอยู่เดิม',
  userId: item.userId._id.toString(),
  itemId: item.itemId,
  itemName: item.itemName,
  quantity: item.quantity,
  serialNumber: item.serialNumber,
  submittedAt: item.createdAt || new Date(),
  source: 'user-owned'
}));
```

##### 6. รวมข้อมูลและเพิ่มหมวดหมู่:
```typescript
// Combine both data sources
const combinedData = [...trackingDataFromRequests, ...trackingDataFromUserOwned];

// Get inventory data for categories
const inventoryItems = await Inventory.find({});
const inventoryMap: {[key: string]: any} = {};
inventoryItems.forEach(item => {
  inventoryMap[item._id.toString()] = {
    itemName: item.itemName,
    category: item.category || 'ไม่ระบุ'
  };
});

// Add category information to tracking data
const trackingDataWithCategories = combinedData.map(item => ({
  ...item,
  category: inventoryMap[item.itemId]?.category || 'ไม่ระบุ',
  currentItemName: inventoryMap[item.itemId]?.itemName || item.itemName
}));

// Sort by category first, then by item name
trackingDataWithCategories.sort((a, b) => {
  if (a.category !== b.category) {
    return a.category.localeCompare(b.category, 'th');
  }
  return a.currentItemName.localeCompare(b.currentItemName, 'th');
});
```

### 2. ปรับปรุง Frontend (`/admin/equipment-tracking/page.tsx`)

#### เปลี่ยน Interface:
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
  userId?: string;
  itemId: string;              // แต่ละรายการมี 1 อุปกรณ์
  itemName: string;
  currentItemName: string;     // ชื่อปัจจุบันจาก inventory
  quantity: number;
  serialNumber?: string;
  category: string;            // หมวดหมู่อุปกรณ์
  submittedAt: string;
  source: 'request' | 'user-owned';  // แหล่งที่มาของข้อมูล
}
```

#### ปรับปรุงการค้นหาและฟิลเตอร์:
```typescript
const applyFilters = () => {
  let filtered = trackingData.filter(record => {
    // Search filter - ค้นหาข้อมูลทั่วไป
    const matchesSearch = !searchTerm || 
      record.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.office.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.phone.includes(searchTerm) ||
      record.currentItemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.serialNumber && record.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    // User filter
    const matchesUser = !userFilter || 
      `${record.firstName} ${record.lastName}`.toLowerCase().includes(userFilter.toLowerCase()) ||
      record.nickname.toLowerCase().includes(userFilter.toLowerCase());

    // Item filter - ใช้ชื่อปัจจุบัน
    const matchesItem = !itemFilter || 
      record.currentItemName.toLowerCase().includes(itemFilter.toLowerCase());

    // Department filter
    const matchesDepartment = !departmentFilter || record.department.includes(departmentFilter);

    // Office filter
    const matchesOffice = !officeFilter || record.office.includes(officeFilter);

    // Date filter
    const recordDate = new Date(record.requestDate);
    const matchesDateFrom = !dateFromFilter || recordDate >= new Date(dateFromFilter);
    const matchesDateTo = !dateToFilter || recordDate <= new Date(dateToFilter);

    // Urgency filter
    const matchesUrgency = !urgencyFilter || record.urgency === urgencyFilter;
    
    // User ID filter
    const matchesUserId = !userIdFilter || record.userId === userIdFilter;
    
    // Item ID filter
    const matchesItemId = !itemIdFilter || record.itemId === itemIdFilter;

    return matchesSearch && matchesUser && matchesItem && matchesDepartment && 
           matchesOffice && matchesDateFrom && matchesDateTo && matchesUrgency &&
           matchesUserId && matchesItemId;
  });

  setFilteredData(filtered);
  setCurrentPage(1);
};
```

#### ปรับปรุงการแสดงผลเป็นตาราง:
```typescript
<table className="min-w-full divide-y divide-gray-200">
  <thead className="bg-gray-50">
    <tr>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        ชื่อ-นามสกุล (ชื่อเล่น)
      </th>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        เบอร์โทร
      </th>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        แผนก
      </th>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        ออฟฟิศ/สาขา
      </th>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        หมวดหมู่
      </th>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        อุปกรณ์ที่มี
      </th>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        จำนวน
      </th>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        Serial Number
      </th>
    </tr>
  </thead>
  <tbody className="bg-white divide-y divide-gray-200">
    {currentItems.map((record, index) => (
      <tr key={`${record._id}-${index}`} className="hover:bg-gray-50">
        {/* แสดงข้อมูลผู้ใช้ */}
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <User className="w-4 h-4 text-blue-500 mr-2" />
            <div>
              <div className="text-sm font-medium text-gray-900">
                {record.firstName} {record.lastName}
              </div>
              <div className="text-sm text-gray-500">
                ({record.nickname})
              </div>
              {record.userId && (
                <div className="text-xs text-gray-400">
                  ID: {record.userId}
                </div>
              )}
            </div>
          </div>
        </td>
        
        {/* แสดงข้อมูลติดต่อ */}
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {record.phone || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {record.department || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {record.office || '-'}
        </td>
        
        {/* แสดงหมวดหมู่อุปกรณ์ */}
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            record.category === 'ไม่ระบุ' 
              ? 'bg-gray-100 text-gray-800' 
              : record.category === 'คอมพิวเตอร์และแล็ปท็อป'
              ? 'bg-red-100 text-red-800'
              : record.category === 'อุปกรณ์เสริม'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-blue-100 text-blue-800'
          }`}>
            {record.category}
          </span>
        </td>
        
        {/* แสดงข้อมูลอุปกรณ์ */}
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <Package className="w-4 h-4 text-green-500 mr-2" />
            <div>
              <div className="text-sm font-medium text-gray-900">
                {record.currentItemName}
              </div>
              <div className="text-xs text-gray-500">
                ID: {record.itemId}
              </div>
              <div className={`text-xs font-medium ${
                record.source === 'user-owned' 
                  ? 'text-orange-600 bg-orange-100 px-1 rounded' 
                  : 'text-blue-600 bg-blue-100 px-1 rounded'
              }`}>
                {record.source === 'user-owned' ? 'อุปกรณ์ที่มีอยู่เดิม' : 'อุปกรณ์ที่เบิก'}
              </div>
            </div>
          </div>
        </td>
        
        {/* แสดงจำนวน */}
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            record.quantity > 1 
              ? 'bg-green-100 text-green-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {record.quantity} ชิ้น
          </span>
        </td>
        
        {/* แสดง Serial Number */}
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {record.serialNumber ? (
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
              {record.serialNumber}
            </span>
          ) : (
            '-'
          )}
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

## คุณสมบัติใหม่

### 1. แสดงอุปกรณ์ครบถ้วน:
- ✅ **อุปกรณ์ที่เบิกมา** จาก RequestLog
- ✅ **อุปกรณ์ที่เพิ่มเอง** จาก UserOwnedItem  
- ✅ **ไม่แสดงอุปกรณ์ที่คืนแล้ว** (ตรวจสอบจาก ReturnLog)

### 2. การจัดรูปแบบข้อมูล:
- ✅ **1 แถว ต่อ 1 รายการอุปกรณ์** แทนการแสดงแบบกลุ่ม
- ✅ **เรียงลำดับตามหมวดหมู่** แล้วตามชื่ออุปกรณ์
- ✅ **แสดงที่มาของข้อมูล** (เบิก/มีอยู่เดิม)

### 3. การแสดงผลแบบตาราง:
- ✅ **ชื่อ-นามสกุล (ชื่อเล่น)** พร้อม User ID
- ✅ **เบอร์โทร**
- ✅ **แผนก**
- ✅ **ออฟฟิศ/สาขา**
- ✅ **หมวดหมู่** พร้อมสีแยกประเภท
- ✅ **อุปกรณ์ที่มี** พร้อม Item ID และแหล่งที่มา
- ✅ **จำนวน** พร้อมสีแยกจำนวน
- ✅ **Serial Number** พร้อมไฮไลท์

### 4. ระบบฟิลเตอร์:
- ✅ **การค้นหาทั่วไป** ในทุกฟิลด์
- ✅ **ฟิลเตอร์ตามผู้ใช้**
- ✅ **ฟิลเตอร์ตามอุปกรณ์**
- ✅ **ฟิลเตอร์ตามแผนก/สาขา**
- ✅ **ฟิลเตอร์ตามวันที่**
- ✅ **ฟิลเตอร์ตาม User ID**
- ✅ **ฟิลเตอร์ตาม Item ID**

### 5. การแสดงสถิติ:
- ✅ **จำนวนรายการอุปกรณ์ทั้งหมด**
- ✅ **สีแยกประเภทอุปกรณ์**
- ✅ **คำอธิบายสัญลักษณ์**

### 6. Pagination:
- ✅ **แสดงไม่เกิน 15 รายการต่อหน้า**
- ✅ **นำทางระหว่างหน้า**
- ✅ **แสดงสถิติการแบ่งหน้า**

## ระบบการทำงาน

### 1. การโหลดข้อมูล:
```
1. Fetch RequestLog → ดึงอุปกรณ์ที่เบิก
2. Fetch ReturnLog → ตรวจสอบอุปกรณ์ที่คืนแล้ว
3. Filter RequestLog → กรองอุปกรณ์ที่คืนแล้วออก
4. Fetch UserOwnedItem → ดึงอุปกรณ์ที่เพิ่มเอง
5. Fetch Inventory → ดึงข้อมูลหมวดหมู่และชื่อปัจจุบัน
6. Combine & Sort → รวมข้อมูลและเรียงลำดับ
```

### 2. การแสดงผล:
```
1. Transform to Table Format → แปลงเป็นรูปแบบตาราง (1 แถว = 1 อุปกรณ์)
2. Apply Filters → ใช้ฟิลเตอร์ตามเงื่อนไข
3. Pagination → แบ่งหน้า 15 รายการต่อหน้า
4. Render Table → แสดงตารางพร้อมสี
```

### 3. การจัดเรียงข้อมูล:
```
1. Primary Sort: หมวดหมู่ (category)
2. Secondary Sort: ชื่ออุปกรณ์ปัจจุบัน (currentItemName)
3. Alphabetical: ใช้ภาษาไทย (localeCompare)
```

## ข้อดีของระบบใหม่

### ✅ ครบถ้วน:
1. **แสดงอุปกรณ์ทุกประเภท**: ที่เบิกและที่มีอยู่เดิม
2. **ไม่แสดงอุปกรณ์ที่คืนแล้ว**: ข้อมูลแม่นยำ
3. **อัปเดตชื่ออุปกรณ์**: ใช้ชื่อปัจจุบันจาก inventory

### ✅ ใช้งานง่าย:
1. **รูปแบบตาราง**: เห็นข้อมูลชัดเจน
2. **สีแยกประเภท**: แยกแยะประเภทอุปกรณ์
3. **การค้นหาครอบคลุม**: ค้นหาได้หลายฟิลด์

### ✅ มีประสิทธิภาพ:
1. **การเรียงลำดับ**: ตามหมวดหมู่แล้วชื่อ
2. **ฟิลเตอร์หลากหลาย**: ตามความต้องการ
3. **Pagination**: โหลดไวไม่ติด

### ✅ ข้อมูลแม่นยำ:
1. **ตรวจสอบการคืน**: ไม่แสดงของที่คืนแล้ว
2. **ชื่อปัจจุบัน**: ชื่ออุปกรณ์ล่าสุด
3. **แหล่งที่มา**: บอกที่มาของอุปกรณ์

## การทดสอบ

### 1. ทดสอบการแสดงอุปกรณ์ครบถ้วน:
1. เบิกอุปกรณ์ → ตรวจสอบแสดงในหน้า tracking
2. เพิ่มอุปกรณ์ใน dashboard → ตรวจสอบแสดงในหน้า tracking
3. คืนอุปกรณ์ → ตรวจสอบหายจากหน้า tracking

### 2. ทดสอบการแสดงผลตาราง:
1. ตรวจสอบ 1 แถว = 1 อุปกรณ์
2. ตรวจสอบการเรียงลำดับตามหมวดหมู่
3. ตรวจสอบข้อมูลครบถ้วนในแต่ละคอลัมน์

### 3. ทดสอบฟิลเตอร์:
1. ค้นหาด้วยชื่อผู้ใช้
2. ค้นหาด้วยชื่ออุปกรณ์
3. ฟิลเตอร์ด้วย User ID และ Item ID
4. ฟิลเตอร์ด้วยแผนก/สาขา

### 4. ทดสอบ Pagination:
1. ตรวจสอบแสดง 15 รายการต่อหน้า
2. ทดสอบการนำทางระหว่างหน้า

### 5. ทดสอบการอัปเดตชื่อ:
1. เปลี่ยนชื่ออุปกรณ์ในคลังสินค้า
2. รีเฟรชหน้า tracking
3. ตรวจสอบชื่อในตารางเปลี่ยนตาม

## สรุป

การปรับปรุงครั้งนี้ทำให้ระบบ Equipment Tracking:

1. **แสดงอุปกรณ์ครบถ้วน** จากทุกแหล่ง
2. **ไม่แสดงอุปกรณ์ที่คืนแล้ว** 
3. **แสดงในรูปแบบตาราง** ที่อ่านง่าย
4. **เรียงลำดับตามหมวดหมู่** และชื่ออุปกรณ์
5. **แสดงชื่ออุปกรณ์ปัจจุบัน** จาก inventory
6. **รองรับการค้นหาและฟิลเตอร์** ครบถ้วน
7. **มี Pagination** ที่เหมาะสม

ระบบนี้ช่วยให้ Admin ติดตามอุปกรณ์ได้ครบถ้วนและแม่นยำมากขึ้น!
