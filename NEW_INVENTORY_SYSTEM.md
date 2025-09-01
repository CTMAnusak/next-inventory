# ระบบ Inventory ใหม่ - Model Redesign

## 🎯 ภาพรวมการเปลี่ยนแปลง

ระบบได้รับการออกแบบใหม่ทั้งหมดเพื่อรองรับการจัดการอุปกรณ์ที่ซับซ้อนขึ้น โดยมีคุณสมบัติหลักดังนี้:

### ✨ คุณสมบัติใหม่

1. **Individual Item Tracking** - ติดตามอุปกรณ์แต่ละชิ้นแยกต่างหาก
2. **Ownership Management** - จัดการเจ้าของอุปกรณ์ (Admin Stock vs User Owned)
3. **Serial Number Management** - รองรับ SN แบบละเอียด
4. **Transfer Audit Trail** - ติดตามการเปลี่ยนมือทุกครั้ง
5. **Master Summary** - ภาพรวมสถิติแบบ real-time

## 🏗️ โครงสร้าง Models ใหม่

### 1. **InventoryItem** - อุปกรณ์แต่ละชิ้น

```typescript
interface IInventoryItem {
  itemName: string;
  category: string;
  serialNumber?: string;        // SN เฉพาะของชิ้นนี้
  status: 'active' | 'maintenance' | 'damaged' | 'retired';
  
  // Ownership ปัจจุบัน
  currentOwnership: {
    ownerType: 'admin_stock' | 'user_owned';
    userId?: string;            // มีเฉพาะ user_owned
    ownedSince: Date;
    assignedBy?: string;        // Admin ที่มอบหมาย
  };
  
  // ข้อมูลต้นกำเนิด
  sourceInfo: {
    addedBy: 'admin' | 'user';
    addedByUserId?: string;     // มีเฉพาะเมื่อ user เพิ่ม
    dateAdded: Date;
    initialOwnerType: 'admin_stock' | 'user_owned';
    acquisitionMethod: 'self_reported' | 'admin_purchased' | 'transferred';
    notes?: string;
  };
  
  // ข้อมูลการ transfer (ถ้ามี)
  transferInfo?: {
    transferredFrom: 'admin_stock' | 'user_owned';
    transferDate: Date;
    approvedBy: string;
    requestId?: string;
    returnId?: string;
  };
}
```

### 2. **InventoryMaster** - ภาพรวมสรุป

```typescript
interface IInventoryMaster {
  itemName: string;
  category: string;
  hasSerialNumber: boolean;
  
  // สถิติรวม
  totalQuantity: number;        // จำนวนรวมทั้งหมด
  availableQuantity: number;    // จำนวนที่เหลือให้ยืม (admin_stock)
  userOwnedQuantity: number;    // จำนวนที่ user ถือ (user_owned)
  
  // สถิติตามสถานะ
  statusBreakdown: {
    active: number;
    maintenance: number;
    damaged: number;
    retired: number;
  };
}
```

### 3. **TransferLog** - ประวัติการเปลี่ยนมือ

```typescript
interface ITransferLog {
  itemId: string;               // Reference to InventoryItem
  itemName: string;
  category: string;
  serialNumber?: string;
  
  transferType: 'user_report' | 'admin_add' | 'request_approved' | 'return_completed';
  
  fromOwnership: {
    ownerType: 'admin_stock' | 'user_owned' | 'new_item';
    userId?: string;
  };
  
  toOwnership: {
    ownerType: 'admin_stock' | 'user_owned';
    userId?: string;
  };
  
  transferDate: Date;
  processedBy?: string;         // Admin ที่ดำเนินการ
  requestId?: string;
  returnId?: string;
  reason?: string;
}
```

## 🔄 การทำงานของระบบใหม่

### **1. User แจ้งอุปกรณ์ที่มีอยู่**

```typescript
// สร้าง InventoryItem
const userItem = await createInventoryItem({
  itemName: "MacBook Pro",
  category: "คอมพิวเตอร์",
  serialNumber: "MB001",
  addedBy: "user",
  addedByUserId: "USER123",
  initialOwnerType: "user_owned",
  userId: "USER123"
});

// Result:
// - InventoryItem: ownerType = "user_owned", userId = "USER123"
// - InventoryMaster: userOwnedQuantity += 1
// - TransferLog: "user_report" entry
```

### **2. Admin เพิ่มอุปกรณ์เข้าคลัง**

```typescript
// สร้าง InventoryItem
const adminItem = await createInventoryItem({
  itemName: "MacBook Pro", 
  category: "คอมพิวเตอร์",
  serialNumber: "MB002",
  addedBy: "admin",
  initialOwnerType: "admin_stock"
});

// Result:
// - InventoryItem: ownerType = "admin_stock", userId = undefined
// - InventoryMaster: availableQuantity += 1
// - TransferLog: "admin_add" entry
```

### **3. User เบิกอุปกรณ์ (Request Approved)**

