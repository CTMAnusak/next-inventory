import mongoose, { Document, Schema } from 'mongoose';

export interface IInventoryItem extends Document {
  itemMasterId: string;         // 🆕 Reference to ItemMaster._id
  serialNumber?: string;        // SN เฉพาะของชิ้นนี้ (ถ้ามี)
  numberPhone?: string;         // เบอร์โทรศัพท์ (สำหรับอุปกรณ์หมวดหมู่ซิมการ์ด)
  statusId: string;            // Reference to statusConfigs.id (สภาพอุปกรณ์: มี/หาย)
  conditionId: string;         // 🆕 Reference to conditionConfigs.id (สถานะอุปกรณ์: ใช้งานได้/ชำรุด)
  
  // Ownership ปัจจุบัน
  currentOwnership: {
    ownerType: 'admin_stock' | 'user_owned';
    userId?: string;            // มีเฉพาะ user_owned
    ownedSince: Date;
    assignedBy?: string;        // Admin ที่มอบหมาย (สำหรับ tracking)
  };
  
  // ข้อมูลต้นกำเนิด
  sourceInfo: {
    addedBy: 'admin' | 'user';
    addedByUserId?: string;     // มีเฉพาะเมื่อ user เพิ่ม
    dateAdded: Date;
    initialOwnerType: 'admin_stock' | 'user_owned';
    acquisitionMethod: 'self_reported' | 'admin_purchased' | 'transferred';
    notes?: string;             // 🆕 Optional หมายเหตุ
  };
  
  // ข้อมูลการ transfer (ถ้ามี)
  transferInfo?: {
    transferredFrom: 'admin_stock' | 'user_owned';
    transferDate: Date;
    approvedBy: string;
    requestId?: string;         // Link ไป RequestLog
    returnId?: string;          // Link ไป ReturnLog
  };
  
  // ข้อมูลการลบ (soft delete)
  deletedAt?: Date;
  deleteReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema = new Schema<IInventoryItem>({
  itemMasterId: { 
    type: String, 
    required: true,
    index: true
  },
  serialNumber: { 
    type: String,
    sparse: true,
    trim: true
  },
  numberPhone: {
    type: String,
    sparse: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        if (!v) return true;
        return /^[0-9]{10}$/.test(v);
      },
      message: 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักเท่านั้น'
    }
  },
  statusId: { 
    type: String, 
    required: true,
    index: true,
    default: 'status_available'  // Default: มี
  },
  conditionId: {
    type: String,
    required: true,
    index: true,
    default: 'cond_working'  // Default: ใช้งานได้
  },
  
  // Ownership ปัจจุบัน
  currentOwnership: {
    ownerType: {
      type: String,
      enum: ['admin_stock', 'user_owned'],
      required: true,
      index: true
    },
    userId: {
      type: String,
      sparse: true,
      index: true
    },
    ownedSince: {
      type: Date,
      required: true,
      default: Date.now
    },
    assignedBy: {
      type: String,
      sparse: true
    }
  },
  
  // ข้อมูลต้นกำเนิด
  sourceInfo: {
    addedBy: {
      type: String,
      enum: ['admin', 'user'],
      required: true
    },
    addedByUserId: {
      type: String,
      sparse: true
    },
    dateAdded: {
      type: Date,
      required: true,
      default: Date.now
    },
    initialOwnerType: {
      type: String,
      enum: ['admin_stock', 'user_owned'],
      required: true
    },
    acquisitionMethod: {
      type: String,
      enum: ['self_reported', 'admin_purchased', 'transferred'],
      required: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  
  // ข้อมูลการ transfer
  transferInfo: {
    transferredFrom: {
      type: String,
      enum: ['admin_stock', 'user_owned']
    },
    transferDate: {
      type: Date
    },
    approvedBy: {
      type: String
    },
    requestId: {
      type: String
    },
    returnId: {
      type: String
    }
  },
  
  // ข้อมูลการลบ (soft delete)
  deletedAt: {
    type: Date
  },
  deleteReason: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes สำหรับ performance
InventoryItemSchema.index({ itemMasterId: 1 });
InventoryItemSchema.index({ 'currentOwnership.ownerType': 1, 'currentOwnership.userId': 1 });
InventoryItemSchema.index({ serialNumber: 1 }, { sparse: true });
InventoryItemSchema.index({ numberPhone: 1 }, { sparse: true });
InventoryItemSchema.index({ statusId: 1, conditionId: 1 });
InventoryItemSchema.index({ deletedAt: 1 }, { sparse: true });
InventoryItemSchema.index({ 'sourceInfo.addedBy': 1, 'sourceInfo.addedByUserId': 1 });

// Pre-save validation
InventoryItemSchema.pre('save', function(next) {
  // ตรวจสอบว่า user_owned ต้องมี userId
  if (this.currentOwnership.ownerType === 'user_owned' && !this.currentOwnership.userId) {
    return next(new Error('user_owned items must have userId'));
  }
  
  // ตรวจสอบว่า admin_stock ต้องไม่มี userId
  if (this.currentOwnership.ownerType === 'admin_stock' && this.currentOwnership.userId) {
    this.currentOwnership.userId = undefined;
  }
  
  // ตรวจสอบว่า user เพิ่มต้องมี addedByUserId
  if (this.sourceInfo.addedBy === 'user' && !this.sourceInfo.addedByUserId) {
    return next(new Error('User-added items must have addedByUserId'));
  }
  
  // ตรวจสอบว่า admin เพิ่มไม่ต้องมี addedByUserId (optional)
  if (this.sourceInfo.addedBy === 'admin' && !this.sourceInfo.addedByUserId) {
    this.sourceInfo.addedByUserId = undefined;
  }
  
  next();
});

// Static methods สำหรับ common queries
InventoryItemSchema.statics.findAvailableByMaster = function(itemMasterId: string) {
  return this.find({
    itemMasterId: itemMasterId,
    'currentOwnership.ownerType': 'admin_stock',
    statusId: 'status_available',  // มี
    conditionId: 'cond_working',   // ใช้งานได้
    deletedAt: { $exists: false }  // ไม่ถูกลบ
  });
};

InventoryItemSchema.statics.findUserOwned = function(userId: string) {
  return this.find({
    'currentOwnership.ownerType': 'user_owned',
    'currentOwnership.userId': userId,
    deletedAt: { $exists: false }  // ไม่ถูกลบ
  });
};

InventoryItemSchema.statics.findActiveItems = function() {
  return this.find({
    deletedAt: { $exists: false }
  });
};

InventoryItemSchema.statics.findByMasterAndStatus = function(itemMasterId: string, statusId: string, conditionId: string) {
  return this.find({
    itemMasterId,
    statusId,
    conditionId,
    deletedAt: { $exists: false }
  });
};

// Force recreation of model to ensure schema updates
if (mongoose.models.InventoryItem) {
  delete mongoose.models.InventoryItem;
}

const InventoryItem = mongoose.model<IInventoryItem>('InventoryItem', InventoryItemSchema);
export { InventoryItem };
export default InventoryItem;
