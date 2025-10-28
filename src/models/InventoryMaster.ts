import mongoose, { Document, Schema } from 'mongoose';

export interface IInventoryMaster extends Document {
  masterItemId: string;         // 🆕 อ้างอิง InventoryItem._id แรกที่สร้าง (เป็น master reference)
  itemName: string;             // ชื่ออุปกรณ์
  categoryId: string;           // หมวดหมู่
  relatedItemIds: string[];     // 🆕 รายการ InventoryItem._id ทั้งหมดที่เป็นกลุ่มเดียวกัน
  // hasSerialNumber removed - use itemDetails.withSerialNumber > 0 instead
  
  // รายละเอียดแต่ละชิ้น (เก็บทั้งจำนวนและ ID ของแต่ละรายการ)
  itemDetails: {
    withSerialNumber: {
      count: number;        // จำนวนที่มี Serial Number
      itemIds: string[];    // ID ของรายการที่มี SN
    };
    withPhoneNumber: {
      count: number;        // จำนวนที่มี Phone Number
      itemIds: string[];      // ID ของรายการที่มี Phone
    };
    other: {
      count: number;          // อุปกรณ์อื่นๆ ที่ไม่มีทั้ง SN และ Phone
      itemIds: string[];      // ID ของรายการอื่นๆ
    };
  };
  
  // สถิติรวม
  totalQuantity: number;        // จำนวนรวมทั้งหมด (admin_stock + user_owned)
  availableQuantity: number;    // จำนวนที่เหลือให้ยืม (admin_stock เท่านั้น)
  userOwnedQuantity: number;    // จำนวนที่ user ถือ (user_owned เท่านั้น)
  
  // 🆕 FIXED: สถิติตามสถานะ (รองรับ dynamic keys ตาม config)
  statusBreakdown: Record<string, number>; // เช่น { status_available: 2, status_missing: 1 }
  
  // 🆕 NEW: สถิติตามสภาพอุปกรณ์ (รองรับ dynamic keys ตาม config)
  conditionBreakdown: Record<string, number>; // เช่น { cond_working: 3, cond_damaged: 1 }
  
  // Stock Management - ใหม่
  stockManagement: {
    adminDefinedStock: number;    // จำนวนที่ Admin กำหนดให้มีในคลัง
    userContributedCount: number; // จำนวนที่ User เพิ่มเข้ามา  
    currentlyAllocated: number;   // จำนวนที่ถูกเบิกจาก admin stock
    realAvailable: number;        // adminDefinedStock - currentlyAllocated
  };
  
  // Admin Stock Operations History - ใหม่
  adminStockOperations: [{
    date: Date;
    adminId: string;
    adminName: string;
    operationType: 'set_stock' | 'adjust_stock' | 'initial_stock';
    previousStock: number;
    newStock: number;
    adjustmentAmount: number;
    reason: string;
  }];
  
  // ข้อมูลการอัปเดตล่าสุด
  lastUpdated: Date;
  lastUpdatedBy?: string;       // Admin ที่อัปเดตล่าสุด
  
  createdAt: Date;
  updatedAt: Date;
}