```typescript
// หาอุปกรณ์ว่าง
const availableItem = await findAvailableItems("MacBook Pro", "คอมพิวเตอร์", 1);

// โอนความเป็นเจ้าของ
await transferInventoryItem({
  itemId: availableItem[0]._id,
  fromOwnerType: "admin_stock",
  toOwnerType: "user_owned", 
  toUserId: "USER456",
  transferType: "request_approved",
  processedBy: "ADMIN001",
  requestId: "REQ123"
});

// Result:
// - InventoryItem: ownerType = "user_owned", userId = "USER456"
// - InventoryMaster: availableQuantity -= 1, userOwnedQuantity += 1
// - TransferLog: "request_approved" entry
```

### **4. User คืนอุปกรณ์ (Return Completed)**

```typescript
// หาอุปกรณ์ที่ user ถือ
const userItem = await InventoryItem.findOne({
  itemName: "MacBook Pro",
  serialNumber: "MB002",
  'currentOwnership.ownerType': 'user_owned',
  'currentOwnership.userId': 'USER456'
});

// โอนกลับเข้าคลัง
await transferInventoryItem({
  itemId: userItem._id,
  fromOwnerType: "user_owned",
  fromUserId: "USER456", 
  toOwnerType: "admin_stock",
  transferType: "return_completed",
  processedBy: "ADMIN001",
  returnId: "RET456"
});

// Result:
// - InventoryItem: ownerType = "admin_stock", userId = undefined
// - InventoryMaster: availableQuantity += 1, userOwnedQuantity -= 1
// - TransferLog: "return_completed" entry
```

## 📊 การแสดงผลในระบบ

### **Admin Dashboard - ภาพรวมคลัง**

```javascript
// Query InventoryMaster
const inventory = await InventoryMaster.find({});

// Display:
{
  itemName: "MacBook Pro",
  totalQuantity: 5,           // รวมทั้งหมด
  availableQuantity: 2,       // เหลือให้ยืม  
  userOwnedQuantity: 3,       // user ถืออยู่
  statusBreakdown: {
    active: 4,
    maintenance: 1,
    damaged: 0,
    retired: 0
  }
}
```

### **User Dashboard - อุปกรณ์ของฉัน**

```javascript
// Query InventoryItem ที่ user เป็นเจ้าของ
const myItems = await findUserOwnedItems("USER123");

// Display:
[
  {
    itemName: "MacBook Pro",
    serialNumber: "MB001",
    category: "คอมพิวเตอร์", 
    ownedSince: "2024-01-01",
    acquisitionMethod: "self_reported", // แจ้งเอง
    source: "อุปกรณ์ที่มีอยู่แล้ว"
  },
  {
    itemName: "Wireless Mouse",
    serialNumber: "MS002",
    category: "อุปกรณ์คอมพิวเตอร์",
    ownedSince: "2024-01-15", 
    acquisitionMethod: "transferred", // เบิกมา
    source: "เบิกจากคลัง",
    assignedBy: "ADMIN001"
  }
]
```

### **Admin Equipment Reports - เลือก SN**

```javascript
// หา SN ทั้งหมดที่ว่าง
const availableSerials = await findAvailableItems("MacBook Pro", "คอมพิวเตอร์");

// Display for selection:
[
  { itemId: "item1", serialNumber: "MB003", status: "active" },
  { itemId: "item2", serialNumber: "MB004", status: "active" },
  { itemId: "item3", serialNumber: null, status: "active" } // ไม่มี SN
]
```

## 🔧 Helper Functions

ระบบมี helper functions ที่ครอบคลุมการใช้งานทั่วไป:

- `createInventoryItem()` - สร้างอุปกรณ์ใหม่
- `transferInventoryItem()` - โอนความเป็นเจ้าของ
- `findAvailableItems()` - หาอุปกรณ์ว่าง
- `findUserOwnedItems()` - หาอุปกรณ์ของ user
- `findItemBySerialNumber()` - หาด้วย SN
- `changeItemStatus()` - เปลี่ยนสถานะ
- `getItemTransferHistory()` - ดูประวัติการเปลี่ยนมือ

## 📝 Migration Script

มี migration script สำหรับแปลงข้อมูลเดิม:

```bash
# Dry run เพื่อดูการเปลี่ยนแปลง
npx tsx src/scripts/migrate-to-new-inventory-system.ts --dry-run

# Run จริง
npx tsx src/scripts/migrate-to-new-inventory-system.ts
```

## ✅ ข้อดีของระบบใหม่

1. **ติดตาม Ownership แม่นยำ** - รู้ว่าของแต่ละชิ้นเป็นของใคร
2. **Serial Number Management** - จัดการ SN ได้แบบละเอียด
3. **Audit Trail ครบถ้วน** - ติดตามการเปลี่ยนแปลงทุกครั้ง
4. **Performance ดี** - ใช้ Master summary สำหรับ query ที่เร็ว
5. **Scalable** - รองรับการขยายฟีเจอร์ในอนาคต
6. **Data Integrity** - มี validation และ consistency checks

## 🚀 Next Steps

1. ทดสอบ migration script กับข้อมูลจริง
2. อัปเดต API endpoints ให้ใช้ models ใหม่
3. อัปเดต UI components ให้แสดงข้อมูลใหม่
4. เพิ่ม SN selection ใน Admin approval process
5. เพิ่มหน้า User transaction history

ระบบใหม่นี้พร้อมรองรับทุกกรณีการใช้งานที่คุยกันมา และสามารถขยายเพิ่มเติมได้ในอนาคต! 🎉
