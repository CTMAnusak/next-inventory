import mongoose, { Document, Schema } from 'mongoose';

export interface IInventoryMaster extends Document {
  itemMasterId: string;          // 🆕 Reference to ItemMaster._id
  
  // สถิติรวม
  totalQuantity: number;        // จำนวนรวมทั้งหมด (admin_stock + user_owned)
  availableQuantity: number;    // จำนวนที่เหลือให้ยืม (admin_stock เท่านั้น)
  userOwnedQuantity: number;    // จำนวนที่ user ถือ (user_owned เท่านั้น)
  
  // สถิติตามสภาพอุปกรณ์ (มี/หาย)
  statusBreakdown: [{
    statusId: string;           // Reference to statusConfigs.id
    count: number;
  }];
  
  // สถิติตามสถานะอุปกรณ์ (ใช้งานได้/ชำรุด)
  conditionBreakdown: [{        // 🆕
    conditionId: string;        // Reference to conditionConfigs.id
    count: number;
  }];
  
  // Stock Management
  stockManagement: {
    adminDefinedStock: number;    // จำนวนที่ Admin กำหนดให้มีในคลัง
    userContributedCount: number; // จำนวนที่ User เพิ่มเข้ามา  
    currentlyAllocated: number;   // จำนวนที่ถูกเบิกจาก admin stock
    realAvailable: number;        // adminDefinedStock - currentlyAllocated
  };
  
  // Admin Stock Operations History
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
  itemMasterId: { 
    type: String, 
    required: true,
    unique: true,
    index: true
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
  
  // สถิติตามสภาพอุปกรณ์
  statusBreakdown: [{
    statusId: {
      type: String,
      required: true
    },
    count: {
      type: Number,
      min: 0,
      default: 0
    }
  }],
  
  // สถิติตามสถานะอุปกรณ์
  conditionBreakdown: [{
    conditionId: {
      type: String,
      required: true
    },
    count: {
      type: Number,
      min: 0,
      default: 0
    }
  }],
  
  // Stock Management
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
  
  // Admin Stock Operations History
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
    type: String
  }
}, {
  timestamps: true
});

// Indexes
InventoryMasterSchema.index({ itemMasterId: 1 }, { unique: true });
InventoryMasterSchema.index({ totalQuantity: 1 });
InventoryMasterSchema.index({ availableQuantity: 1 });
InventoryMasterSchema.index({ lastUpdated: -1 });

// Pre-save hook to calculate realAvailable
InventoryMasterSchema.pre('save', function(next) {
  if (this.stockManagement) {
    this.stockManagement.realAvailable = 
      this.stockManagement.adminDefinedStock - this.stockManagement.currentlyAllocated;
    
    // Ensure realAvailable is not negative
    if (this.stockManagement.realAvailable < 0) {
      this.stockManagement.realAvailable = 0;
    }
  }
  
  this.lastUpdated = new Date();
  next();
});

// Static methods
InventoryMasterSchema.statics.findByItemMaster = function(itemMasterId: string) {
  return this.findOne({ itemMasterId });
};

InventoryMasterSchema.statics.findAvailableItems = function() {
  return this.find({ 
    availableQuantity: { $gt: 0 } 
  }).sort({ lastUpdated: -1 });
};

InventoryMasterSchema.statics.updateSummary = async function(itemMasterId: string) {
  const InventoryItem = mongoose.model('InventoryItem');
  
  // คำนวณสถิติจาก InventoryItem
  const stats = await InventoryItem.aggregate([
    {
      $match: { 
        itemMasterId,
        deletedAt: { $exists: false } // Exclude soft-deleted items
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
          $push: '$statusId'
        },
        conditionBreakdown: {
          $push: '$conditionId'
        }
      }
    }
  ]);
  
  if (stats.length === 0) {
    // ไม่มี item แล้ว ลบ master record
    await this.deleteOne({ itemMasterId });
    return null;
  }
  
  const stat = stats[0];
  
  // คำนวณ breakdown
  const statusCounts: { [key: string]: number } = {};
  const conditionCounts: { [key: string]: number } = {};
  
  stat.statusBreakdown.forEach((statusId: string) => {
    statusCounts[statusId] = (statusCounts[statusId] || 0) + 1;
  });
  
  stat.conditionBreakdown.forEach((conditionId: string) => {
    conditionCounts[conditionId] = (conditionCounts[conditionId] || 0) + 1;
  });
  
  // อัปเดตหรือสร้าง master record
  return await this.findOneAndUpdate(
    { itemMasterId },
    {
      totalQuantity: stat.totalQuantity,
      availableQuantity: stat.availableQuantity,
      userOwnedQuantity: stat.userOwnedQuantity,
      statusBreakdown: Object.entries(statusCounts).map(([statusId, count]) => ({
        statusId,
        count
      })),
      conditionBreakdown: Object.entries(conditionCounts).map(([conditionId, count]) => ({
        conditionId,
        count
      })),
      lastUpdated: new Date()
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true
    }
  );
};

// Force recreation of model to ensure schema updates
if (mongoose.models.InventoryMaster) {
  delete mongoose.models.InventoryMaster;
}

const InventoryMaster = mongoose.model<IInventoryMaster>('InventoryMaster', InventoryMasterSchema);
export { InventoryMaster };
export default InventoryMaster;