const InventoryMasterSchema = new Schema<IInventoryMaster>({
  masterItemId: { 
    type: String, 
    required: true,
    index: true
  },
  itemName: { 
    type: String, 
    required: true,
    index: true
  },
  categoryId: { 
    type: String, 
    required: true,
    index: true
  },
  relatedItemIds: [{
    type: String,
    required: true
  }],
  // hasSerialNumber field removed - use itemDetails.withSerialNumber > 0 instead
  
  // รายละเอียดแต่ละชิ้น (เก็บทั้งจำนวนและ ID ของแต่ละรายการ)
  itemDetails: {
    withSerialNumber: {
      count: {
        type: Number,
        min: 0,
        default: 0
      },
      itemIds: [{
        type: String,
        required: true
      }]
    },
    withPhoneNumber: {
      count: {
        type: Number,
        min: 0,
        default: 0
      },
      itemIds: [{
        type: String,
        required: true
      }]
    },
    other: {
      count: {
        type: Number,
        min: 0,
        default: 0
      },
      itemIds: [{
        type: String,
        required: true
      }]
    }
  },
  
  // สถิติรวม
  totalQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  availableQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  userOwnedQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  
  // 🆕 FIXED: สถิติตามสถานะ (ใช้ dynamic object รองรับ config)
  statusBreakdown: {
    type: Schema.Types.Mixed, // รองรับ dynamic keys เช่น { status_available: 2, status_missing: 1 }
    default: {}
  },
  
  // 🆕 NEW: สถิติตามสภาพอุปกรณ์ (ใช้ dynamic object รองรับ config)
  conditionBreakdown: {
    type: Schema.Types.Mixed, // รองรับ dynamic keys เช่น { cond_working: 3, cond_damaged: 1 }
    default: {}
  },
  
  // Stock Management - ใหม่
  stockManagement: {
    adminDefinedStock: {
      type: Number,
      min: 0,
      default: 0
    },
    userContributedCount: {
      type: Number,
      min: 0,
      default: 0
    },
    currentlyAllocated: {
      type: Number,
      min: 0,
      default: 0
    },
    realAvailable: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  
  // Admin Stock Operations History - ใหม่
  adminStockOperations: [{
    date: {
      type: Date,
      default: Date.now
    },
    adminId: {
      type: String,
      required: true
    },
    adminName: {
      type: String,
      required: true
    },
    operationType: {
      type: String,
      enum: ['set_stock', 'adjust_stock', 'initial_stock'],
      required: true
    },
    previousStock: {
      type: Number,
      min: 0
    },
    newStock: {
      type: Number,
      min: 0
    },
    adjustmentAmount: {
      type: Number
    },
    reason: {
      type: String,
      required: true
    }
  }],
  
  // ข้อมูลการอัปเดต
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  lastUpdatedBy: {
    type: String  // Admin user_id
  }
}, {
  timestamps: true
});

// Unique index สำหรับ itemName + categoryId
InventoryMasterSchema.index({ itemName: 1, categoryId: 1 }, { unique: true });

// Pre-save validation
InventoryMasterSchema.pre('save', function(next) {
  // 🔧 CRITICAL FIX: ลบ validation ที่บังคับให้ totalQuantity = availableQuantity + userOwnedQuantity
  // เพราะ totalQuantity ควรนับอุปกรณ์ทั้งหมด (รวมชำรุด/สูญหาย)
  // แต่ availableQuantity นับเฉพาะที่พร้อมเบิก (available + working)
  
  // ✅ NEW: Validation ที่ถูกต้อง - ตรวจสอบว่าค่าไม่ติดลบ
  if (this.totalQuantity < 0) {
    console.warn(`Invalid totalQuantity for ${this.itemName}: ${this.totalQuantity}`);
    this.totalQuantity = 0;
  }
  if (this.availableQuantity < 0) {
    console.warn(`Invalid availableQuantity for ${this.itemName}: ${this.availableQuantity}`);
    this.availableQuantity = 0;
  }
  if (this.userOwnedQuantity < 0) {
    console.warn(`Invalid userOwnedQuantity for ${this.itemName}: ${this.userOwnedQuantity}`);
    this.userOwnedQuantity = 0;
  }
  
  // Stock Management Auto-correction: realAvailable = adminDefinedStock - currentlyAllocated
  if (this.stockManagement) {
    this.stockManagement.realAvailable = Math.max(0, this.stockManagement.adminDefinedStock - this.stockManagement.currentlyAllocated);
  }
  
  // อัปเดต lastUpdated
  this.lastUpdated = new Date();
  
  next();
});

// Static methods สำหรับ common operations
InventoryMasterSchema.statics.updateSummary = async function(itemName: string, category: string) {
  const InventoryItem = mongoose.model('InventoryItems');
  
  // คำนวณสถิติจาก InventoryItem
  // 🔧 CRITICAL FIX: Exclude soft-deleted items from aggregation
  const stats = await InventoryItem.aggregate([
    {
      $match: { 
        itemName, 
        categoryId: category, // 🆕 FIXED: Use categoryId field
        deletedAt: { $exists: false } // 🆕 FIXED: Use proper soft delete check
      }
    },
    {
      $group: {
        _id: null,
        totalQuantity: { $sum: 1 },
        availableQuantity: {
          $sum: {
            $cond: [
              { $eq: ['$currentOwnership.ownerType', 'admin_stock'] },
              1, 0
            ]
          }
        },
        userOwnedQuantity: {
          $sum: {
            $cond: [
              { $eq: ['$currentOwnership.ownerType', 'user_owned'] },
              1, 0
            ]
          }
        },
        statusBreakdown: {
          $push: '$statusId' // 🆕 FIXED: Use statusId instead of status
        },
        conditionBreakdown: { // 🆕 NEW: Collect conditionId
          $push: '$conditionId'
        }
        // hasSerialNumber calculation removed - use itemDetails.withSerialNumber > 0 instead
      }
    }
  ]);
  
  if (stats.length === 0) {
    // ไม่มี item แล้ว ลบ master record
    await this.deleteOne({ itemName, categoryId: category });
    return null;
  }
  
  const stat = stats[0];
  
  // 🆕 FIXED: คำนวณ status breakdown แบบ dynamic
  const statusBreakdown: Record<string, number> = {};
  const conditionBreakdown: Record<string, number> = {};
  
  stat.statusBreakdown.forEach((status: string) => {
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
  });
  
  // เพิ่มการคำนวณ condition breakdown ถ้ามีข้อมูล
  if (stat.conditionBreakdown) {
    stat.conditionBreakdown.forEach((condition: string) => {
      conditionBreakdown[condition] = (conditionBreakdown[condition] || 0) + 1;
    });
  }
  
  // อัปเดตหรือสร้าง master record
  return await this.findOneAndUpdate(
    { itemName, categoryId: category },
    {
      itemName,
      categoryId: category,
      // hasSerialNumber removed - use itemDetails.withSerialNumber > 0 instead
      totalQuantity: stat.totalQuantity,
      availableQuantity: stat.availableQuantity,
      userOwnedQuantity: stat.userOwnedQuantity,
      statusBreakdown,
      conditionBreakdown, // 🆕 NEW: Include condition breakdown
      lastUpdated: new Date()
    },
    { 
      upsert: true, 
      new: true,
      runValidators: true
    }
  );
};

InventoryMasterSchema.statics.incrementQuantity = async function(
  itemName: string, 
  category: string, 
  ownerType: 'admin_stock' | 'user_owned',
  status: string = 'active',
  delta: number = 1
) {
  const updateFields: any = {
    $inc: {
      totalQuantity: delta,
      [`statusBreakdown.${status}`]: delta
    },
    $set: {
      lastUpdated: new Date()
    }
  };
  
  if (ownerType === 'admin_stock') {
    updateFields.$inc.availableQuantity = delta;
  } else {
    updateFields.$inc.userOwnedQuantity = delta;
  }
  
  return await this.findOneAndUpdate(
    { itemName, category },
    updateFields,
    { 
      upsert: true, 
      new: true,
      runValidators: true
    }
  );
};

// Static methods สำหรับ Admin Stock Management
InventoryMasterSchema.statics.setAdminStock = async function(itemName: string, category: string, newStock: number, reason: string, adminId: string, adminName: string) {
  const item = await this.findOne({ itemName, categoryId: category });
  if (!item) {
    throw new Error(`ไม่พบรายการ ${itemName} ในหมวดหมู่ ${category}`);
  }
  
  const previousStock = item.stockManagement?.adminDefinedStock || 0;
  
  // Initialize stockManagement if not exists
  if (!item.stockManagement) {
    item.stockManagement = {
      adminDefinedStock: 0,
      userContributedCount: 0,
      currentlyAllocated: 0,
      realAvailable: 0
    };
  }
  
  // Initialize adminStockOperations if not exists
  if (!item.adminStockOperations) {
    item.adminStockOperations = [];
  }
  
  // เพิ่ม operation ลงใน history
  item.adminStockOperations.push({
    date: new Date(),
    adminId,
    adminName,
    operationType: 'set_stock',
    previousStock,
    newStock,
    adjustmentAmount: newStock - previousStock,
    reason
  });
  
  // อัปเดต stock
  item.stockManagement.adminDefinedStock = newStock;
  item.lastUpdated = new Date();
  item.lastUpdatedBy = adminId;
  
  await item.save();
  return item;
};

InventoryMasterSchema.statics.adjustAdminStock = async function(itemName: string, category: string, adjustment: number, reason: string, adminId: string, adminName: string) {
  const item = await this.findOne({ itemName, categoryId: category });
  if (!item) {
    throw new Error(`ไม่พบรายการ ${itemName} ในหมวดหมู่ ${category}`);
  }
  
  // Initialize stockManagement if not exists
  if (!item.stockManagement) {
    item.stockManagement = {
      adminDefinedStock: 0,
      userContributedCount: 0,
      currentlyAllocated: 0,
      realAvailable: 0
    };
  }
  
  const previousStock = item.stockManagement.adminDefinedStock;
  const newStock = Math.max(0, previousStock + adjustment);
  
  // Initialize adminStockOperations if not exists
  if (!item.adminStockOperations) {
    item.adminStockOperations = [];
  }
  
  // เพิ่ม operation ลงใน history
  item.adminStockOperations.push({
    date: new Date(),
    adminId,
    adminName,
    operationType: 'adjust_stock',
    previousStock,
    newStock,
    adjustmentAmount: adjustment,
    reason
  });
  
  // อัปเดต stock
  item.stockManagement.adminDefinedStock = newStock;
  item.lastUpdated = new Date();
  item.lastUpdatedBy = adminId;
  
  await item.save();
  return item;
};

// Force recreation of model to ensure schema updates
if (mongoose.models.InventoryMasters) {
  delete mongoose.models.InventoryMasters;
}

export default mongoose.model<IInventoryMaster>('InventoryMasters', InventoryMasterSchema);
