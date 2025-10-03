# 🚀 Reference-based Inventory System Guide

## 📋 Overview

ระบบ Reference-based Inventory System เป็นการปรับปรุงระบบคลังอุปกรณ์ให้ใช้ **ObjectId References** แทนการเก็บชื่ออุปกรณ์เป็น String เพื่อให้:

- ✅ **Data Integrity** - ข้อมูลสอดคล้องกันเมื่อเปลี่ยนชื่อ
- ✅ **Performance** - Query เร็วขึ้นด้วย Index
- ✅ **Scalability** - รองรับข้อมูลจำนวนมาก
- ✅ **Maintainability** - ง่ายต่อการดูแลรักษา

## 🏗️ Architecture

### Database Models

#### 1. ItemMaster (Master Data)
```typescript
{
  _id: ObjectId,
  itemName: string,        // ชื่ออุปกรณ์ (unique)
  categoryId: string,      // Reference to InventoryConfig.categoryConfigs.id
  hasSerialNumber: boolean,
  isActive: boolean,
  createdBy: ObjectId,     // Reference to User
  createdAt: Date,
  updatedAt: Date
}
```

#### 2. InventoryItem (Individual Items)
```typescript
{
  _id: ObjectId,
  itemMasterId: ObjectId,  // Reference to ItemMaster
  serialNumber?: string,
  numberPhone?: string,    // For SIM cards
  statusId: string,        // Reference to InventoryConfig.statusConfigs.id
  conditionId: string,     // Reference to InventoryConfig.conditionConfigs.id
  currentOwnership: {
    ownerType: 'admin_stock' | 'user_owned',
    userId?: ObjectId,     // Reference to User
    ownedSince: Date,
    assignedBy?: ObjectId  // Admin User who assigned
  },
  sourceInfo: {
    addedBy: 'admin' | 'user',
    addedByUserId: ObjectId,
    dateAdded: Date,
    initialOwnerType: 'admin_stock' | 'user_owned',
    acquisitionMethod: 'self_reported' | 'admin_purchased' | 'transferred',
    notes?: string
  },
  transferInfo?: {
    transferredFrom: 'admin_stock' | 'user_owned',
    transferDate: Date,
    approvedBy: ObjectId,
    requestId?: ObjectId,
    returnId?: ObjectId
  },
  deletedAt?: Date,        // Soft delete
  deleteReason?: string,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3. InventoryMaster (Aggregated Statistics)
```typescript
{
  _id: ObjectId,
  itemMasterId: ObjectId,  // Reference to ItemMaster
  totalQuantity: number,
  availableQuantity: number,
  userOwnedQuantity: number,
  statusBreakdown: [{ statusId: string, count: number }],
  conditionBreakdown: [{ conditionId: string, count: number }],
  stockManagement: {
    adminDefinedStock: number,
    userContributedCount: number,
    currentlyAllocated: number,
    realAvailable: number
  },
  adminStockOperations: [...],
  lastUpdated: Date,
  lastUpdatedBy?: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 4. InventoryConfig (Configuration)
```typescript
{
  _id: ObjectId,
  categoryConfigs: [{
    id: string,
    name: string,
    isSpecial: boolean,
    isSystemCategory: boolean,
    order: number,
    createdAt: Date,
    updatedAt: Date
  }],
  statusConfigs: [{        // สภาพอุปกรณ์ (มี/หาย)
    id: string,
    name: string,
    color: string,
    order: number,
    isSystemConfig: boolean,
    createdAt: Date,
    updatedAt: Date
  }],
  conditionConfigs: [{     // สถานะอุปกรณ์ (ใช้งานได้/ชำรุด)
    id: string,
    name: string,
    color: string,
    order: number,
    isSystemConfig: boolean,
    createdAt: Date,
    updatedAt: Date
  }]
}
```

## 🔧 Configuration Management

### Default Configurations

#### Categories
```typescript
[
  { id: 'cat_unassigned', name: 'ไม่ระบุ', isSystemCategory: true },
  { id: 'cat_computer', name: 'คอมพิวเตอร์', isSystemCategory: false },
  { id: 'cat_network', name: 'เครือข่าย', isSystemCategory: false },
  { id: 'cat_phone', name: 'โทรศัพท์', isSystemCategory: false },
  { id: 'cat_sim', name: 'ซิมการ์ด', isSpecial: true, isSystemCategory: false }
]
```

#### Statuses (สภาพอุปกรณ์)
```typescript
[
  { id: 'status_available', name: 'มี', color: '#10B981', isSystemConfig: true },
  { id: 'status_missing', name: 'หาย', color: '#EF4444', isSystemConfig: true }
]
```

#### Conditions (สถานะอุปกรณ์)
```typescript
[
  { id: 'cond_working', name: 'ใช้งานได้', color: '#10B981', isSystemConfig: true },
  { id: 'cond_damaged', name: 'ชำรุด', color: '#F59E0B', isSystemConfig: true }
]
```

**หมายเหตุ:** ระบบมี default เพียง 2 สถานะอุปกรณ์เท่านั้น ไม่มี "เสีย" ในรายการ default

## 🌐 API Endpoints

### Configuration APIs
- `GET /api/admin/inventory-config` - Get all configurations
- `GET /api/admin/inventory-config/categories` - Get categories
- `POST /api/admin/inventory-config/categories` - Create category
- `PUT /api/admin/inventory-config/categories/[id]` - Update category
- `DELETE /api/admin/inventory-config/categories/[id]` - Delete category
- Similar endpoints for statuses and conditions

### ItemMaster APIs
- `GET /api/admin/item-masters` - List item masters
- `POST /api/admin/item-masters` - Create item master
- `GET /api/admin/item-masters/[id]` - Get item master
- `PUT /api/admin/item-masters/[id]` - Update item master
- `DELETE /api/admin/item-masters/[id]` - Delete item master

### Equipment Operations
- `GET /api/equipment-request/available` - Get available equipment
- `POST /api/equipment-request` - Request equipment
- `POST /api/equipment-return` - Return equipment
- `GET /api/user/owned-equipment` - Get user's owned equipment
- `POST /api/user/owned-equipment` - Add user's equipment

### Admin Approval
- `POST /api/admin/equipment-request/approve` - Approve request
- `PUT /api/admin/equipment-request/approve` - Reject request
- `POST /api/admin/equipment-return/approve` - Approve return
- `PUT /api/admin/equipment-return/approve` - Reject return

### Tracking
- `GET /api/admin/equipment-tracking` - Complete tracking system

## 🚀 Migration Process

### 1. Backup Data
```bash
npm run backup
```

### 2. Dry Run Migration
```bash
npm run migrate-reference-dry-run
```

### 3. Execute Migration
```bash
npm run migrate-reference-execute
```

### 4. Test System
```bash
npm run test-complete-system
```

### 5. Rollback (if needed)
```bash
npm run migrate-reference-rollback
```

## 📱 Frontend Integration

### Dashboard Component
ใช้ `DashboardNew.tsx` ที่รองรับ:
- ✅ เลือกหมวดหมู่ → แสดงรายการอุปกรณ์
- ✅ เพิ่มอุปกรณ์ใหม่ได้
- ✅ เลือกสภาพและสถานะอุปกรณ์
- ✅ รองรับ Serial Number และ Phone Number
- ✅ หมายเหตุ optional

### Key Features
- **Reference-based Data Loading** - ดึงข้อมูลจาก APIs ใหม่
- **Enhanced Forms** - รองรับการเลือก status/condition
- **Color-coded Display** - แสดงสีตาม configuration
- **Backward Compatibility** - ยังใช้ UI pattern เดิม

## 🔍 Helper Functions

### Core Functions
```typescript
// Create inventory item
createInventoryItem(params: CreateItemParams): Promise<InventoryItem>

// Transfer item between owners
transferInventoryItem(params: TransferItemParams): Promise<InventoryItem>

// Find available items for request
findAvailableItems(itemMasterId: string, quantity: number): Promise<InventoryItem[]>

// Update inventory master aggregation
updateInventoryMaster(itemMasterId: string): Promise<InventoryMaster>

// Change item status/condition
changeItemStatus(itemId: string, statusId: string, conditionId: string, changedBy: string, reason?: string): Promise<InventoryItem>

// Soft delete item
softDeleteInventoryItem(itemId: string, deletedBy: string, reason?: string): Promise<InventoryItem>
```

### Legacy Compatibility
```typescript
// Backward compatibility functions
createInventoryItemLegacy(params: any): Promise<InventoryItem>
updateInventoryMasterLegacy(itemName: string, categoryId: string): Promise<InventoryMaster>
```

## 🎯 Key Benefits

### 1. Data Integrity
- ✅ ชื่ออุปกรณ์เปลี่ยน → อัปเดตที่เดียว
- ✅ ไม่มีข้อมูลไม่สอดคล้องกัน
- ✅ Foreign Key constraints

### 2. Performance
- ✅ Index บน ObjectId references
- ✅ Query เร็วขึ้น
- ✅ Aggregation pipeline มีประสิทธิภาพ

### 3. Scalability
- ✅ รองรับข้อมูลจำนวนมาก
- ✅ Pagination support
- ✅ Efficient memory usage

### 4. Maintainability
- ✅ Code structure ชัดเจน
- ✅ Type safety ด้วย TypeScript
- ✅ Centralized configuration

## 🧪 Testing

### Test Scripts
```bash
# Test new system
npm run test-new-system

# Test complete system
npm run test-complete-system
```

### Test Coverage
- ✅ Configuration system
- ✅ ItemMaster management
- ✅ Inventory item creation
- ✅ Transfer operations
- ✅ Status management
- ✅ API endpoints

## 📊 Monitoring

### Key Metrics
- Total items by category
- Available vs user-owned quantities
- Status/condition breakdowns
- Transfer history
- User activity

### Admin Dashboard
- Real-time inventory status
- Equipment tracking
- Request/return management
- Configuration management

## 🔒 Security

### Access Control
- ✅ User authentication required
- ✅ Admin-only configuration changes
- ✅ User can only manage own items
- ✅ Audit trail for all changes

### Data Validation
- ✅ Serial number uniqueness
- ✅ Phone number uniqueness
- ✅ Reference validation
- ✅ Input sanitization

## 🎉 Conclusion

ระบบ Reference-based Inventory System ให้:
- **ความยืดหยุ่น** - ปรับแต่งได้ง่าย
- **ประสิทธิภาพ** - ทำงานเร็วและเสถียร
- **ความน่าเชื่อถือ** - ข้อมูลถูกต้องและสอดคล้อง
- **ความสะดวก** - ใช้งานง่ายและเข้าใจง่าย

พร้อมใช้งานจริงในสภาพแวดล้อม Production! 🚀
