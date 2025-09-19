import mongoose, { Document, Schema } from 'mongoose';

export interface IInventoryMaster extends Document {
  itemName: string;
  categoryId: string;  // ใช้ ID แทน string เพื่อ relational integrity
  readonly category?: string;   // เก็บไว้ชั่วคราวสำหรับ backward compatibility (readonly)
  hasSerialNumber: boolean;     // บอกว่าประเภทนี้มี SN หรือไม่
  
  // สถิติรวม
  totalQuantity: number;        // จำนวนรวมทั้งหมด (admin_stock + user_owned)
  availableQuantity: number;    // จำนวนที่เหลือให้ยืม (admin_stock เท่านั้น)
  userOwnedQuantity: number;    // จำนวนที่ user ถือ (user_owned เท่านั้น)
  
  // สถิติตามสถานะ
  statusBreakdown: {
    active: number;
    maintenance: number;
    damaged: number;
    retired: number;
  };
  
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
  category: { 
    type: String, 
    required: false,  // Optional for backward compatibility
    index: true
  },
  hasSerialNumber: {
    type: Boolean,
    required: true,
    default: false
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
  
  // สถิติตามสถานะ
  statusBreakdown: {
    active: {
      type: Number,
      min: 0,
      default: 0
    },
    maintenance: {
      type: Number,
      min: 0,
      default: 0
    },
    damaged: {
      type: Number,
      min: 0,
      default: 0
    },
    retired: {
      type: Number,
      min: 0,
      default: 0
    }
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
InventoryMasterSchema.index({ itemName: 1, category: 1 }); // Keep for backward compatibility

// Pre-save validation
InventoryMasterSchema.pre('save', function(next) {
  // ตรวจสอบว่า totalQuantity = availableQuantity + userOwnedQuantity
  const calculatedTotal = this.availableQuantity + this.userOwnedQuantity;
  if (Math.abs(this.totalQuantity - calculatedTotal) > 0.01) {
    console.warn(`Total quantity mismatch for ${this.itemName}: ${this.totalQuantity} !== ${calculatedTotal}`);
    // Auto-correct
    this.totalQuantity = calculatedTotal;
  }
  
  // ตรวจสอบว่า statusBreakdown รวมกันต้องเท่ากับ totalQuantity
  const statusTotal = this.statusBreakdown.active + this.statusBreakdown.maintenance + 
                     this.statusBreakdown.damaged + this.statusBreakdown.retired;
  if (Math.abs(statusTotal - this.totalQuantity) > 0.01) {
    console.warn(`Status breakdown mismatch for ${this.itemName}: ${statusTotal} !== ${this.totalQuantity}`);
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
  const InventoryItem = mongoose.model('InventoryItem');
  
  // คำนวณสถิติจาก InventoryItem
  // 🔧 CRITICAL FIX: Exclude soft-deleted items from aggregation
  const stats = await InventoryItem.aggregate([
    {
      $match: { 
        itemName, 
        category,
        status: { $ne: 'deleted' } // ✅ Exclude soft-deleted items
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
          $push: '$status'
        },
        hasSerialNumber: {
          $max: {
            $cond: [
              { $ne: ['$serialNumber', null] },
              true, false
            ]
          }
        }
      }
    }
  ]);
  
  if (stats.length === 0) {
    // ไม่มี item แล้ว ลบ master record
    await this.deleteOne({ itemName, category });
    return null;
  }
  
  const stat = stats[0];
  
  // คำนวณ status breakdown
  const statusBreakdown = {
    active: 0,
    maintenance: 0,
    damaged: 0,
    retired: 0
  };
  
  stat.statusBreakdown.forEach((status: string) => {
    if (statusBreakdown.hasOwnProperty(status)) {
      statusBreakdown[status as keyof typeof statusBreakdown]++;
    }
  });
  
  // อัปเดตหรือสร้าง master record
  return await this.findOneAndUpdate(
    { itemName, category },
    {
      itemName,
      category,
      hasSerialNumber: stat.hasSerialNumber || false,
      totalQuantity: stat.totalQuantity,
      availableQuantity: stat.availableQuantity,
      userOwnedQuantity: stat.userOwnedQuantity,
      statusBreakdown,
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
  const item = await this.findOne({ itemName, category });
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
  const item = await this.findOne({ itemName, category });
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
if (mongoose.models.InventoryMaster) {
  delete mongoose.models.InventoryMaster;
}

export default mongoose.model<IInventoryMaster>('InventoryMaster', InventoryMasterSchema);
