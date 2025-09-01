# การแก้ไขปัญหาชื่ออุปกรณ์ไม่อัปเดตในรายงาน

## ภาพรวมปัญหา

เมื่อมีการเปลี่ยนชื่ออุปกรณ์ในคลังสินค้า (เช่น จาก "Mouse" เป็น "Mouse555") ชื่ออุปกรณ์ในหน้า "รายงานการเบิก/คืนอุปกรณ์" ยังคงแสดงชื่อเก่า ไม่ได้อัปเดตตามการเปลี่ยนแปลงในคลังสินค้า

## สาเหตุของปัญหา

1. **การบันทึกข้อมูลแบบ Static**: ระบบบันทึก `itemName` ไว้ใน `requestlogs` และ `returnlogs` collections ตอนที่เบิก/คืนอุปกรณ์
2. **การแสดงผลแบบ Static**: หน้า equipment reports แสดง `item.itemName` โดยตรงจากข้อมูลที่บันทึกไว้
3. **ไม่มีการ Sync**: ไม่มีการอัปเดตชื่ออุปกรณ์ในรายงานเมื่อมีการเปลี่ยนชื่อในคลังสินค้า

## การแก้ไขที่ทำ

### 1. ปรับปรุง Interface และ Model

#### RequestLog Interface:
```typescript
interface RequestLog {
  // ... other fields
  items: Array<{
    itemId: string;        // Primary reference to inventory
    itemName: string;      // Current name from inventory
    quantity: number;
    serialNumber?: string;
  }>;
}
```

#### ReturnLog Interface:
```typescript
interface ReturnLog {
  // ... other fields
  items: Array<{
    itemId: string;        // Primary reference to inventory
    itemName: string;      // Current name from inventory
    quantity: number;
    serialNumber?: string;
    assetNumber?: string;
    image?: string;
  }>;
}
```

### 2. เพิ่ม State สำหรับเก็บข้อมูล Inventory ปัจจุบัน

```typescript
// State for current inventory data
const [inventoryItems, setInventoryItems] = useState<{[key: string]: string}>({});
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

### 5. ปรับปรุงการแสดงผลในตาราง

#### Request Logs Table:
```typescript
<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
  {getCurrentItemName(item)}
</td>
```

#### Return Logs Table:
```typescript
<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
  {getCurrentItemName(item)}
</td>
```

### 6. ปรับปรุง Search Filter

```typescript
// Search filter
const matchesSearch = !searchTerm || 
  item.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
  item.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
  item.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
  item.items.some(equip => {
    const currentItemName = getCurrentItemName(equip);
    return currentItemName.toLowerCase().includes(searchTerm.toLowerCase());
  });
```

### 7. ปรับปรุงปุ่ม Refresh

```typescript
<button
  onClick={() => {
    fetchData();
    fetchInventoryData();
  }}
  disabled={loading}
  className="..."
>
  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
  <span>รีเฟรช</span>
</button>
```

## การทำงานของระบบใหม่

### 1. การโหลดข้อมูล:
1. `fetchData()` - โหลดข้อมูล request/return logs
2. `fetchInventoryData()` - โหลดข้อมูล inventory ปัจจุบัน
3. สร้าง map ของ `itemId` ไปยัง `itemName` ปัจจุบัน

### 2. การแสดงผล:
1. ใช้ `getCurrentItemName(item)` แทน `item.itemName`
2. ถ้ามี `itemId` และพบใน `inventoryItems` จะแสดงชื่อปัจจุบัน
3. ถ้าไม่พบจะ fallback ไปใช้ชื่อที่บันทึกไว้

### 3. การค้นหา:
1. ใช้ชื่ออุปกรณ์ปัจจุบันในการค้นหา
2. รองรับการค้นหาด้วยชื่อใหม่ที่อัปเดต

## ข้อดีของการแก้ไข

### ✅ ข้อดี:
1. **ชื่ออุปกรณ์ปัจจุบัน**: แสดงชื่ออุปกรณ์ล่าสุดที่อัปเดตในคลังสินค้า
2. **การค้นหาที่แม่นยำ**: สามารถค้นหาด้วยชื่อใหม่ได้
3. **ความสอดคล้อง**: รายงานแสดงข้อมูลที่ตรงกับคลังสินค้าปัจจุบัน
4. **Performance**: ใช้ map lookup แทนการ query database ทุกครั้ง

### ⚠️ ข้อควรระวัง:
1. **การ Refresh**: ต้องกดปุ่ม "รีเฟรช" เพื่ออัปเดตชื่ออุปกรณ์
2. **Fallback**: ถ้าไม่พบ `itemId` ใน inventory จะแสดงชื่อเก่า
3. **Data Consistency**: ข้อมูลใน `requestlogs` และ `returnlogs` ยังคงเป็นชื่อเก่า

## การทดสอบ

### 1. ทดสอบการเปลี่ยนชื่ออุปกรณ์:
1. ไปที่หน้า "จัดการคลังสินค้า"
2. เปลี่ยนชื่ออุปกรณ์ (เช่น จาก "Mouse" เป็น "Mouse555")
3. ไปที่หน้า "รายงานการเบิก/คืนอุปกรณ์"
4. กดปุ่ม "รีเฟรช"
5. ตรวจสอบว่าชื่ออุปกรณ์ในรายงานเปลี่ยนเป็นชื่อใหม่

### 2. ทดสอบการค้นหา:
1. ใช้ชื่ออุปกรณ์ใหม่ในการค้นหา
2. ตรวจสอบว่าสามารถค้นหาข้อมูลได้

### 3. ทดสอบการแสดงผล:
1. ตรวจสอบว่าชื่ออุปกรณ์ในตารางแสดงชื่อปัจจุบัน
2. ตรวจสอบว่าข้อมูลอื่นๆ ยังคงถูกต้อง

## สรุป

การแก้ไขนี้ทำให้ระบบสามารถแสดงชื่ออุปกรณ์ปัจจุบันได้แม้ว่าข้อมูลใน `requestlogs` และ `returnlogs` จะเป็นชื่อเก่า โดยใช้ `itemId` เป็น primary reference และ populate ชื่ออุปกรณ์จาก inventory ปัจจุบัน

ระบบจะทำงานดังนี้:
1. **บันทึกข้อมูล**: ใช้ `itemId` และ `itemName` ปัจจุบัน
2. **แสดงผล**: ใช้ชื่อจาก inventory ปัจจุบัน
3. **การค้นหา**: รองรับชื่อใหม่ที่อัปเดต
4. **การอัปเดต**: กดปุ่ม "รีเฟรช" เพื่ออัปเดตชื่ออุปกรณ์
